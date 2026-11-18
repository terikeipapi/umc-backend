# 8주차 실습 인증과 필수 미션 기록

작성일: 2026년 11월 17일(한국 시간)

최종 보완·검증: 2026년 11월 18일(한국 시간). 생성 시각 UTC 처리와 제출 자료를 보완했다.

기준 자료: 사용자 제공 「8주차 - 서비스의 핵심 기능 만들기」 PDF의 NestJS 실습 1~4, 38쪽 체크리스트·실습 인증, 39쪽 Standard Mission, 41~42쪽 트러블슈팅 형식.

이번 PDF는 앞서 진행한 프런트엔드 8주차 미션과 구분되는 **백엔드 워크북**이다. PDF에 있는 실습과 필수 미션을 NestJS로 구현했다. 아래 인증 문구는 실제 실행 결과를 근거로 복사해서 사용할 수 있도록 작성했다.

[전체 제출 패키지 ZIP](../../output/week8-workbook-submission.zip)에는 구현 소스·테스트·설정 예제·제출 문구·보고서·인증 이미지를 모았다. 실제 `.env`, 의존성·빌드·임시 폴더와 원본 강의 PDF는 포함하지 않는다.

## 실습 수행 내용

| 실습 | 구현 | 확인 근거 |
| --- | --- | --- |
| 1. Favorite 엔티티와 DTO | `Favorite extends BaseTimeEntity`, 회원 관계, TMDB 영화 ID, 복합 UNIQUE, 생성·수정 시각, 요청·응답 DTO | [엔티티](../../src/movie/entities/favorite.entity.ts), [공통 시간 엔티티](../../src/movie/entities/base-time.entity.ts) |
| 2. 즐겨찾기 API | 토큰 회원으로 등록·목록·여부 조회·해제, 최신 등록 순서, `favoriteId/movieId/createdAt` 응답 | [서비스](../../src/movie/favorite.service.ts), [컨트롤러](../../src/movie/favorite.controller.ts), 실제 Postman 캡처 |
| 3. 영화 기록과 트랜잭션 | `POST /movie-records`, `addToFavorites: true`일 때 두 저장을 같은 manager로 수행, false는 평점만 저장 | [트랜잭션 서비스](../../src/movie/movie-record.service.ts), 실제 HTTP·DB rollback 검사 |
| 4. 실패를 서비스 규칙으로 처리 | 무토큰 401, 중복 찜 409, 없는 찜 삭제 404, 잘못된 ID 400, 빈 목록·미등록 상태는 200 | [실제 HTTP 기록](../../output/week8-workbook/evidence.json), [Postman Collection 실행 기록](../../output/week8-workbook/newman-results.json) |

기존 회원·평점 API를 유지하기 위해 `Member`, `Rating`의 TypeORM 매핑은 현재 테이블에 맞춰 추가했다. 기존 raw SQL API를 호출해 트랜잭션을 우회하지 않고, 영화 기록의 모든 조회·저장은 `manager.getRepository()`로 가져온 Repository만 사용한다. 새 즐겨찾기 시각은 공통 엔티티의 저장 훅에서 실제 UTC 시각으로 설정하며, DB 세션의 현지 시각을 UTC로 오해해 9시간 어긋나는 문제를 수정했다.

## 실습 인증에 넣을 내용

> NestJS와 TypeORM으로 즐겨찾기 API 4개와 영화 기록 저장 API를 구현했다. Favorite은 BaseTimeEntity를 상속하고, 로그인 회원과 TMDB movieId를 함께 저장하도록 만들었다. 요청의 URL·본문·쿼리로 회원을 선택하지 않고, 검증된 Bearer 토큰의 회원 ID를 사용했다.
>
> Postman에서 즐겨찾기 등록 201, 같은 영화 중복 등록 409·FAVORITE409_1, 내 목록 조회 200, 영화별 즐겨찾기 여부 조회 200, 해제 200·result:null을 확인했다. 미등록 상태는 isFavorite:false이며, 없는 즐겨찾기를 다시 삭제하면 404·FAVORITE404_1을 반환한다.
>
> POST /movie-records에 addToFavorites:true를 보내 평점과 즐겨찾기가 함께 반환되는 201 응답을 확인했다. DataSource.transaction() 안에서 두 저장을 수행하고, 실제 MySQL에 평점 INSERT가 실행된 뒤 즐겨찾기 저장을 실패시키는 별도 검증으로 두 데이터가 모두 남지 않는 rollback도 확인했다.

트랜잭션 코드 캡처 옆에는 다음 한 문장을 넣으면 된다.

> 평점과 즐겨찾기는 하나의 영화 기록을 구성하므로, 즐겨찾기 저장에 실패했을 때 먼저 저장한 평점까지 되돌리기 위해 같은 DataSource.transaction()으로 묶었다.

