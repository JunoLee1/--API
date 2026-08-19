# Kane + 박희수 (Head Coach + Physical Coach) — 컨디셔닝·부상 관리 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 재활 선수의 훈련 부하 임계치 조정(KN6), 허용 활동 표시(BH2), 부상 시점 부하 스냅샷 자동 기록(BH4), 재활 관련 알림 추가(BH7), 고퍼포먼스 알림(BH8), matchAvailable 라인업 블록 해제(BH9) 6개 갭 해소.

**Architecture:**
- `training-load.service.ts` — 재활 선수 임계치 스케일링, allowedActivities 응답 포함, 고퍼포먼스 알림
- `injury.service.ts` — priorWeeklyLoad 자동 기록, 재활 알림 발송
- `match.lineup.repo.ts` — matchAvailable + medicalSignedAt 조건 시 블록 제외
- Schema migration — 4개 NotificationType enum 값 추가 (shadow DB 우회 방식)

**Tech Stack:** Express + TypeScript + Prisma (backend), Jest (unit tests)

---

## Grill 결정 요약

| 코드 | 결정 |
|------|------|
| KN6 | `rehabLoadPercentage`로 과부하 **임계치 하향** — load 실측값 유지, `effectiveThreshold = positionThreshold × (rehabLoadPercentage / 100)` |
| BH2 | `allowedActivities` 텍스트를 `upsert` 응답에 포함 — 피지컬 코치 화면 노출 |
| BH4 | `createInjury` 시 `getWeeklyLoadTotal` 조회 → `Injury.priorWeeklyLoad` 자동 기록 (fire-and-forget) |
| BH7 | `REHABILITATING` 전환 + `saveReport`에서 `rehabLoadPercentage`/`allowedActivities` 변경 시 → PHYSICAL_COACH + HEAD_COACH 알림 |
| BH8 | `approveSession` 시 `performanceScore ≥ 80` 일괄 체크 → HEAD_COACH + 선수 본인 알림 |
| BH9 | `matchAvailable = true AND medicalSignedAt IS NOT NULL` 선수는 `findActiveInjuredPlayerIds`에서 제외 → 라인업 블록 해제 |

---

## File Map

| 파일 | 변경 |
|------|------|
| `apps/api/prisma/schema.prisma` | NotificationType에 4개 값 추가 |
| `apps/api/prisma/migrations/20260816000001_conditioning_notif_types/migration.sql` | enum 값 추가 SQL |
| `apps/api/src/training-load/training-load.service.ts` | KN6 임계치 스케일링, BH2 allowedActivities 응답 |
| `apps/api/src/training-load/training-load.repo.ts` | `findActiveInjuryWithReport()` 추가 |
| `apps/api/src/injury/injury.service.ts` | BH4 priorWeeklyLoad 기록, BH7 재활 알림 |
| `apps/api/src/injury/injury.repo.ts` | `updatePriorWeeklyLoad()` 추가 |
| `apps/api/src/training/training.service.ts` | BH8 고퍼포먼스 알림 |
| `apps/api/src/match/match.lineup.repo.ts` | BH9 matchAvailable 조건 추가 |
| `apps/api/__test__/training-load/training-load.rehab-threshold.test.ts` | KN6 + BH2 테스트 |
| `apps/api/__test__/injury/injury.prior-load.test.ts` | BH4 테스트 |
| `apps/api/__test__/injury/injury.rehab-notif.test.ts` | BH7 테스트 |
| `apps/api/__test__/training/training.high-performance.test.ts` | BH8 테스트 |
| `apps/api/__test__/match/match.lineup.match-available.test.ts` | BH9 테스트 |

---

## Task 1: Schema — NotificationType enum 값 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260816000001_conditioning_notif_types/migration.sql`

- [x] **Step 1: migration.sql 작성**

```sql
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INJURY_REHABILITATING_STARTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INJURY_REPORT_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRAINING_HIGH_PERFORMANCE_PLAYER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRAINING_HIGH_PERFORMANCE_SELF';
```

- [x] **Step 2: schema.prisma 업데이트**

`enum NotificationType` 블록에 4개 값 추가 (기존 마지막 값 `HIRING_SURVEY_CLOSED` 뒤):

