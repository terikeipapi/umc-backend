# 8주차 백엔드 트러블슈팅 보고서

작성일: 2026년 11월 17일(한국 시간)

최종 보완·검증: 2026년 11월 18일(한국 시간).

기준: 사용자 제공 「8주차 - 서비스의 핵심 기능 만들기」 PDF. 이 문서는 이번 백엔드 실습의 이슈·문제·해결과 실제 검증을 기록한다. 앞선 프런트엔드 8주차 트러블슈팅은 별도 저장소의 과거 기록이다.

## 이슈 No.1. 기존 즐겨찾기 동작이 PDF 명세와 달랐다

**이슈**

기존 프런트엔드 API 연결용 서버는 중복 즐겨찾기 등록에 성공을 반환하고, 없던 즐겨찾기를 삭제해도 성공했다. 응답도 영화 ID와 선택 상태만 제공했다. PDF는 중복 등록 409·`FAVORITE409_1`, 없는 즐겨찾기 해제 404·`FAVORITE404_1`, 등록·목록의 `favoriteId/movieId/createdAt`을 요구했다.

**문제**

화면에서 버튼을 토글하는 편의와 워크북의 명시적인 실패 규칙을 동일한 계약이라고 가정했다. 기존 33건 검증에는 반복 추가·삭제가 성공해야 한다는 이전 명세가 들어 있어 이번 과제의 검증으로 사용할 수 없었다.

**해결**

TypeORM Repository 기반으로 서비스를 변경하고 사전 중복 검사와 INSERT 시 DB UNIQUE 충돌을 같은 409 코드로 처리했다. 삭제에는 회원·영화 조건을 사용하고 삭제 행 수가 0이면 404를 반환한다. 프런트엔드는 GET의 `{isFavorite}`와 POST의 즐겨찾기 객체를 버튼용 상태로 변환하도록 조정했다. 이전 검증 자료는 과거 기록으로 남기고 이번 워크북용 검증을 분리했다.

**검증**

실제 Postman에서 첫 등록 201, 재등록 409를 확인했다. HTTP·DB 검증에서 서로 다른 회원의 목록 분리와 동시 추가 후 찜 한 행만 존재하는 것도 확인했다. 프런트엔드 69개 회귀 테스트·타입 검사·빌드가 통과했다.

참고: [현재 API 계약](API.md), [즐겨찾기 서비스](../../src/movie/favorite.service.ts).

## 이슈 No.2. CREATE TABLE IF NOT EXISTS만으로 기존 시간 컬럼을 추가할 수 없었다

**이슈**

앞서 만들어 둔 `favorite` 테이블에는 `created_at`, `updated_at`이 없었다. 이번 Favorite 엔티티는 BaseTimeEntity에서 두 컬럼을 상속하므로 기존 DB와 엔티티가 달랐다.

**문제**

새 스키마 SQL에 컬럼을 적어도 `CREATE TABLE IF NOT EXISTS`는 이미 존재하는 테이블을 변경하지 않는다. ORM의 `synchronize:true`로 전체 DB를 자동 수정하면 기존 과제의 데이터와 테이블까지 영향을 받을 수 있다.

**해결**

`synchronize:false`를 유지하고 DB 준비 스크립트에서 INFORMATION_SCHEMA로 실제 컬럼을 조회한 뒤 없는 컬럼만 ALTER TABLE로 추가했다. 기존 찜 관계는 유지한다. 과거 등록 시각은 저장된 적이 없어 복원할 수 없으므로 기존 행의 시각은 마이그레이션 시각임을 문서에 표시했다.

**검증**

로컬 MySQL에서 추가형 마이그레이션을 실행하고 실제 POST·GET 응답의 createdAt과 ORM 매핑을 확인했다. 기존 데이터를 삭제하는 DROP/TRUNCATE 작업은 사용하지 않았다.

