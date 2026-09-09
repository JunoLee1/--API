# Club Data Ownership Phase 1.5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Player·Prospect mutation 경로(update/delete/sign 등) 전체에 `actorClubId` 스코핑을 추가해, Club A 유저가 Club B 리소스를 수정·삭제하지 못하게 막는다.

**Architecture:** 서비스 mutation 메서드에 `actorClubId?: number | null` 파라미터를 추가하고, 이미 존재하는 `repo.findById(id, actorClubId)` 호출에 넘긴다. `findById`는 `findFirst`이므로 clubId 불일치 시 `null` 반환 → 기존 404 가드가 처리. `actorClubId`가 null/undefined면 필터 미적용(SUPER_ADMIN bypass 유지).

**Tech Stack:** Express, TypeScript, Jest (ts-jest), Prisma

---

## 파일 맵

| 파일 | 역할 |
|---|---|
| `apps/api/src/player/player.service.ts` | 수정: 6개 mutation 메서드에 `actorClubId` 추가 |
| `apps/api/src/player/player.controller.ts` | 수정: `user.clubId` 서비스에 전달 (7개 핸들러) |
| `apps/api/src/player/player.service.test.ts` | 신규: clubId 스코핑 단위 테스트 |
| `apps/api/src/prospect/prospect.service.ts` | 수정: 7개 mutation 메서드에 `actorClubId` 추가 |
| `apps/api/src/prospect/prospect.controller.ts` | 수정: `user.clubId` 서비스에 전달 (7개 핸들러) |
| `apps/api/src/prospect/prospect.service.test.ts` | 수정: clubId 스코핑 테스트 추가 |

---

## Task 1: Player 서비스 — 실패 테스트 작성

**Files:**
- Create: `apps/api/src/player/player.service.test.ts`

- [ ] **Step 1: 테스트 파일 생성**