```prisma
  INJURY_REHABILITATING_STARTED
  INJURY_REPORT_UPDATED
  TRAINING_HIGH_PERFORMANCE_PLAYER
  TRAINING_HIGH_PERFORMANCE_SELF
```

- [x] **Step 3: migration 적용 + Prisma client 재생성**

```bash
cd apps/api
npx prisma db execute --file prisma/migrations/20260816000001_conditioning_notif_types/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260816000001_conditioning_notif_types
npx prisma generate
```

- [x] **Step 4: 커밋**

```bash
git add apps/api/prisma/
git commit -m "feat(schema): add 4 NotificationType values for conditioning/injury gaps"
```

---

## Task 2: KN6 + BH2 — 재활 임계치 스케일링 + allowedActivities 응답

**Files:**
- Modify: `apps/api/src/training-load/training-load.repo.ts`
- Modify: `apps/api/src/training-load/training-load.service.ts`
- Create: `apps/api/__test__/training-load/training-load.rehab-threshold.test.ts`

- [x] **Step 1: 실패 테스트 작성**

`apps/api/__test__/training-load/training-load.rehab-threshold.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TrainingLoadService, getLoadThreshold, getEffectiveThreshold } from "../../src/training-load/training-load.service";

// getEffectiveThreshold 함수 테스트
describe("getEffectiveThreshold", () => {
  test("rehabLoadPercentage 없으면 기본 임계치 반환", () => {
    expect(getEffectiveThreshold("CB", null)).toBe(500);
  });

  test("rehabLoadPercentage 60이면 임계치 × 0.6", () => {
    expect(getEffectiveThreshold("CB", 60)).toBe(300);
  });

  test("rehabLoadPercentage 100이면 임계치 그대로", () => {
    expect(getEffectiveThreshold("GK", 100)).toBe(400);
  });
});

// upsert 응답에 allowedActivities 포함 테스트
describe("TrainingLoadService — allowedActivities in response", () => {
  const mockRepo = {
    upsert: jest.fn(),
    getWeeklyLoadTotal: jest.fn().mockResolvedValue(0),
    getPlayerName: jest.fn().mockResolvedValue({ playerName: "테스트", position: "CB" }),
    findActiveInjuryWithReport: jest.fn(),
  } as any;
  const mockNotifRepo = { createForPhysicalCoach: jest.fn(), createForHeadCoach: jest.fn(), createForMedicalDirector: jest.fn() } as any;

  let service: TrainingLoadService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrainingLoadService(mockRepo, mockNotifRepo);
    mockRepo.upsert.mockResolvedValue({ id: 1, playerId: "p1", load: 300 });
  });

  test("활성 부상 + allowedActivities 있으면 응답에 포함", async () => {
    mockRepo.findActiveInjuryWithReport.mockResolvedValue({
      status: "REHABILITATING",
      report: { rehabLoadPercentage: 60, allowedActivities: "상체 훈련만 허용" },
    });
    const result = await service.upsert(
      { playerId: "p1", sessionId: 1, load: 300 },
      "p1", "COACHING_STAFF", "PHYSICAL_COACH"
    );
    expect((result as any).allowedActivities).toBe("상체 훈련만 허용");
  });

  test("부상 없으면 allowedActivities 없음", async () => {
    mockRepo.findActiveInjuryWithReport.mockResolvedValue(null);
    const result = await service.upsert(
      { playerId: "p1", sessionId: 1, load: 200 },
      "p1", "COACHING_STAFF", "PHYSICAL_COACH"
    );
    expect((result as any).allowedActivities).toBeUndefined();
  });

  test("rehabLoadPercentage 60 → 임계치 300으로 낮아져 500 부하 시 overload 알림", async () => {
    mockRepo.findActiveInjuryWithReport.mockResolvedValue({
      status: "REHABILITATING",
      report: { rehabLoadPercentage: 60, allowedActivities: null },
    });
    mockRepo.getWeeklyLoadTotal.mockResolvedValue(350);
    await service.upsert(
      { playerId: "p1", sessionId: 1, load: 350 },
      "p1", "COACHING_STAFF", "PHYSICAL_COACH"
    );
    expect(mockNotifRepo.createForPhysicalCoach).toHaveBeenCalledWith(
      "TRAINING_LOAD_ALERT",
      expect.any(Function),
      undefined
    );
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

```bash
cd apps/api && npx jest --testPathPattern="training-load.rehab-threshold" --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `getEffectiveThreshold` 미존재, `findActiveInjuryWithReport` 미존재

