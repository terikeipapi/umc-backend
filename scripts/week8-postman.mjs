import { mkdir, writeFile } from 'node:fs/promises';

const initialization = [
  '(function () {',
  'const tag = pm.variables.replaceIn("{{$randomUUID}}").replace(/-/g, "").slice(0, 7);',
  'pm.collectionVariables.set("emailA", "postman8-" + tag + "-a@example.com");',
  'pm.collectionVariables.set("emailB", "postman8-" + tag + "-b@example.com");',
  'pm.collectionVariables.set("nicknameA", "w8a" + tag);',
  'pm.collectionVariables.set("nicknameB", "w8b" + tag);',
  'pm.collectionVariables.set("demoPassword", "Workbook8!" + tag);',
  '["memberIdA", "memberIdB", "tokenA", "tokenB", "favoriteId", "recordRatingId"].forEach(function(key) { pm.collectionVariables.unset(key); });',
  '})();',
];

function entry(name, method, path, status, code, body, options = {}) {
  const checks = [
    '(function () {',
    `pm.test("HTTP ${status}", function () { pm.response.to.have.status(${status}); });`,
    'const responseData = pm.response.json();',
    'pm.test("공통 응답 형식", function () { pm.expect(Object.keys(responseData).sort()).to.eql(["code", "isSuccess", "message", "result"]); pm.expect(responseData.message).to.be.a("string"); });',
    `pm.test("isSuccess", function () { pm.expect(responseData.isSuccess).to.eql(${status < 400}); });`,
    `pm.test("응답 코드 ${code}", function () { pm.expect(responseData.code).to.eql("${code}"); });`,
    ...(options.checks || []),
    '})();',
  ];
  return {
    name,
    event: [
      ...(options.initialize ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: initialization } }] : []),
      { listen: 'test', script: { type: 'text/javascript', exec: checks } },
    ],
    request: {
      method,
      auth: options.public ? { type: 'noauth' } : { type: 'bearer', bearer: [{ key: 'token', value: `{{${options.other ? 'tokenB' : 'tokenA'}}}`, type: 'string' }] },
      header: body === undefined ? [] : [{ key: 'Content-Type', value: 'application/json', type: 'text' }],
      url: `{{baseUrl}}${path}`,
      description: options.description || name,
      ...(body === undefined ? {} : { body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } }),
    },
  };
}

