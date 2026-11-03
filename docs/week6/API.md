# 6주차 영화 평점 서비스 API 명세

구현 스택은 NestJS와 MySQL이다. 기본 URL은 `http://localhost:3000`이며 요청 본문은 `Content-Type: application/json`을 사용한다. 이 명세는 6주차 영화 평점 API에 적용된다.

## 응답 규칙

성공과 실패는 다음 네 필드를 사용한다. 삭제 성공만 HTTP 204 규칙에 따라 본문을 반환하지 않는다.

```json
{
  "isSuccess": true,
  "code": "COMMON201",
  "message": "회원가입에 성공했습니다.",
  "result": { "memberId": 1, "email": "umc@example.com", "nickname": "moviefan" }
}
```

```json
{
  "isSuccess": false,
  "code": "MEMBER4091",
  "message": "이미 사용 중인 이메일입니다.",
  "result": null
}
```

예시의 ID는 설명용이다. 실행 결과의 실제 ID와 요청·응답은 [검증 기록](../../output/week6/evidence.json)에서 확인한다. 회원가입 응답에는 `password` 또는 비밀번호 해시를 포함하지 않는다.

## API 목록

| 기능 | Method | 경로 | 성공 상태 | result |
| --- | --- | --- | --- | --- |
| 회원가입 | POST | `/members` | 201 Created | 회원 정보 |
| 이메일 중복 확인 | GET | `/members/email/:email` | 200 OK | 사용 여부 |
| 닉네임 중복 확인 | GET | `/members/nickname/:nickname` | 200 OK | 사용 여부 |
| 회원 평점 목록 | GET | `/members/:memberId/ratings` | 200 OK | 평점 배열 |
| 평점 등록 | POST | `/members/:memberId/ratings` | 201 Created | 생성된 ratingId 숫자 |
| 평점 수정 | PATCH | `/members/:memberId/ratings/:ratingId` | 200 OK | null |
| 평점 삭제 | DELETE | `/members/:memberId/ratings/:ratingId` | 204 No Content | 본문 없음 |

`memberId`와 `ratingId`는 양의 정수 경로 값이다. 현재 주차에서는 요청 경로의 `memberId`를 요청자로 사용한다. 로그인 토큰에서 요청자를 식별하는 기능은 다음 주차 범위다.

## 회원가입

`POST /members`

```json
{
  "email": "umc@example.com",
  "password": "Umc!1234",
  "nickname": "moviefan"
}
```

| 필드 | 자료형 | 필수 | 검증 |
| --- | --- | --- | --- |
| email | string | 예 | 빈 값 금지, 이메일 형식, 최대 254자 |
| nickname | string | 예 | 2~12자, 공백으로만 이루어진 값 금지 |
| password | string | 예 | 8자 이상, 영문 대문자·소문자·숫자·`!@#$%^&*` 중 특수문자 모두 포함, UTF-8 기준 최대 72바이트 |

서버는 이메일과 닉네임을 확인한 뒤 `bcrypt.hash(password, 10)`으로 해시한다. DB의 `member.password`는 60자 bcrypt 해시를 저장한다. bcrypt의 입력 절단을 피하기 위해 72바이트를 넘는 비밀번호는 거절한다.

이메일과 닉네임은 각각 UNIQUE 제약으로 보호한다. 사전 중복 확인 뒤 동시 요청이 들어와도 DB가 최종적으로 중복 저장을 막는다. 사전 확인과 DB 제약에서 발견한 중복은 같은 오류 코드로 응답한다.

중복 확인 조회의 `result`는 각각 `{ "email": "umc@example.com", "exists": true }`, `{ "nickname": "moviefan", "exists": true }` 형식이다. 미사용 값이면 `exists`가 false다.

## 평점 등록

`POST /members/:memberId/ratings`

```json
{
  "movieId": 27205,
  "score": 5,
  "comment": "다시 보고 싶은 영화입니다."
}
```

| 필드 | 자료형 | 필수 | 검증 |
| --- | --- | --- | --- |
| movieId | number | 예 | 양의 정수, 안전하게 표현 가능한 정수 |
| score | number | 예 | 1~5 정수; `"5"`, 0, 6, 4.5는 거절 |
| comment | string 또는 null | 아니요 | 문자열이면 최대 500자; 생략 또는 null이면 DB NULL |