- [x] **Step 3: `training-load.repo.ts` — `findActiveInjuryWithReport` 추가**

기존 `findActiveInjury` 메서드를 다음으로 교체:

```typescript
findActiveInjuryWithReport(playerId: string) {
  return this.prisma.injury.findFirst({
    where: {
      playerId,
      status: { in: ["OCCURRED", "DIAGNOSED", "REHABILITATING"] as any },
    },
    select: {
      id: true,
      status: true,
      report: {
        select: {
          rehabLoadPercentage: true,
          allowedActivities: true,
        },
      },
    },
  });
}
```

> 기존 `findActiveInjury` 호출부가 있으면 `findActiveInjuryWithReport`로 일괄 교체.

- [x] **Step 4: `training-load.service.ts` — `getEffectiveThreshold` + 로직 수정**

`getLoadThreshold` 아래에 추가:

```typescript
export function getEffectiveThreshold(position?: string | null, rehabLoadPercentage?: number | null): number {
  const base = getLoadThreshold(position);
  if (!rehabLoadPercentage) return base;
  return Math.round(base * (rehabLoadPercentage / 100));
}
```

`upsert()` 메서드 내 기존 `findActiveInjury` 블록을 교체:

```typescript
const activeInjury = await this.repo.findActiveInjuryWithReport(dto.playerId);
const rehabLoadPercentage = activeInjury?.report?.rehabLoadPercentage ?? null;
const allowedActivities = activeInjury?.report?.allowedActivities ?? null;

if (activeInjury) {
  console.warn(`[TrainingLoad] Player ${dto.playerId} has active injury (${activeInjury.status})`);
}

const result = await this.repo.upsert(dto);

if (dto.load !== undefined) {
  const weekStart = this.getWeekStart(new Date());
  const total = await this.repo.getWeeklyLoadTotal(dto.playerId, weekStart);
  const player = await this.repo.getPlayerName(dto.playerId);
  const playerName = player?.playerName ?? dto.playerId;
  // KN6: rehab 선수는 rehabLoadPercentage 기준으로 임계치 하향
  const threshold = getEffectiveThreshold(player?.position, rehabLoadPercentage);
  if (total >= threshold) {
    // ... 기존 알림 발송 로직 유지 (threshold 변수 사용)
  }
}

// BH2: allowedActivities가 있으면 응답에 포함
const response = allowedActivities ? { ...result, allowedActivities } : result;
return response;
```

- [x] **Step 5: 테스트 통과 확인**

```bash
cd apps/api && npx jest --testPathPattern="training-load.rehab-threshold" --no-coverage 2>&1 | tail -15
```

Expected: PASS — 3개 테스트 통과

- [x] **Step 6: 커밋**

```bash
git add apps/api/src/training-load/ apps/api/__test__/training-load/
git commit -m "feat(training-load): KN6 rehab threshold scaling + BH2 allowedActivities in response"
```

---

## Task 3: BH4 — 부상 시점 priorWeeklyLoad 자동 기록

**Files:**
- Modify: `apps/api/src/injury/injury.repo.ts`
- Modify: `apps/api/src/injury/injury.service.ts`
- Create: `apps/api/__test__/injury/injury.prior-load.test.ts`

- [x] **Step 1: 실패 테스트 작성**