```typescript
// apps/api/src/player/player.service.test.ts
import { PlayerService } from './player.service';
import { AppError } from '../lib/appError';
import type { PlayerRepository } from './player.repo';
import type { MarketValueRepository } from './market-value.repo';

const makeRepo = (overrides: Partial<PlayerRepository> = {}): PlayerRepository =>
  ({
    findAll: jest.fn(),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    promotePlayer: jest.fn(),
    updateWorkPermit: jest.fn(),
    delete: jest.fn(),
    getMatchStats: jest.fn(),
    getTrainingResults: jest.fn(),
    getPositionDiversity: jest.fn(),
    ...overrides,
  } as unknown as PlayerRepository);

const makeMvRepo = (overrides: Partial<MarketValueRepository> = {}): MarketValueRepository =>
  ({
    getHistory: jest.fn(),
    updateCurrentValue: jest.fn(),
    ...overrides,
  } as unknown as MarketValueRepository);

const PLAYER_STUB = {
  id: 'p1',
  playerName: '홍길동',
  clubId: 10,
  teamId: 1,
  status: 'ACTIVE',
  team: { id: 1, type: 'FIRST_TEAM' },
  userId: 99,
};

// ─── updatePlayer ────────────────────────────────────────────────────────────

describe('PlayerService.updatePlayer — clubId 스코핑', () => {
  it('다른 clubId면 PLAYER_NOT_FOUND 404', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new PlayerService(repo);
    await expect(service.updatePlayer('p1', {}, 99)).rejects.toThrow(
      new AppError(404, 'PLAYER_NOT_FOUND'),
    );
    expect(repo.findById).toHaveBeenCalledWith('p1', 99);
  });

  it('같은 clubId면 repo.update 호출', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(PLAYER_STUB),
      update: jest.fn().mockResolvedValue(PLAYER_STUB),
    });
    const service = new PlayerService(repo);
    await service.updatePlayer('p1', { playerName: '김철수' }, 10);
    expect(repo.update).toHaveBeenCalledWith('p1', { playerName: '김철수' });
  });

  it('actorClubId 미전달(null)이면 clubId 필터 없이 처리', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(PLAYER_STUB),
      update: jest.fn().mockResolvedValue(PLAYER_STUB),
    });
    const service = new PlayerService(repo);
    await service.updatePlayer('p1', {}, null);
    expect(repo.findById).toHaveBeenCalledWith('p1', null);
  });
});

// ─── updatePlayerStatus ──────────────────────────────────────────────────────

describe('PlayerService.updatePlayerStatus — clubId 스코핑', () => {
  it('다른 clubId면 PLAYER_NOT_FOUND 404', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new PlayerService(repo);
    await expect(service.updatePlayerStatus('p1', { status: 'RELEASED' }, 1, 99)).rejects.toThrow(
      new AppError(404, 'PLAYER_NOT_FOUND'),
    );
    expect(repo.findById).toHaveBeenCalledWith('p1', 99);
  });
});

// ─── promotePlayer ───────────────────────────────────────────────────────────

describe('PlayerService.promotePlayer — clubId 스코핑', () => {
  it('다른 clubId면 PLAYER_NOT_FOUND 404', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new PlayerService(repo);
    await expect(service.promotePlayer('p1', 2, 1, 99)).rejects.toThrow(
      new AppError(404, 'PLAYER_NOT_FOUND'),
    );
    expect(repo.findById).toHaveBeenCalledWith('p1', 99);
  });
});

// ─── updateWorkPermit ────────────────────────────────────────────────────────

describe('PlayerService.updateWorkPermit — clubId 스코핑', () => {
  it('다른 clubId면 PLAYER_NOT_FOUND 404', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new PlayerService(repo);
    await expect(
      service.updateWorkPermit('p1', { workPermitStatus: 'PENDING' }, 99),
    ).rejects.toThrow(new AppError(404, 'PLAYER_NOT_FOUND'));
    expect(repo.findById).toHaveBeenCalledWith('p1', 99);
  });
});

// ─── deletePlayer ────────────────────────────────────────────────────────────

describe('PlayerService.deletePlayer — clubId 스코핑', () => {
  it('다른 clubId면 PLAYER_NOT_FOUND 404', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new PlayerService(repo);
    await expect(service.deletePlayer('p1', 1, 99)).rejects.toThrow(
      new AppError(404, 'PLAYER_NOT_FOUND'),
    );
    expect(repo.findById).toHaveBeenCalledWith('p1', 99);
  });
});

// ─── updateMarketValue ───────────────────────────────────────────────────────

describe('PlayerService.updateMarketValue — clubId 스코핑', () => {
  it('다른 clubId면 PLAYER_NOT_FOUND 404', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new PlayerService(repo, makeMvRepo());
    await expect(service.updateMarketValue('p1', { value: 1000000 }, 1, 99)).rejects.toThrow(
      new AppError(404, 'PLAYER_NOT_FOUND'),
    );
    expect(repo.findById).toHaveBeenCalledWith('p1', 99);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 전부 실패 확인**

```bash
cd apps/api && npx jest player.service.test --no-coverage 2>&1 | tail -20
```

예상: `TypeError: ... is not a function` 또는 `Expected: AppError(404...) Received: ...` — 서비스 메서드 시그니처 불일치로 실패.

---

## Task 2: Player 서비스 — 구현

**Files:**
- Modify: `apps/api/src/player/player.service.ts`

- [ ] **Step 1: 6개 메서드에 `actorClubId` 파라미터 추가**

`apps/api/src/player/player.service.ts` 의 아래 메서드들을 수정한다.

```typescript
// 변경 전
async updatePlayer(id: string, dto: UpdatePlayerDto) {
  const player = await this.repo.findById(id);
  if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
  return this.repo.update(id, dto);
}

