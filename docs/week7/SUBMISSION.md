# 7주차 실습 인증과 필수 미션 기록

참고 자료: 「7주차 - 로그인한 사용자를 구분하기」 PDF의 본문 실습 1~6, 62쪽 전체 시나리오, 71~73쪽 실습 체크리스트·필수 미션·제출물.

NestJS로 본문 실습 1~6과 필수 9단계 시나리오를 구현하고 검증했다. 실제 로컬 HTTP 28건, Postman Collection의 Newman 요청 23건·검증 137개가 모두 통과했다. 단위 테스트 1개, E2E 테스트 163개와 빌드도 통과했다. 아래 문구와 이미지를 실습 인증·미션 기록에 사용할 수 있다.

실제 HTTP 원본은 [evidence.json](../../output/week7/evidence.json), Postman 실행 결과는 [newman-results.json](../../output/week7/newman-results.json), 전체 요청을 열어 볼 수 있는 자료는 [실행 기록 HTML](../../output/week7/report.html)이다. API 요청 규칙은 [API 명세](API.md)에 정리했다.

[전체 제출 패키지 ZIP](../../output/week7-submission.zip)에는 구현 소스·테스트·설정 예제·명세·기록·증빙 이미지를 함께 묶었다. 실제 `.env`, 의존성 폴더와 작업용 캐시는 제외했다.