`apps/api/__test__/injury/injury.prior-load.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { InjuryService } from "../../src/injury/injury.service";

const mockRepo = {
  create: jest.fn(),
  updatePriorWeeklyLoad: jest.fn(),
  findById: jest.fn(),
} as any;
const mockNotifRepo = { createForCoachingStaff: jest.fn() } as any;
const mockLoadRepo = {
  getWeeklyLoadTotal: jest.fn(),
} as any;

describe("InjuryService — priorWeeklyLoad auto-populate (BH4)", () => {
  let service: InjuryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InjuryService(mockRepo, mockNotifRepo, mockLoadRepo);
    mockRepo.create.mockResolvedValue({ id: 10, playerId: "player-001" });
    mockRepo.updatePriorWeeklyLoad.mockResolvedValue(undefined);
  });

  test("createInjury 후 getWeeklyLoadTotal 조회 → updatePriorWeeklyLoad 호출", async () => {
    mockLoadRepo.getWeeklyLoadTotal.mockResolvedValue(420);
    await service.createInjury({ playerId: "player-001", bodyPart: "KNEE", cause: "TRAINING" } as any);
    // fire-and-forget이므로 microtask flush 필요
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockLoadRepo.getWeeklyLoadTotal).toHaveBeenCalledWith("player-001", expect.any(Date));
    expect(mockRepo.updatePriorWeeklyLoad).toHaveBeenCalledWith(10, 420);
  });

  test("loadTotal이 0이면 updatePriorWeeklyLoad 호출 안 함", async () => {
    mockLoadRepo.getWeeklyLoadTotal.mockResolvedValue(0);
    await service.createInjury({ playerId: "player-001", bodyPart: "KNEE", cause: "TRAINING" } as any);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockRepo.updatePriorWeeklyLoad).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

```bash
cd apps/api && npx jest --testPathPattern="injury.prior-load" --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `updatePriorWeeklyLoad` 미존재, `InjuryService` 3번째 인자 없음

- [x] **Step 3: `injury.repo.ts` — `updatePriorWeeklyLoad` 추가**

```typescript
updatePriorWeeklyLoad(injuryId: number, load: number) {
  return this.prisma.injury.update({
    where: { id: injuryId },
    data: { priorWeeklyLoad: load },
  });
}
```

- [x] **Step 4: `injury.service.ts` — TrainingLoadRepository 주입 + createInjury 수정**

생성자에 `loadRepo` 추가:

```typescript
constructor(
  private repo: InjuryRepository,
  private notifRepo: NotificationRepository,
  private loadRepo?: { getWeeklyLoadTotal: (playerId: string, weekStart: Date) => Promise<number> },
) {}
```

`createInjury()` 내 injury 생성 후:

```typescript
const result = await this.repo.create(dto);

// BH4: 부상 시점 직전 7일 훈련 부하 스냅샷 (fire-and-forget)
if (this.loadRepo) {
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  void this.loadRepo.getWeeklyLoadTotal(dto.playerId, weekStart)
    .then(load => { if (load > 0) return this.repo.updatePriorWeeklyLoad(result.id, load); })
    .catch(console.error);
}
```

`injury.routes.ts`에서 `InjuryService` 인스턴스화 시 `TrainingLoadRepository` 전달:

```typescript
import { TrainingLoadRepository } from "../training-load/training-load.repo";
const loadRepo = new TrainingLoadRepository(prisma);
const service = new InjuryService(repo, notifRepo, loadRepo);
```

- [x] **Step 5: 테스트 통과 확인**

```bash
cd apps/api && npx jest --testPathPattern="injury.prior-load" --no-coverage 2>&1 | tail -15
```

Expected: PASS — 2개 테스트 통과

- [x] **Step 6: 커밋**

```bash
git add apps/api/src/injury/ apps/api/__test__/injury/injury.prior-load.test.ts
git commit -m "feat(injury): BH4 auto-populate priorWeeklyLoad on injury creation"
```

---

## Task 4: BH7 — 재활 관련 알림

**Files:**
- Modify: `apps/api/src/injury/injury.service.ts`
- Create: `apps/api/__test__/injury/injury.rehab-notif.test.ts`

- [x] **Step 1: 실패 테스트 작성**