// 변경 후
async updatePlayer(id: string, dto: UpdatePlayerDto, actorClubId?: number | null) {
  const player = await this.repo.findById(id, actorClubId);
  if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
  return this.repo.update(id, dto);
}
```

```typescript
// 변경 전
async updatePlayerStatus(id: string, { status }: UpdatePlayerStatusDto, actorId: number) {
  const player = await this.repo.findById(id);

// 변경 후
async updatePlayerStatus(id: string, { status }: UpdatePlayerStatusDto, actorId: number, actorClubId?: number | null) {
  const player = await this.repo.findById(id, actorClubId);
```

```typescript
// 변경 전
async promotePlayer(id: string, targetTeamId: number, actorId: number) {
  const player = await this.repo.findById(id);

// 변경 후
async promotePlayer(id: string, targetTeamId: number, actorId: number, actorClubId?: number | null) {
  const player = await this.repo.findById(id, actorClubId);
```

```typescript
// 변경 전
async updateWorkPermit(id: string, dto: { workPermitStatus: string; workPermitExpiry?: string }) {
  const player = await this.repo.findById(id);

// 변경 후
async updateWorkPermit(id: string, dto: { workPermitStatus: string; workPermitExpiry?: string }, actorClubId?: number | null) {
  const player = await this.repo.findById(id, actorClubId);
```

```typescript
// 변경 전
async deletePlayer(id: string, actorId: number) {
  const player = await this.repo.findById(id);

// 변경 후
async deletePlayer(id: string, actorId: number, actorClubId?: number | null) {
  const player = await this.repo.findById(id, actorClubId);
```

```typescript
// 변경 전
async updateMarketValue(playerId: string, dto: UpdateMarketValueDto, recordedById: number) {
  const player = await this.repo.findById(playerId);

// 변경 후
async updateMarketValue(playerId: string, dto: UpdateMarketValueDto, recordedById: number, actorClubId?: number | null) {
  const player = await this.repo.findById(playerId, actorClubId);
```

- [ ] **Step 2: 테스트 실행 — 전부 통과 확인**

```bash
cd apps/api && npx jest player.service.test --no-coverage 2>&1 | tail -20
```

예상: `Tests: N passed`

- [ ] **Step 3: 커밋**

```bash
cd apps/api && git add src/player/player.service.ts src/player/player.service.test.ts
git commit -m "feat: Player 서비스 mutation 경로 clubId 스코핑 추가"
```

---

## Task 3: Player 컨트롤러 — user.clubId 전달

**Files:**
- Modify: `apps/api/src/player/player.controller.ts`

- [ ] **Step 1: 7개 핸들러에 `user.clubId` 전달**

아래 각 핸들러를 수정한다. 변경 포인트만 표시.

**`updatePlayer`:**
```typescript
// 변경 전
const player = await this.service.updatePlayer(String(req.params["id"]), req.body);

// 변경 후
const player = await this.service.updatePlayer(String(req.params["id"]), req.body, user.clubId);
```

**`updatePlayerStatus`:**
```typescript
// 변경 전
const result = await this.service.updatePlayerStatus(String(req.params["id"]), req.body, user.id);

// 변경 후
const result = await this.service.updatePlayerStatus(String(req.params["id"]), req.body, user.id, user.clubId);
```

**`promotePlayer`:**
```typescript
// 변경 전
const result = await this.service.promotePlayer(String(req.params["id"]), targetTeamId, user.id);

// 변경 후
const result = await this.service.promotePlayer(String(req.params["id"]), targetTeamId, user.id, user.clubId);
```

**`deletePlayer`:**
```typescript
// 변경 전
await this.service.deletePlayer(String(req.params["id"]), user.id);

// 변경 후
await this.service.deletePlayer(String(req.params["id"]), user.id, user.clubId);
```

**`updateWorkPermit`:**
```typescript
// 변경 전
const { role, frontOfficeRole } = requireUser(req);
// ... 권한 체크 후
res.json(await this.service.updateWorkPermit(req.params['id']!, req.body));

// 변경 후
const user = requireUser(req);
const { role, frontOfficeRole } = user;
// ... 권한 체크 후
res.json(await this.service.updateWorkPermit(req.params['id']!, req.body, user.clubId));
```

**`updateMarketValue`:**
```typescript
// 변경 전
const result = await this.service.updateMarketValue(
  String(req.params["id"]),
  req.body,
  user.id,
);

// 변경 후
const result = await this.service.updateMarketValue(
  String(req.params["id"]),
  req.body,
  user.id,
  user.clubId,
);
```

**`updateMyInfo`:**
```typescript
// 변경 전
const result = await this.service.updatePlayer(playerId, {
  ...(emergencyContactName !== undefined && { emergencyContactName }),
  ...(emergencyContactPhone !== undefined && { emergencyContactPhone }),
  ...(emergencyContactRelation !== undefined && { emergencyContactRelation }),
});

// 변경 후
const result = await this.service.updatePlayer(playerId, {
  ...(emergencyContactName !== undefined && { emergencyContactName }),
  ...(emergencyContactPhone !== undefined && { emergencyContactPhone }),
  ...(emergencyContactRelation !== undefined && { emergencyContactRelation }),
}, user.clubId);
```

- [ ] **Step 2: TypeScript 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -30
```

예상: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
cd apps/api && git add src/player/player.controller.ts
git commit -m "feat: Player 컨트롤러 mutation 핸들러에 user.clubId 전달"
```

---

## Task 4: Prospect 서비스 — 실패 테스트 작성

**Files:**
- Modify: `apps/api/src/prospect/prospect.service.test.ts`

- [ ] **Step 1: 기존 파일 끝에 clubId 스코핑 테스트 추가**

`apps/api/src/prospect/prospect.service.test.ts` 파일 맨 끝에 아래 블록을 추가한다.

```typescript
// ─── clubId 스코핑 — mutation 경로 ──────────────────────────────────────────

describe('ProspectService mutation — clubId 스코핑', () => {
  const OTHER_CLUB_ID = 99;

  it('update: 다른 clubId면 PROSPECT_NOT_FOUND 404', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue(null),
    }));
    await expect(service.update(1, {}, OTHER_CLUB_ID)).rejects.toThrow(
      new AppError(404, 'PROSPECT_NOT_FOUND'),
    );
  });

  it('update: actorClubId null이면 findById에 null 전달', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({ id: 1 }),
    });
    const service = new ProspectService(repo);
    await service.update(1, {}, null);
    expect(repo.findById).toHaveBeenCalledWith(1, null);
  });

  it('updateStatus: 다른 clubId면 PROSPECT_NOT_FOUND 404 (CONTRACT_PENDING 경로)', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue(null),
    }));
    await expect(
      service.updateStatus(1, { status: 'CONTRACT_PENDING' }, OTHER_CLUB_ID),
    ).rejects.toThrow(new AppError(404, 'PROSPECT_NOT_FOUND'));
  });

  it('sign: 다른 clubId면 PROSPECT_NOT_FOUND 404', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue(null),
      getForeignPlayerCount: jest.fn().mockResolvedValue({ leagueLevel: 'K_LEAGUE_1', count: 0 }),
    }));
    await expect(
      service.sign(1, { workPermitStatus: 'NOT_REQUIRED' } as any, OTHER_CLUB_ID),
    ).rejects.toThrow(new AppError(404, 'PROSPECT_NOT_FOUND'));
  });

  it('recordMedicalResult: 다른 clubId면 PROSPECT_NOT_FOUND 404', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue(null),
    }));
    await expect(
      service.recordMedicalResult(1, { result: 'pass' } as any, OTHER_CLUB_ID),
    ).rejects.toThrow(new AppError(404, 'PROSPECT_NOT_FOUND'));
  });

  it('addNegotiationLog: 다른 clubId면 PROSPECT_NOT_FOUND 404', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue(null),
    }));
    await expect(
      service.addNegotiationLog(1, {} as any, 1, OTHER_CLUB_ID),
    ).rejects.toThrow(new AppError(404, 'PROSPECT_NOT_FOUND'));
  });

  it('addVideoEvaluation: 다른 clubId면 PROSPECT_NOT_FOUND 404', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue(null),
    }));
    await expect(
      service.addVideoEvaluation(1, {} as any, 1, OTHER_CLUB_ID),
    ).rejects.toThrow(new AppError(404, 'PROSPECT_NOT_FOUND'));
  });

  it('addEvaluationLog: 다른 clubId면 PROSPECT_NOT_FOUND 404', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue(null),
    }));
    await expect(
      service.addEvaluationLog(1, {} as any, 1, OTHER_CLUB_ID),
    ).rejects.toThrow(new AppError(404, 'PROSPECT_NOT_FOUND'));
  });
});
```

- [ ] **Step 2: 테스트 실행 — 전부 실패 확인**

```bash
cd apps/api && npx jest prospect.service.test --no-coverage 2>&1 | tail -20
```

예상: 새로 추가한 8개 테스트가 실패 (메서드 시그니처 불일치).

---

## Task 5: Prospect 서비스 — 구현

**Files:**
- Modify: `apps/api/src/prospect/prospect.service.ts`

- [ ] **Step 1: 7개 메서드 수정**

**`update`:**
```typescript
// 변경 전
async update(id: number, dto: UpdateProspectDto) {
  const prospect = await this.repo.findById(id);
  if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
  return this.repo.update(id, dto);
}