const favoriteFields = 'pm.test("favoriteId/movieId/createdAt", function () { pm.expect(responseData.result.favoriteId).to.be.a("number"); pm.expect(responseData.result.movieId).to.eql(550); pm.expect(responseData.result.createdAt).to.be.a("string"); pm.expect(new Date(responseData.result.createdAt).getTime()).to.be.at.most(Date.now()+60000); pm.expect(new Date(responseData.result.createdAt).getTime()).to.be.at.least(Date.now()-60000); });';
const item = [
  entry('01 준비 - 회원 A 가입', 'POST', '/members', 201, 'COMMON201', { email: '{{emailA}}', password: '{{demoPassword}}', nickname: '{{nicknameA}}' }, { public: true, initialize: true, checks: ['if (pm.response.code === 201) pm.collectionVariables.set("memberIdA", responseData.result.memberId);'] }),
  entry('02 준비 - 회원 A 로그인', 'POST', '/auth/login', 200, 'COMMON200', { email: '{{emailA}}', password: '{{demoPassword}}' }, { public: true, checks: ['pm.test("로그인 토큰 발급", function () { pm.expect(responseData.result.accessToken).to.be.a("string"); });', 'if (pm.response.code === 200) pm.collectionVariables.set("tokenA", responseData.result.accessToken);'] }),
  entry('03 준비 - 회원 B 가입', 'POST', '/members', 201, 'COMMON201', { email: '{{emailB}}', password: '{{demoPassword}}', nickname: '{{nicknameB}}' }, { public: true, checks: ['if (pm.response.code === 201) pm.collectionVariables.set("memberIdB", responseData.result.memberId);'] }),
  entry('04 준비 - 회원 B 로그인', 'POST', '/auth/login', 200, 'COMMON200', { email: '{{emailB}}', password: '{{demoPassword}}' }, { public: true, checks: ['if (pm.response.code === 200) pm.collectionVariables.set("tokenB", responseData.result.accessToken);'] }),
  entry('05 인증 없음 - 즐겨찾기 401', 'POST', '/favorites', 401, 'AUTH401_2', { movieId: 550 }, { public: true }),
  entry('06 내 즐겨찾기 빈 목록', 'GET', '/favorites', 200, 'COMMON200', undefined, { checks: ['pm.test("빈 목록은 정상", function () { pm.expect(responseData.result).to.eql([]); });'] }),
  entry('07 즐겨찾기 전 여부 false', 'GET', '/favorites/550', 200, 'COMMON200', undefined, { checks: ['pm.test("isFavorite false", function () { pm.expect(responseData.result).to.eql({isFavorite:false}); });'] }),
  entry('08 실습 인증 - 즐겨찾기 등록 201', 'POST', '/favorites', 201, 'COMMON201', { movieId: 550 }, { checks: [favoriteFields, 'if (pm.response.code === 201) pm.collectionVariables.set("favoriteId", responseData.result.favoriteId);'] }),
  entry('09 실습 인증 - 중복 등록 409', 'POST', '/favorites', 409, 'FAVORITE409_1', { movieId: 550 }),
  entry('10 실습 인증 - 내 즐겨찾기 목록 200', 'GET', '/favorites', 200, 'COMMON200', undefined, { checks: ['pm.test("내 영화 한 개", function () { pm.expect(responseData.result).to.have.lengthOf(1); pm.expect(responseData.result[0].movieId).to.eql(550); pm.expect(responseData.result[0].favoriteId).to.eql(Number(pm.collectionVariables.get("favoriteId"))); });'] }),
  entry('11 실습 인증 - 즐겨찾기 여부 true', 'GET', '/favorites/550', 200, 'COMMON200', undefined, { checks: ['pm.test("isFavorite true", function () { pm.expect(responseData.result).to.eql({isFavorite:true}); });'] }),
  entry('12 회원 B의 목록은 비어 있음', 'GET', '/favorites', 200, 'COMMON200', undefined, { other: true, checks: ['pm.test("회원별 목록 분리", function () { pm.expect(responseData.result).to.eql([]); });'] }),
  entry('13 회원 B는 A의 즐겨찾기 해제 불가', 'DELETE', '/favorites/550', 404, 'FAVORITE404_1', undefined, { other: true }),
  entry('14 실습 인증 - 즐겨찾기 해제 200', 'DELETE', '/favorites/550', 200, 'COMMON200', undefined, { checks: ['pm.test("삭제 공통 응답 null", function () { pm.expect(responseData.result).to.eql(null); });'] }),
  entry('15 해제 후 여부 false', 'GET', '/favorites/550', 200, 'COMMON200', undefined, { checks: ['pm.test("isFavorite false", function () { pm.expect(responseData.result).to.eql({isFavorite:false}); });'] }),
  entry('16 해제 후 빈 목록', 'GET', '/favorites', 200, 'COMMON200', undefined, { checks: ['pm.test("빈 목록", function () { pm.expect(responseData.result).to.eql([]); });'] }),
  entry('17 없는 즐겨찾기 해제 404', 'DELETE', '/favorites/550', 404, 'FAVORITE404_1'),
  entry('18 영화 ID 0 검증 400', 'POST', '/favorites', 400, 'COMMON4001', { movieId: 0 }),
  entry('19 실습 인증 - 영화 기록 동시 저장 201', 'POST', '/movie-records', 201, 'COMMON201', { movieId: 238, score: 5, comment: '다시 보고 싶은 영화입니다.', addToFavorites: true }, { checks: ['pm.test("평점과 즐겨찾기 함께 반환", function () { pm.expect(responseData.result.rating.movieId).to.eql(238); pm.expect(responseData.result.rating.score).to.eql(5); pm.expect(responseData.result.favorite.movieId).to.eql(238); pm.expect(responseData.result.favorite.createdAt).to.be.a("string"); });', 'if (pm.response.code === 201) pm.collectionVariables.set("recordRatingId", responseData.result.rating.ratingId);'] }),
  entry('20 영화 기록 중복 평점 409', 'POST', '/movie-records', 409, 'RATING409_1', { movieId: 238, score: 3, addToFavorites: true }),
  entry('21 addToFavorites false는 평점만 저장', 'POST', '/movie-records', 201, 'COMMON201', { movieId: 13, score: 4, addToFavorites: false }, { checks: ['pm.test("favorite null", function () { pm.expect(responseData.result.favorite).to.eql(null); pm.expect(responseData.result.rating.movieId).to.eql(13); });'] }),
  entry('22 false 기록은 즐겨찾기 없음', 'GET', '/favorites/13', 200, 'COMMON200', undefined, { checks: ['pm.test("false 기록의 즐겨찾기 없음", function () { pm.expect(responseData.result.isFavorite).to.eql(false); });'] }),
  entry('23 충돌 준비 - 즐겨찾기 선등록', 'POST', '/favorites', 201, 'COMMON201', { movieId: 550 }),
  entry('24 기존 즐겨찾기 영화 기록 409', 'POST', '/movie-records', 409, 'FAVORITE409_1', { movieId: 550, score: 5, addToFavorites: true }),
  entry('25 기록 요청 무토큰 401', 'POST', '/movie-records', 401, 'AUTH401_2', { movieId: 680, score: 5, addToFavorites: true }, { public: true }),
  entry('26 문자열 boolean 거절 400', 'POST', '/movie-records', 400, 'COMMON4001', { movieId: 680, score: 5, addToFavorites: 'true' }),
];