`apps/api/__test__/injury/injury.rehab-notif.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { InjuryService } from "../../src/injury/injury.service";

const baseRepo = {
  findById: jest.fn(),
  updateStatus: jest.fn(),
  getReport: jest.fn(),
  upsertReport: jest.fn(),
} as any;
const mockNotifRepo = {
  createForPhysicalCoach: jest.fn().mockResolvedValue(undefined),
  createForHeadCoach: jest.fn().mockResolvedValue(undefined),
  createForCoachingStaff: jest.fn().mockResolvedValue(undefined),
} as any;

describe("InjuryService — BH7 rehab notifications", () => {
  let service: InjuryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InjuryService(baseRepo, mockNotifRepo);
    baseRepo.findById.mockResolvedValue({ id: 1, playerId: "p1", status: "DIAGNOSED", player: { playerName: "김민준" } });
    baseRepo.updateStatus.mockResolvedValue({ id: 1, status: "REHABILITATING" });
  });

  test("updateStatus → REHABILITATING 시 PHYSICAL_COACH + HEAD_COACH 알림", async () => {
    baseRepo.getReport.mockResolvedValue(null);
    await service.updateStatus(1, { status: "REHABILITATING" }, 2, { role: "ADMIN", coachingRole: null });
    expect(mockNotifRepo.createForPhysicalCoach).toHaveBeenCalledWith(
      "INJURY_REHABILITATING_STARTED",
      expect.any(Function),
      1
    );
    expect(mockNotifRepo.createForHeadCoach).toHaveBeenCalledWith(
      "INJURY_REHABILITATING_STARTED",
      expect.any(Function),
      1
    );
  });

  test("REHABILITATING 외 상태 전환 시 INJURY_REHABILITATING_STARTED 알림 없음", async () => {
    baseRepo.updateStatus.mockResolvedValue({ id: 1, status: "READY_TO_RETURN" });
    baseRepo.findById.mockResolvedValue({ id: 1, playerId: "p1", status: "REHABILITATING", player: { playerName: "김민준" } });
    await service.updateStatus(1, { status: "READY_TO_RETURN" }, 2, { role: "ADMIN", coachingRole: null });
    expect(mockNotifRepo.createForPhysicalCoach).not.toHaveBeenCalledWith(
      "INJURY_REHABILITATING_STARTED",
      expect.any(Function),
      expect.anything()
    );
  });

  test("saveReport에서 rehabLoadPercentage 변경 시 PHYSICAL_COACH + HEAD_COACH 알림", async () => {
    baseRepo.findById.mockResolvedValue({ id: 1, playerId: "p1", status: "REHABILITATING", player: { playerName: "김민준" } });
    baseRepo.getReport.mockResolvedValue({ rehabLoadPercentage: 40, allowedActivities: null });
    baseRepo.upsertReport.mockResolvedValue({ id: 1, rehabLoadPercentage: 70, allowedActivities: null, matchAvailable: false, medicalSignedAt: null });
    await service.saveReport(1, { rehabLoadPercentage: 70 } as any, 2, { role: "ADMIN", coachingRole: null });
    expect(mockNotifRepo.createForPhysicalCoach).toHaveBeenCalledWith(
      "INJURY_REPORT_UPDATED",
      expect.any(Function),
      1
    );
    expect(mockNotifRepo.createForHeadCoach).toHaveBeenCalledWith(
      "INJURY_REPORT_UPDATED",
      expect.any(Function),
      1
    );
  });

  test("saveReport에서 재활 무관 필드(matchAvailable)만 변경 시 알림 없음", async () => {
    baseRepo.findById.mockResolvedValue({ id: 1, playerId: "p1", status: "REHABILITATING", player: { playerName: "김민준" } });
    baseRepo.getReport.mockResolvedValue({ rehabLoadPercentage: 60, allowedActivities: null });
    baseRepo.upsertReport.mockResolvedValue({ id: 1, rehabLoadPercentage: 60, allowedActivities: null, matchAvailable: true, medicalSignedAt: null });
    await service.saveReport(1, { matchAvailable: true } as any, 2, { role: "ADMIN", coachingRole: null });
    expect(mockNotifRepo.createForPhysicalCoach).not.toHaveBeenCalledWith(
      "INJURY_REPORT_UPDATED",
      expect.any(Function),
      expect.anything()
    );
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

```bash
cd apps/api && npx jest --testPathPattern="injury.rehab-notif" --no-coverage 2>&1 | tail -15
```

Expected: FAIL — 알림 미발송

- [x] **Step 3: `injury.service.ts` — `updateStatus` 수정**

기존 `READY_TO_RETURN` 알림 블록 앞에 추가:

```typescript
if (dto.status === "REHABILITATING") {
  const name = injury.player?.playerName ?? String(id);
  const title = "재활 훈련 시작";
  const body = `${name} 선수가 재활 훈련을 시작합니다. 훈련 부하 계획을 조정해주세요.`;
  await Promise.all([
    this.notifRepo.createForPhysicalCoach("INJURY_REHABILITATING_STARTED", () => ({ title, body }), id).catch(console.error),
    this.notifRepo.createForHeadCoach("INJURY_REHABILITATING_STARTED", () => ({ title, body }), id).catch(console.error),
  ]);
}
```

- [x] **Step 4: `injury.service.ts` — `saveReport` 수정**

`upsertReport` 호출 전에 기존 리포트 조회 후 비교:

```typescript
const existing = await this.repo.getReport(injuryId);
const report = await this.repo.upsertReport(injuryId, safeDto, userId);