// 변경 후
async update(id: number, dto: UpdateProspectDto, actorClubId?: number | null) {
  const prospect = await this.repo.findById(id, actorClubId);
  if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
  return this.repo.update(id, dto);
}
```

**`updateStatus`** — `CONTRACT_PENDING` 경로의 `findById` 에 actorClubId 추가:
```typescript
// 변경 전
async updateStatus(id: number, dto: TransitionProspectStatusDto) {
  if (dto.status === "SIGNED") throw new AppError(400, "USE_SIGN_ENDPOINT");
  if (dto.status === "SHORTLIST") {
    const prospect = await this.repo.findById(id);
    // ...
  }
  if (dto.status === "CONTRACT_PENDING") {
    const prospect = await this.repo.findById(id);
    // ...
  }
  return this.repo.updateStatus(id, dto.status);
}

// 변경 후
async updateStatus(id: number, dto: TransitionProspectStatusDto, actorClubId?: number | null) {
  if (dto.status === "SIGNED") throw new AppError(400, "USE_SIGN_ENDPOINT");
  if (dto.status === "SHORTLIST") {
    const prospect = await this.repo.findById(id, actorClubId);
    if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
    if (prospect.status === "LONGLIST") throw new AppError(400, "MUST_GO_THROUGH_PRE_SHORTLIST");
    const count = await this.repo.countByStatus("SHORTLIST");
    if (count >= SHORTLIST_CAPACITY) throw new AppError(409, "SHORTLIST_FULL");
    const latest = await this.repo.getLatestVideoEvaluation(id);
    if (!latest || latest.result !== "PASS") throw new AppError(400, "VIDEO_EVAL_REQUIRED");
  }
  if (dto.status === "CONTRACT_PENDING") {
    const prospect = await this.repo.findById(id, actorClubId);
    if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
    if (prospect.visaRequired && prospect.visaEligibility === 'UNCERTAIN') {
      throw new AppError(400, 'VISA_ELIGIBILITY_UNCERTAIN');
    }
  }
  return this.repo.updateStatus(id, dto.status);
}
```

> 주의: SHORTLIST·CONTRACT_PENDING 두 경로 모두 기존에 `if (!prospect)` 가드가 있다. `actorClubId` 인자만 추가하면 된다.

**`sign`** — `findById` 가드 추가:
```typescript
// 변경 전
async sign(id: number, dto: SignProspectDto) {
  if (dto.workPermitStatus && dto.workPermitStatus !== 'NOT_REQUIRED') {
    const { leagueLevel, count } = await this.repo.getForeignPlayerCount();
    const limit = getForeignQuota(leagueLevel);
    if (count >= limit) throw new AppError(409, 'FOREIGN_QUOTA_EXCEEDED');
  }
  const result = await this.repo.sign(id, dto);
  void notificationService.notifyProspectSigned(result.name).catch(console.error);
  return result;
}