## 제출할 인증 이미지

아래 API 이미지는 **실제 Postman 데스크톱 앱에서 로컬 서버에 요청하고 받은 화면**이다. 자동 실행 JSON을 Postman 화면처럼 만든 이미지와 구분한다. 스크린샷에는 회원 액세스 토큰 값을 표시하지 않는다.

| 인증 항목 | 이미지 | 확인할 내용 |
| --- | --- | --- |
| 무토큰 인증 실패(추가 증빙) | [00-no-token-401.png](../../output/week8-workbook/captures/00-no-token-401.png) | 401, AUTH401_2 |
| 즐겨찾기 등록 | [01-favorite-created-201.png](../../output/week8-workbook/captures/01-favorite-created-201.png) | POST, movieId만 있는 본문, 201, favoriteId·createdAt |
| 같은 영화 중복 등록 | [02-favorite-duplicate-409.png](../../output/week8-workbook/captures/02-favorite-duplicate-409.png) | 409, FAVORITE409_1 |
| 내 즐겨찾기 목록 | [03-favorite-list-200.png](../../output/week8-workbook/captures/03-favorite-list-200.png) | GET /favorites, 배열 |
| 영화별 즐겨찾기 여부 | [04-favorite-status-200.png](../../output/week8-workbook/captures/04-favorite-status-200.png) | GET /favorites/550, isFavorite:true |
| 즐겨찾기 해제 | [05-favorite-deleted-200.png](../../output/week8-workbook/captures/05-favorite-deleted-200.png) | DELETE /favorites/550, 200, result:null |
| 영화 기록 저장 | [06-movie-record-created-201.png](../../output/week8-workbook/captures/06-movie-record-created-201.png) | POST /movie-records, 201, rating·favorite |
| 트랜잭션 코드 | [07-transaction-source.png](../../output/week8-workbook/captures/07-transaction-source.png) | 실제 서비스 소스 발췌, DataSource.transaction, 같은 manager의 두 save |

마지막 코드 이미지는 원본 서비스 파일을 행 번호와 함께 표시한 코드 자료이며 Postman 화면이 아니다.

인증 자료 준비에 사용한 데모 계정도 생성 ID·이메일·닉네임을 확인한 뒤 연결 데이터와 함께 정리했다. [Postman 데스크톱 검증 데이터 정리 기록](../../output/week8-workbook/postman-desktop-cleanup.json)에 삭제 건수를 남겼다.

## 필수 미션 기록에 넣을 내용

> 필수 미션은 NestJS로 진행했다. Favorite 엔티티·TypeORM Repository·Service·Controller와 DTO를 구성하고 POST /favorites, GET /favorites, GET /favorites/{movieId}, DELETE /favorites/{movieId}, POST /movie-records를 완성했다. BaseTimeEntity에서 생성·수정 시각을 상속하고, 회원과 영화 ID의 복합 UNIQUE로 중복 데이터를 방지했다.
>
> 구현 전에 기존 API와 PDF 명세를 비교했다. 앞선 프런트엔드 연결용 구현은 중복 등록·없는 항목 삭제를 성공으로 처리했지만, 이번 PDF는 각각 FAVORITE409_1과 FAVORITE404_1을 요구했다. 서비스 규칙을 명세에 맞추고 기존 프런트엔드의 즐겨찾기 응답 처리도 조정했다. 기존 찜 데이터는 보존하면서 누락된 시간 컬럼만 추가했다.
>
> 영화 기록 서비스는 한 트랜잭션의 manager에서 회원·평점·즐겨찾기 Repository를 얻어 사용한다. 기존 평점과 찜을 먼저 검사하고, 동시 요청으로 사전 검사를 통과한 중복 INSERT도 DB UNIQUE 오류를 해당 409 코드로 변환한다. addToFavorites:false는 favorite:null을 반환하며 기존 찜은 삭제하지 않는다.
>
> 실제 HTTP 40건과 DB 확인 9건, Postman Collection의 Newman 실행 26개 요청·117개 검증이 통과했다. DB 검증에는 두 번째 저장 실패 시 이미 INSERT한 평점도 rollback되는 시나리오가 포함된다. 백엔드 E2E 223개·단위 테스트 1개·빌드와 프런트엔드 회귀 테스트 69개·타입 검사·빌드도 통과했다. 구현 중 발견한 명세 차이, 스키마 이행, 트랜잭션 검증, Newman 정리, 생성 시각의 시간대 문제는 별도 트러블슈팅 보고서에 정리했다.

## 구현 중간 과정

