# 8주차 핵심 개념과 학습 후기 초안

2026년 11월 17일 기준 공식 문서와 현재 구현을 연결해 정리했다. 아래 학습 후기 문장은 제출용 초안이며, 이해 정도와 개인 소감은 직접 확인한 내용에 맞게 조정하면 된다.

## 트랜잭션과 commit·rollback

트랜잭션은 함께 성공해야 하는 여러 DB 작업을 하나의 단위로 다룬다. `COMMIT`은 변경을 확정하고 `ROLLBACK`은 현재 트랜잭션의 변경을 취소한다. InnoDB에서 개별 INSERT가 실패했다고 앞선 모든 SQL이 항상 자동 취소되는 것은 아니므로, 애플리케이션이 전체 작업의 실패를 트랜잭션 경계까지 전달해야 한다. [MySQL COMMIT·ROLLBACK](https://dev.mysql.com/doc/refman/8.4/en/commit.html), [InnoDB 오류 처리](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html)

이 프로젝트에서는 평점 저장 후 즐겨찾기 저장에 실패하면 예외가 `DataSource.transaction()` 콜백 밖으로 나간다. 성공할 때만 `{rating,favorite}`를 반환한다. 콜백 안의 조회·저장은 전달받은 `manager`에서 얻은 Repository를 사용해 같은 연결에 참여시킨다. [TypeORM 트랜잭션](https://typeorm.io/docs/transactions/)

```ts
return this.dataSource.transaction(async (manager) => {
  const ratingRepository = manager.getRepository(Rating);
  const favoriteRepository = manager.getRepository(Favorite);
  // 회원 확인·중복 검사도 같은 manager로 수행한다.
  const rating = await ratingRepository.save(/* ... */);
  const favorite = await favoriteRepository.save(/* ... */);
  return { rating, favorite };
});
```

위 코드는 흐름을 줄여 표현한 설명용 코드다. 실제 nullable favorite·DTO 변환·예외 처리는 [MovieRecordService](../../src/movie/movie-record.service.ts)를 따른다.

## 원자성과 ACID

원자성은 한 요청의 여러 변경을 모두 반영하거나 모두 취소하는 성질이다. 평점만 남고 즐겨찾기는 없는 중간 결과를 막는 것이 이번 실습의 중심이다. ACID는 원자성 외에 일관성·격리성·지속성을 함께 설명한다. [MySQL InnoDB와 ACID](https://dev.mysql.com/doc/refman/8.4/en/mysql-acid.html)

| 속성 | 이번 서비스에 연결한 의미 |
| --- | --- |
| Atomicity | true 요청의 평점과 즐겨찾기를 한 성공·실패 단위로 처리 |
| Consistency | 회원 FK·점수 범위·복합 UNIQUE 등 데이터 규칙 유지 |
| Isolation | 동시에 들어온 요청 간 읽기·쓰기의 가시성과 충돌을 관리 |
| Durability | 정상 commit한 결과의 보존. 실제 보장 수준은 DB·스토리지 설정에도 영향받음 |

트랜잭션만 추가하면 모든 동시성 문제가 사라지는 것은 아니다. 격리 수준, 제약, 잠금과 오류 처리를 함께 고려해야 한다. MySQL InnoDB는 네 가지 표준 격리 수준을 제공하고 기본값은 `REPEATABLE READ`다. 현재 서비스는 임의로 격리 수준을 바꾸지 않고 설정된 DB 기본값을 사용한다. [MySQL 격리 수준](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)

## 사전 중복 검사와 복합 UNIQUE

서비스의 사전 검사는 이미 있는 즐겨찾기를 사용자에게 `FAVORITE409_1`로 설명한다. 하지만 두 요청이 동시에 검사하면 둘 다 “없음”을 읽을 수 있다. DB의 `UNIQUE(member_id,movie_id)`는 최종 삽입 단계에서 중복 행을 막는다. DB 중복 오류도 도메인의 409로 변환해야 한다. [MySQL UNIQUE 인덱스](https://dev.mysql.com/doc/refman/8.4/en/create-index.html#unique-indexes)

`movie_id` 하나만 UNIQUE로 설정하면 서로 다른 회원도 같은 영화를 즐겨찾기할 수 없게 된다. 필요한 규칙은 “서비스 전체에서 영화 한 번”이 아니라 “한 회원에게 같은 영화 한 번”이므로 두 컬럼을 묶는다. 회원 A와 B가 같은 영화를 각각 보관하는 것은 허용한다.

사전 검사와 UNIQUE는 역할이 다르다. 사전 검사는 일반 흐름과 오류 메시지를 분명하게 만들고, UNIQUE는 검사와 저장 사이의 동시 요청까지 포함해 DB 규칙을 강제한다.

## 낙관적 잠금

낙관적 잠금은 읽을 때의 버전과 갱신 시점의 버전을 비교해 다른 요청이 먼저 수정한 경우 충돌로 처리하는 방식이다. TypeORM에는 버전을 증가시키는 `@VersionColumn`과 QueryBuilder의 optimistic lock 기능이 있다. 버전 필드가 존재하는 것과 실제 수정 요청에서 기대 버전을 검사하는 것은 구분해야 한다. [TypeORM 특수 컬럼](https://typeorm.io/docs/entity/entities/#special-columns), [TypeORM QueryBuilder 잠금](https://typeorm.io/docs/query-builder/select-query-builder/#set-locking)

이번 코드에는 낙관적 잠금용 버전 컬럼이나 평점 수정의 기대 버전 검사를 구현하지 않았다. 조사한 개념과 구현 기능을 구분한다. 현재 추가 중복은 DB UNIQUE로, 영화 기록의 부분 저장은 트랜잭션으로 처리한다. 향후 평점 동시 수정의 덮어쓰기를 막아야 한다면 버전 검사와 충돌 응답을 별도로 설계해야 한다.

## 학습 후기 질문에 넣을 답변 초안

**1. 트랜잭션이 없을 때 평점만 저장되고 즐겨찾기가 저장되지 않으면 왜 문제인가?**

사용자가 요청한 것은 평점과 즐겨찾기를 함께 남기는 하나의 영화 기록이다. 일부만 저장되면 실패 응답을 받았는데 평점은 이미 존재하는 등 요청 결과와 DB 상태가 어긋난다. 다시 시도할 때는 평점 중복으로 막힐 수도 있다. 두 저장을 같은 트랜잭션으로 묶어 실패 시 앞선 변경도 되돌려야 한다.

**2. 서버 중복 검사와 DB UNIQUE를 함께 두는 이유는 무엇인가?**

서버 검사는 기존 데이터를 확인하고 의미 있는 오류를 반환하기 위해 필요하다. 동시에 들어온 요청은 둘 다 검사를 통과할 수 있으므로 이것만으로 중복을 보장할 수 없다. 복합 UNIQUE가 최종 저장을 보호하고, 그 제약 위반을 서비스의 중복 오류로 변환하면 일반 요청과 동시 요청 모두 같은 규칙으로 처리할 수 있다.

**정리 문장 초안**

“이번 구현에서는 정상 응답뿐 아니라 중복 등록, 없는 즐겨찾기 해제, 인증 실패, 두 번째 저장 실패를 구분했다. 특히 두 번째 저장이 실패했을 때 첫 번째 저장도 취소되어야 한다는 점을 트랜잭션 경계와 검증 시나리오에 반영했다. 다음에는 격리 수준과 낙관적 잠금이 각각 어떤 동시성 문제를 해결하는지 추가로 비교할 수 있다.”
