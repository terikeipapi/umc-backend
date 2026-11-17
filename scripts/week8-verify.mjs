import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createConnection } from 'mysql2/promise';

try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const dbHost = process.env.DB_HOST || 'localhost';
if (!['localhost', '127.0.0.1', '::1'].includes(dbHost)) {
  throw new Error(
    'week8:verify cleanup requires a local development database.',
  );
}

const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
if (
  !['localhost', '127.0.0.1', '::1', '[::1]'].includes(
    new URL(baseUrl).hostname,
  )
) {
  throw new Error('week8:verify requires a local development server.');
}
const evidence = [];
const createdMembers = [];
const cleanup = { members: 0, favorites: 0, ratings: 0 };
const connection = await createConnection({
  host: dbHost,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
});

async function cleanCreatedMembers() {
  await connection.beginTransaction();
  try {
    for (const member of createdMembers) {
      const [matching] = await connection.execute(
        'SELECT member_id FROM member WHERE member_id = ? AND email = ? FOR UPDATE',
        [member.memberId, member.email],
      );
      assert.equal(
        matching.length,
        1,
        'Cleanup member ID and generated email must match',
      );
      for (const table of ['favorite', 'rating']) {
        const [deleted] = await connection.execute(
          `DELETE FROM ${table} WHERE member_id = ?`,
          [member.memberId],
        );
        cleanup[table === 'favorite' ? 'favorites' : 'ratings'] +=
          deleted.affectedRows;
      }
      const [deleted] = await connection.execute(
        'DELETE FROM member WHERE member_id = ? AND email = ?',
        [member.memberId, member.email],
      );
      assert.equal(deleted.affectedRows, 1);
      cleanup.members += deleted.affectedRows;
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

async function call(name, method, path, status, token, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10_000),
  });
  const json = await response.json();
  evidence.push({
    name,
    method,
    path,
    status: response.status,
    code: json.code,
  });
  assert.equal(response.status, status, `${name}: ${JSON.stringify(json)}`);
  assert.equal(json.isSuccess, status < 400);
  return json.result;
}

async function createAccount() {
  const id = randomBytes(5).toString('hex');
  const account = {
    email: `week8-${id}@example.com`,
    password: `Week8!${randomBytes(8).toString('hex')}`,
    nickname: `w8${id}`,
  };
  const member = await call(
    'Create isolated verification member',
    'POST',
    '/members',
    201,
    undefined,
    account,
  );
  createdMembers.push({ memberId: member.memberId, email: account.email });
  const login = await call(
    'Log in verification member',
    'POST',
    '/auth/login',
    200,
    undefined,
    { email: account.email, password: account.password },
  );
  return { memberId: member.memberId, token: login.accessToken };
}