[Notion 실습 인증·미션 기록 초안](https://app.notion.com/p/414eb2880e2081f19c0ae3303f598aae?pvs=204)에도 인증 문구·수행 과정·검증 결과·트러블슈팅을 저장했다. 이미지 파일은 로컬 제출 자료에 있으며 원래 워크북에 첨부해서 사용할 수 있다.

## 실습 수행 내용

| 실습 | 구현·확인할 내용 | 현재 확인 상태 |
| --- | --- | --- |
| 실습 1 로그인 | bcrypt 비교, A/B 로그인, `nickname/accessToken`, 틀린 비밀번호와 없는 이메일의 동일 실패 응답 | HTTP·Newman·E2E 통과 |
| 실습 2 인증 관문 | Bearer 토큰의 서명·만료 검사, 신뢰할 회원 ID를 요청에 전달 | 서명·클레임·변조·만료 검사 통과 |
| 실습 3 내 정보 | 토큰으로 email/nickname/createdAt 조회, 무토큰·변조 토큰 거절 | HTTP 200·401 분기 확인 |
| 실습 4 내 정보 수정 | 2~12자 닉네임 검증, 중복 거절, 가입 시각 유지와 재조회 반영 | HTTP 200·400·409 및 DB 확인 |
| 실습 5 평점 리팩토링 | 쓰기 경로에서 memberId 제거, 토큰 작성자 사용, 삭제 200 공통 응답 | 등록·수정·삭제 및 이전 쓰기 경로 제거 확인 |
| 실습 6 인증·인가 구분 | 무토큰 401, 타인 토큰 403, 없는 평점 404 | AUTH401_2·RATING403_1·RATING404_1 확인 |

## 실습 인증에 넣을 내용

아래는 실제 실행 결과에 근거해 복사해서 사용할 수 있는 인증 문구다. 대표 HTTP 검증 시각은 2026년 11월 10일 19:26:44(한국 시간)이다. 데모 회원 A의 ID는 12, B의 ID는 13이다. Newman은 별도로 생성한 데모 회원을 사용했다.

1. 회원 A/B를 가입시킨 뒤 `POST /auth/login`으로 각각 토큰을 발급받았다. HTTP 200과 `COMMON200`을 확인했고, 로그인 결과에는 `nickname/accessToken`만 포함되며 비밀번호와 저장 해시는 없었다. 없는 이메일과 틀린 비밀번호는 동일한 `AUTH401_1` 응답을 반환했다.
2. 발급 토큰을 로컬에서 디코딩해 header의 `alg=HS256`, payload의 `sub`, `email`, `iat`, `exp`를 확인했다. 이 대표 실행에서 `sub`는 `"12"`였다. Guard는 디코딩된 값만 믿지 않고 서명·만료·클레임을 검증했다.
3. Authorization 없이 `GET /members/me`를 호출했을 때 HTTP 401·`AUTH401_2`, 정상 토큰에서는 HTTP 200과 본인의 이메일·닉네임·가입 시각을 확인했다. JSON과 만료 정보를 유지하면서 payload의 한 글자와 `sub`를 바꾸고 원래 서명을 유지한 요청은 HTTP 401·`AUTH401_3`으로 거절됐다.
4. `PATCH /members/me`로 닉네임을 수정하고 재조회 및 DB SELECT로 저장을 확인했다. `createdAt`은 변경되지 않았다. 다른 회원의 닉네임은 409·`MEMBER409_1`, 한 글자·공백 닉네임과 추가 `memberId` 필드는 400으로 거절됐다.
5. A 토큰으로 평점 등록 201·본인 수정 200·삭제 200을 확인했다. B 토큰의 A 평점 수정은 403·`RATING403_1`이었다. 평점 등록 body에는 `movieId/score/comment`만 있었고 쓰기 URL에도 `memberId`가 없었다. 삭제 결과는 `null`이고 DB에서도 해당 평점이 제거됐다.

jwt.io 화면에서 직접 확인하는 항목은 브라우저 접근 호스트를 사용할 수 없어 수행하지 못했다. 위 로컬 디코딩 결과와 구분해 기록한다. 실제 Postman 앱 화면을 조작한 것은 아니며 Collection을 Newman CLI로 실행했다.

## 필수 제출 이미지 4개

| 제출 항목 | 원본 요청 ID | 확인한 이미지 | 표시 내용 |
| --- | --- | --- | --- |
| 로그인 성공 | `03-login-a` | [로그인 200](../../output/week7/captures/03-login-a.png) | 200, nickname, 전체 accessToken |
| 토큰 없이 내 정보 조회 | `13-me-no-token` | [무토큰 401](../../output/week7/captures/13-me-no-token.png) | GET /members/me, Authorization 없음, 401, AUTH401_2 |
| 다른 회원의 평점 수정 | `08-other-owner-edit` | [타인 수정 403](../../output/week7/captures/08-other-owner-edit.png) | B 토큰, A의 ratingId, 403, RATING403_1 |
| 본인 평점 등록 성공 | `05-rating-created` | [본인 등록 201](../../output/week7/captures/05-rating-created.png) | POST /ratings, body에 memberId 없음, 201, COMMON201 |

이미지 4장은 실제 HTTP 원본을 이미지로 만든 자료이며 화면에 그 출처를 표시했다. Postman UI 캡처는 아니다. 전체 accessToken이 보이는 이미지의 데모 토큰은 만료 후 `AUTH401_4`가 반환되는 것까지 확인했다. JWT 서명 비밀키와 DB 비밀번호는 자료에 포함하지 않았다.

## 필수 미션의 9단계

아래 순서는 PDF 62쪽과 같다. 가입과 로그인은 회원 두 명을 각각 요청하므로 실제 HTTP 요청 수는 11건이다.

| 단계 | 실제 실행 | 확인 결과 |
| --- | --- | --- |
| 1 | 회원 A/B 가입 | 각 201 |
| 2 | 회원 A/B 로그인 | 각 200, 토큰 A/B |
| 3 | A 토큰으로 POST /ratings | 201, COMMON201 |
| 4 | A가 같은 movieId로 중복 등록 | 409, RATING409_1 |
| 5 | A 토큰으로 본인 평점 PATCH | 200 |
| 6 | B 토큰으로 같은 평점 PATCH | 403, RATING403_1 |
| 7 | Authorization 없이 같은 요청 | 401, AUTH401_2 |
| 8 | A 토큰으로 없는 평점 DELETE | 404, RATING404_1 |
| 9 | A 토큰으로 본인 평점 DELETE | 200, COMMON200, result null |

## 미션 기록에 넣을 구현 과정

1. 6주차의 회원·평점·공통 실패 응답 구조를 확인하고, 이번 주차에서 새로 필요한 로그인·내 정보와 변경할 평점 경로를 정리했다.
2. JWT 설정을 환경 변수로 분리했다. 비밀키는 로컬 환경에만 두고, 유효시간은 초 단위 숫자로 처리한다.
3. 로그인 DTO를 검증하고 저장된 bcrypt 해시와 입력을 비교하도록 연결했다. 없는 이메일과 틀린 비밀번호를 같은 401 응답으로 처리한다.
4. 공통 Guard에서 Bearer 토큰을 검증하고 회원 ID를 꺼내 컨트롤러로 전달한다. 서명 오류와 만료 오류의 응답 코드를 구분한다.
5. 내 정보 조회·닉네임 수정은 Guard에서 확인한 본인 ID만 사용하도록 구성한다. 중복 닉네임과 잘못된 입력을 거절하고 재조회로 변경을 확인한다.
6. 평점 쓰기 URL의 memberId를 제거하고 등록·수정·삭제의 작성자 판단을 토큰으로 옮긴다. 공개 회원별 조회 경로는 유지한다.
7. 서비스에서 평점 존재 여부를 먼저 검사한 뒤 소유권을 확인한다. 없는 대상은 404이고, 존재하지만 다른 회원의 평점이면 403이다.
8. PDF의 9단계를 실제 로컬 HTTP 및 Postman Collection 실행으로 검증하고 실패 응답·DB 결과를 기록한다. 자동 테스트와 실행 증거는 서로 구분해 남긴다.
9. 로그인, 무토큰 401, 타인 수정 403, 본인 등록 201의 필수 증빙 4개와 API 명세·소스 링크를 정리한다.

### 구현 중 확인한 세부 사항

- [ApiException](../../src/exception/api.exception.ts)에 상태·코드·메시지를 담아 기존 [전역 필터](../../src/common/http-exception.filter.ts)의 공통 실패 구조를 유지했다. 회원가입의 기존 오류 코드와 이번 주차 인증·평점 오류 코드는 명세에 맞게 구분했다.
- [AuthModule](../../src/auth/auth.module.ts)에서 JWT 비밀키와 초 단위 만료 설정을 읽는다. 서명 키는 로컬 `.env`에만 생성했고, 저장소 예제에는 빈 값만 제공한다. 32바이트 미만 키와 잘못된 만료 설정은 서버 시작 시 거절한다.
- [로그인 서비스](../../src/auth/auth.service.ts)는 bcrypt 비교를 사용한다. 없는 이메일에도 더미 해시 비교를 수행하며, 없는 이메일과 틀린 비밀번호를 같은 메시지로 처리했다.
- [Guard](../../src/auth/jwt-auth.guard.ts)는 HS256을 지정하고 서명·만료·subject를 확인한 뒤 신뢰할 회원 ID를 설정한다. [LoginMember 데코레이터](../../src/auth/login-member.decorator.ts)로 컨트롤러의 ID 추출을 모았다.
- [DB 준비 스크립트](../../scripts/week7-db.mjs)로 기존 회원·평점 데이터를 보존하면서 `created_at`을 추가했다. 6주차 데이터에는 가입 시각이 없으므로 기존 회원의 값은 마이그레이션 시각이며 원래 가입 시각을 복원한 값이 아니다. 신규 회원은 UTC 시각을 저장한다.
- [내 정보 서비스](../../src/movie/member.service.ts)는 본인 ID만으로 조회·수정하고, 닉네임 중복 확인에서 본인을 제외했다. 사전 검사 후 동시 요청이 충돌해도 DB UNIQUE 오류를 409로 변환한다. 이메일·비밀번호 변경은 허용하지 않았다.
- [평점 컨트롤러](../../src/movie/rating.controller.ts)의 기존 `/members/:memberId` 쓰기 경로를 제거했다. [서비스](../../src/movie/rating.service.ts)는 대상 존재와 소유권을 검사하고 실제 UPDATE·DELETE에도 작성자 조건을 넣었다. 공개 회원별 조회는 유지했다.
- 첫 Newman 실행에서는 `Identifier 'data' has already been declared` 오류로 후속 토큰·ID가 저장되지 않았다. 스크립트의 로컬 범위를 분리하고 이름을 바꾼 뒤 재실행해 요청 23개·검증 137개를 통과했다. [트러블슈팅 기록](TROUBLESHOOTING.md)에 원문과 해결을 남겼다.

6주차 문서·캡처는 당시의 기록으로 보존했다. 현재 서버의 평점 쓰기 경로와 삭제 200 규칙은 이 문서와 7주차 API 명세를 따른다. 기존 회원별 쓰기 URL을 계속 호출하면 404가 반환된다.

## 재현 명령

`.env.example`을 기준으로 DB 설정과 비공개 JWT 키를 준비하고 `npm run week7:db`, `npm run build`, `npm run start:prod` 순서로 실행한다. 기본 서버 포트는 3000이다. 별도 검증 서버는 127.0.0.1:3007에서 실행했다. 일반 서버를 검증하려면 `WEEK7_BASE_URL`을 해당 주소로 바꾼다.

```powershell
$env:WEEK7_BASE_URL = 'http://127.0.0.1:3007'
$env:WEEK7_WAIT_FOR_EXPIRY = '1'
node scripts/week7-verify.mjs
node scripts/week7-report.mjs
```

짧은 토큰 만료를 함께 확인할 때는 검증 서버의 프로세스 환경에서만 `JWT_ACCESS_EXPIRATION=15`를 설정한다. 위 verifier는 30초를 초과하는 대기를 거절한다. 이는 워크북 선택 미션의 정확한 60초 대기 실행과는 구분한다.

Postman 앱에서는 Collection과 Environment를 가져와 전체 요청을 순서대로 실행한다. Newman CLI가 준비됐다면 다음과 같이 실행한다.

```powershell
npx --yes newman run docs/week7/week7.postman_collection.json -e docs/week7/week7.postman_environment.json --env-var baseUrl=http://127.0.0.1:3007 --reporters cli,json --reporter-json-export output/week7/newman-results.json
```

첫 요청은 새 예시 회원 값을 생성한다. 실행하면 로컬 DB에 데모 회원이 추가되고 데모 평점은 마지막 본인 삭제 단계에서 제거된다. 요청 중 생성된 토큰은 실행 환경에만 저장하며 배포용 비밀값은 포함하지 않는다.

## 최종 검증 결과

| 검증 | 실제 결과 |
| --- | --- |
| 단위 테스트 | 1개 통과 |
| E2E 테스트 | 5개 파일, 163개 통과 |
| 프로덕션 빌드 | 통과 |
| 실제 HTTP·MySQL 검증 | 2026-11-10 19:26:44 KST 시작, 28/28 통과 |
| Postman Collection/Newman | 2026-11-10 19:24:19 KST 완료, 요청 23개·검증 137개, 실패 0개 |
| DB 확인 | bcrypt 60자·cost 10·원문 비교 일치, 닉네임 수정 반영, 삭제한 평점 0건 |
| 토큰 확인 | A/B의 만료 후 401·AUTH401_4 확인, Newman 데모 토큰도 만료됨 |

- [x] 빌드·단위·E2E 테스트 통과
- [x] 실제 HTTP 9단계 시나리오 및 본문 추가 실습 검증
- [x] Postman Collection/Newman 실행과 assertion 확인
- [x] bcrypt 저장·닉네임 수정·평점 삭제 DB SELECT 확인
- [x] 필수 이미지 4개 생성 및 내용 판독
- [x] 실습용 토큰 만료 확인
- [ ] jwt.io 웹 화면에서 직접 payload 확인: 브라우저 접근 호스트 제한으로 로컬 디코딩을 수행함

실제 스터디 모임 사진과 UMC 사이트 제출은 수행하지 않았다. 구현 코드와 인증 자료는 [GitHub 저장소](https://github.com/terikeipapi/umc-backend)의 `main` 브랜치에 게시했다. [미션 기록](https://github.com/terikeipapi/umc-backend/blob/main/docs/week7/SUBMISSION.md), [트러블슈팅 보고서](https://github.com/terikeipapi/umc-backend/blob/main/docs/week7/TROUBLESHOOTING.md), [증빙 이미지 4장](https://github.com/terikeipapi/umc-backend/tree/main/output/week7/captures)을 원래 워크북의 실습 인증·미션 기록에 사용할 수 있다.