// BH7: rehabLoadPercentage 또는 allowedActivities 변경 시 피지컬 코치 + 헤드코치 알림
const rehabChanged =
  (safeDto.rehabLoadPercentage !== undefined && safeDto.rehabLoadPercentage !== existing?.rehabLoadPercentage) ||
  (safeDto.allowedActivities !== undefined && safeDto.allowedActivities !== existing?.allowedActivities);

if (rehabChanged) {
  const name = injury.player?.playerName ?? String(injuryId);
  const pct = report.rehabLoadPercentage;
  const title = "재활 훈련 조건 변경";
  const body = `${name} 선수의 재활 부하 허용치가 ${pct ? pct + "%" : "미설정"}로 업데이트됐습니다.`;
  await Promise.all([
    this.notifRepo.createForPhysicalCoach("INJURY_REPORT_UPDATED", () => ({ title, body }), injuryId).catch(console.error),
    this.notifRepo.createForHeadCoach("INJURY_REPORT_UPDATED", () => ({ title, body }), injuryId).catch(console.error),
  ]);
}
```

`injury.repo.ts`에 `getReport` 메서드가 없으면 추가:

```typescript
getReport(injuryId: number) {
  return this.prisma.injuryReport.findUnique({
    where: { injuryId },
    select: { rehabLoadPercentage: true, allowedActivities: true },
  });
}
```

- [x] **Step 5: 테스트 통과 확인**

```bash
cd apps/api && npx jest --testPathPattern="injury.rehab-notif" --no-coverage 2>&1 | tail -15
```

Expected: PASS — 4개 테스트 통과

- [x] **Step 6: 커밋**

```bash
git add apps/api/src/injury/ apps/api/__test__/injury/injury.rehab-notif.test.ts
git commit -m "feat(injury): BH7 notify PHYSICAL_COACH+HEAD_COACH on REHABILITATING transition and report update"
```

---

## Task 5: BH8 — 고퍼포먼스 알림 (approveSession)

**Files:**
- Modify: `apps/api/src/training/training.service.ts`
- Create: `apps/api/__test__/training/training.high-performance.test.ts`

- [x] **Step 1: 실패 테스트 작성**

`apps/api/__test__/training/training.high-performance.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TrainingService } from "../../src/training/training.service";

const mockRepo = {
  findById: jest.fn(),
  approve: jest.fn(),
  findPlayerUserId: jest.fn(),
} as any;
const mockNotifRepo = {
  createForHeadCoach: jest.fn().mockResolvedValue(undefined),
  createForUser: jest.fn().mockResolvedValue(undefined),
} as any;

