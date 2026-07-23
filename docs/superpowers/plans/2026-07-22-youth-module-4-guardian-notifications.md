# 유소년 모듈 Plan 4: GUARDIAN 알림 (주간 일정 + 이벤트 알림)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학부모(GUARDIAN)에게 주간 훈련·경기 일정 요약(월요일 cron)과 세션 변경·취소 즉시 알림을 구현한다. MATCH_DAY_REMINDER와 CALLUP_REQUESTED도 GUARDIAN 수신자에 확장한다.

**Architecture:** 두 가지 알림 채널. (1) 주간 cron — `node-cron` `0 8 * * 1` (월요일 08:00), 그 주의 TrainingSession + Match를 조회해 GUARDIAN별로 묶어 1건씩 발송. (2) 이벤트 트리거 — TrainingSession 수정/취소 시 해당 팀의 GUARDIAN에게 즉시 발송.

**Tech Stack:** node-cron (기존 패턴), Prisma, NotificationRepository

**의존성:** Plan 1 완료 필요 (GUARDIAN 역할, `Player.guardianId`, `createForGuardian`)

---

## 파일 맵

### BE — 신규
- `apps/api/src/jobs/youthWeeklySchedule.ts`
- `apps/api/__test__/jobs/youthWeeklySchedule.test.ts`

### BE — 수정
- `apps/api/src/training/training.service.ts` — 세션 수정/취소 시 GUARDIAN 알림
- `apps/api/src/training/training.repo.ts` — 팀의 GUARDIAN 조회 메서드 추가
- `apps/api/src/match/match.squad.repo.ts` — GUARDIAN 포함 알림 대상 조회
- `apps/api/src/player-callup/player-callup.service.ts` — CALLUP_REQUESTED에 GUARDIAN 추가
- `apps/api/src/server.ts` — 새 cron job 등록
- `apps/api/__test__/training/training.session.guardian.test.ts`

---

## Task 1: 주간 일정 cron job

**Files:**
- Create: `apps/api/src/jobs/youthWeeklySchedule.ts`
- Create: `apps/api/__test__/jobs/youthWeeklySchedule.test.ts`

- [ ] **Step 1: failing test 작성**

`apps/api/__test__/jobs/youthWeeklySchedule.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { collectWeeklyScheduleByGuardian } from "../../src/jobs/youthWeeklySchedule";

const monday = new Date("2026-07-20T00:00:00.000Z"); // 월요일

const mockPrisma = {
  trainingSession: {
    findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([
      {
        id: 1, date: new Date("2026-07-21T09:00:00.000Z"), sessionType: "FIELD",
        team: { id: 2, name: "U15" },
      },
    ]),
  },
  match: {
    findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([
      {
        id: 10, date: new Date("2026-07-23T14:00:00.000Z"),
        homeTeamName: "우리팀 U15", awayTeamName: "상대팀",
        team: { id: 2 },
      },
    ]),
  },
  player: {
    findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([
      { guardianId: 100 },
      { guardianId: 101 },
    ]),
  },
} as any;

describe("collectWeeklyScheduleByGuardian", () => {
  beforeEach(() => jest.clearAllMocks());

  test("이번 주 훈련과 경기를 guardianId별로 묶어 반환", async () => {
    const result = await collectWeeklyScheduleByGuardian(mockPrisma, monday);

    expect(result).toHaveLength(2); // 두 guardianId에 각각
    expect(result[0]!.guardianId).toBe(100);
    expect(result[0]!.sessions).toHaveLength(1);
    expect(result[0]!.matches).toHaveLength(1);
  });

  test("guardianId 없는 선수는 제외", async () => {
    mockPrisma.player.findMany.mockResolvedValueOnce([{ guardianId: null }, { guardianId: 200 }]);
    const result = await collectWeeklyScheduleByGuardian(mockPrisma, monday);
    expect(result.every(r => r.guardianId !== null)).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd apps/api && npx jest __test__/jobs/youthWeeklySchedule.test.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: cron job 구현**

`apps/api/src/jobs/youthWeeklySchedule.ts`:

```typescript
import cron from "node-cron";
import type { PrismaClient } from "../generated/client";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";

