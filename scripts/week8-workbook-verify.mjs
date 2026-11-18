import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createConnection } from 'mysql2/promise';
import { DataSource } from 'typeorm';

try { process.loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const localHosts = ['localhost', '127.0.0.1', '::1', '[::1]'];
const host = process.env.DB_HOST || 'localhost';
const baseUrl = process.env.WEEK8_WORKBOOK_BASE_URL || 'http://localhost:3000';
if (!localHosts.includes(host) || !localHosts.includes(new URL(baseUrl).hostname)) {
  throw new Error('Workbook verification requires a local development server and database.');
}
if (!process.env.DB_NAME) throw new Error('Set DB_NAME in the local .env first.');

const dbOptions = {
  host,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  timezone: 'Z',
};
const connection = await createConnection(dbOptions);
const createdMembers = [];
const evidence = [];
const databaseChecks = [];
const cleanup = { members: 0, favorites: 0, ratings: 0 };
const startedAt = new Date().toISOString();

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    /^(password|accessToken|refreshToken|authorization)$/i.test(key) ? '[REDACTED]' : redact(item),
  ]));
}

async function request(name, method, path, token, body) {
  const headers = { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) };
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000),
  });
  const json = await response.json();
  evidence.push({
    id: String(evidence.length + 1).padStart(2, '0'), name, verifiedAt: new Date().toISOString(),
    request: { method, path, headers: redact(headers), ...(body !== undefined ? { body: redact(body) } : {}) },
    response: { status: response.status, body: redact(json) },
  });
  return { status: response.status, json };
}

async function call(name, method, path, status, code, token, body) {
  const result = await request(name, method, path, token, body);
  assert.equal(result.status, status, `${name}: ${JSON.stringify(redact(result.json))}`);
  assert.equal(result.json.code, code, `${name}: response code`);
  assert.equal(result.json.isSuccess, status < 400, `${name}: success flag`);
  assert.equal(typeof result.json.message, 'string');
  return result.json.result;
}

async function account(suffix) {
  const tag = randomBytes(5).toString('hex');
  const input = { email: `workbook8-${tag}-${suffix}@example.com`, nickname: `w${suffix}${tag}`, password: `Workbook8!${randomBytes(8).toString('hex')}` };
  const member = await call(`Prepare member ${suffix}: signup`, 'POST', '/members', 201, 'COMMON201', undefined, input);
  createdMembers.push({ memberId: member.memberId, email: input.email });
  const login = await call(`Prepare member ${suffix}: login`, 'POST', '/auth/login', 200, 'COMMON200', undefined, { email: input.email, password: input.password });
  assert.equal(typeof login.accessToken, 'string');
  return { memberId: member.memberId, token: login.accessToken };
}

function checkFavorite(value, movieId) {
  assert.equal(value.movieId, movieId);
  assert.ok(Number.isSafeInteger(value.favoriteId) && value.favoriteId > 0);
  assert.ok(Number.isFinite(Date.parse(value.createdAt)));
  assert.ok(Date.parse(value.createdAt) <= Date.now() + 60_000, 'New favorite createdAt must not be a local timestamp incorrectly labeled UTC.');
  assert.ok(Date.parse(value.createdAt) >= Date.parse(startedAt) - 60_000, 'New favorite createdAt must match the current UTC instant.');
  assert.deepEqual(Object.keys(value).sort(), ['createdAt', 'favoriteId', 'movieId']);
}

async function counts(memberId, movieId) {
  const [rating] = await connection.execute('SELECT COUNT(*) AS count FROM rating WHERE member_id = ? AND movie_id = ?', [memberId, movieId]);
  const [favorite] = await connection.execute('SELECT COUNT(*) AS count FROM favorite WHERE member_id = ? AND movie_id = ?', [memberId, movieId]);
  return { rating: Number(rating[0].count), favorite: Number(favorite[0].count) };
}

async function checkCounts(name, memberId, movieId, expected) {
  const actual = await counts(memberId, movieId);
  assert.deepEqual(actual, expected, name);
  databaseChecks.push({ name, memberId, movieId, actual, expected, passed: true });
}

