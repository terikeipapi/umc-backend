# 8주차 즐겨찾기·영화 기록 API

기준: 「8주차 - 서비스의 핵심 기능 만들기」 PDF의 NestJS 실습 1~4 및 Standard Mission. 작성일은 2026년 11월 17일이다. 아래 JSON은 계약을 설명하는 예시이며, 실제 실행 결과는 제출 기록의 증빙을 기준으로 한다.

## 인증과 공통 응답

이번 주차의 다섯 API는 모두 로그인한 회원의 Bearer 토큰이 필요하다.

```http
Authorization: Bearer {accessToken}
Content-Type: application/json
```

회원 ID는 검증된 토큰의 `sub`에서만 얻는다. 호출 URL·본문·쿼리에 `memberId`를 넣지 않는다. 본문에 선언되지 않은 `memberId` 등을 추가하면 400이다. 다른 쿼리 값을 보내더라도 로그인 회원을 바꾸는 근거로 사용하지 않는다.

PDF의 예시는 전역 인증 설정을 사용하지만, 이 프로젝트는 기존 공개 API를 유지하고 [즐겨찾기 컨트롤러](../../src/movie/favorite.controller.ts)와 [영화 기록 컨트롤러](../../src/movie/movie-record.controller.ts)에 `@UseGuards(JwtAuthGuard)`를 적용했다. 두 컨트롤러의 모든 요청은 실제 JWT 서명·만료 검사를 통과해야 한다. 단순 JWT 디코딩으로 인증을 대신하지 않는다.

성공·실패 응답은 모두 `{isSuccess,code,message,result}` 형식이다. 성공 메시지는 기능에 따라 달라지며, 클라이언트는 상태 코드와 `isSuccess`, `code`, `result`를 기준으로 처리한다.

| Method | URL | 요청 본문 | 성공 |
| --- | --- | --- | --- |
| POST | `/favorites` | `movieId` | 201, `COMMON201`, 즐겨찾기 객체 |
| GET | `/favorites` | 없음 | 200, `COMMON200`, 배열 |
| GET | `/favorites/{movieId}` | 없음 | 200, `COMMON200`, `{isFavorite}` |
| DELETE | `/favorites/{movieId}` | 없음 | 200, `COMMON200`, `null` |
| POST | `/movie-records` | `movieId`, `score`, 선택 `comment`, `addToFavorites` | 201, `COMMON201`, `{rating,favorite}` |

## 즐겨찾기 등록

```http
POST /favorites
```

```json
{
  "movieId": 550
}
```

```json
{
  "isSuccess": true,
  "code": "COMMON201",
  "message": "찜한 영화에 추가했습니다.",
  "result": {
    "favoriteId": 1,
    "movieId": 550,
    "createdAt": "2026-11-17T04:00:00.000Z"
  }
}
```

`movieId`는 TMDB 영화의 양의 안전한 정수이며 로컬 movie 테이블의 외래 키가 아니다. `favoriteId`는 우리 서버가 생성한 즐겨찾기 행 ID다. 같은 회원·영화의 중복 등록은 409·`FAVORITE409_1`이다. 사전 존재 검사와 DB의 `UNIQUE(member_id,movie_id)`를 함께 사용하고, 동시 삽입에서 발생한 DB 중복 오류도 같은 코드로 변환한다.

## 내 즐겨찾기 목록

```http
GET /favorites
```

`result`는 로그인 회원의 즐겨찾기만 담은 배열이다. 각 원소는 등록 응답과 같은 `{favoriteId,movieId,createdAt}`이고 `favoriteId DESC`로 최신 등록 순서다. 비어 있으면 200·`COMMON200`과 `result: []`를 반환한다.

## 특정 영화의 즐겨찾기 여부

```http
GET /favorites/550
```

```json
{
  "isSuccess": true,
  "code": "COMMON200",
  "message": "영화의 찜 여부를 조회했습니다.",
  "result": {
    "isFavorite": true
  }
}
```

등록하지 않은 영화도 정상 조회이므로 200과 `isFavorite: false`다. `movieId` 경로는 양의 10진 정수만 허용한다. `0`, 음수, 소수, `1e0`, 안전한 정수 범위 초과 값은 400이다.

## 즐겨찾기 해제

```http
DELETE /favorites/550
```

```json
{
  "isSuccess": true,
  "code": "COMMON200",
  "message": "찜한 영화에서 삭제했습니다.",
  "result": null
}
```

삭제 조건에는 토큰에서 확인한 회원과 영화가 함께 들어간다. 다른 회원에게 해당 영화가 있더라도 본인의 관계가 없으면 404·`FAVORITE404_1`이다. 같은 해제 요청을 다시 보내는 경우도 이미 관계가 없으므로 404다.