describe("TrainingService — BH8 high performance notification", () => {
  let service: TrainingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrainingService(mockRepo, mockNotifRepo);
    mockRepo.approve.mockResolvedValue({ id: 1, isApproved: true, approvedById: 2 });
  });

  test("80+ 선수 있으면 HEAD_COACH 알림 + 선수 본인 알림", async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      isApproved: false,
      results: [
        { attendance: "PRESENT", performanceScore: 85, playerId: "p1", player: { playerName: "김민준" } },
        { attendance: "PRESENT", performanceScore: 70, playerId: "p2", player: { playerName: "이준" } },
      ],
    });
    mockRepo.findPlayerUserId.mockResolvedValue({ userId: 17 });

    await service.approveSession(1, 2);

    expect(mockNotifRepo.createForHeadCoach).toHaveBeenCalledWith(
      "TRAINING_HIGH_PERFORMANCE_PLAYER",
      expect.any(Function),
      1
    );
    expect(mockNotifRepo.createForUser).toHaveBeenCalledWith(
      17, "TRAINING_HIGH_PERFORMANCE_SELF", expect.any(Function), 1
    );
    // 70점 선수(p2)는 알림 없음
    expect(mockNotifRepo.createForUser).toHaveBeenCalledTimes(1);
  });

  test("80+ 선수 없으면 고퍼포먼스 알림 없음", async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      isApproved: false,
      results: [
        { attendance: "PRESENT", performanceScore: 75, playerId: "p1", player: { playerName: "김민준" } },
      ],
    });

    await service.approveSession(1, 2);

    expect(mockNotifRepo.createForHeadCoach).not.toHaveBeenCalledWith(
      "TRAINING_HIGH_PERFORMANCE_PLAYER",
      expect.any(Function),
      expect.anything()
    );
  });

  test("ABSENT_AUTHORIZED 선수는 고퍼포먼스 체크 제외", async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      isApproved: false,
      results: [
        { attendance: "ABSENT_AUTHORIZED", performanceScore: 90, playerId: "p1", player: { playerName: "김민준" } },
      ],
    });

    await service.approveSession(1, 2);

    expect(mockNotifRepo.createForHeadCoach).not.toHaveBeenCalledWith(
      "TRAINING_HIGH_PERFORMANCE_PLAYER",
      expect.any(Function),
      expect.anything()
    );
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

```bash
cd apps/api && npx jest --testPathPattern="training.high-performance" --no-coverage 2>&1 | tail -15
```

Expected: FAIL — 고퍼포먼스 알림 미구현

- [x] **Step 3: `training.service.ts` — `approveSession` 수정**

`approveSession()` 내 `return` 직전에 추가 (기존 evalWarning 로직 뒤):

```typescript
// BH8: 고퍼포먼스 선수(score ≥ 80) 일괄 알림 (fire-and-forget)
const HIGH_PERF_THRESHOLD = 80;
const highPerfResults = presentResults.filter(
  (r: any) => r.performanceScore != null && r.performanceScore >= HIGH_PERF_THRESHOLD
);

if (highPerfResults.length > 0 && this.notifRepo) {
  void (async () => {
    const names = highPerfResults.map((r: any) => r.player?.playerName ?? r.playerId).join(", ");
    await this.notifRepo!.createForHeadCoach(
      "TRAINING_HIGH_PERFORMANCE_PLAYER",
      () => ({
        title: "고퍼포먼스 선수",
        body: `${names} 선수가 이번 세션에서 ${HIGH_PERF_THRESHOLD}점 이상을 기록했습니다.`,
      }),
      id,
    ).catch(console.error);

    for (const r of highPerfResults) {
      const player = await this.repo.findPlayerUserId(r.playerId);
      if (player?.userId) {
        await this.notifRepo!.createForUser(
          player.userId,
          "TRAINING_HIGH_PERFORMANCE_SELF",
          () => ({
            title: "훌륭한 훈련이었습니다",
            body: `오늘 훈련 평가 점수: ${r.performanceScore}점`,
          }),
          id,
        ).catch(console.error);
      }
    }
  })();
}
```

> `presentResults`는 이미 `approveSession` 내에서 계산됩니다. `HIGH_PERF_THRESHOLD`는 상수로 추출.

- [x] **Step 4: 테스트 통과 확인**

```bash
cd apps/api && npx jest --testPathPattern="training.high-performance" --no-coverage 2>&1 | tail -15
```

Expected: PASS — 3개 테스트 통과

- [x] **Step 5: 커밋**

```bash
git add apps/api/src/training/training.service.ts apps/api/__test__/training/training.high-performance.test.ts
git commit -m "feat(training): BH8 notify HEAD_COACH and player on performanceScore >= 80 at session approval"
```

---

## Task 6: BH9 — matchAvailable 라인업 블록 해제

**Files:**
- Modify: `apps/api/src/match/match.lineup.repo.ts`
- Create: `apps/api/__test__/match/match.lineup.match-available.test.ts`