참고: [DB 준비 스크립트](../../scripts/week8-db.mjs), [BaseTimeEntity](../../src/movie/entities/base-time.entity.ts), [TypeORM 엔티티 상속](https://typeorm.io/docs/entity/entity-inheritance/).

## 이슈 No.3. 사전 중복 오류만 확인해서는 rollback을 증명할 수 없었다

**이슈**

이미 찜한 영화로 영화 기록을 요청해 409가 나고 평점 행이 없다는 것만으로는, 평점 INSERT 뒤 실패했을 때 실제 rollback되는지 알 수 없다. 사전 검사에서 거절됐다면 아직 어떤 INSERT도 실행되지 않았기 때문이다.

**문제**

기존의 주입된 Repository나 raw SQL 서비스 호출을 트랜잭션 콜백에 섞으면 같은 DB 연결을 사용한다고 보장할 수 없다. 단순 모의 DataSource에서 예외가 전달되는 것과 실제 MySQL의 rollback도 다르다.

**해결**

영화 기록은 `DataSource.transaction(async manager => ...)` 안에서 manager가 만든 Repository만 사용한다. 예외는 성공 응답으로 바꾸지 않고 콜백 밖으로 전파한다. 별도 로컬 검증에서는 실제 운영 서비스 클래스와 독립 DataSource를 사용해 평점을 실제 INSERT하고, 그 트랜잭션의 Favorite.save에만 실패를 주입했다. 실패용 공개 API나 DB 전역 trigger는 만들지 않았다.

**검증**

실패 직전 같은 트랜잭션에서 평점이 보였다는 `ratingVisibleBeforeFailure:true`를 기록했고, rollback 후 별도 DB 연결에서 rating/favorite이 모두 0행임을 확인했다. 이 검증은 HTTP 응답과 구분된 Service + 실제 DB 검증으로 표시했다.

참고: [실제 DB 검증 기록](../../output/week8-workbook/evidence.json), [영화 기록 서비스](../../src/movie/movie-record.service.ts), [TypeORM 트랜잭션 공식 문서](https://typeorm.io/docs/transactions/).

## 이슈 No.4. Newman 검증은 통과했지만 생성 회원 정리가 0건이었다

**이슈**

첫 Newman 실행에서 요청 26건·assertion 117개는 통과했지만 정리할 회원이 0명으로 집계됐다.

**문제**

정리 코드가 `summary.collection.variables`에서 실행 중 갱신된 회원 ID·이메일을 얻으려 했다. 해당 값은 원래 Collection 기본값이어서 런타임에 저장한 값이 반영되지 않았다.

**해결**

실제 실행된 회원가입·로그인 요청 및 응답에서 생성 ID·이메일을 얻도록 수정했다. 삭제 전 DB에서 ID와 이메일이 모두 일치하는지 검사하고 해당 회원의 연결 데이터만 정리한다. 첫 실행에 남은 데모 회원도 동일하게 확인한 후 정리했다. 정리된 회원 수가 정확히 2명인지 assertion을 추가했다.

**검증**

재실행에서 26건·117개 검증이 모두 통과했고 `cleanup.members:2`를 확인했다. 최종 JSON과 공유 Collection에는 실제 토큰·비밀번호를 남기지 않았다.

참고: [Newman 실행·정리 래퍼](../../scripts/week8-newman.mjs), [정리 결과가 포함된 실행 기록](../../output/week8-workbook/newman-results.json).

## 이슈 No.5. 생성 시각이 실제 UTC보다 9시간 늦게 반환됐다

**이슈**

실제 Postman 응답에서 한국 시간 13:49에 만든 즐겨찾기의 `createdAt`이 `13:49Z`로 표시됐다. 같은 순간의 올바른 UTC는 `04:49Z`다.

**문제**

MySQL 세션의 시간대는 `SYSTEM`이었고, `CURRENT_TIMESTAMP`는 한국 현지 시각을 DATETIME에 저장했다. 반면 ORM 연결은 `timezone:'Z'`로 DATETIME을 UTC라고 해석했다. 이 설정은 DB 세션의 NOW() 자체를 UTC로 바꾸는 설정이 아니므로, 저장된 시각과 반환값이 9시간 어긋났다.

**해결**

BaseTimeEntity의 `@BeforeInsert`에서 생성·수정 시각을 JavaScript `Date`로 명시하고 `@BeforeUpdate`에서 수정 시각을 갱신한다. ORM의 UTC 직렬화로 실제 순간을 저장하며, 서버 전체 시간대나 기존 행을 일괄 변경하지 않았다. 신규 즐겨찾기 응답이 실행 시각 범위 안에 있는지 실제 HTTP 검증과 Postman Collection의 assertion을 추가했다.

**검증**

UTC 수정이 포함된 서버로 재시작하고 실제 HTTP·DB 및 Newman 검증을 다시 실행했다. 공통 엔티티 훅의 시각 검증도 자동 테스트에 포함했다. 수정 전 화면 대신 새 UTC 응답으로 인증 자료를 갱신했다.

참고: [BaseTimeEntity](../../src/movie/entities/base-time.entity.ts), [HTTP 시각 회귀 검증](../../scripts/week8-workbook-verify.mjs).

## 최종 검증

백엔드 E2E 223개·단위 테스트 1개·빌드, 실제 HTTP 40건·DB 확인 9건, Newman 26개 요청·117개 assertion이 통과했다. 새 즐겨찾기의 생성 시각과 요청 시각 차이는 최대 14ms였다. 린트는 종료 코드 0이며 기존 `test/books.db-verification.mjs:294`의 타입 경고 두 개가 남아 있다. 제출 인증 문구·코드 링크·실제 Postman 화면은 [실습 인증과 필수 미션 기록](SUBMISSION.md)에 모았다.