try {
  for (const [method, path] of [
    ['GET', '/favorites'],
    ['GET', '/favorites/550'],
    ['POST', '/favorites'],
    ['DELETE', '/favorites/550'],
  ]) {
    await call(
      'Reject unauthenticated favorites request',
      method,
      path,
      401,
      undefined,
      method === 'POST' ? { movieId: 550 } : undefined,
    );
  }
  const owner = await createAccount();
  const other = await createAccount();
  await call(
    'Read authenticated profile',
    'GET',
    '/members/me',
    200,
    owner.token,
  );
  assert.deepEqual(
    await call(
      'Initial favorites empty',
      'GET',
      '/favorites',
      200,
      owner.token,
    ),
    [],
  );
  assert.deepEqual(
    await call(
      'Initial status false',
      'GET',
      '/favorites/550',
      200,
      owner.token,
    ),
    { movieId: 550, isFavorite: false },
  );
  for (let index = 0; index < 2; index++) {
    assert.deepEqual(
      await call(
        'Idempotent favorite add',
        'POST',
        '/favorites',
        201,
        owner.token,
        { movieId: 550 },
      ),
      { movieId: 550, isFavorite: true },
    );
  }
  assert.deepEqual(
    await call(
      'List has one favorite after repeated add',
      'GET',
      '/favorites',
      200,
      owner.token,
    ),
    [{ movieId: 550 }],
  );
  assert.equal(
    (
      await call(
        'Status true after add',
        'GET',
        '/favorites/550',
        200,
        owner.token,
      )
    ).isFavorite,
    true,
  );
  assert.deepEqual(
    await call(
      'Other account favorites remain empty',
      'GET',
      '/favorites',
      200,
      other.token,
    ),
    [],
  );
  assert.equal(
    (
      await call(
        'Other account status remains false',
        'GET',
        '/favorites/550',
        200,
        other.token,
      )
    ).isFavorite,
    false,
  );
  await call(
    'Other account delete cannot remove owner favorite',
    'DELETE',
    '/favorites/550',
    200,
    other.token,
  );
  assert.equal(
    (
      await call(
        'Owner favorite survives other-account delete',
        'GET',
        '/favorites/550',
        200,
        owner.token,
      )
    ).isFavorite,
    true,
  );
  await Promise.all(
    [0, 1].map(() =>
      call(
        'Concurrent duplicate favorite add',
        'POST',
        '/favorites',
        201,
        owner.token,
        { movieId: 550 },
      ),
    ),
  );
  assert.deepEqual(
    await call(
      'Unique pair survives concurrent adds',
      'GET',
      '/favorites',
      200,
      owner.token,
    ),
    [{ movieId: 550 }],
  );
  for (let index = 0; index < 2; index++) {
    assert.equal(
      await call(
        'Idempotent favorite removal',
        'DELETE',
        '/favorites/550',
        200,
        owner.token,
      ),
      null,
    );
  }
  assert.deepEqual(
    await call(
      'Favorites empty after removal',
      'GET',
      '/favorites',
      200,
      owner.token,
    ),
    [],
  );

  assert.deepEqual(
    await call(
      'Initial member ratings empty',
      'GET',
      `/members/${owner.memberId}/ratings`,
      200,
      owner.token,
    ),
    [],
  );
  const rating = await call(
    'Create rating',
    'POST',
    '/ratings',
    201,
    owner.token,
    { movieId: 550, score: 5, comment: 'Week 8 verification' },
  );
  assert.equal(rating.memberId, owner.memberId);
  await call(
    'Prevent other account rating update',
    'PATCH',
    `/ratings/${rating.ratingId}`,
    403,
    other.token,
    { score: 1 },
  );
  await call(
    'Prevent other account rating deletion',
    'DELETE',
    `/ratings/${rating.ratingId}`,
    403,
    other.token,
  );
  assert.equal(
    (
      await call(
        'Read created member rating',
        'GET',
        `/members/${owner.memberId}/ratings`,
        200,
        owner.token,
      )
    )[0].score,
    5,
  );
  assert.equal(
    (
      await call(
        'Update owned rating',
        'PATCH',
        `/ratings/${rating.ratingId}`,
        200,
        owner.token,
        { score: 3, comment: 'Updated verification' },
      )
    ).score,
    3,
  );
  assert.equal(
    await call(
      'Delete owned rating',
      'DELETE',
      `/ratings/${rating.ratingId}`,
      200,
      owner.token,
    ),
    null,
  );
  assert.deepEqual(
    await call(
      'Ratings empty after deletion',
      'GET',
      `/members/${owner.memberId}/ratings`,
      200,
      owner.token,
    ),
    [],
  );
} finally {
  await cleanCreatedMembers();
}

await mkdir('output/week8', { recursive: true });
await writeFile(
  'output/week8/api-verification.json',
  `${JSON.stringify(
    {
      verifiedAt: new Date().toISOString(),
      requests: evidence.length,
      allPassed: true,
      note: 'Real local HTTP + MySQL; created verification members were removed with exact member ID and generated email matching. Credentials and tokens are excluded.',
      cleanup,
      evidence,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `Week 8 live API verification passed: ${evidence.length} requests. Evidence: output/week8/api-verification.json`,
);