await mkdir('docs/week8', { recursive: true });
await writeFile('docs/week8/week8.postman_collection.json', `${JSON.stringify({
  info: { _postman_id: '2d950563-4261-449b-91a6-004c114db286', name: 'UMC 8주차 - 서비스의 핵심 기능 만들기', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: '백엔드 워크북 실습1~4와 Standard Mission. 01부터 순서대로 실행합니다. 08,09,10,11,14,19가 필수 응답 캡처 대상입니다. API의 URL/바디에 memberId를 보내지 않고 Bearer 토큰으로 회원을 식별합니다. 매 실행마다 별도 예시 회원을 생성합니다. 실행 중 토큰은 Postman 로컬 Collection 변수에만 저장되므로 실행 뒤 토큰 변수를 지우고 공유/Export 전에 비우세요. 서버 비밀키/DB 비밀번호는 넣지 않습니다. 원자성의 실제 DB 롤백은 별도 week8-workbook-verify.mjs에서 검증합니다. 스터디 사진 및 UMC 사이트 제출은 이 Collection이 수행하지 않습니다.' },
  item,
  variable: [{ key: 'baseUrl', value: 'http://localhost:3000', type: 'string' }, ...['emailA', 'emailB', 'nicknameA', 'nicknameB', 'demoPassword', 'memberIdA', 'memberIdB', 'tokenA', 'tokenB', 'favoriteId', 'recordRatingId'].map((key) => ({ key, value: '', type: 'string' }))],
}, null, 2)}\n`);
await writeFile('docs/week8/week8.postman_environment.json', `${JSON.stringify({ id: 'a64b5daa-45c9-45cf-8c24-23e40e59266a', name: 'UMC 8주차 로컬 서버', values: [{ key: 'baseUrl', value: 'http://localhost:3000', type: 'default', enabled: true }], _postman_variable_scope: 'environment' }, null, 2)}\n`);
console.log(`Created ${item.length} workbook Postman requests with empty token/password variables.`);
