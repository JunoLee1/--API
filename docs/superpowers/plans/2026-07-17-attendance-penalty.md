# 훈련 출결 페널티 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 훈련 출결 기록 시 무단 지각 3회=무단 결석 1회 환산, 누적 무단 결석 3회 배수마다 감독(HEAD_COACH)에게 알림을 발송한다.

**Architecture:** 기존 `TrainingResult` 모델에 스키마 변경 없이, `upsertResult` 호출 시 누적 출결을 집계(groupBy)하여 3의 배수 도달 여부를 판단한다. 페널티 판단 로직은 순수 함수로 분리해 `training.service.ts`에서 export하고 단위 테스트로 검증한다. 알림은 기존 fire-and-forget 패턴을 따른다.

**Tech Stack:** Express + Prisma 7 + TypeScript (BE), Jest integration tests

---

## File Structure

**수정:**
- `apps/api/src/notification/notification.repo.ts` — `createForHeadCoach` 메서드 추가
- `apps/api/src/notification/notification.service.ts` — `notifyAttendancePenalty` 메서드 추가
- `apps/api/src/training/training.repo.ts` — `countUnexcusedAttendance`, `findPlayerNameById` 추가
- `apps/api/src/training/training.service.ts` — `calcEffectiveAbsences`, `shouldTriggerPenalty` export + `upsertResult`에 페널티 체크 추가

**신규 생성:**
- `apps/api/__test__/training/attendance.penalty.test.ts` — 순수함수 단위 테스트 + `countUnexcusedAttendance` 통합 테스트

---

## 출결 규칙 요약 (모든 태스크 참고)

| 상황 | 처리 |
|------|------|
| `ABSENT_UNAUTHORIZED` | 무단 결석 1회 |
| `LATE_UNAUTHORIZED` | 무단 지각 1회 (3회 = 무단 결석 1회) |
| `effectiveAbsences = ABSENT_UNAUTHORIZED + floor(LATE_UNAUTHORIZED / 3)` | |
| `effectiveAbsences > 0 && effectiveAbsences % 3 === 0` | 감독 알림 발송 |

재알림: 3회, 6회, 9회… 마다 반복 발송.

---

## Task 1: Notification — createForHeadCoach + notifyAttendancePenalty

**Files:**
- Modify: `apps/api/src/notification/notification.repo.ts`
- Modify: `apps/api/src/notification/notification.service.ts`

- [ ] **Step 1: notification.repo.ts — `createForHeadCoach` 추가**

`createForTD` 메서드 바로 뒤에 삽입:

```typescript
createForHeadCoach(type: string, title: string, body: string, entityId?: number) {
  return this.prisma.$transaction(async (tx) => {
    const headCoaches = await tx.user.findMany({
      where: { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" },
      select: { id: true },
    });
    if (headCoaches.length === 0) return;
    await tx.notification.createMany({
      data: headCoaches.map((u) => ({ userId: u.id, type, title, body, entityId })) as any,
    });
  });
}
```

- [ ] **Step 2: notification.service.ts — `notifyAttendancePenalty` 추가**

`notifyCoachArchived` 메서드 바로 뒤에 삽입:

```typescript
async notifyAttendancePenalty(playerName: string, effectiveAbsences: number) {
  const title = "훈련 출결 페널티 발생";
  const body = `${playerName} 선수의 누적 무단 결석이 ${effectiveAbsences}회에 도달했습니다.`;
  await this.repo.createForHeadCoach("ATTENDANCE_PENALTY", title, body);
  getIO().to("staff-room").emit("notification:attendance", {
    type: "ATTENDANCE_PENALTY", title, body, createdAt: new Date().toISOString(),
  });
}
```

- [ ] **Step 3: tsc 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|ErrorHandler" | head -10
```

Expected: 0 errors

- [ ] **Step 4: commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/notification/notification.repo.ts apps/api/src/notification/notification.service.ts
git commit -m "feat(attendance): add createForHeadCoach and notifyAttendancePenalty"
```

---

## Task 2: Training Repo — countUnexcusedAttendance + findPlayerNameById

**Files:**
- Modify: `apps/api/src/training/training.repo.ts`

- [ ] **Step 1: `countUnexcusedAttendance` 추가**

`updateResult` 메서드 바로 뒤에 삽입:

```typescript
async countUnexcusedAttendance(playerId: string): Promise<{ absences: number; lateCount: number }> {
  const rows = await this.prisma.trainingResult.groupBy({
    by: ["attendance"],
    where: { playerId, attendance: { in: ["ABSENT_UNAUTHORIZED", "LATE_UNAUTHORIZED"] } },
    _count: { attendance: true },
  });
  const absences = rows.find((r) => r.attendance === "ABSENT_UNAUTHORIZED")?._count.attendance ?? 0;
  const lateCount = rows.find((r) => r.attendance === "LATE_UNAUTHORIZED")?._count.attendance ?? 0;
  return { absences, lateCount };
}

findPlayerNameById(playerId: string) {
  return this.prisma.player.findUnique({ where: { id: playerId }, select: { playerName: true } });
}
```

- [ ] **Step 2: tsc 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|ErrorHandler" | head -10
```

Expected: 0 errors

- [ ] **Step 3: commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/training/training.repo.ts
git commit -m "feat(attendance): add countUnexcusedAttendance and findPlayerNameById to TrainingRepository"
```

---

## Task 3: Training Service — 페널티 판단 + upsertResult 통합

**Files:**
- Modify: `apps/api/src/training/training.service.ts`

- [ ] **Step 1: 파일 상단에 import 추가 + 순수 함수 export**

기존 import 블록 뒤에 추가:

```typescript
import { NotificationService } from "../notification/notification.service";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const notificationService = new NotificationService(new NotificationRepository(getPrisma()));

export function calcEffectiveAbsences(absences: number, lateCount: number): number {
  return absences + Math.floor(lateCount / 3);
}

export function shouldTriggerPenalty(effectiveAbsences: number): boolean {
  return effectiveAbsences > 0 && effectiveAbsences % 3 === 0;
}
```

- [ ] **Step 2: `upsertResult` 메서드 교체**

기존 `upsertResult` 전체를 아래로 교체:

```typescript
async upsertResult(sessionId: number, dto: UpsertResultDto) {
  const session = await this.repo.findById(sessionId);
  if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
  const existing = await this.repo.findResult(sessionId, dto.playerId);
  const result = existing
    ? await this.repo.updateResult(existing.id, dto)
    : await this.repo.createResult(sessionId, dto);

  if (dto.attendance === "ABSENT_UNAUTHORIZED" || dto.attendance === "LATE_UNAUTHORIZED") {
    const { absences, lateCount } = await this.repo.countUnexcusedAttendance(dto.playerId);
    const effective = calcEffectiveAbsences(absences, lateCount);
    if (shouldTriggerPenalty(effective)) {
      const player = await this.repo.findPlayerNameById(dto.playerId);
      if (player) {
        void notificationService.notifyAttendancePenalty(player.playerName, effective).catch(console.error);
      }
    }
  }

  return result;
}
```

- [ ] **Step 3: tsc 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|ErrorHandler" | head -10
```

Expected: 0 errors

- [ ] **Step 4: commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/training/training.service.ts
git commit -m "feat(attendance): add penalty check to upsertResult"
```

---

## Task 4: 테스트 — 순수함수 단위 테스트 + countUnexcusedAttendance 통합 테스트

**Files:**
- Create: `apps/api/__test__/training/attendance.penalty.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

```typescript
import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { calcEffectiveAbsences, shouldTriggerPenalty } from '../../src/training/training.service';
import { TrainingRepository } from '../../src/training/training.repo';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// ── 순수 함수 단위 테스트 ────────────────────────────────────────────────────

describe('calcEffectiveAbsences', () => {
  it('무단 결석만 카운트', () => {
    expect(calcEffectiveAbsences(3, 0)).toBe(3);
  });
  it('무단 지각 3회 = 무단 결석 1회', () => {
    expect(calcEffectiveAbsences(0, 3)).toBe(1);
  });
  it('혼합: 결석 2 + 지각 3 = effective 3', () => {
    expect(calcEffectiveAbsences(2, 3)).toBe(3);
  });
  it('지각 나머지는 버림: floor(8/3)=2', () => {
    expect(calcEffectiveAbsences(0, 8)).toBe(2);
  });
});

describe('shouldTriggerPenalty', () => {
  it('3회 도달 시 트리거', () => {
    expect(shouldTriggerPenalty(3)).toBe(true);
  });
  it('6회 도달 시 재트리거', () => {
    expect(shouldTriggerPenalty(6)).toBe(true);
  });
  it('0회는 트리거 안함', () => {
    expect(shouldTriggerPenalty(0)).toBe(false);
  });
  it('1, 2, 4, 5회는 트리거 안함', () => {
    expect(shouldTriggerPenalty(1)).toBe(false);
    expect(shouldTriggerPenalty(2)).toBe(false);
    expect(shouldTriggerPenalty(4)).toBe(false);
    expect(shouldTriggerPenalty(5)).toBe(false);
  });
});

