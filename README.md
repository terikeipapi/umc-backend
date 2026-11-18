# UMC 백엔드 스터디

## 8주차: 서비스의 핵심 기능 만들기

사용자 제공 백엔드 PDF의 NestJS 실습 1~4와 Standard Mission을 구현했습니다. Favorite은 BaseTimeEntity를 상속하며 TypeORM Repository로 회원별 즐겨찾기를 관리합니다. 모든 요청에는 `Authorization: Bearer <accessToken>`이 필요하고, 회원 ID는 검증한 JWT에서만 읽습니다.

| 요청 | 요청 본문 | 성공 `result` |
| --- | --- | --- |
| `GET /favorites` | 없음 | `[{ "favoriteId": 1, "movieId": 550, "createdAt": "..." }]` |
| `GET /favorites/550` | 없음 | `{ "isFavorite": true }` |
| `POST /favorites` | `{ "movieId": 550 }` | `{ "favoriteId": 1, "movieId": 550, "createdAt": "..." }` (201) |
| `DELETE /favorites/550` | 없음 | `null` (200) |
| `POST /movie-records` | `movieId, score, comment?, addToFavorites` | `{ "rating": { ... }, "favorite": { ... } }` (201) |

찜이 없는 목록은 빈 배열이며, 찜하지 않은 영화 조회는 `isFavorite: false`입니다. 중복 등록은 **409·FAVORITE409_1**, 없는 찜 삭제는 **404·FAVORITE404_1**입니다. DB의 `(member_id, movie_id)` 유일 제약은 동시 요청의 중복도 막습니다. 영화 기록은 `DataSource.transaction()`에서 같은 manager의 Repository로 두 저장을 묶습니다. `addToFavorites:false`면 평점만 저장하고 `favorite:null`을 반환합니다.

- [실습 인증·필수 미션 기록과 실제 화면](docs/week8/SUBMISSION.md)
- [트러블슈팅 보고서](docs/week8/TROUBLESHOOTING.md), [API 명세](docs/week8/API.md), [학습 키워드·후기 초안](docs/week8/LEARNING.md)
- [Postman Collection](docs/week8/week8.postman_collection.json), [Environment](docs/week8/week8.postman_environment.json)
- [소스·보고서·인증 자료 제출 ZIP](output/week8-workbook-submission.zip)

```bash
npm run week8:db
npm run build
npm run start:prod
# 다른 터미널
npm run week8:verify
node scripts/week8-newman.mjs
npm run test:e2e
```

`week8:db`는 기존 테이블·찜 데이터를 유지하고 필요한 테이블 및 시간 컬럼을 준비합니다. 과거 찜의 원래 생성 시각은 저장되지 않았으므로 기존 행에는 마이그레이션 시각이 채워집니다. `week8:verify`는 실제 HTTP 40건과 DB 검사 9건을 수행하고 격리된 검증 회원을 정리합니다. 첫 INSERT 뒤의 실제 rollback도 별도로 검사합니다. [HTTP·DB 기록](output/week8-workbook/evidence.json)과 [Newman 기록](output/week8-workbook/newman-results.json)은 토큰·비밀번호를 제외한 자료입니다.

검증 결과(2026년 11월 18일 보완): 빌드·단위 테스트 1개·E2E 223개·실제 HTTP 40건·DB 검사 9건·Newman 요청 26개와 검증 117개 통과. 공통 엔티티의 UTC 저장 훅과 시각 회귀 검사도 포함합니다. 린트는 종료 코드 0이며 기존 `test/books.db-verification.mjs:294`의 타입 경고 2건이 남아 있습니다. PowerShell 실행 정책으로 `npm` 실행이 차단되면 `npm.cmd`를 사용합니다.

앞선 프런트엔드 연결용 [33건 검증 기록](output/week8/api-verification.json)은 당시 upsert·반복 삭제 성공 계약의 과거 자료입니다. 이번 PDF 제출에는 `docs/week8/`와 `output/week8-workbook/` 자료를 사용하세요.