## 영화 기록 저장

```http
POST /movie-records
```

```json
{
  "movieId": 238,
  "score": 5,
  "comment": "다시 보고 싶은 영화입니다.",
  "addToFavorites": true
}
```

```json
{
  "isSuccess": true,
  "code": "COMMON201",
  "message": "영화 기록을 저장했습니다.",
  "result": {
    "rating": {
      "ratingId": 3,
      "memberId": 7,
      "movieId": 238,
      "score": 5,
      "comment": "다시 보고 싶은 영화입니다."
    },
    "favorite": {
      "favoriteId": 2,
      "movieId": 238,
      "createdAt": "2026-11-17T04:10:00.000Z"
    }
  }
}
```

응답의 `rating.memberId`는 기존 평점 응답과의 호환을 위해 서버가 포함하는 값이며 요청 입력값이 아니다. `ratingId`와 `favoriteId`는 서로 다른 테이블의 ID다.

| 필드 | 검증 |
| --- | --- |
| `movieId` | 필수, 1~`Number.MAX_SAFE_INTEGER` 정수 |
| `score` | 필수, 1~5 정수 |
| `comment` | 선택, 문자열 또는 null, 최대 500자 |
| `addToFavorites` | 필수, JSON boolean. 문자열 `"true"`, 숫자, null은 허용하지 않음 |

`addToFavorites: false`이면 평점만 저장하고 `result.favorite`는 `null`이다. 이미 즐겨찾기한 영화여도 false 요청의 평점 등록은 가능하다. 평점이 이미 있다면 두 모드 모두 409·`RATING409_1`이다. true 요청에서 즐겨찾기만 이미 있다면 409·`FAVORITE409_1`이고 새 평점을 남기지 않는다.

[영화 기록 서비스](../../src/movie/movie-record.service.ts)는 `DataSource.transaction()` 안에서 전달받은 `manager.getRepository()`로만 회원 조회와 두 저장을 실행한다. 저장 도중 발생한 예외를 콜백 밖으로 전달해 전체 rollback을 유도한다. 전역 Repository와 별도 RatingService·FavoriteService 호출을 섞지 않는다. [TypeORM 공식 트랜잭션 문서](https://typeorm.io/docs/transactions/)

## 실패 응답

```json
{
  "isSuccess": false,
  "code": "FAVORITE409_1",
  "message": "이미 이 영화를 즐겨찾기하셨습니다.",
  "result": null
}
```

| HTTP | code | 상황 |
| --- | --- | --- |
| 400 | `COMMON4001` | DTO·경로 검증 실패, 추가 본문 필드 |
| 401 | `AUTH401_2` | Bearer 헤더 없음 또는 형식 오류 |
| 401 | `AUTH401_3` | 위조·변조·서명·클레임 오류 |
| 401 | `AUTH401_4` | 토큰 만료 |
| 404 | `MEMBER404_1` | 토큰 회원에 대응하는 DB 회원이 없음 |
| 404 | `FAVORITE404_1` | 해제할 본인의 즐겨찾기가 없음 |
| 409 | `FAVORITE409_1` | 같은 회원·영화의 즐겨찾기 중복 |
| 409 | `RATING409_1` | 영화 기록 요청의 평점 중복 |
| 500 | `COMMON500` | 예상하지 못한 서버 오류. SQL·비밀값은 응답에 포함하지 않음 |

401은 요청자를 확인하지 못한 상황이고, 404는 요청자를 확인한 뒤 대상 관계를 찾지 못한 상황이다. 이번 API가 401로 보호되더라도 소유권 조건과 입력 검증은 별도로 유지한다.

## 구현 위치

- [Favorite·BaseTimeEntity](../../src/movie/entities/favorite.entity.ts), [시간 컬럼](../../src/movie/entities/base-time.entity.ts)
- [FavoriteService와 Repository 사용](../../src/movie/favorite.service.ts)
- [즐겨찾기 Controller](../../src/movie/favorite.controller.ts)
- [MovieRecordService 트랜잭션](../../src/movie/movie-record.service.ts), [Controller](../../src/movie/movie-record.controller.ts)
- [영화 기록 요청 DTO](../../src/movie/dto/create-movie-record.dto.ts), [공통 평점 검증](../../src/movie/dto/create-rating.dto.ts)
- [인증 Guard](../../src/auth/jwt-auth.guard.ts), [공통 실패 응답 필터](../../src/common/http-exception.filter.ts)

Swagger UI는 선택 Challenge Mission이며 이번 필수 구현 범위에는 포함하지 않았다.
