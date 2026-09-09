# Club Data Ownership Phase 1.5 — Mutation 경로 clubId 검증

**날짜:** 2026-09-09  
**관련:** Phase 1 (PR #514), Phase 2 (TrainingSession/OperatingExpense)

---

## 배경

Phase 1 (PR #514)에서 Player·Prospect의 `findAll`, `findById`, `create`에 `clubId` 스코핑을 추가했다. 그러나 mutation 경로(`update`, `delete`, `sign` 등)는 `repo.findById(id)` 를 clubId 없이 호출하고 있어, Club A 유저가 Club B 소속 리소스를 수정·삭제할 수 있는 갭이 남아 있다.

---

## 갭 목록

### Player (6개 메서드)

| 서비스 메서드 | 현재 문제 |
|---|---|
| `updatePlayer(id, dto)` | `findById(id)` — clubId 무시 |
| `updatePlayerStatus(id, dto, actorId)` | `findById(id)` — clubId 무시 |
| `promotePlayer(id, targetTeamId, actorId)` | `findById(id)` — clubId 무시 |
| `updateWorkPermit(id, dto)` | `findById(id)` — clubId 무시 |
| `deletePlayer(id, actorId)` | `findById(id)` — clubId 무시 |
| `updateMarketValue(playerId, dto, recordedById)` | `findById(id)` — clubId 무시 |
| `updateMyInfo` (컨트롤러) | 본인 userId 체크만, clubId 스코핑 없음 |

### Prospect (7개 메서드)

| 서비스 메서드 | 현재 문제 |
|---|---|
| `update(id, dto)` | `findById(id)` — clubId 무시 |
| `updateStatus(id, dto)` | `findById(id)` 일부 경로에서 clubId 무시 |
| `sign(id, dto)` | `findById` 호출 자체 없음 — 바로 `repo.sign()` |
| `recordMedicalResult(id, dto)` | `this.getById(id)` — clubId 미전달 |
| `addNegotiationLog(id, dto, actorId)` | `this.getById(id)` — clubId 미전달 |
| `addVideoEvaluation(id, dto, actorId)` | `this.getById(id)` — clubId 미전달 |
| `addEvaluationLog(id, dto, actorId)` | `this.getById(id)` — clubId 미전달 |

---

## 설계

### 핵심 패턴

서비스 mutation 메서드에 `actorClubId?: number | null` 파라미터 추가 → `repo.findById(id, actorClubId)` 에 전달.

`findById`는 `findFirst`로 구현되어 있어, `clubId` 불일치 시 `null` 반환 → 기존 `throw new AppError(404, "PLAYER_NOT_FOUND")` 가드가 자동 처리. 새 에러 코드나 헬퍼 함수 추가 없음.

### SUPER_ADMIN / clubId 없는 계정

`actorClubId`가 `null | undefined`이면 `findById` WHERE 절에 포함하지 않음 (기존 동작). 전체 접근 유지.

### sign 예외 처리

`prospect.sign`은 현재 `findById` 없이 `repo.sign()` 을 바로 호출한다. 메서드 상단에 `findById(id, actorClubId)` 가드를 추가해 clubId 불일치 시 404 반환.

---

## 변경 파일

### `apps/api/src/player/player.service.ts`

변경 메서드 시그니처:

```
updatePlayer(id, dto, actorClubId?)
updatePlayerStatus(id, dto, actorId, actorClubId?)
promotePlayer(id, targetTeamId, actorId, actorClubId?)
updateWorkPermit(id, dto, actorClubId?)
deletePlayer(id, actorId, actorClubId?)
updateMarketValue(playerId, dto, recordedById, actorClubId?)
```

각 메서드 내 `this.repo.findById(id)` → `this.repo.findById(id, actorClubId)`.

### `apps/api/src/player/player.controller.ts`

각 mutation 핸들러에서 `user.clubId`를 서비스 메서드에 추가로 전달.  
`updateMyInfo`: 기존 `updatePlayer(playerId, {...})` 호출을 `updatePlayer(playerId, {...}, user.clubId)` 로 수정.

### `apps/api/src/prospect/prospect.service.ts`

변경 메서드 시그니처:

```
update(id, dto, actorClubId?)
updateStatus(id, dto, actorClubId?)
sign(id, dto, actorClubId?)
recordMedicalResult(id, dto, actorClubId?)
addNegotiationLog(id, dto, actorId, actorClubId?)
addVideoEvaluation(id, dto, actorId, actorClubId?)
addEvaluationLog(id, dto, actorId, actorClubId?)
```

- `findById(id)` → `findById(id, actorClubId)` 또는  
- `this.getById(id)` → `this.getById(id, actorClubId)`  
- `sign`: 상단에 `findById(id, actorClubId)` 가드 추가.

### `apps/api/src/prospect/prospect.controller.ts`

각 mutation 핸들러에서 `user.clubId`를 서비스 메서드에 추가로 전달.

---

## 테스트 전략

기존 서비스 테스트(`prospect.service.test.ts`)에 아래 케이스 추가:

- 올바른 clubId → 정상 처리
- 다른 클럽 clubId → 404 반환
- clubId = null (SUPER_ADMIN 시뮬) → clubId 필터 없이 처리

Player 서비스 테스트 파일이 없으면 신규 생성.

---

## 범위 밖 (Phase 2+)

- `TrainingSession`, `OperatingExpense` mutation — Phase 2에서 처리
- `getMarketValueHistory` 등 read-only 경로 — Phase 1 에서 이미 처리됨
- Contract, Match 등 다른 도메인 — 별도 이슈