`movieId`는 TMDB 식별자다. 로컬 `movie` 테이블을 만들거나 해당 테이블에 대한 FK를 요구하지 않는다. 요청 회원이 없으면 404, 같은 회원이 같은 영화에 남긴 평점이 있으면 409다. `(member_id, movie_id)` 복합 UNIQUE 제약으로 중복 저장을 막는다.

성공 응답:

```json
{
  "isSuccess": true,
  "code": "COMMON201",
  "message": "평점 등록에 성공했습니다.",
  "result": 1
}
```

## 평점 수정

`PATCH /members/:memberId/ratings/:ratingId`

```json
{
  "score": 4,
  "comment": "다시 본 뒤 별점을 조정했습니다."
}
```

`score`는 수정 요청에서도 필수이며 등록과 같은 1~5 정수 규칙을 사용한다. `comment`는 선택이고 생략 또는 null이면 NULL로 변경한다. `movieId`와 소유 회원은 수정할 수 없다. DTO에 없는 필드를 보내면 400으로 거절한다.

서버는 평점을 먼저 조회해 없으면 404를 반환하고, 존재하면 `rating.member_id`와 경로의 `memberId`를 비교해 다르면 403을 반환한다.

```json
{
  "isSuccess": true,
  "code": "COMMON200",
  "message": "평점 수정에 성공했습니다.",
  "result": null
}
```

## 평점 삭제와 조회

`DELETE /members/:memberId/ratings/:ratingId`는 수정과 동일한 존재·소유자 검사를 거친다. 성공하면 `204 No Content`와 빈 본문을 반환한다. 삭제 뒤 `GET /members/:memberId/ratings`로 목록에서 해당 평점이 사라졌는지 확인한다. 같은 평점에 대한 재삭제는 404다.

`GET /members/:memberId/ratings`의 성공 `result`는 `ratingId`, `memberId`, `movieId`, `score`, `comment` 필드를 가진 평점 배열이다. 평점 ID 내림차순으로 반환하고 평점이 없는 회원은 빈 배열이다. 실제 수정 전후 값은 [요청·응답 검증 기록](../../output/week6/evidence.json)을 참고한다.

## 실패 규칙

| HTTP 상태 | code | 상황 |
| --- | --- | --- |
| 400 Bad Request | COMMON4001 | DTO 검증 실패, DTO에 없는 필드, 잘못된 경로 ID 또는 JSON |
| 403 Forbidden | RATING4031 | 다른 회원 소유의 평점 수정·삭제 |
| 404 Not Found | MEMBER4041 | 존재하지 않는 회원의 평점 등록·조회 |
| 404 Not Found | RATING4041 | 존재하지 않는 평점 수정·삭제 |
| 409 Conflict | MEMBER4091 | 이메일 중복 |
| 409 Conflict | MEMBER4092 | 닉네임 중복 |
| 409 Conflict | RATING4091 | 같은 회원과 영화의 평점 중복 |
| 409 Conflict | COMMON4091 | 그 외 DB UNIQUE 제약 위반 |
| 409 Conflict | COMMON4092 | 저장 시 참조 대상이 사라지는 FK 충돌 |
| 500 Internal Server Error | COMMON500 | 예기치 못한 서버 오류 |

실패의 `result`는 항상 null이다. 검증 실패 메시지는 첫 번째 검증 사유를 전달한다. 전역 예외 필터는 SQL문·DB 자격 증명·내부 오류 상세를 응답에 포함하지 않는다.

## 실행과 재현

`.env`의 로컬 MySQL 접속 설정을 준비한 뒤 프로젝트 루트에서 실행한다.

```powershell
npm install
npm run week6:db
npm run build
npm run start:prod
```

`week6:db`는 [전용 스키마](../../sql/week6-schema.sql)의 `member`, `rating` 테이블을 준비한다. 기존 도서 테이블용 `sql/schema.sql` 대신 6주차 전용 명령을 사용한다.

[Postman Collection](week6.postman_collection.json)과 [Environment](week6.postman_environment.json)를 가져온 뒤 Environment를 선택하고 Collection Runner에서 순서대로 실행한다. 첫 요청은 새 실행 식별자를 만들고 회원·평점 ID는 후속 요청 변수로 저장한다. 컬렉션은 로컬 개발 DB에 데모 회원을 생성하고 마지막 단계에서 데모 평점을 삭제한다. 회원 삭제 API는 이번 주차 범위에 없어 데모 회원은 DB에 남는다.