- [x] **Step 1: 실패 테스트 작성**

`apps/api/__test__/match/match.lineup.match-available.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { MatchLineupRepository } from "../../src/match/match.lineup.repo";

const mockFindMany = jest.fn();
const mockPrisma = {
  injury: { findMany: mockFindMany },
} as any;

describe("MatchLineupRepository — BH9 matchAvailable bypass", () => {
  let repo: MatchLineupRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new MatchLineupRepository(mockPrisma);
  });

  test("matchAvailable=true + medicalSignedAt 있으면 결과에서 제외", async () => {
    mockFindMany.mockResolvedValue([
      { playerId: "p1" }, // 일반 부상 → 포함
      // p2는 matchAvailable=true + medicalSignedAt → 쿼리에서 제외되므로 반환 안 됨
    ]);
    const result = await repo.findActiveInjuredPlayerIds(["p1", "p2"]);
    expect(result.map(r => r.playerId)).toEqual(["p1"]);
  });

  test("matchAvailable=true 지만 medicalSignedAt=null이면 여전히 블록", async () => {
    mockFindMany.mockResolvedValue([
      { playerId: "p1" },
      { playerId: "p2" }, // medicalSignedAt 없음 → 블록 유지
    ]);
    const result = await repo.findActiveInjuredPlayerIds(["p1", "p2"]);
    expect(result.map(r => r.playerId)).toContain("p2");
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

```bash
cd apps/api && npx jest --testPathPattern="match.lineup.match-available" --no-coverage 2>&1 | tail -15
```

Expected: FAIL — 현재 쿼리에 `matchAvailable` 조건 없음

- [x] **Step 3: `match.lineup.repo.ts` — `findActiveInjuredPlayerIds` 수정**

```typescript
findActiveInjuredPlayerIds(playerIds: string[]) {
  return this.prisma.injury.findMany({
    where: {
      playerId: { in: playerIds },
      status: { not: "RETURNED" },
      // BH9: matchAvailable=true + 의사 서명 완료이면 라인업 허용
      NOT: {
        report: {
          matchAvailable: true,
          medicalSignedAt: { not: null },
        },
      },
    },
    select: { playerId: true },
  });
}
```

- [x] **Step 4: 테스트 통과 확인**

```bash
cd apps/api && npx jest --testPathPattern="match.lineup.match-available" --no-coverage 2>&1 | tail -15
```

Expected: PASS — 2개 테스트 통과

- [x] **Step 5: 커밋**

```bash
git add apps/api/src/match/match.lineup.repo.ts apps/api/__test__/match/match.lineup.match-available.test.ts
git commit -m "feat(lineup): BH9 lift lineup block when matchAvailable=true and medicalSignedAt present"
```

---

## Self-Review

### Spec coverage check

| 갭 | Task | 상태 |
|----|------|------|
| KN6: rehabLoadPercentage → 임계치 하향 | Task 2 | ✅ PR #285 |
| BH2: allowedActivities → upsert 응답에 포함 | Task 2 | ✅ PR #285 |
| BH4: createInjury → priorWeeklyLoad 자동 기록 | Task 3 | ✅ PR #285 |
| BH7: REHABILITATING 전환 + 리포트 변경 → 알림 | Task 4 | ✅ PR #285 |
| BH8: performanceScore ≥ 80 → 세션 승인 시 알림 | Task 5 | ✅ PR #285 |
| BH9: matchAvailable=true + medicalSignedAt → 라인업 블록 해제 | Task 6 | ✅ PR #285 |

### 타입 일관성

- `getEffectiveThreshold(position, rehabLoadPercentage)` — `number | null` 입력, `number` 반환
- `findActiveInjuryWithReport()` — `{ id, status, report: { rehabLoadPercentage, allowedActivities } | null }`
- `allowedActivities` upsert 응답 — 선택적 확장 (`{ ...result, allowedActivities? }`)
- `updatePriorWeeklyLoad(injuryId, load)` — fire-and-forget, `load > 0` 조건 후 호출
- `findActiveInjuredPlayerIds` — 기존 반환 타입 `{ playerId: string }[]` 유지, 쿼리 조건만 추가