export async function collectWeeklyScheduleByGuardian(
  prisma: PrismaClient,
  weekStart: Date,
) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // 이번 주 YOUTH 팀 훈련 세션
  const sessions = await prisma.trainingSession.findMany({
    where: {
      date: { gte: weekStart, lt: weekEnd },
      team: { type: "YOUTH" },
    },
    select: { id: true, date: true, sessionType: true, team: { select: { id: true, name: true } } },
  });

  // 이번 주 YOUTH 팀 경기
  const matches = await prisma.match.findMany({
    where: {
      date: { gte: weekStart, lt: weekEnd },
      team: { type: "YOUTH" },
    },
    select: { id: true, date: true, homeTeamName: true, awayTeamName: true, team: { select: { id: true } } },
  });

  // 해당 팀 선수들의 GUARDIAN 수집
  const youthTeamIds = [...new Set([
    ...sessions.map(s => s.team.id),
    ...matches.map(m => m.team!.id),
  ])];

  if (youthTeamIds.length === 0) return [];

  const players = await prisma.player.findMany({
    where: { teamId: { in: youthTeamIds }, guardianId: { not: null } },
    select: { guardianId: true, teamId: true },
  });

  // guardianId별로 묶기
  const guardianMap = new Map<number, { sessions: typeof sessions; matches: typeof matches }>();

  for (const player of players) {
    if (!player.guardianId) continue;
    if (!guardianMap.has(player.guardianId)) {
      guardianMap.set(player.guardianId, {
        sessions: sessions.filter(s => s.team.id === player.teamId),
        matches: matches.filter(m => m.team?.id === player.teamId),
      });
    }
  }

  return Array.from(guardianMap.entries()).map(([guardianId, data]) => ({
    guardianId,
    ...data,
  }));
}

