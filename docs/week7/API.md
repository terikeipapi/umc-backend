# 7주차 API 명세

6주차 회원가입·공개 조회 기능에 로그인, 내 정보 조회·수정과 토큰 기반 평점 쓰기를 추가한다. 모든 응답은 `isSuccess`, `code`, `message`, `result`로 구성한다. 평점 삭제도 HTTP 200과 `result: null`을 반환한다.

## 요청 경로

| 기능 | 요청 | 인증 | 성공 |
| --- | --- | --- | --- |
| 회원가입 | `POST /members` | 공개 | 201, `COMMON201` |
| 로그인 | `POST /auth/login` | 공개 | 200, `COMMON200` |
| 내 정보 조회 | `GET /members/me` | Bearer 토큰 | 200, `COMMON200` |
| 내 닉네임 수정 | `PATCH /members/me` | Bearer 토큰 | 200, `COMMON200` |
| 회원별 평점 조회 | `GET /members/:memberId/ratings` | 공개 | 200, `COMMON200` |
| 평점 등록 | `POST /ratings` | Bearer 토큰 | 201, `COMMON201` |
| 평점 수정 | `PATCH /ratings/:ratingId` | Bearer 토큰 | 200, `COMMON200` |
| 평점 삭제 | `DELETE /ratings/:ratingId` | Bearer 토큰 | 200, `COMMON200`, result null |

이메일·닉네임 중복 확인 경로 `GET /members/email/:email`, `GET /members/nickname/:nickname`도 공개 경로로 유지한다. 기존 `POST /members/:memberId/ratings`, `PATCH/DELETE /members/:memberId/ratings/:ratingId`는 제거한다.

## 인증

보호된 요청은 다음 헤더를 사용한다.

```http
Authorization: Bearer {accessToken}
```

로그인으로 받은 토큰의 서명·만료 시간을 Guard에서 검사하고 검증된 `sub`를 회원 식별자로 사용한다. 요청 바디와 경로에서 로그인 회원의 `memberId`를 받지 않는다. Guard가 통과해도 수정·삭제할 평점의 작성자가 다르면 서비스의 소유권 검사에서 403으로 거절한다.

`JWT_SECRET`은 서버 환경 변수로만 관리한다. `.env.example`의 안내를 참고해 로컬 `.env`를 준비하며 실제 비밀키를 코드·응답·제출 자료에 넣지 않는다. 일반 실행의 `JWT_ACCESS_EXPIRATION` 단위는 초이다. 실습 인증용 별도 서버는 예시 토큰을 빠르게 만료시키기 위해 프로세스 환경 값만 15초로 설정했다면, 그 실제 유효시간을 실행 기록에서 확인한다.

## 로그인

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "email": "movie@example.com",
  "password": "Umc!1234"
}
```

정상 응답의 `result`는 `nickname`과 `accessToken`이다. 로그인에서는 이메일 형식과 비어 있지 않은 비밀번호를 확인하며 신규 가입용 비밀번호 조합 정책을 다시 강제하지 않는다. 저장된 bcrypt 해시와 입력을 비교한다. 존재하지 않는 이메일과 틀린 비밀번호는 모두 같은 상태·코드·메시지로 응답한다.

```json
{
  "isSuccess": false,
  "code": "AUTH401_1",
  "message": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "result": null
}
```

## 내 정보

`GET /members/me`의 `result`에는 다음 세 필드만 포함한다. `createdAt`은 DB에 저장된 가입 시각이며 닉네임 수정 뒤에도 유지한다.

```json
{
  "email": "movie@example.com",
  "nickname": "영화광",
  "createdAt": "2026-11-10T09:00:00.000Z"
}
```

`PATCH /members/me`는 아래 바디를 받으며 수정된 내 정보와 같은 응답 형태를 반환한다. 닉네임은 2~12자이고 공백만으로 구성할 수 없다. 허용하지 않은 필드는 400으로 거절한다.

```json
{
  "nickname": "새영화광"
}
```

## 평점 쓰기

`POST /ratings` 바디에는 회원 ID가 없다. `movieId`는 양의 안전한 정수, `score`는 1~5 정수, 선택 `comment`는 최대 500자이다.

```json
{
  "movieId": 27205,
  "score": 5,
  "comment": "다시 보고 싶은 영화입니다."
}
```

등록 성공은 HTTP 201이며 `result.ratingId`를 포함한 평점 객체를 반환한다. 작성자는 검증된 토큰에서 결정한다. `PATCH /ratings/:ratingId`는 `score`와 선택 `comment`를 받고 수정된 평점 객체를 반환한다.

```json
{
  "score": 4,
  "comment": "수정한 후기입니다."
}
```

`DELETE /ratings/:ratingId` 성공은 HTTP 200이며 공통 성공 응답의 `result`가 null이다. 없는 평점은 404를 먼저 반환하고, 존재하는 평점의 작성자가 다른 경우 403을 반환한다.

## 실패 코드

| HTTP | code | 의미 |
| --- | --- | --- |
| 400 | `COMMON4001` | DTO·경로 입력값 오류, 허용하지 않은 필드 |
| 401 | `AUTH401_1` | 이메일 또는 비밀번호가 올바르지 않음 |
| 401 | `AUTH401_2` | 인증 헤더·Bearer 토큰 누락 또는 헤더 형식 오류 |
| 401 | `AUTH401_3` | 위조·변조·잘못된 클레임 등 유효하지 않은 토큰 |
| 401 | `AUTH401_4` | 토큰 만료 |
| 404 | `MEMBER404_1` | 회원 없음 |
| 409 | `MEMBER409_1` | 내 정보 수정 시 닉네임 중복 |
| 404 | `RATING404_1` | 평점 없음 |
| 403 | `RATING403_1` | 존재하는 평점의 작성자가 아님 |
| 409 | `RATING409_1` | 같은 회원·영화의 평점 중복 |

회원가입의 기존 이메일·닉네임 중복 코드는 6주차 명세를 유지할 수 있다. 위 표의 `MEMBER409_1`은 이번 주차 내 정보 수정의 코드이다.

## 실행 기록과 재현

- [실습 인증·미션 기록](SUBMISSION.md)
- [Postman Collection](week7.postman_collection.json), [Environment](week7.postman_environment.json)
- 실제 HTTP 기록 생성: `node scripts/week7-verify.mjs`
- 실제 기록 HTML 생성: `node scripts/week7-report.mjs`
- 실제 기록 PNG 생성: 번들 Python으로 `scripts/week7-captures.py` 실행

위 JSON은 명세 예시이다. 실제 수행 시각·응답·토큰·회원 ID는 성공한 실행 후 생성되는 `output/week7/evidence.json`을 기준으로 한다.
