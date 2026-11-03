# 6주차 실습 및 필수 미션 제출 자료

NestJS로 회원가입과 영화 평점 등록·수정·삭제 API를 구현했다. 아래 문서와 검증 산출물을 함께 제출 자료로 사용할 수 있다. 요청 예시와 실제 실행 증거는 구분하며, 실행 날짜·상태·응답·DB 확인 결과는 검증 기록을 기준으로 한다.

## 제출물

최종 묶음은 [전체 제출 패키지](../../output/week6-submission.zip)이며, 소스 코드·API 명세·Postman 자료·인증 이미지 13장·8쪽 보고서를 포함한다.

| 요구 자료 | 위치 |
| --- | --- |
| API 명세 | [API.md](API.md) |
| 통합 제출 보고서 | [PDF](../../output/pdf/week6-submission.pdf), [HTML](../../output/week6/report.html) |
| Postman 요청과 자동 확인 스크립트 | [Collection](week6.postman_collection.json), [Environment](week6.postman_environment.json) |
| 요청·응답 원본과 DB 확인 결과 | [evidence.json](../../output/week6/evidence.json) |
| 화면 요청·응답 캡처 | [screenshots 폴더](../../output/week6/screenshots/) |
| 핵심 코드 | 아래 코드 링크 |
| 트러블슈팅 1건 | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |

## 실습 인증

워크북 37쪽에서 요구한 세 가지 응답의 캡처 경로는 다음과 같다. 캡처에 표시된 요청과 응답은 [원본 검증 기록](../../output/week6/evidence.json)과 함께 확인한다.

1. [회원가입 성공](../../output/week6/screenshots/01-signup-success.png): `POST /members`의 HTTP 201 응답, `memberId/email/nickname` 확인, password 미포함.
2. [검증 실패](../../output/week6/screenshots/02-validation-failure.png): 잘못된 이메일을 보낸 요청의 HTTP 400과 공통 실패 구조 확인.
3. [평점 등록 성공](../../output/week6/screenshots/16-rating-created.png): `POST`의 HTTP 201 응답과 평점 ID 확인. [평점 수정 성공](../../output/week6/screenshots/23-rating-updated.png)도 함께 첨부한다.

필수 미션의 추가 증빙은 [중복 평점 409](../../output/week6/screenshots/17-duplicate-rating.png), [다른 회원의 수정 403](../../output/week6/screenshots/19-owner-forbidden-patch.png), [없는 평점 수정 404](../../output/week6/screenshots/21-missing-rating-patch.png), [삭제 204와 빈 본문](../../output/week6/screenshots/25-rating-deleted.png)이다.

## 필수 미션 확인 항목

| 항목 | 구현·검증 내용 | 근거 |
| --- | --- | --- |
| 회원가입 입력 검증 | 이메일 형식, 닉네임 2~12자, 비밀번호 조합·길이 검사 | DTO, Postman 검증 실패 요청 |
| 안전한 비밀번호 저장 | bcrypt cost 10, 해시 60자 저장, 응답에서 제외 | 회원 서비스, 검증 기록의 DB 확인 |
| 평점 등록 | 양의 TMDB movieId, 정수 score 1~5, comment 최대 500자 | 평점 DTO, 등록 요청 |
| 평점 수정 | score 필수, 소유 회원 확인 후 변경 | 수정 요청과 재조회 |
| 평점 삭제 | 소유 회원 확인, HTTP 204, 빈 본문 | 삭제 응답과 삭제 뒤 재조회 |
| 중복·검증 실패 | 이메일·닉네임·평점 중복 409, 잘못된 별점 400 | 실패 응답 캡처·원본 기록 |
| 소유자와 존재 여부 | 다른 회원의 수정·삭제 403, 없는 평점 404 | 오류 요청·응답 기록 |
| 중복 저장 방지 | 이메일·닉네임 UNIQUE, 회원·영화 복합 UNIQUE | 스키마 및 DB 검증 기록 |
| 일관된 응답 | isSuccess/code/message/result 공통 구조; 204는 본문 없음 | 전역 예외 필터, API 명세 |

## 구현 과정 기록