async function verifyRealRollback(memberId) {
  const [{ MovieRecordService }, { Member }, { Rating }, { Favorite }] = await Promise.all([
    import('../dist/movie/movie-record.service.js'),
    import('../dist/movie/entities/member.entity.js'),
    import('../dist/movie/entities/rating.entity.js'),
    import('../dist/movie/entities/favorite.entity.js'),
  ]);
  const source = new DataSource({
    type: 'mysql', ...dbOptions, username: dbOptions.user, entities: [Member, Rating, Favorite],
    synchronize: false, migrationsRun: false, dropSchema: false,
  });
  await source.initialize();
  const movieId = 901000008;
  await checkCounts('Rollback probe starts with no rows', memberId, movieId, { rating: 0, favorite: 0 });
  let ratingVisibleBeforeFailure = false;
  let favoriteSaveAttempted = false;
  const transactionSource = {
    transaction: (work) => source.transaction(async (manager) => {
      const getRepository = manager.getRepository.bind(manager);
      manager.getRepository = (entity) => {
        const repository = getRepository(entity);
        if (entity !== Favorite) return repository;
        return new Proxy(repository, {
          get(target, key) {
            if (key === 'save') return async () => {
              favoriteSaveAttempted = true;
              ratingVisibleBeforeFailure = (await getRepository(Rating).count({ where: { member: { memberId }, movieId } })) === 1;
              assert.equal(ratingVisibleBeforeFailure, true, 'The first real INSERT must exist inside this transaction before the forced second-write failure.');
              throw new Error('WORKBOOK_SECOND_SAVE_FAILURE');
            };
            const value = Reflect.get(target, key);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      };
      return work(manager);
    }),
  };
  try {
    const service = new MovieRecordService(transactionSource);
    await assert.rejects(service.create(memberId, { movieId, score: 5, comment: 'Real rollback verification', addToFavorites: true }), /WORKBOOK_SECOND_SAVE_FAILURE/);
    assert.equal(favoriteSaveAttempted, true);
    assert.equal(ratingVisibleBeforeFailure, true);
    await checkCounts('Second save fails: earlier real rating INSERT is rolled back', memberId, movieId, { rating: 0, favorite: 0 });
    databaseChecks.push({ name: 'Actual TypeORM transaction rollback after successful first INSERT', method: 'Service + real local TypeORM DataSource; isolated per-transaction Favorite.save rejection, no production failure endpoint or database trigger', ratingVisibleBeforeFailure, favoriteSaveAttempted, passed: true });
  } finally { await source.destroy(); }
}

async function cleanupMembers() {
  await connection.beginTransaction();
  try {
    for (const member of createdMembers) {
      const [matching] = await connection.execute('SELECT member_id FROM member WHERE member_id = ? AND email = ? FOR UPDATE', [member.memberId, member.email]);
      assert.equal(matching.length, 1, 'Cleanup requires both the exact generated member ID and email.');
      for (const table of ['favorite', 'rating']) {
        const [result] = await connection.execute(`DELETE FROM ${table} WHERE member_id = ?`, [member.memberId]);
        cleanup[table === 'favorite' ? 'favorites' : 'ratings'] += result.affectedRows;
      }
      const [result] = await connection.execute('DELETE FROM member WHERE member_id = ? AND email = ?', [member.memberId, member.email]);
      assert.equal(result.affectedRows, 1);
      cleanup.members += result.affectedRows;
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { await connection.end(); }
}

try {
  for (const [method, path, body] of [
    ['POST', '/favorites', { movieId: 550 }], ['GET', '/favorites'], ['GET', '/favorites/550'], ['DELETE', '/favorites/550'],
    ['POST', '/movie-records', { movieId: 238, score: 5, addToFavorites: true }],
  ]) await call('Reject unauthenticated workbook API', method, path, 401, 'AUTH401_2', undefined, body);

  const owner = await account('a');
  const other = await account('b');
  assert.deepEqual(await call('Initial favorites are an empty array', 'GET', '/favorites', 200, 'COMMON200', owner.token), []);
  assert.deepEqual(await call('Unregistered movie status is false', 'GET', '/favorites/550', 200, 'COMMON200', owner.token), { isFavorite: false });
  checkFavorite(await call('Register a favorite', 'POST', '/favorites', 201, 'COMMON201', owner.token, { movieId: 550 }), 550);
  await call('Duplicate favorite is a service conflict', 'POST', '/favorites', 409, 'FAVORITE409_1', owner.token, { movieId: 550 });
  const list = await call('List contains the registered favorite', 'GET', '/favorites', 200, 'COMMON200', owner.token);
  assert.equal(list.length, 1); checkFavorite(list[0], 550);
  assert.deepEqual(await call('Registered movie status is true', 'GET', '/favorites/550', 200, 'COMMON200', owner.token), { isFavorite: true });
  assert.deepEqual(await call('Other member has an independent empty list', 'GET', '/favorites', 200, 'COMMON200', other.token), []);
  assert.deepEqual(await call('Other member status is false', 'GET', '/favorites/550', 200, 'COMMON200', other.token), { isFavorite: false });
  await call('Other member cannot delete the owner favorite', 'DELETE', '/favorites/550', 404, 'FAVORITE404_1', other.token);
  assert.deepEqual(await call('Owner relation remains after other member delete', 'GET', '/favorites/550', 200, 'COMMON200', owner.token), { isFavorite: true });
  checkFavorite(await call('Different members may favorite the same movie', 'POST', '/favorites', 201, 'COMMON201', other.token, { movieId: 550 }), 550);
  checkFavorite(await call('Register a newer favorite', 'POST', '/favorites', 201, 'COMMON201', owner.token, { movieId: 238 }), 238);
  const ordered = await call('Favorites are sorted by newest registration', 'GET', '/favorites', 200, 'COMMON200', owner.token);
  assert.deepEqual(ordered.map((item) => item.movieId), [238, 550]);
  assert.ok(ordered[0].favoriteId > ordered[1].favoriteId);
  assert.equal(await call('Remove a favorite with the common response', 'DELETE', '/favorites/550', 200, 'COMMON200', owner.token), null);
  assert.deepEqual(await call('Removed movie status becomes false', 'GET', '/favorites/550', 200, 'COMMON200', owner.token), { isFavorite: false });
  await call('Removing a nonexistent relation is 404', 'DELETE', '/favorites/550', 404, 'FAVORITE404_1', owner.token);
  await call('Reject movie ID zero', 'POST', '/favorites', 400, 'COMMON4001', owner.token, { movieId: 0 });
  await call('Reject a body-supplied member ID', 'POST', '/favorites', 400, 'COMMON4001', owner.token, { movieId: 13, memberId: other.memberId });

  const races = await Promise.all([0, 1].map(() => request('Concurrent favorite registration preserves the unique pair', 'POST', '/favorites', owner.token, { movieId: 680 })));
  assert.deepEqual(races.map((item) => item.status).sort(), [201, 409]);
  assert.equal(races.find((item) => item.status === 409).json.code, 'FAVORITE409_1');
  await checkCounts('Concurrent duplicate requests produce one favorite', owner.memberId, 680, { rating: 0, favorite: 1 });

  const record = await call('Save a rating and favorite in one movie record', 'POST', '/movie-records', 201, 'COMMON201', owner.token, { movieId: 603, score: 5, comment: '다시 보고 싶은 영화입니다.', addToFavorites: true });
  assert.equal(record.rating.movieId, 603); assert.equal(record.rating.score, 5);
  assert.ok(Number.isSafeInteger(record.rating.ratingId)); checkFavorite(record.favorite, 603);
  await checkCounts('Successful true movie record commits both rows', owner.memberId, 603, { rating: 1, favorite: 1 });
  await call('Duplicate movie record uses the existing rating conflict code', 'POST', '/movie-records', 409, 'RATING409_1', owner.token, { movieId: 603, score: 3, addToFavorites: true });
  await checkCounts('Duplicate movie record adds no rows', owner.memberId, 603, { rating: 1, favorite: 1 });
  const ratingOnly = await call('False addToFavorites saves only the rating', 'POST', '/movie-records', 201, 'COMMON201', owner.token, { movieId: 13, score: 4, addToFavorites: false });
  assert.equal(ratingOnly.favorite, null); assert.equal(ratingOnly.rating.movieId, 13);
  await checkCounts('False movie record commits one rating and no favorite', owner.memberId, 13, { rating: 1, favorite: 0 });
  await call('Existing favorite stops the composite request', 'POST', '/movie-records', 409, 'FAVORITE409_1', owner.token, { movieId: 238, score: 5, addToFavorites: true });
  await checkCounts('Preexisting favorite conflict leaves no new rating', owner.memberId, 238, { rating: 0, favorite: 1 });
  const existingFavoriteRatingOnly = await call('False flag permits rating when a favorite already exists', 'POST', '/movie-records', 201, 'COMMON201', owner.token, { movieId: 238, score: 4, addToFavorites: false });
  assert.equal(existingFavoriteRatingOnly.favorite, null);
  await checkCounts('False flag preserves the existing favorite', owner.memberId, 238, { rating: 1, favorite: 1 });
  for (const [name, patch] of [
    ['Reject record movie ID zero', { movieId: 0 }], ['Reject out-of-range score', { score: 6 }],
    ['Reject string boolean', { addToFavorites: 'true' }], ['Reject null boolean', { addToFavorites: null }],
    ['Reject overlong comment', { comment: '가'.repeat(501) }], ['Reject record owner field', { memberId: other.memberId }],
  ]) await call(name, 'POST', '/movie-records', 400, 'COMMON4001', owner.token, { movieId: 999, score: 5, addToFavorites: true, ...patch });

  await verifyRealRollback(owner.memberId);
} finally { await cleanupMembers(); }

await mkdir('output/week8-workbook', { recursive: true });
await writeFile('output/week8-workbook/evidence.json', `${JSON.stringify({
  startedAt, completedAt: new Date().toISOString(), baseUrl, httpRequests: evidence.length, allPassed: true,
  verification: 'Actual local HTTP + MySQL. Rollback probe separately calls the production service with a real isolated TypeORM transaction and an injected second-save failure.',
  redaction: 'Passwords, access tokens and Authorization values are redacted. Test members are cleaned using the exact generated IDs and emails.',
  cleanup, databaseChecks, evidence,
}, null, 2)}\n`);
console.log(`Week 8 workbook verified: ${evidence.length} actual HTTP requests, ${databaseChecks.length} database checks; exact test-member cleanup completed.`);