// 변경 후
async sign(id: number, dto: SignProspectDto, actorClubId?: number | null) {
  const prospect = await this.repo.findById(id, actorClubId);
  if (!prospect) throw new AppError(404, 'PROSPECT_NOT_FOUND');
  if (dto.workPermitStatus && dto.workPermitStatus !== 'NOT_REQUIRED') {
    const { leagueLevel, count } = await this.repo.getForeignPlayerCount();
    const limit = getForeignQuota(leagueLevel);
    if (count >= limit) throw new AppError(409, 'FOREIGN_QUOTA_EXCEEDED');
  }
  const result = await this.repo.sign(id, dto);
  void notificationService.notifyProspectSigned(result.name).catch(console.error);
  return result;
}
```

**`recordMedicalResult`** — `this.getById` → `this.getById(id, actorClubId)`:
```typescript
// 변경 전
async recordMedicalResult(id: number, dto: ProspectMedicalResultDto) {
  const prospect = await this.getById(id);

// 변경 후
async recordMedicalResult(id: number, dto: ProspectMedicalResultDto, actorClubId?: number | null) {
  const prospect = await this.getById(id, actorClubId);
```

**`addNegotiationLog`:**
```typescript
// 변경 전
async addNegotiationLog(id: number, dto: CreateProspectNegotiationLogDto, createdById: number) {
  const prospect = await this.getById(id);

// 변경 후
async addNegotiationLog(id: number, dto: CreateProspectNegotiationLogDto, createdById: number, actorClubId?: number | null) {
  const prospect = await this.getById(id, actorClubId);
```

**`addVideoEvaluation`:**
```typescript
// 변경 전
async addVideoEvaluation(id: number, dto: CreateProspectVideoEvaluationDto, evaluatedById: number) {
  await this.getById(id); // 존재 확인

// 변경 후
async addVideoEvaluation(id: number, dto: CreateProspectVideoEvaluationDto, evaluatedById: number, actorClubId?: number | null) {
  await this.getById(id, actorClubId); // 존재 + club 스코핑 확인
```

**`addEvaluationLog`:**
```typescript
// 변경 전
async addEvaluationLog(id: number, dto: CreateProspectEvaluationLogDto, evaluatedById: number) {
  await this.getById(id); // 존재 확인

// 변경 후
async addEvaluationLog(id: number, dto: CreateProspectEvaluationLogDto, evaluatedById: number, actorClubId?: number | null) {
  await this.getById(id, actorClubId); // 존재 + club 스코핑 확인
```

- [ ] **Step 2: 테스트 실행 — 전부 통과 확인**

```bash
cd apps/api && npx jest prospect.service.test --no-coverage 2>&1 | tail -20
```

예상: 기존 테스트 포함 전부 통과.

- [ ] **Step 3: 커밋**

```bash
cd apps/api && git add src/prospect/prospect.service.ts src/prospect/prospect.service.test.ts
git commit -m "feat: Prospect 서비스 mutation 경로 clubId 스코핑 추가"
```

---

## Task 6: Prospect 컨트롤러 — user.clubId 전달

**Files:**
- Modify: `apps/api/src/prospect/prospect.controller.ts`

- [ ] **Step 1: 7개 핸들러 수정**

각 핸들러에서 `user.clubId` 를 서비스 메서드 마지막 인자로 추가한다.

**`update`:**
```typescript
// 변경 전
const { role, frontOfficeRole } = requireUser(req);
if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(200).json(await this.service.update(Number(req.params["id"]), req.body));

// 변경 후
const user = requireUser(req);
if (!canWrite(user.role, user.frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(200).json(await this.service.update(Number(req.params["id"]), req.body, user.clubId));
```

**`updateStatus`:**
```typescript
// 변경 전
const { role, frontOfficeRole } = requireUser(req);
if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(200).json(
  await this.service.updateStatus(Number(req.params["id"]), req.body as TransitionProspectStatusDto)
);

// 변경 후
const user = requireUser(req);
if (!canWrite(user.role, user.frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(200).json(
  await this.service.updateStatus(Number(req.params["id"]), req.body as TransitionProspectStatusDto, user.clubId)
);
```

**`sign`:**
```typescript
// 변경 전
const { role, frontOfficeRole } = requireUser(req);
if (!canSign(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(200).json(
  await this.service.sign(Number(req.params["id"]), req.body as SignProspectDto)
);

// 변경 후
const user = requireUser(req);
if (!canSign(user.role, user.frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(200).json(
  await this.service.sign(Number(req.params["id"]), req.body as SignProspectDto, user.clubId)
);
```

**`recordMedicalResult`:**
```typescript
// 변경 전
const { role, frontOfficeRole } = requireUser(req);
if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(200).json(
  await this.service.recordMedicalResult(Number(req.params["id"]), req.body as ProspectMedicalResultDto)
);

// 변경 후
const user = requireUser(req);
if (!canWrite(user.role, user.frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(200).json(
  await this.service.recordMedicalResult(Number(req.params["id"]), req.body as ProspectMedicalResultDto, user.clubId)
);
```

**`addNegotiationLog`:**
```typescript
// 변경 전
const { role, frontOfficeRole, id } = requireUser(req);
if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(201).json(
  await this.service.addNegotiationLog(Number(req.params["id"]), req.body as CreateProspectNegotiationLogDto, id)
);

// 변경 후
const user = requireUser(req);
if (!canWrite(user.role, user.frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(201).json(
  await this.service.addNegotiationLog(Number(req.params["id"]), req.body as CreateProspectNegotiationLogDto, user.id, user.clubId)
);
```

**`addVideoEvaluation`:**
```typescript
// 변경 전
const { role, frontOfficeRole, id } = requireUser(req);
if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(201).json(
  await this.service.addVideoEvaluation(
    Number(req.params["id"]),
    req.body as CreateProspectVideoEvaluationDto,
    id,
  ),
);

// 변경 후
const user = requireUser(req);
if (!canWrite(user.role, user.frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(201).json(
  await this.service.addVideoEvaluation(
    Number(req.params["id"]),
    req.body as CreateProspectVideoEvaluationDto,
    user.id,
    user.clubId,
  ),
);
```

**`addEvaluationLog`:**
```typescript
// 변경 전
const { role, frontOfficeRole, id } = requireUser(req);
if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(201).json(
  await this.service.addEvaluationLog(
    Number(req.params["id"]),
    req.body as CreateProspectEvaluationLogDto,
    id,
  ),
);

// 변경 후
const user = requireUser(req);
if (!canWrite(user.role, user.frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
res.status(201).json(
  await this.service.addEvaluationLog(
    Number(req.params["id"]),
    req.body as CreateProspectEvaluationLogDto,
    user.id,
    user.clubId,
  ),
);
```

- [ ] **Step 2: TypeScript 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -30
```

예상: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
cd apps/api && git add src/prospect/prospect.controller.ts
git commit -m "feat: Prospect 컨트롤러 mutation 핸들러에 user.clubId 전달"
```

---

## Task 7: 전체 테스트 실행 + PR

- [ ] **Step 1: 전체 테스트 스위트 실행**

```bash
cd apps/api && npx jest --no-coverage 2>&1 | tail -20
```

예상: 기존 테스트 포함 전부 통과 (실패 없음).

- [ ] **Step 2: PR 생성**

```bash
gh pr create \
  --title "feat: Club Data Ownership Phase 1.5 — mutation 경로 clubId 스코핑" \
  --body "$(cat <<'EOF'
## Summary
- Player·Prospect mutation 경로(update/delete/sign 등) 13개 메서드에 `actorClubId` 스코핑 추가
- Club A 유저가 Club B 소속 Player·Prospect를 수정/삭제하지 못하도록 차단
- SUPER_ADMIN / clubId 없는 계정은 기존대로 전체 접근 유지

## Test plan
- [ ] `player.service.test.ts` 신규 6개 describe 블록 통과
- [ ] `prospect.service.test.ts` 기존 + 신규 8개 케이스 통과
- [ ] `npx tsc --noEmit` 에러 없음
- [ ] 전체 Jest 스위트 통과

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