## 7주차: 로그인한 사용자를 구분하기

NestJS와 MySQL로 JWT 로그인, 인증 Guard, 내 정보 조회·닉네임 수정, 토큰 기반 평점 등록·수정·삭제를 구현했습니다. 현재 평점 쓰기는 `/ratings`와 `/ratings/:ratingId`를 사용하며, 삭제 성공은 200과 `result: null`을 반환합니다. 공개 회원별 평점 조회는 유지합니다.

- [실습 인증 문구·필수 미션 기록·수행 과정](docs/week7/SUBMISSION.md)
- [7주차 API 명세](docs/week7/API.md), [실제 요청·응답 HTML](output/week7/report.html)
- [필수 응답 이미지 4장](output/week7/captures/), [HTTP·DB 원본](output/week7/evidence.json)
- [Postman Collection](docs/week7/week7.postman_collection.json), [Environment](docs/week7/week7.postman_environment.json), [Newman 실행 결과](output/week7/newman-results.json)
- [트러블슈팅 기록](docs/week7/TROUBLESHOOTING.md)
- [7주차 전체 제출 패키지 ZIP](output/week7-submission.zip)

검증 결과: 단위 테스트 1개, E2E 163개, 실제 HTTP 28건, Newman 요청 23개·assertion 137개 및 빌드 통과. 이미지 4장은 실제 HTTP 기록을 이미지로 만든 자료이며 Postman UI 캡처는 아닙니다. jwt.io 직접 조작은 브라우저 접근 제한으로 로컬 디코딩으로 대체했습니다.

`.env.example`의 DB 설정과 비공개 `JWT_SECRET`을 준비한 다음 실행합니다. 키는 32바이트 이상이며 `.env`는 Git에 포함하지 않습니다.

```bash
npm install
npm run week7:db
npm run build
npm run start:prod
```

기존 회원·평점 데이터는 보존합니다. 6주차에 가입 시각을 저장하지 않았으므로 기존 회원에 추가된 `created_at`은 마이그레이션 시각입니다. 신규 회원은 UTC 가입 시각을 저장합니다. 아래 6주차 자료는 당시 경로·응답으로 수행한 과거 기록입니다.

## 6주차: 회원가입과 영화 평점

NestJS와 MySQL로 회원가입, 평점 등록·수정·삭제, 입력 검증, 공통 오류 응답을 구현했습니다.

- [실습·필수 미션 제출 가이드](docs/week6/SUBMISSION.md)
- [API 명세](docs/week6/API.md)
- [8쪽 수행 보고서 PDF](output/pdf/week6-submission.pdf)
- [실습 인증 및 미션 캡처 13장](output/week6/screenshots/)
- [핵심 구현 코드](src/movie/), [공통 검증·예외 처리](src/common/)
- [Postman Collection](docs/week6/week6.postman_collection.json), [Environment](docs/week6/week6.postman_environment.json)
- [트러블슈팅 기록](docs/week6/TROUBLESHOOTING.md)
- [전체 제출 패키지 ZIP](output/week6-submission.zip)

검증 결과: 빌드 성공, 단위 테스트 1개, E2E 테스트 106개, 실제 MySQL HTTP 검증 29건 통과.

`.env.example`을 참고해 로컬 MySQL 설정을 준비한 뒤 실행합니다.

```bash
npm install
npm run week6:db
npm run build
npm run start:prod
```

서버를 실행한 상태에서 다른 터미널의 `npm run week6:verify`로 실제 HTTP 검증을 수행할 수 있습니다. 검증은 데모 회원을 생성합니다. [실행 기록 HTML](output/week6/report.html)은 파일을 내려받아 브라우저에서 열면 요청·응답을 선택해 확인할 수 있습니다.

---

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

This project is already instrumented. Create a free account at [observe.nestjs.com](https://observe.nestjs.com), add an application, and paste the generated app key and secret into the `ObserveModule.forRoot()` call in `src/app.module.ts`.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
