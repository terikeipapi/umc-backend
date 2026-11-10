import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createConnection } from 'mysql2/promise';
import bcrypt from 'bcrypt';

try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const baseUrl = process.env.WEEK7_BASE_URL || 'http://localhost:3007';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname)) {
  throw new Error('Week 7 verification requires a local development API.');
}
if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || 'localhost')) {
  throw new Error('Week 7 verification requires a local development database.');
}
const waitForExpiry = process.env.WEEK7_WAIT_FOR_EXPIRY === '1';
const output = new URL('../output/week7/', import.meta.url);
await mkdir(output, { recursive: true });
const tag = Date.now().toString(36).slice(-7);
const fixturePassword = 'Umc!1234';
const memberA = { email: `week7-${tag}-a@example.com`, password: fixturePassword, nickname: `w7${tag}a` };
const memberB = { email: `week7-${tag}-b@example.com`, password: fixturePassword, nickname: `w7${tag}b` };
const report = {
  runAt: new Date().toISOString(),
  runAtSeoul: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium' }).format(new Date()),
  baseUrl,
  source: 'Actual HTTP requests to the compiled local NestJS server and SELECT queries against local MySQL.',
  runTag: tag,
  fixtureNotice: 'All emails, nicknames, and passwords in this report belong to disposable local demonstration members. No JWT signing secret or database password is recorded.',
  requests: [],
  database: {},
  requiredCaptureIds: ['03-login-a', '13-me-no-token', '08-other-owner-edit', '05-rating-created'],
  scenario: [
    { step: 1, title: '회원 A/B 가입', ids: ['01-signup-a', '02-signup-b'] },
    { step: 2, title: '회원 A/B 로그인', ids: ['03-login-a', '04-login-b'] },
    { step: 3, title: 'A의 평점 등록', ids: ['05-rating-created'] },
    { step: 4, title: '같은 영화 중복 등록', ids: ['06-rating-duplicate'] },
    { step: 5, title: 'A의 본인 평점 수정', ids: ['07-owner-edit'] },
    { step: 6, title: 'B의 타인 평점 수정', ids: ['08-other-owner-edit'] },
    { step: 7, title: '토큰 없이 같은 요청', ids: ['09-rating-no-token'] },
    { step: 8, title: '없는 평점 삭제', ids: ['10-rating-missing'] },
    { step: 9, title: 'A의 본인 평점 삭제', ids: ['11-owner-delete'] },
  ],
};