// ── countUnexcusedAttendance 통합 테스트 ──────────────────────────────────

let s1Id: number;
let s2Id: number;
let s3Id: number;
let testPlayerId: string;

beforeAll(async () => {
  const player = await prisma.player.findFirst({ select: { id: true } });
  if (!player) throw new Error('테스트 player가 없습니다.');
  testPlayerId = player.id;

  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error('테스트 user가 없습니다.');
  const season = await prisma.season.findFirst({ select: { id: true } });
  if (!season) throw new Error('테스트 season이 없습니다.');

  const base = { goal: '페널티테스트', sessionType: 'PHYSICAL' as const, seasonId: season.id, createdById: user.id };
  const [a, b, c] = await Promise.all([
    prisma.trainingSession.create({ data: { ...base, date: new Date('2026-01-01') } }),
    prisma.trainingSession.create({ data: { ...base, date: new Date('2026-01-02') } }),
    prisma.trainingSession.create({ data: { ...base, date: new Date('2026-01-03') } }),
  ]);
  s1Id = a.id; s2Id = b.id; s3Id = c.id;
});

afterAll(async () => {
  await prisma.trainingResult.deleteMany({ where: { sessionId: { in: [s1Id, s2Id, s3Id] } } });
  await prisma.trainingSession.deleteMany({ where: { id: { in: [s1Id, s2Id, s3Id] } } });
  await prisma.$disconnect();
});

describe('TrainingRepository.countUnexcusedAttendance', () => {
  it('기록 없으면 0 반환', async () => {
    const repo = new TrainingRepository(prisma);
    const result = await repo.countUnexcusedAttendance(testPlayerId);
    expect(result.absences).toBe(0);
    expect(result.lateCount).toBe(0);
  });

  it('무단 결석 1 + 무단 지각 1 카운트', async () => {
    await prisma.trainingResult.createMany({
      data: [
        { sessionId: s1Id, playerId: testPlayerId, attendance: 'ABSENT_UNAUTHORIZED' },
        { sessionId: s2Id, playerId: testPlayerId, attendance: 'LATE_UNAUTHORIZED' },
        { sessionId: s3Id, playerId: testPlayerId, attendance: 'PRESENT' },
      ],
    });
    const repo = new TrainingRepository(prisma);
    const result = await repo.countUnexcusedAttendance(testPlayerId);
    expect(result.absences).toBe(1);
    expect(result.lateCount).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
cd /Users/juno/work/football/apps/api && npx jest __test__/training/attendance.penalty.test.ts --no-coverage 2>&1 | tail -20
```

Expected: 10/10 PASS

- [ ] **Step 3: commit**

```bash
cd /Users/juno/work/football
git add apps/api/__test__/training/attendance.penalty.test.ts
git commit -m "test(attendance): add penalty pure function and integration tests"
```

---

## Self-Review

**Spec coverage:**
- [x] 무단 지각 3회 = 무단 결석 1회 — `calcEffectiveAbsences` (Task 3)
- [x] 누적 무단 결석 3회 배수마다 재알림 — `shouldTriggerPenalty` (Task 3)
- [x] 감독(HEAD_COACH) 알림 — `createForHeadCoach` + `notifyAttendancePenalty` (Task 1)
- [x] 기존 `upsertResult` 트리거 — Task 3
- [x] 스키마 변경 없음 — groupBy 집계 사용

**Placeholder scan:** 없음

**Type consistency:**
- `calcEffectiveAbsences(absences: number, lateCount: number)` — Task 3 정의, Task 4 import ✅
- `shouldTriggerPenalty(effectiveAbsences: number)` — Task 3 정의, Task 4 import ✅
- `countUnexcusedAttendance(playerId: string)` — Task 2 정의, Task 3에서 `this.repo.countUnexcusedAttendance` 호출 ✅
- `findPlayerNameById(playerId: string)` — Task 2 정의, Task 3에서 호출 ✅
- `notifyAttendancePenalty(playerName: string, effectiveAbsences: number)` — Task 1 정의, Task 3에서 호출 ✅