export function startYouthWeeklyScheduleJob() {
  // 매주 월요일 오전 8시
  cron.schedule("0 8 * * 1", async () => {
    const prisma = getPrisma();
    const notifRepo = new NotificationRepository(prisma);

    const monday = new Date();
    monday.setHours(0, 0, 0, 0);

    const groups = await collectWeeklyScheduleByGuardian(prisma, monday);

    for (const group of groups) {
      const sessionCount = group.sessions.length;
      const matchCount = group.matches.length;
      const body = [
        sessionCount > 0 ? `훈련 ${sessionCount}회` : null,
        matchCount > 0 ? `경기 ${matchCount}경기` : null,
      ].filter(Boolean).join(", ");

      if (!body) continue;

      void notifRepo
        .createForGuardian(
          group.guardianId,
          "YOUTH_WEEKLY_SCHEDULE",
          "이번 주 일정 안내",
          `이번 주 예정된 일정: ${body}`,
        )
        .catch(console.error);
    }
  });
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
cd apps/api && npx jest __test__/jobs/youthWeeklySchedule.test.ts --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: server.ts에 cron 등록**

`apps/api/src/server.ts`에 추가:

```typescript
import { startYouthWeeklyScheduleJob } from "./jobs/youthWeeklySchedule";
// startExternalReportReminderJob(); 아래에:
startYouthWeeklyScheduleJob();
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/jobs/youthWeeklySchedule.ts apps/api/__test__/jobs/ apps/api/src/server.ts
git commit -m "feat(youth): 주간 일정 cron - GUARDIAN에게 매주 월요일 발송"
```

---

## Task 2: 훈련 세션 변경·취소 시 GUARDIAN 즉시 알림

**Files:**
- Modify: `apps/api/src/training/training.repo.ts`
- Modify: `apps/api/src/training/training.service.ts`
- Create: `apps/api/__test__/training/training.session.guardian.test.ts`

- [ ] **Step 1: training.repo.ts에 GUARDIAN 조회 메서드 추가**

`apps/api/src/training/training.repo.ts`에 추가:

```typescript
findGuardiansByTeam(teamId: number): Promise<number[]> {
  return this.prisma.player
    .findMany({
      where: { teamId, guardianId: { not: null } },
      select: { guardianId: true },
    })
    .then(rows => rows.map(r => r.guardianId!));
}
```

- [ ] **Step 2: failing test 작성**

`apps/api/__test__/training/training.session.guardian.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TrainingService } from "../../src/training/training.service";

// TrainingService의 실제 생성자 시그니처에 맞게 mockRepo 구성
const mockRepo = {
  findById: jest.fn(),
  update: jest.fn(),
  cancel: jest.fn(),
  findGuardiansByTeam: jest.fn<() => Promise<number[]>>().mockResolvedValue([100, 101]),
  // 기존 메서드 필요 시 추가
} as any;

const mockNotifRepo = {
  createForGuardian: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
  // 기존 메서드 추가
  createForHeadCoach: jest.fn(),
  createForStaff: jest.fn(),
} as any;

const service = new TrainingService(mockRepo, mockNotifRepo);

describe("TrainingService - YOUTH 세션 변경 시 GUARDIAN 알림", () => {
  beforeEach(() => jest.clearAllMocks());

  test("YOUTH 팀 세션 날짜 변경 시 GUARDIAN에게 알림 발송", async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1, teamId: 2, team: { type: "YOUTH", name: "U15" },
      date: new Date("2026-07-21T09:00:00.000Z"),
    });
    mockRepo.update.mockResolvedValue({ id: 1, date: new Date("2026-07-22T09:00:00.000Z") });

    await service.updateSession(1, { date: "2026-07-22T09:00:00.000Z" }, 1);

    expect(mockRepo.findGuardiansByTeam).toHaveBeenCalledWith(2);
    expect(mockNotifRepo.createForGuardian).toHaveBeenCalledTimes(2);
    expect(mockNotifRepo.createForGuardian).toHaveBeenCalledWith(
      100, "YOUTH_SESSION_CHANGED", expect.stringContaining("U15"), expect.any(String), 1,
    );
  });

  test("FIRST_TEAM 세션 변경 시 GUARDIAN 알림 미발송", async () => {
    mockRepo.findById.mockResolvedValue({
      id: 2, teamId: 3, team: { type: "FIRST_TEAM", name: "1군" },
      date: new Date(),
    });
    mockRepo.update.mockResolvedValue({ id: 2 });

    await service.updateSession(2, { date: "2026-07-22T10:00:00.000Z" }, 1);

    expect(mockRepo.findGuardiansByTeam).not.toHaveBeenCalled();
    expect(mockNotifRepo.createForGuardian).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 테스트 실행 → 확인**

```bash
cd apps/api && npx jest __test__/training/training.session.guardian.test.ts --no-coverage
```

테스트가 실패하면 `training.service.ts`의 `updateSession`(또는 해당 세션 수정 메서드) 시그니처를 확인하여 mock 조정.

- [ ] **Step 4: training.service.ts에 GUARDIAN 알림 추가**

`training.service.ts`의 세션 수정 메서드(날짜·시간 변경, 취소 처리)에 YOUTH 팀 분기 추가:

```typescript
// 세션 수정 후 (예: updateSession 내):
if (session.team?.type === "YOUTH") {
  const guardianIds = await this.repo.findGuardiansByTeam(session.teamId);
  for (const guardianId of guardianIds) {
    void this.notifRepo
      .createForGuardian(
        guardianId,
        "YOUTH_SESSION_CHANGED",
        `${session.team.name} 훈련 일정 변경`,
        `훈련 일정이 변경됐습니다. 앱에서 확인해주세요.`,
        session.id,
      )
      .catch(console.error);
  }
}
```

취소 처리 메서드에도 동일 패턴 적용 (body만 "훈련이 취소됐습니다"로 변경).

- [ ] **Step 5: 테스트 실행 → 통과 확인**

```bash
cd apps/api && npx jest __test__/training/training.session.guardian.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/training/ apps/api/__test__/training/training.session.guardian.test.ts
git commit -m "feat(youth): YOUTH 세션 변경·취소 시 GUARDIAN 즉시 알림"
```

---

## Task 3: MATCH_DAY_REMINDER + CALLUP_REQUESTED GUARDIAN 확장

**Files:**
- Modify: `apps/api/src/jobs/matchDayNotification.ts`
- Modify: `apps/api/src/player-callup/player-callup.service.ts`

- [ ] **Step 1: matchDayNotification.ts — GUARDIAN 포함**

`matchDayNotification.ts`에서 경기 스쿼드 기반 알림 루프 내, 기존 선수 알림 발송 후 GUARDIAN 알림 추가:

```typescript
// 기존 userId 알림 발송 후
const player = entry.player;
if (player.guardianId) {
  void notifService
    .notifyGuardianMatchDayReminder(player.guardianId, {
      date: matchInfo.date,
      homeTeamName: matchInfo.homeTeamName,
      awayTeamName: matchInfo.awayTeamName,
      venue: matchInfo.venue ?? null,
    })
    .catch(console.error);
}
```

`NotificationService`에 `notifyGuardianMatchDayReminder` 메서드 추가:

```typescript
// notification.service.ts 또는 repo에 추가
async notifyGuardianMatchDayReminder(guardianUserId: number, match: { date: Date; homeTeamName: string; awayTeamName: string; venue: string | null }) {
  const dateStr = new Date(match.date).toLocaleDateString("ko-KR");
  return this.notifRepo.createForGuardian(
    guardianUserId,
    "MATCH_DAY_REMINDER",
    "내일 경기 일정",
    `${dateStr} ${match.homeTeamName} vs ${match.awayTeamName}${match.venue ? ` (${match.venue})` : ""}`,
  );
}
```

단, `player` 데이터에 `guardianId`가 포함되지 않으면 `matchSquad.repo.ts`의 `findUnnotifiedForDate` 쿼리에 `player.guardianId` 추가 필요:

```typescript
// match.squad.repo.ts findUnnotifiedForDate 내 player select에 추가:
player: { select: { userId: true, guardianId: true } }
```

- [ ] **Step 2: player-callup.service.ts — GUARDIAN 알림 추가**

`player-callup.service.ts`의 `create` 메서드 내 기존 GM 알림 발송 후:

```typescript
// 콜업 대상 선수의 guardianId 조회
const player = callup.player as any;
if (player.guardianId) {
  void this.notifRepo
    .createForGuardian(
      player.guardianId,
      "CALLUP_REQUESTED",
      "1군 콜업 요청",
      `${player.playerName} 선수에게 1군 콜업 요청이 들어왔습니다.`,
      callup.id,
    )
    .catch(console.error);
}
```

`player-callup.repo.ts`의 `create` 반환 include에 `player.guardianId` 포함 여부 확인. 없으면 추가:

```typescript
// player-callup.repo.ts create include 내:
player: { select: { id: true, playerName: true, guardianId: true } }
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/jobs/matchDayNotification.ts apps/api/src/player-callup/ apps/api/src/notification/
git commit -m "feat(youth): MATCH_DAY_REMINDER + CALLUP_REQUESTED GUARDIAN 수신자 확장"
```

---

## Task 4: 전체 테스트

- [ ] **Step 1: 전체 테스트 실행**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: 기존 + 신규 전체 PASS

- [ ] **Step 2: TypeScript 최종 확인**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(youth): Plan 4 완료 - GUARDIAN 알림 시스템"
```