async function call(id, title, method, pathname, { body, token, expected, code, note, scenarioStep } = {}) {
  const headers = { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const entry = { id, title, at: new Date().toISOString(), scenarioStep: scenarioStep ?? null, note: note ?? '', request: { method, path: pathname, headers, body: body ?? null }, response: null, passed: false };
  report.requests.push(entry);
  const started = performance.now();
  const response = await fetch(baseUrl + pathname, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  const raw = await response.text();
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error(`${id}: response was not JSON (HTTP ${response.status}).`); }
  entry.response = { status: response.status, statusText: response.statusText, body: parsed, raw };
  entry.elapsedMs = Math.round(performance.now() - started);
  assert.equal(response.status, expected, `${id}: unexpected HTTP status ${response.status}.`);
  assert.deepEqual(Object.keys(parsed).sort(), ['code', 'isSuccess', 'message', 'result']);
  assert.equal(parsed.isSuccess, response.status < 400);
  if (code) assert.equal(parsed.code, code, `${id}: unexpected response code.`);
  assert.equal(typeof parsed.message, 'string');
  assert.equal(raw.includes('"password"'), false, `${id}: response exposes a password field.`);
  if (response.status >= 400) assert.equal(parsed.result, null);
  entry.passed = true;
  return parsed;
}

function claims(token) {
  assert.equal(typeof token, 'string');
  const parts = token.split('.');
  assert.equal(parts.length, 3);
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

let connection;
try {
  connection = await createConnection({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME, timezone: 'Z' });

  // These first requests preserve the workbook's nine-step order exactly.
  const signupA = await call('01-signup-a', '준비: 회원 A 가입', 'POST', '/members', { body: memberA, expected: 201, code: 'COMMON201', scenarioStep: 1 });
  const signupB = await call('02-signup-b', '준비: 회원 B 가입', 'POST', '/members', { body: memberB, expected: 201, code: 'COMMON201', scenarioStep: 1 });
  const memberId = signupA.result.memberId;
  const otherMemberId = signupB.result.memberId;
  report.memberId = memberId;
  report.otherMemberId = otherMemberId;

  const loginA = await call('03-login-a', '로그인 성공: 회원 A', 'POST', '/auth/login', { body: { email: memberA.email, password: fixturePassword }, expected: 200, code: 'COMMON200', scenarioStep: 2, note: '필수 캡처 1: 실제 로그인 응답의 accessToken. 실행 종료 시 만료 확인 여부도 함께 기록한다.' });
  const loginB = await call('04-login-b', '로그인 성공: 회원 B', 'POST', '/auth/login', { body: { email: memberB.email, password: fixturePassword }, expected: 200, code: 'COMMON200', scenarioStep: 2 });
  const tokenA = loginA.result.accessToken;
  const tokenB = loginB.result.accessToken;
  assert.deepEqual(Object.keys(loginA.result).sort(), ['accessToken', 'nickname']);
  assert.equal(loginA.result.nickname, memberA.nickname);
  const payloadA = claims(tokenA);
  const payloadB = claims(tokenB);
  assert.equal(payloadA.sub, String(memberId));
  assert.equal(payloadA.email, memberA.email);
  assert.equal(Object.hasOwn(payloadA, 'password'), false);
  assert.equal(typeof payloadA.iat, 'number');
  assert.equal(typeof payloadA.exp, 'number');
  assert.ok(payloadA.exp > payloadA.iat);
  report.jwt = { header: JSON.parse(Buffer.from(tokenA.split('.')[0], 'base64url').toString('utf8')), payload: payloadA, lifetimeSeconds: payloadA.exp - payloadA.iat, decodedLocally: true, externalJwtDebuggerUsed: false, tokensExpiredAtVerification: false };

  const rating = { movieId: 27205, score: 5, comment: '토큰에서 작성자를 확인하는 실습입니다.' };
  const created = await call('05-rating-created', 'A 토큰으로 평점 등록 성공', 'POST', '/ratings', { body: rating, token: tokenA, expected: 201, code: 'COMMON201', scenarioStep: 3, note: '필수 캡처 4: body는 movieId/score/comment이며 memberId가 없다.' });
  const ratingId = created.result.ratingId;
  assert.equal(Number.isSafeInteger(ratingId), true);
  assert.equal(created.result.memberId, memberId);
  assert.equal(Object.hasOwn(rating, 'memberId'), false);
  report.ratingId = ratingId;
  await call('06-rating-duplicate', '같은 영화의 중복 평점 차단', 'POST', '/ratings', { body: rating, token: tokenA, expected: 409, code: 'RATING409_1', scenarioStep: 4 });
  const updated = await call('07-owner-edit', 'A의 본인 평점 수정', 'PATCH', `/ratings/${ratingId}`, { body: { score: 4, comment: '본인 토큰으로 수정한 후기입니다.' }, token: tokenA, expected: 200, code: 'COMMON200', scenarioStep: 5 });
  assert.equal(updated.result.score, 4);
  assert.equal(updated.result.memberId, memberId);
  await call('08-other-owner-edit', 'B 토큰으로 A의 평점 수정: 403', 'PATCH', `/ratings/${ratingId}`, { body: { score: 1, comment: '다른 회원의 수정 시도' }, token: tokenB, expected: 403, code: 'RATING403_1', scenarioStep: 6, note: '필수 캡처 3: B 토큰은 유효하므로 인증 통과 후 소유권 검사에서 거절된다.' });
  await call('09-rating-no-token', 'Authorization 없이 같은 평점 수정: 401', 'PATCH', `/ratings/${ratingId}`, { body: { score: 1, comment: '토큰 없는 수정 시도' }, expected: 401, code: 'AUTH401_2', scenarioStep: 7 });
  const [missingRows] = await connection.execute('SELECT rating_id FROM rating WHERE rating_id = ?', [99999]);
  assert.equal(missingRows.length, 0, 'Workbook missing rating 99999 exists; choose an empty local fixture database.');
  await call('10-rating-missing', '없는 평점 삭제: 404', 'DELETE', '/ratings/99999', { token: tokenA, expected: 404, code: 'RATING404_1', scenarioStep: 8 });
  const deleted = await call('11-owner-delete', 'A의 본인 평점 삭제: 200과 result null', 'DELETE', `/ratings/${ratingId}`, { token: tokenA, expected: 200, code: 'COMMON200', scenarioStep: 9 });
  assert.equal(deleted.result, null);
  report.scenarioPassed = true;

  // Additional practice confirmations follow the nine-step required scenario.
  const me = await call('12-me-success', '실습 3: 토큰으로 내 정보 조회', 'GET', '/members/me', { token: tokenA, expected: 200, code: 'COMMON200' });
  assert.deepEqual(Object.keys(me.result).sort(), ['createdAt', 'email', 'nickname']);
  assert.equal(me.result.email, memberA.email);
  assert.equal(me.result.nickname, memberA.nickname);
  assert.equal(Number.isNaN(Date.parse(me.result.createdAt)), false);
  await call('13-me-no-token', '토큰 없이 내 정보 조회: 401', 'GET', '/members/me', { expected: 401, code: 'AUTH401_2', note: '필수 캡처 2: 요청에 Authorization이 없고 AUTH401_2를 반환한다.' });
  const tamperedParts = tokenA.split('.');
  const changedClaims = JSON.parse(Buffer.from(tamperedParts[1], 'base64url').toString('utf8'));
  const originalSubject = changedClaims.sub;
  const lastDigit = Number(originalSubject.at(-1));
  changedClaims.sub = originalSubject === '1' ? '3' : originalSubject.slice(0, -1) + String(lastDigit ^ 1);
  const changedPayload = Buffer.from(JSON.stringify(changedClaims)).toString('base64url');
  assert.equal(changedPayload.length, tamperedParts[1].length);
  assert.equal([...changedPayload].filter((character, index) => character !== tamperedParts[1][index]).length, 1);
  assert.notEqual(changedClaims.sub, originalSubject);
  assert.equal(changedClaims.exp, payloadA.exp);
  tamperedParts[1] = changedPayload;
  await call('14-me-tampered', '실습 2·3: payload 한 글자 변조 거절', 'GET', '/members/me', { token: tamperedParts.join('.'), expected: 401, code: 'AUTH401_3', note: 'JSON과 만료 시각을 유지한 채 sub를 바꾸어 인코딩 payload의 한 글자만 교체했다. 원래 서명은 그대로 두었으며 401로 거절됐다.' });
  const unknown = await call('15-login-unknown', '가입하지 않은 이메일의 로그인 실패', 'POST', '/auth/login', { body: { email: `missing-${tag}@example.com`, password: fixturePassword }, expected: 401, code: 'AUTH401_1' });
  const wrong = await call('16-login-wrong-password', '틀린 비밀번호의 로그인 실패', 'POST', '/auth/login', { body: { email: memberA.email, password: 'Wrong!1234' }, expected: 401, code: 'AUTH401_1' });
  assert.deepEqual(unknown, wrong);
  report.loginFailureResponsesIdentical = true;
  const newNickname = `n7${tag}a`;
  const patched = await call('17-me-edit', '실습 4: 내 닉네임 수정', 'PATCH', '/members/me', { body: { nickname: newNickname }, token: tokenA, expected: 200, code: 'COMMON200' });
  assert.equal(patched.result.nickname, newNickname);
  assert.equal(patched.result.createdAt, me.result.createdAt);
  const refreshed = await call('18-me-after-edit', '내 정보 재조회로 수정 반영 확인', 'GET', '/members/me', { token: tokenA, expected: 200, code: 'COMMON200' });
  assert.deepEqual(refreshed.result, patched.result);
  await call('19-me-duplicate-nickname', '다른 회원의 닉네임 중복 거절', 'PATCH', '/members/me', { body: { nickname: memberB.nickname }, token: tokenA, expected: 409, code: 'MEMBER409_1' });
  await call('20-me-short-nickname', '한 글자 닉네임 검증 실패', 'PATCH', '/members/me', { body: { nickname: '가' }, token: tokenA, expected: 400, code: 'COMMON4001' });
  await call('21-me-blank-nickname', '공백 닉네임 검증 실패', 'PATCH', '/members/me', { body: { nickname: '   ' }, token: tokenA, expected: 400, code: 'COMMON4001' });
  await call('22-me-extra-field', '내 정보 요청의 memberId 주입 차단', 'PATCH', '/members/me', { body: { nickname: newNickname, memberId: otherMemberId }, token: tokenA, expected: 400, code: 'COMMON4001' });
  await call('23-rating-spoof', '평점 등록 body의 memberId 주입 차단', 'POST', '/ratings', { body: { ...rating, memberId: otherMemberId }, token: tokenA, expected: 400, code: 'COMMON4001' });
  await call('24-legacy-write-removed', '기존 memberId 경로의 등록 API 제거 확인', 'POST', `/members/${memberId}/ratings`, { body: rating, token: tokenA, expected: 404 });
  const publicList = await call('25-public-ratings', '공개 회원별 평점 조회 유지', 'GET', `/members/${memberId}/ratings`, { expected: 200, code: 'COMMON200' });
  assert.deepEqual(publicList.result, []);
  await call('26-repeat-delete', '삭제한 평점 재삭제: 404', 'DELETE', `/ratings/${ratingId}`, { token: tokenA, expected: 404, code: 'RATING404_1' });

  const [saved] = await connection.execute('SELECT member_id, email, password, nickname, created_at FROM member WHERE member_id = ?', [memberId]);
  assert.equal(saved.length, 1);
  const savedHash = saved[0].password;
  const [ratingRows] = await connection.execute('SELECT COUNT(*) AS count FROM rating WHERE rating_id = ?', [ratingId]);
  report.database = {
    password: { algorithm: 'bcrypt', length: savedHash.length, rounds: bcrypt.getRounds(savedHash), differsFromPlaintext: savedHash !== fixturePassword, matchesPassword: await bcrypt.compare(fixturePassword, savedHash) },
    nickname: saved[0].nickname,
    nicknameMatchesPatch: saved[0].nickname === newNickname,
    createdAtPresent: Boolean(saved[0].created_at),
    deletedRatingRows: Number(ratingRows[0].count),
    memberId,
    otherMemberId,
  };
  assert.equal(report.database.password.matchesPassword, true);
  assert.equal(report.database.password.length, 60);
  assert.equal(report.database.nicknameMatchesPatch, true);
  assert.equal(report.database.deletedRatingRows, 0);

  if (waitForExpiry) {
    const waitMs = Math.max(payloadA.exp, payloadB.exp) * 1000 - Date.now() + 250;
    if (waitMs > 30_000) throw new Error('Use an isolated verification server with JWT_ACCESS_EXPIRATION <= 30 seconds.');
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    await call('27-expired-token-a', '추가 확인: A 토큰 만료 후 401', 'GET', '/members/me', { token: tokenA, expected: 401, code: 'AUTH401_4', note: '검증 서버의 짧은 유효시간으로 확인했다. 워크북 선택 미션의 60초 대기와는 별도 실행이다.' });
    await call('28-expired-token-b', '추가 확인: B 토큰도 만료됨', 'GET', '/members/me', { token: tokenB, expected: 401, code: 'AUTH401_4' });
    report.jwt.tokensExpiredAtVerification = true;
  }
  report.jwt.expiredByUtc = new Date(Math.max(payloadA.exp, payloadB.exp) * 1000).toISOString();
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error instanceof assert.AssertionError ? error.message : `Verification stopped (${error?.code || error?.name || 'Error'}).`;
  throw error;
} finally {
  if (connection) await connection.end();
  report.requestCount = report.requests.length;
  report.passedCount = report.requests.filter((entry) => entry.passed).length;
  report.finishedAt = new Date().toISOString();
  await writeFile(new URL('evidence.json', output), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Week 7 evidence: ${report.passedCount}/${report.requestCount} HTTP checks; output/week7/evidence.json`);
}