1. PDF의 실습·Standard Mission·실패 코드와 앞선 구현을 비교해 다섯 API의 계약을 정리했다.
2. Favorite의 공통 시간 상속, 회원 관계, 외부 TMDB ID, 복합 UNIQUE를 TypeORM으로 매핑했다. `synchronize:false`를 유지해 자동 스키마 변경을 막았다.
3. 기존 DB를 삭제하지 않고 없는 `created_at`, `updated_at`만 추가했다. 과거 찜의 실제 등록 시각은 복원할 수 없어 기존 행은 마이그레이션 시각으로 채운다는 점을 기록했다.
4. 즐겨찾기 등록은 사전 중복 검사와 DB UNIQUE 오류 처리를 함께 적용했다. 해제는 로그인 회원·영화 조건으로 삭제하고 대상이 없으면 404로 응답한다.
5. 영화 기록 DTO에서 양의 안전한 정수 ID, 1~5 정수 별점, 500자 이하 후기, 필수 boolean을 검증했다. 문자열 `"true"`나 요청 본문의 `memberId`는 거절한다.
6. `DataSource.transaction()`의 manager로만 두 저장을 묶고 예외를 콜백 밖으로 전파해 rollback을 보장했다.
7. 성공·실패 응답과 실제 DB 행 수를 검증했다. 실패를 사전 검사에서 끝내는 경우와 첫 INSERT 후 실제로 rollback하는 경우를 별도로 확인했다.
8. Postman Collection을 실제 Newman으로 실행하고, 데스크톱 Postman에서 대표 요청·응답 화면을 캡처했다. 토큰·비밀번호를 제외한 실행 기록과 코드 링크를 정리했다.

## 핵심 코드와 자료

- [BaseTimeEntity](../../src/movie/entities/base-time.entity.ts), [Favorite](../../src/movie/entities/favorite.entity.ts), [회원·영화 UNIQUE 정의](../../sql/week8-favorites.sql)
- [즐겨찾기 서비스](../../src/movie/favorite.service.ts), [즐겨찾기 컨트롤러](../../src/movie/favorite.controller.ts)
- [영화 기록 서비스](../../src/movie/movie-record.service.ts), [영화 기록 컨트롤러](../../src/movie/movie-record.controller.ts), [영화 기록 요청 DTO](../../src/movie/dto/create-movie-record.dto.ts)
- [API 명세](API.md), [학습 키워드·학습 후기 초안](LEARNING.md), [트러블슈팅 보고서](TROUBLESHOOTING.md)
- [Postman Collection](week8.postman_collection.json), [빈 토큰 환경 파일](week8.postman_environment.json)
- [실제 HTTP·DB 검증](../../output/week8-workbook/evidence.json), [Newman 결과](../../output/week8-workbook/newman-results.json)

## 재현과 검증 범위

```powershell
# 기존 .env의 로컬 DB/JWT 설정을 사용한다. 실제 .env는 제출하지 않는다.
npm.cmd run week8:db
npm.cmd run build
npm.cmd run start:prod

# 다른 터미널
npm.cmd run week8:verify
node scripts/week8-newman.mjs
npm.cmd run test:e2e
npm.cmd test
```

실제 HTTP와 Newman 검증은 격리된 테스트 회원 두 명을 만들고 생성 ID·이메일을 함께 확인해 정리한다. Newman 프로세스가 강제로 종료되거나 실행기 자체가 치명적 오류로 중단되면 정리가 실행되지 않을 수 있으므로 해당 실행의 데모 회원을 확인해야 한다. Postman 앱에서 Collection을 직접 실행하는 경우에도 생성한 학습용 데이터만 확인해 정리한다. 공유하는 Collection·환경 파일의 토큰과 비밀번호 기본값은 비어 있다.

| 검증 | 결과 |
| --- | --- |
| 백엔드 E2E | 7개 파일, 223개 통과 (UTC 시각 회귀 검증 포함) |
| 백엔드 단위 테스트·빌드 | 1개 통과·빌드 통과 |
| 실제 로컬 HTTP | 40/40 통과 |
| 실제 MySQL DB 검사 | 9건 통과, 실제 INSERT 후 rollback 포함 |
| 실제 Newman | 26개 요청·117개 검증, 실패 0 |
| 프런트엔드 회귀 검증 | 타입 검사·69개 테스트·프로덕션 빌드 통과 |
| 백엔드 린트 | 종료 코드 0, 기존 도서 검증 파일의 타입 경고 2개 |

선택 Challenge인 Swagger 적용은 이번 요청의 필수 범위에 포함하지 않았다. 학습 키워드의 낙관적 잠금은 개념 조사이며 실제 버전 컬럼 구현을 주장하지 않는다. 스터디 모임 사진, 원본 Notion 수정, UMC 사이트 제출, CodeRabbit 요청은 수행하지 않았다.

기존 `output/week8/api-verification.json`의 33건은 앞선 프런트엔드 연결용 명세의 과거 기록이다. **이번 PDF 제출에는 `output/week8-workbook/` 자료를 사용한다.**