1. 워크북의 실습 1~3과 Standard Mission을 읽고 필요한 요청·응답·실패 상태를 정리했다. 기존 프로젝트가 NestJS였으므로 한 가지 스택으로 진행했다.
2. 기존 도서 기능과 함께 사용할 수 있도록 영화 평점 기능을 별도 모듈로 구성하고, 회원·평점 전용 테이블과 제약 조건을 준비했다. TMDB movieId는 외부 식별자이므로 로컬 영화 테이블 FK를 만들지 않았다.
3. DTO에서 요청 자료형·길이·범위를 검증하고 전역 ValidationPipe에서 허용하지 않은 필드를 거절하도록 연결했다.
4. 회원 서비스에서 이메일·닉네임 중복을 확인하고 bcrypt 해시를 저장했다. 응답에 포함할 필드를 명시해 비밀번호 유출을 막았다.
5. 평점 서비스에서 회원 존재, 중복 평점, 평점 존재와 소유자를 확인했다. 수정·삭제는 소유 회원 조건을 함께 사용하도록 구성했다.
6. 전역 예외 필터에서 HTTP 예외와 DB 제약 위반을 공통 실패 구조로 바꾸고, DB 내부 오류 내용을 숨겼다.
7. 자동 테스트와 로컬 MySQL 요청을 통해 정상 흐름, 중복·입력 오류, 소유자 오류, 없는 리소스, 삭제 뒤 조회를 검증했다. 실제 결과는 [검증 기록](../../output/week6/evidence.json)에 남겼다.
8. 실습 인증 캡처, API 명세, Postman 컬렉션과 트러블슈팅 기록을 제출 자료로 정리했다.

## 자동 검증 결과

단위 테스트 1개와 E2E 테스트 106개를 통과했다. 별도로 컴파일한 NestJS 서버와 실제 로컬 MySQL에 대해 29개 HTTP 요청을 실행했고 모두 통과했다. 검증 시각은 2026년 11월 3일 17:38:46(한국 시간)이다.

DB 조회로 비밀번호가 평문과 다른 60자 bcrypt 해시이며 cost가 10이고 원래 비밀번호와 비교 검증되는 것을 확인했다. 중복 평점 요청 뒤 저장된 해당 평점은 1개였으며 삭제 요청은 204와 빈 본문을 반환했다. 같은 이메일로 동시 가입한 두 요청의 결과는 201·409였고 저장된 회원은 1명이었다. 실제 요청·응답과 DB 확인 결과는 [검증 기록](../../output/week6/evidence.json), 화면 자료는 [통합 보고서](../../output/week6/report.html)에서 확인한다.

## 핵심 코드 링크

다음 링크는 현재 프로젝트의 소스 파일을 가리킨다. [GitHub 저장소](https://github.com/terikeipapi/umc-backend)의 같은 경로에서도 코드와 제출 자료를 확인할 수 있다.

- [영화 평점 모듈](../../src/movie/movie.module.ts)
- [회원가입과 중복 확인](../../src/movie/member.controller.ts)
- [회원 저장과 bcrypt 해시](../../src/movie/member.service.ts)
- [회원가입 입력 DTO](../../src/movie/dto/create-member.dto.ts)
- [평점 등록·수정·삭제 경로](../../src/movie/rating.controller.ts)
- [평점 저장·소유자 검사](../../src/movie/rating.service.ts)
- [평점 등록 DTO](../../src/movie/dto/create-rating.dto.ts), [평점 수정 DTO](../../src/movie/dto/update-rating.dto.ts)
- [전역 검증과 예외 필터 설정](../../src/common/configure-app.ts)
- [공통 오류 응답과 DB 제약 위반 변환](../../src/common/http-exception.filter.ts)
- [전용 DB 스키마와 UNIQUE/FK 제약](../../sql/week6-schema.sql)
- [요청·응답 자동 테스트](../../test/movie.e2e-spec.ts)

## 실행 및 제출 방법

프로젝트 루트에서 `npm install`, `npm run week6:db`, `npm run build`, `npm run start:prod` 순서로 실행한다. 서버를 켠 상태에서 Postman 컬렉션을 순서대로 실행하면 회원·평점 ID를 자동으로 이어서 사용할 수 있다. 자세한 요청 규칙은 [API 명세](API.md)를 따른다.

서버 실행 후 `npm run week6:verify`로 실제 HTTP 요청과 DB 확인을 다시 수행할 수 있다. 이 명령은 새 데모 회원을 남기고 `evidence.json`을 갱신한다. 이어 `npm run week6:report`는 갱신한 기록으로 HTML을 만든다. 기존 인증 이미지와 PDF는 제공 시점의 실행 기록이므로 원본 패키지를 보관하면 된다.

워크북 제출 페이지에는 이 기록의 내용, API 명세, 핵심 코드 링크와 인증 이미지를 함께 첨부하면 된다. Notion에는 캡처 이미지를 직접 첨부하고 코드 링크는 GitHub 파일 주소로 연결한다. [API 명세 주소](https://github.com/terikeipapi/umc-backend/blob/main/docs/week6/API.md), [핵심 코드 주소](https://github.com/terikeipapi/umc-backend/tree/main/src/movie), [인증 이미지 주소](https://github.com/terikeipapi/umc-backend/tree/main/output/week6/screenshots)를 사용할 수 있다. UMC 제출 사이트 업로드는 별도로 진행한다.

실제 스터디 모임 사진은 API 응답 캡처와 다른 자료다. 모임 사진이 필요한 경우 본인이 촬영한 사진을 별도로 첨부한다.
