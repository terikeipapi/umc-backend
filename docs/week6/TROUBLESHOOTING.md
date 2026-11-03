# 트러블슈팅: 전역 자동 변환이 경로 ID 검증보다 먼저 실행됨

## 이슈

컴파일한 NestJS 서버에서 다음 요청을 실행했을 때 잘못된 경로 ID인데도 입력 검증 단계에서 거절되지 않았다.

```http
GET http://localhost:3000/members/1e0/ratings
```

기대한 응답은 `400 Bad Request / COMMON4001`이다. 실제 수정 전 응답은 `404 Not Found / MEMBER4041`이었으며, 요청이 서비스의 회원 조회까지 진행했다. [수정 전 원본](../../output/week6/troubleshooting-before.json)에 실제 요청과 응답을 기록했다.

```json
{
  "isSuccess": false,
  "code": "MEMBER4041",
  "message": "존재하지 않는 유저입니다.",
  "result": null
}
```

## 원인

컨트롤러의 `@Param('memberId', PositiveIdPipe) memberId: number` 선언은 컴파일 시 Number 타입 메타데이터를 만든다. 전역 `ValidationPipe({ transform: true })`가 이 정보를 사용해 문자열 `"1e0"`을 숫자 `1`로 먼저 변환했다. 뒤에서 실행되는 `PositiveIdPipe`는 원래 문자열 표현을 잃은 값을 검사했으므로 지수 표기법을 걸러내지 못했다.

NestJS는 경로·쿼리 매개변수를 선언된 원시 타입으로 자동 변환할 수 있다고 설명한다. 실제 ValidationPipe의 `transformPrimitive`도 Number 메타데이터를 만났을 때 숫자로 변환한다. 이 동작과 로컬 수정 전 응답을 함께 확인해 자동 변환 순서를 원인으로 판단했다. [NestJS Validation 문서](https://docs.nestjs.com/techniques/validation#transform-payload-objects), [ValidationPipe 공식 소스](https://github.com/nestjs/nest/blob/master/packages/common/pipes/validation.pipe.ts)

## 해결

[평점 컨트롤러](../../src/movie/rating.controller.ts)의 경로 인자 타입을 `unknown`으로 선언해 Number 자동 변환을 피했다. [PositiveIdPipe](../../src/movie/positive-id.pipe.ts)가 원래 경로 값을 숫자 문자 패턴과 양의 안전한 정수 조건으로 먼저 검사하도록 했다. 검증을 통과한 값만 서비스에 숫자로 전달한다.

```typescript
@Get(':memberId/ratings')
async getMemberRatings(
  @Param('memberId', PositiveIdPipe) memberId: unknown,
) {
  return success(
    '평점 조회에 성공했습니다.',
    await this.ratings.getRatingsByMember(Number(memberId)),
  );
}
```

등록·수정·삭제 경로의 `memberId`와 `ratingId`도 같은 방식으로 처리했다. DTO의 본문 검증과 전역 공통 오류 응답은 유지한다.

## 검증 자료

컴파일한 서버를 다시 실행한 뒤 [수정 전 원본](../../output/week6/troubleshooting-before.json)과 같은 요청을 보냈다. 수정 후 `GET /members/1e0/ratings`는 HTTP 400, `code: COMMON4001`, `result: null`을 반환했다. `+1`, `0x1` 형태의 memberId와 `1e0` 형태의 ratingId도 모두 HTTP 400으로 거절했다. 네 가지 실제 응답은 [수정 후 원본](../../output/week6/troubleshooting-after.json)에 저장했다.

```json
{
  "isSuccess": false,
  "code": "COMMON4001",
  "message": "ID는 양의 안전한 정수여야 합니다.",
  "result": null
}
```

정상적인 양의 정수 ID를 사용한 회원가입과 평점 등록·수정·삭제도 별도 실행했다. [실제 HTTP 검증 기록](../../output/week6/evidence.json)의 29개 요청이 모두 통과해 정상 흐름이 유지되는 것을 확인했다.

이 문제는 `transform: true` 자체의 오류가 아니라 원래 문자열 형식을 검사해야 하는 사용자 정의 파이프와 자동 숫자 변환의 적용 순서가 맞지 않아 발생했다. 값의 범위뿐 아니라 경로 문자열의 허용 형식을 검증할 때에는 변환 이전 값을 검사해야 한다.
