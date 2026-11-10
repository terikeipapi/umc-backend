# 7주차 트러블슈팅: Postman 테스트 스크립트 이름 충돌

## 이슈

첫 Newman 실행에서 회원가입·로그인 HTTP 응답은 성공했지만 23개 요청의 테스트 스크립트가 모두 아래 오류로 실패했다.

```text
SyntaxError
Identifier 'data' has already been declared
at test-script
inside "01 준비 - 회원 A 가입"
```

로그인 결과의 토큰과 회원 ID를 저장하는 스크립트도 실행되지 않아 후속 평점 요청에는 유효한 토큰이 전달되지 않았다. 이후의 401은 이 실패에서 이어진 결과였다. 토큰이 발급된 HTTP 200 응답 자체와 스크립트 실패를 구분했다.

최초 실행 요약은 [newman-first-failure-summary.json](../../output/week7/newman-first-failure-summary.json)에 보관했다.

## 문제

각 테스트 스크립트의 최상위에 `const data = pm.response.json()`을 사용했다. 첫 요청 파일에서 이 선언은 한 번만 있었지만 Newman 샌드박스 실행 중 같은 이름의 선언과 충돌했다. 샌드박스 내부에서 충돌하는 선언이 어디서 만들어졌는지까지는 확정하지 않았다.

## 해결

응답 변수명을 `responseData`로 바꾸고 각 요청의 테스트와 사전 요청 스크립트를 즉시 실행 함수로 감싸 로컬 범위를 만들었다.

```js
(function () {
  const responseData = pm.response.json();
  pm.test("공통 응답 형식", function () {
    pm.expect(Object.keys(responseData).sort()).to.eql([
      "code", "isSuccess", "message", "result",
    ]);
  });
})();
```

토큰·ID 저장 코드는 같은 로컬 범위에서 응답을 읽고 `pm.environment.set()`으로 후속 요청에 전달한다. 가입 단계부터 새 데모 회원으로 컬렉션 전체를 다시 실행했다.

## 확인 결과

수정된 컬렉션의 요청 23개와 assertion 137개가 모두 통과했다. PDF의 필수 9단계 순서를 유지했으며 본인 평점 생성 201, 중복 409, 타인 수정 403, 무토큰 401, 없는 평점 404와 본인 삭제 200을 확인했다.

실행 결과: [newman-results.json](../../output/week7/newman-results.json)

## 배운 점

HTTP 성공 여부와 응답 뒤에 실행되는 테스트 스크립트의 성공 여부를 함께 확인한다. 토큰이나 ID를 저장하는 단계가 실패하면 뒤의 요청에서 연쇄 오류가 발생할 수 있으므로 최초 실패부터 확인한다. 공통 스크립트의 변수는 로컬 범위에 두고 실제 컬렉션 러너에서 검증한다.

## 참고 자료

- [Postman 공식 Newman CLI 문서](https://learning.postman.com/docs/reference/newman-cli/command-line-integration-with-newman/)
- [실습 인증·미션 기록](SUBMISSION.md)
