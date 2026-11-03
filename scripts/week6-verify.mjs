import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createConnection } from 'mysql2/promise';
import bcrypt from 'bcrypt';

try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const baseUrl =
  process.env.WEEK6_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname)) {
  throw new Error('Verification requires a local development API.');
}
if (
  !['localhost', '127.0.0.1', '::1'].includes(
    process.env.DB_HOST || 'localhost',
  )
) {
  throw new Error('Verification requires a local development DB.');
}
const output = new URL('../output/week6/', import.meta.url);
await mkdir(output, { recursive: true });
const tag = Date.now().toString(36).slice(-7);
const password = 'Umc!1234';
const member = {
  email: `week6-${tag}@example.com`,
  password,
  nickname: `w6${tag}a`,
};
const other = {
  email: `week6-${tag}-other@example.com`,
  password,
  nickname: `w6${tag}b`,
};
const report = {
  runAt: new Date().toISOString(),
  runAtSeoul: new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date()),
  baseUrl,
  source:
    'Real HTTP requests to the compiled NestJS app and real local MySQL queries.',
  runTag: tag,
  requests: [],
  database: {},
};

async function call(id, title, method, path, body, expected, expectedCode) {
  const started = performance.now();
  const response = await fetch(baseUrl + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  const parsed = raw ? JSON.parse(raw) : null;
  const entry = {
    id,
    title,
    at: new Date().toISOString(),
    request: {
      method,
      path,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body ?? null,
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      body: parsed,
      raw,
    },
    elapsedMs: Math.round(performance.now() - started),
    passed: false,
  };
  report.requests.push(entry);
  assert.ok(
    (Array.isArray(expected) ? expected : [expected]).includes(response.status),
    `${id}: unexpected HTTP status ${response.status}; ${raw}`,
  );
  if (response.status === 204)
    assert.equal(raw, '', 'DELETE must have no response body');
  else {
    assert.deepEqual(Object.keys(parsed).sort(), [
      'code',
      'isSuccess',
      'message',
      'result',
    ]);
    assert.equal(parsed.isSuccess, response.status < 400);
    if (expectedCode) assert.equal(parsed.code, expectedCode);
    assert.equal(
      raw.includes('"password"'),
      false,
      'Password must not be exposed',
    );
    if (response.status >= 400) assert.equal(parsed.result, null);
  }
  entry.passed = true;
  return parsed;
}

let connection;
try {
  connection = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });
  const first = await call(
    '01-signup-success',
    '회원가입 성공',
    'POST',
    '/members',
    member,
    201,
    'COMMON201',
  );
  const memberId = first.result.memberId;
  report.memberId = memberId;
  assert.deepEqual(Object.keys(first.result).sort(), [
    'email',
    'memberId',
    'nickname',
  ]);
  await call(
    '02-validation-failure',
    '이메일 형식 검증 실패',
    'POST',
    '/members',
    { ...member, email: 'invalid-email' },
    400,
    'COMMON4001',
  );
  await call(
    '03-weak-password',
    '비밀번호 조합 검증 실패',
    'POST',
    '/members',
    { ...member, password: 'password123' },
    400,
    'COMMON4001',
  );
  await call(
    '04-invalid-nickname',
    '닉네임 길이 검증 실패',
    'POST',
    '/members',
    { ...member, nickname: 'a' },
    400,
    'COMMON4001',
  );
  await call(
    '05-duplicate-email',
    '이메일 중복 차단',
    'POST',
    '/members',
    { ...member, nickname: `e${tag}` },
    409,
    'MEMBER4091',
  );
  await call(
    '06-duplicate-nickname',
    '닉네임 중복 차단',
    'POST',
    '/members',
    { ...member, email: `nick-${tag}@example.com` },
    409,
    'MEMBER4092',
  );
  await call(
    '07-extra-field',
    '허용하지 않은 필드 거절',
    'POST',
    '/members',
    { ...member, isAdmin: true },
    400,
    'COMMON4001',
  );
  const second = await call(
    '08-other-member',
    '소유권 검증용 두 번째 회원',
    'POST',
    '/members',
    other,
    201,
    'COMMON201',
  );
  const otherId = second.result.memberId;
  report.otherMemberId = otherId;
  await call(
    '09-email-check',
    '이메일 중복 조회',
    'GET',
    `/members/email/${encodeURIComponent(member.email)}`,
    undefined,
    200,
    'COMMON200',
  );
  await call(
    '10-nickname-check',
    '닉네임 중복 조회',
    'GET',
    `/members/nickname/${encodeURIComponent(member.nickname)}`,
    undefined,
    200,
    'COMMON200',
  );

  const path = `/members/${memberId}/ratings`;
  const rating = {
    movieId: 27205,
    score: 5,
    comment: '다시 보고 싶은 영화입니다.',
  };
  await call(
    '11-invalid-score',
    '별점 범위 검증 실패',
    'POST',
    path,
    { ...rating, score: 6 },
    400,
    'COMMON4001',
  );
  await call(
    '12-fractional-score',
    '소수 별점 검증 실패',
    'POST',
    path,
    { ...rating, score: 3.5 },
    400,
    'COMMON4001',
  );
  await call(
    '13-comment-too-long',
    '후기 501자 검증 실패',
    'POST',
    path,
    { ...rating, comment: '가'.repeat(501) },
    400,
    'COMMON4001',
  );
  await call(
    '14-invalid-movie',
    '영화 ID 검증 실패',
    'POST',
    path,
    { ...rating, movieId: 0 },
    400,
    'COMMON4001',
  );
  await call(
    '15-missing-member',
    '없는 회원의 평점 등록',
    'POST',
    '/members/4294967295/ratings',
    rating,
    404,
    'MEMBER4041',
  );
  const created = await call(
    '16-rating-created',
    '평점 등록 성공',
    'POST',
    path,
    rating,
    201,
    'COMMON201',
  );
  const ratingId = created.result;
  report.ratingId = ratingId;
  assert.equal(typeof ratingId, 'number');
  await call(
    '17-duplicate-rating',
    '중복 평점 차단',
    'POST',
    path,
    rating,
    409,
    'RATING4091',
  );
  const [count] = await connection.execute(
    'SELECT COUNT(*) AS count FROM rating WHERE member_id = ? AND movie_id = ?',
    [memberId, rating.movieId],
  );
  assert.equal(Number(count[0].count), 1);
  report.database.ratingRowsAfterDuplicate = Number(count[0].count);
  await call(
    '18-rating-list',
    '등록 후 조회',
    'GET',
    path,
    undefined,
    200,
    'COMMON200',
  );
  await call(
    '19-owner-forbidden-patch',
    '다른 회원의 수정 차단',
    'PATCH',
    `/members/${otherId}/ratings/${ratingId}`,
    { score: 1 },
    403,
    'RATING4031',
  );
  await call(
    '20-owner-forbidden-delete',
    '다른 회원의 삭제 차단',
    'DELETE',
    `/members/${otherId}/ratings/${ratingId}`,
    undefined,
    403,
    'RATING4031',
  );
  await call(
    '21-missing-rating-patch',
    '없는 평점 수정',
    'PATCH',
    `${path}/4294967295`,
    { score: 4 },
    404,
    'RATING4041',
  );
  await call(
    '22-missing-rating-delete',
    '없는 평점 삭제',
    'DELETE',
    `${path}/4294967295`,
    undefined,
    404,
    'RATING4041',
  );
  await call(
    '23-rating-updated',
    '평점 수정 성공',
    'PATCH',
    `${path}/${ratingId}`,
    { score: 4, comment: '수정한 후기입니다.' },
    200,
    'COMMON200',
  );
  const updated = await call(
    '24-updated-list',
    '수정 후 조회',
    'GET',
    path,
    undefined,
    200,
    'COMMON200',
  );
  assert.equal(updated.result[0].score, 4);
  assert.equal(updated.result[0].comment, '수정한 후기입니다.');
  await call(
    '25-rating-deleted',
    '평점 삭제 성공 - 본문 없음',
    'DELETE',
    `${path}/${ratingId}`,
    undefined,
    204,
  );
  const deleted = await call(
    '26-deleted-list',
    '삭제 후 빈 목록 확인',
    'GET',
    path,
    undefined,
    200,
    'COMMON200',
  );
  assert.deepEqual(deleted.result, []);
  await call(
    '27-repeat-delete',
    '삭제한 평점 재삭제',
    'DELETE',
    `${path}/${ratingId}`,
    undefined,
    404,
    'RATING4041',
  );

  const [saved] = await connection.execute(
    'SELECT password FROM member WHERE member_id = ?',
    [memberId],
  );
  const storedHash = saved[0].password;
  report.database.password = {
    algorithm: 'bcrypt',
    length: storedHash.length,
    rounds: bcrypt.getRounds(storedHash),
    differsFromPlaintext: storedHash !== password,
    matchesPassword: await bcrypt.compare(password, storedHash),
    prefix: storedHash.slice(0, 7),
  };
  assert.equal(storedHash.length, 60);
  assert.equal(report.database.password.matchesPassword, true);

  // Exercise the real DB constraint independently of the service pre-check.
  // The duplicate INSERT fails and does not add or change a row.
  try {
    await connection.execute(
      'INSERT INTO member (email, password, nickname) VALUES (?, ?, ?)',
      [member.email, storedHash, `d${tag}`],
    );
    assert.fail('Database must reject duplicate email');
  } catch (error) {
    assert.equal(error.code, 'ER_DUP_ENTRY');
    report.database.directUniqueViolation = {
      code: error.code,
      errno: error.errno,
      sqlMessage: error.sqlMessage,
    };
  }

  const concurrentEmail = `race-${tag}@example.com`;
  const concurrent = await Promise.all(
    [0, 1].map((index) =>
      call(
        `28-race-${index + 1}`,
        '동시 회원가입 - UNIQUE 최종 보호',
        'POST',
        '/members',
        {
          email: concurrentEmail,
          password,
          nickname: `r${tag}${index}`,
        },
        [201, 409],
      ),
    ),
  );
  // Each individual status is nondeterministic, assert the pair below.
  const raceEntries = report.requests.filter((entry) =>
    entry.id.startsWith('28-race-'),
  );
  assert.deepEqual(
    raceEntries.map((entry) => entry.response.status).sort(),
    [201, 409],
  );
  const [raceRows] = await connection.execute(
    'SELECT COUNT(*) AS count FROM member WHERE email = ?',
    [concurrentEmail],
  );
  assert.equal(Number(raceRows[0].count), 1);
  report.concurrency = {
    statuses: raceEntries.map((entry) => entry.response.status),
    storedRows: Number(raceRows[0].count),
    responses: concurrent,
  };
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error.message;
  throw error;
} finally {
  if (connection) await connection.end();
  report.requestCount = report.requests.length;
  report.passedCount = report.requests.filter((entry) => entry.passed).length;
  await writeFile(
    new URL('evidence.json', output),
    JSON.stringify(report, null, 2) + '\n',
    'utf8',
  );
  console.log(
    `Evidence: ${report.passedCount}/${report.requestCount} HTTP checks; output/week6/evidence.json`,
  );
}
