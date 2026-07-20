# 자동 알림 시스템 (등번호 충돌 · 경기 D-1 · 출결 위반) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF 기획안 §5.2·§6·§7.1·§7.2 미구현 항목(등번호 충돌 알림, 경기 D-1 알림, 무단 출결 선수 본인 알림)을 in-app notification으로 구현한다.

**Architecture:** 기존 `NotificationRepository.createForUser()` + `NotificationService` 패턴을 그대로 사용한다. `MatchSquad` 모델을 신설해 스쿼드 확정→D-1 알림 트리거를 만든다. 선수 본인 알림은 해당 선수의 `userId`를 조회해 `createForUser`로 저장한다.

**Tech Stack:** Express + TypeScript, Prisma (db push), Jest (mock 단위 테스트), node-cron

---

## File Map

### BE (apps/api)

| 파일 | 역할 |
|------|------|
| `prisma/schema.prisma` | `MatchSquad` 모델 + `NotificationType` enum 4개 추가 |
| `src/notification/notification.service.ts` | `notifyJerseyConflict`, `notifyAttendanceUnauthorized`, `notifyAttendancePenaltyPlayer`, `notifyMatchDayReminder` 추가 |
| `src/player/jersey.repo.ts` | `findPlayerUserId(playerId)` 추가 |
| `src/player/jersey.service.ts` | `NotificationRepository` 주입, 충돌 시 선수 알림 발송 |
| `src/training/training.service.ts` | `upsertResult` — 선수 본인 알림 추가 |
| `src/match/match.squad.repo.ts` | MatchSquad CRUD |
| `src/match/match.squad.service.ts` | squad add/remove/confirm 로직 |
| `src/match/match.squad.controller.ts` | HTTP 핸들러 |
| `src/match/match.routes.ts` | squad 라우트 추가 |
| `src/jobs/matchDayNotification.ts` | 매일 18:00 D-1 알림 cron |
| `src/server.ts` | cron 등록 |
| `__test__/player/jersey.service.test.ts` | 알림 발송 케이스 추가 |
| `__test__/notification/notification.service.test.ts` | 신규 알림 메서드 단위 테스트 |
| `__test__/match/match.squad.service.test.ts` | 스쿼드 확정 단위 테스트 |

---

## Task 1: 스키마 — MatchSquad 모델 + NotificationType 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: NotificationType enum에 4개 값 추가**

`schema.prisma`의 `enum NotificationType {` 블록(현재 마지막 값 `TACTICAL_ANALYSIS_CONFIRM_REQUESTED`) 뒤에 추가:

```prisma
  JERSEY_NUMBER_CONFLICT
  MATCH_DAY_REMINDER
  ATTENDANCE_UNAUTHORIZED
  ATTENDANCE_PENALTY_PLAYER
```

- [x] **Step 2: MatchSquad 모델 추가**

`schema.prisma` 파일 끝에 추가:

```prisma
model MatchSquad {
  id            Int       @id @default(autoincrement())
  matchId       Int
  playerId      String
  isConfirmed   Boolean   @default(false)
  confirmedAt   DateTime?
  confirmedById Int?
  notifiedAt    DateTime?

  match       Match   @relation(fields: [matchId], references: [id])
  player      Player  @relation(fields: [playerId], references: [id])
  confirmedBy User?   @relation("SquadConfirmations", fields: [confirmedById], references: [id])

  @@unique([matchId, playerId])
  @@index([matchId])
}
```

- [x] **Step 3: Match 모델에 relation 추가**

`model Match { ... }` 블록의 `tacticalAnalyses TacticalAnalysis[]` 뒤에:

```prisma
  squadPlayers     MatchSquad[]
```

- [x] **Step 4: Player 모델에 relation 추가**

`model Player { ... }` 블록의 `marketValueHistory MarketValueHistory[]` 뒤에:

```prisma
  matchSquads      MatchSquad[]
```

- [x] **Step 5: User 모델에 relation 추가**

`schema.prisma`에서 `model User {` 블록을 찾아 relations 섹션 하단에:

```prisma
  squadConfirmations MatchSquad[] @relation("SquadConfirmations")
```

- [x] **Step 6: db push**

```bash
cd /Users/juno/work/football/apps/api
npx prisma db push 2>&1 | tail -5
```

Expected: `Your database is now in sync with your Prisma schema.`

- [x] **Step 7: 클라이언트 재생성 확인**

```bash
npx prisma generate 2>&1 | tail -3
```

- [x] **Step 8: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add MatchSquad model + jersey/match/attendance notification types"
```

---

## Task 2: NotificationService — 신규 알림 메서드 4개

**Files:**
- Modify: `apps/api/src/notification/notification.service.ts`
- Create: `apps/api/__test__/notification/notification.service.test.ts`

- [x] **Step 1: 테스트 파일 작성**

`apps/api/__test__/notification/notification.service.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { NotificationService } from "../../src/notification/notification.service";

const mockRepo = {
  createForUser: jest.fn<() => Promise<any>>().mockResolvedValue({}),
  createForHeadCoach: jest.fn<() => Promise<any>>().mockResolvedValue({}),
} as any;

// Socket.io mock
jest.mock("../../src/lib/io", () => ({
  getIO: () => ({ to: () => ({ emit: jest.fn() }) }),
}));

const service = new NotificationService(mockRepo);

describe("NotificationService - notifyJerseyConflict", () => {
  beforeEach(() => jest.clearAllMocks());

  test("OCCUPIED 사유로 선수에게 알림", async () => {
    await service.notifyJerseyConflict(42, 7, "OCCUPIED");
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      42, "JERSEY_NUMBER_CONFLICT",
      "등번호 7번 선택 불가",
      expect.stringContaining("이미 다른 선수가 사용 중"),
    );
  });

  test("RETIRED 사유로 알림", async () => {
    await service.notifyJerseyConflict(42, 10, "RETIRED");
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      42, "JERSEY_NUMBER_CONFLICT",
      "등번호 10번 선택 불가",
      expect.stringContaining("영구결번"),
    );
  });
});

describe("NotificationService - notifyAttendanceUnauthorized", () => {
  beforeEach(() => jest.clearAllMocks());

  test("무단 지각 알림", async () => {
    await service.notifyAttendanceUnauthorized(10, "LATE", new Date("2026-07-20"), 1, 0);
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      10, "ATTENDANCE_UNAUTHORIZED",
      expect.stringContaining("무단 지각"),
      expect.stringContaining("누적"),
    );
  });

  test("무단 결근 알림", async () => {
    await service.notifyAttendanceUnauthorized(10, "ABSENT", new Date("2026-07-20"), 1, 1);
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      10, "ATTENDANCE_UNAUTHORIZED",
      expect.stringContaining("무단 결근"),
      expect.any(String),
    );
  });
});

describe("NotificationService - notifyAttendancePenaltyPlayer", () => {
  beforeEach(() => jest.clearAllMocks());

  test("페널티 경고 알림", async () => {
    await service.notifyAttendancePenaltyPlayer(10, 3);
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      10, "ATTENDANCE_PENALTY_PLAYER",
      "출결 페널티 경고",
      expect.stringContaining("3회"),
    );
  });
});

describe("NotificationService - notifyMatchDayReminder", () => {
  beforeEach(() => jest.clearAllMocks());

  test("경기 D-1 알림", async () => {
    const match = {
      date: new Date("2026-07-21T10:00:00Z"),
      homeTeamName: "FC Seoul",
      awayTeamName: "Busan IPark",
      venue: "서울월드컵경기장",
    };
    await service.notifyMatchDayReminder(10, match);
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      10, "MATCH_DAY_REMINDER",
      "내일 경기 알림",
      expect.stringContaining("FC Seoul"),
    );
  });
});
```

- [x] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest --testPathPattern="notification.service" --no-coverage 2>&1 | tail -15
```

Expected: FAIL — 메서드 없음

- [x] **Step 3: NotificationService에 메서드 4개 추가**

`apps/api/src/notification/notification.service.ts`에 기존 `getPartnerAlerts()` 아래에 추가:

```typescript
async notifyJerseyConflict(
  playerUserId: number,
  number: number,
  reason: "OCCUPIED" | "RETIRED" | "RESERVED",
) {
  const reasonText: Record<string, string> = {
    OCCUPIED: "이미 다른 선수가 사용 중입니다",
    RETIRED: "구단 영구결번입니다",
    RESERVED: "계약 진행 중인 선수가 선점한 번호입니다",
  };
  const title = `등번호 ${number}번 선택 불가`;
  const body = `요청하신 ${number}번은 ${reasonText[reason]}. 다른 번호를 선택해 주세요.`;
  await this.repo.createForUser(playerUserId, "JERSEY_NUMBER_CONFLICT", title, body);
}

async notifyAttendanceUnauthorized(
  playerUserId: number,
  type: "LATE" | "ABSENT",
  date: Date,
  lateCount: number,
  effectiveAbsences: number,
) {
  const typeText = type === "LATE" ? "무단 지각" : "무단 결근";
  const dateStr = date.toLocaleDateString("ko-KR");
  const title = `${typeText} 기록 안내`;
  const body = `${dateStr} ${typeText}이 기록됐습니다. 현재 누적 무단 결근 환산 ${effectiveAbsences}회 (무단 지각 ${lateCount}회 포함).`;
  await this.repo.createForUser(playerUserId, "ATTENDANCE_UNAUTHORIZED", title, body);
}

async notifyAttendancePenaltyPlayer(playerUserId: number, effectiveAbsences: number) {
  const title = "출결 페널티 경고";
  const body = `무단 결근 누적 환산 ${effectiveAbsences}회로 규정에 따른 페널티(벌금, 출전 정지 등)가 부여될 수 있습니다. 코치진에게 문의하세요.`;
  await this.repo.createForUser(playerUserId, "ATTENDANCE_PENALTY_PLAYER", title, body);
}

async notifyMatchDayReminder(
  playerUserId: number,
  matchInfo: { date: Date; homeTeamName: string; awayTeamName: string; venue?: string | null },
) {
  const dateStr = matchInfo.date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const timeStr = matchInfo.date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const title = "내일 경기 알림";
  const body = `${dateStr} ${timeStr} | ${matchInfo.homeTeamName} vs ${matchInfo.awayTeamName}${matchInfo.venue ? ` @ ${matchInfo.venue}` : ""}. 경기 준비 바랍니다.`;
  await this.repo.createForUser(playerUserId, "MATCH_DAY_REMINDER", title, body);
}
```

- [x] **Step 4: 테스트 실행 — PASS 확인**

```bash
npx jest --testPathPattern="notification.service" --no-coverage 2>&1 | tail -10
```

Expected: 8 tests passed

- [x] **Step 5: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/notification/notification.service.ts apps/api/__test__/notification/notification.service.test.ts
git commit -m "feat(notification): add jersey conflict, attendance, match day reminder notification methods"
```

---

## Task 3: 등번호 충돌 → 선수 본인 자동 알림

**Files:**
- Modify: `apps/api/src/player/jersey.repo.ts`
- Modify: `apps/api/src/player/jersey.service.ts`
- Modify: `apps/api/src/player/jersey.controller.ts`
- Modify: `apps/api/src/player/player.routes.ts`
- Modify: `apps/api/__test__/player/jersey.service.test.ts`

- [x] **Step 1: 테스트에 알림 케이스 추가**

`apps/api/__test__/player/jersey.service.test.ts` 기존 테스트 아래에 추가:

```typescript
const mockNotifRepo = {
  createForUser: jest.fn<() => Promise<any>>().mockResolvedValue({}),
} as any;

describe("JerseyService - assignToPlayer with notification", () => {
  beforeEach(() => jest.clearAllMocks());

  test("OCCUPIED 충돌 시 선수에게 알림 발송", async () => {
    mockRepo.findByNumberAndTeam.mockResolvedValue({
      id: 1, number: 7, status: "OCCUPIED", playerId: "existing",
    });
    mockRepo.findPlayerUserId = jest.fn<() => Promise<any>>().mockResolvedValue({ userId: 99 });

    const serviceWithNotif = new JerseyService(mockRepo, mockNotifRepo);

    await expect(serviceWithNotif.assignToPlayer(1, { number: 7, playerId: "p2" }))
      .rejects.toMatchObject({ code: "JERSEY_NUMBER_OCCUPIED" });

    // 알림이 발송됐는지 확인 (fire-and-forget이므로 짧게 대기)
    await new Promise((r) => setTimeout(r, 10));
    expect(mockNotifRepo.createForUser).toHaveBeenCalledWith(
      99, "JERSEY_NUMBER_CONFLICT",
      "등번호 7번 선택 불가",
      expect.stringContaining("이미 다른 선수"),
    );
  });

  test("userId 없는 선수는 알림 미발송", async () => {
    mockRepo.findByNumberAndTeam.mockResolvedValue({
      id: 1, number: 7, status: "OCCUPIED",
    });
    mockRepo.findPlayerUserId = jest.fn<() => Promise<any>>().mockResolvedValue({ userId: null });

    const serviceWithNotif = new JerseyService(mockRepo, mockNotifRepo);

    await expect(serviceWithNotif.assignToPlayer(1, { number: 7, playerId: "p2" }))
      .rejects.toMatchObject({ code: "JERSEY_NUMBER_OCCUPIED" });

    await new Promise((r) => setTimeout(r, 10));
    expect(mockNotifRepo.createForUser).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest --testPathPattern="jersey.service" --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `findPlayerUserId is not a function` 또는 생성자 인자 불일치

- [x] **Step 3: jersey.repo.ts에 findPlayerUserId 추가**

`apps/api/src/player/jersey.repo.ts`의 기존 메서드들 아래에 추가:

```typescript
findPlayerUserId(playerId: string) {
  return this.prisma.player.findUnique({
    where: { id: playerId },
    select: { userId: true },
  });
}
```

- [x] **Step 4: jersey.service.ts — NotificationRepository 주입 + 충돌 알림**

`apps/api/src/player/jersey.service.ts` 전체를 아래로 교체:

```typescript
import { AppError } from "../lib/appError";
import { JerseyRepository } from "./jersey.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { AssignJerseyDto } from "./dto/jersey.dto";

const CONFLICT_REASON: Record<string, "OCCUPIED" | "RETIRED" | "RESERVED"> = {
  OCCUPIED: "OCCUPIED",
  RETIRED: "RETIRED",
  RESERVED: "RESERVED",
};

export class JerseyService {
  constructor(
    private repo: JerseyRepository,
    private notifRepo?: NotificationRepository,
  ) {}

  listByTeam(teamId: number) {
    return this.repo.findByTeam(teamId);
  }

  listByPlayer(playerId: string) {
    return this.repo.findByPlayer(playerId);
  }

  async assignToPlayer(teamId: number, dto: AssignJerseyDto) {
    const existing = await this.repo.findByNumberAndTeam(dto.number, teamId);

    if (existing && CONFLICT_REASON[existing.status]) {
      // fire-and-forget: 충돌 시 배정 대상 선수에게 알림
      if (this.notifRepo && dto.playerId) {
        void this.repo
          .findPlayerUserId(dto.playerId)
          .then((p) => {
            if (p?.userId) {
              return this.notifRepo!.createForUser(
                p.userId,
                "JERSEY_NUMBER_CONFLICT",
                `등번호 ${dto.number}번 선택 불가`,
                `요청하신 ${dto.number}번은 ${
                  existing.status === "OCCUPIED"
                    ? "이미 다른 선수가 사용 중입니다"
                    : existing.status === "RETIRED"
                    ? "구단 영구결번입니다"
                    : "계약 진행 중인 선수가 선점한 번호입니다"
                }. 다른 번호를 선택해 주세요.`,
              );
            }
          })
          .catch(console.error);
      }
      if (existing.status === "OCCUPIED") throw new AppError(409, "JERSEY_NUMBER_OCCUPIED");
      if (existing.status === "RETIRED") throw new AppError(403, "JERSEY_NUMBER_RETIRED");
      if (existing.status === "RESERVED") throw new AppError(409, "JERSEY_NUMBER_RESERVED");
    }

    if (existing) {
      return this.repo.updateStatus(existing.id, { status: "OCCUPIED", playerId: dto.playerId });
    }
    return this.repo.create(teamId, { ...dto, status: "OCCUPIED" });
  }

  async release(teamId: number, number: number) {
    const jersey = await this.repo.findByNumberAndTeam(number, teamId);
    if (!jersey) throw new AppError(404, "JERSEY_NOT_FOUND");
    if (jersey.status !== "OCCUPIED") throw new AppError(409, "JERSEY_NOT_OCCUPIED");
    return this.repo.updateStatus(jersey.id, { status: "AVAILABLE", playerId: null });
  }

  async retire(teamId: number, number: number) {
    const jersey = await this.repo.findByNumberAndTeam(number, teamId);
    if (!jersey) {
      return this.repo.create(teamId, { number, status: "RETIRED" });
    }
    if (jersey.status !== "AVAILABLE") throw new AppError(409, "JERSEY_MUST_BE_AVAILABLE_TO_RETIRE");
    return this.repo.updateStatus(jersey.id, { status: "RETIRED", playerId: null });
  }

  async reactivate(teamId: number, number: number) {
    const jersey = await this.repo.findByNumberAndTeam(number, teamId);
    if (!jersey || jersey.status !== "RETIRED") throw new AppError(409, "JERSEY_NOT_RETIRED");
    return this.repo.updateStatus(jersey.id, { status: "AVAILABLE" });
  }
}
```

- [x] **Step 5: player.routes.ts — JerseyService에 notifRepo 주입**

`apps/api/src/player/player.routes.ts`에서 import 추가 후 jerseyService 생성 수정:

파일 상단 imports에 추가:
```typescript
import { NotificationRepository } from "../notification/notification.repo";
```

기존 `const jerseyService = new JerseyService(jerseyRepo);` 를:
```typescript
const notifRepo = new NotificationRepository(getPrisma());
const jerseyService = new JerseyService(jerseyRepo, notifRepo);
```

- [x] **Step 6: 테스트 실행 — PASS 확인**

```bash
npx jest --testPathPattern="jersey.service" --no-coverage 2>&1 | tail -10
```

Expected: 7 tests passed (기존 5 + 신규 2)

- [x] **Step 7: TS 컴파일 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [x] **Step 8: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/player/jersey.repo.ts apps/api/src/player/jersey.service.ts apps/api/src/player/player.routes.ts apps/api/__test__/player/jersey.service.test.ts
git commit -m "feat(jersey): send notification to player on jersey number conflict"
```

---

## Task 4: 무단 출결 → 선수 본인 알림

**Files:**
- Modify: `apps/api/src/training/training.service.ts`
- Create: `apps/api/__test__/training/training.attendance.notification.test.ts`

- [x] **Step 1: 테스트 파일 작성**

`apps/api/__test__/training/training.attendance.notification.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TrainingService } from "../../src/training/training.service";

const mockRepo = {
  findById: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1, teamId: 1 }),
  upsertResult: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
  countUnexcusedAttendance: jest.fn<() => Promise<any>>().mockResolvedValue({ absences: 0, lateCount: 0 }),
  findPlayerNameById: jest.fn<() => Promise<any>>().mockResolvedValue({ playerName: "김선수" }),
  findPlayerUserId: jest.fn<() => Promise<any>>().mockResolvedValue({ userId: 55 }),
} as any;

const mockNotifRepo = {
  createForUser: jest.fn<() => Promise<any>>().mockResolvedValue({}),
  createForHeadCoach: jest.fn<() => Promise<any>>().mockResolvedValue({}),
} as any;

jest.mock("../../src/lib/io", () => ({
  getIO: () => ({ to: () => ({ emit: jest.fn() }) }),
}));
jest.mock("../../src/notification/notification.service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    notifyAttendancePenalty: jest.fn().mockResolvedValue(undefined),
    notifyAttendanceUnauthorized: jest.fn().mockResolvedValue(undefined),
    notifyAttendancePenaltyPlayer: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe("TrainingService - upsertResult 출결 알림", () => {
  beforeEach(() => jest.clearAllMocks());

  test("LATE_UNAUTHORIZED 시 선수에게 알림 발송", async () => {
    mockRepo.countUnexcusedAttendance.mockResolvedValue({ absences: 0, lateCount: 1 });

    const service = new TrainingService(mockRepo, mockNotifRepo);
    await service.upsertResult(1, { playerId: "p1", attendance: "LATE_UNAUTHORIZED" } as any);

    expect(mockRepo.findPlayerUserId).toHaveBeenCalledWith("p1");
  });

  test("ABSENT_UNAUTHORIZED 시 선수에게 알림 발송", async () => {
    mockRepo.countUnexcusedAttendance.mockResolvedValue({ absences: 1, lateCount: 0 });

    const service = new TrainingService(mockRepo, mockNotifRepo);
    await service.upsertResult(1, { playerId: "p1", attendance: "ABSENT_UNAUTHORIZED" } as any);

    expect(mockRepo.findPlayerUserId).toHaveBeenCalledWith("p1");
  });

  test("PRESENT는 알림 없음", async () => {
    const service = new TrainingService(mockRepo, mockNotifRepo);
    await service.upsertResult(1, { playerId: "p1", attendance: "PRESENT" } as any);

    expect(mockRepo.findPlayerUserId).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest --testPathPattern="training.attendance.notification" --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `findPlayerUserId is not a function`

- [x] **Step 3: training.repo.ts에 findPlayerUserId 추가**

`apps/api/src/training/training.repo.ts`에서 기존 `findPlayerNameById` 메서드 아래에 추가:

```typescript
findPlayerUserId(playerId: string) {
  return this.prisma.player.findUnique({
    where: { id: playerId },
    select: { userId: true },
  });
}
```

- [x] **Step 4: training.service.ts — upsertResult에 선수 본인 알림 추가**

`apps/api/src/training/training.service.ts`에서 `upsertResult` 메서드를 찾아 아래 내용으로 교체:

```typescript
async upsertResult(sessionId: number, dto: UpsertResultDto) {
  const session = await this.repo.findById(sessionId);
  if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
  const result = await this.repo.upsertResult(sessionId, dto);

  if (dto.attendance === "ABSENT_UNAUTHORIZED" || dto.attendance === "LATE_UNAUTHORIZED") {
    const { absences, lateCount } = await this.repo.countUnexcusedAttendance(dto.playerId);
    const effective = calcEffectiveAbsences(absences, lateCount);
    const type = dto.attendance === "LATE_UNAUTHORIZED" ? "LATE" : "ABSENT";

    // 선수 본인 알림 (userId 보유 선수만)
    void this.repo
      .findPlayerUserId(dto.playerId)
      .then(async (p) => {
        if (!p?.userId) return;
        await notificationService.notifyAttendanceUnauthorized(
          p.userId,
          type,
          new Date(),
          lateCount,
          effective,
        );
        if (shouldTriggerPenalty(effective)) {
          await notificationService.notifyAttendancePenaltyPlayer(p.userId, effective);
        }
      })
      .catch(console.error);

    // 코치진 페널티 알림 (기존 로직)
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

파일 상단의 `notificationService` 인스턴스 선언에 `notifyAttendanceUnauthorized`와 `notifyAttendancePenaltyPlayer`가 포함되어 있는지 확인한다. `NotificationService`는 이미 Task 2에서 해당 메서드를 추가했으므로 바로 사용 가능하다.

- [x] **Step 5: 테스트 실행 — PASS 확인**

```bash
npx jest --testPathPattern="training.attendance.notification" --no-coverage 2>&1 | tail -10
```

Expected: 3 tests passed

- [x] **Step 6: 기존 training 테스트 PASS 유지 확인**

```bash
npx jest --testPathPattern="attendance.penalty" --no-coverage 2>&1 | tail -5
```

Expected: all passed

- [x] **Step 7: TS 컴파일 확인**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [x] **Step 8: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/training/training.service.ts apps/api/src/training/training.repo.ts apps/api/__test__/training/training.attendance.notification.test.ts
git commit -m "feat(training): notify player on unauthorized attendance + penalty"
```

---

## Task 5: MatchSquad API

**Files:**
- Create: `apps/api/src/match/match.squad.repo.ts`
- Create: `apps/api/src/match/match.squad.service.ts`
- Create: `apps/api/src/match/match.squad.controller.ts`
- Modify: `apps/api/src/match/match.routes.ts`
- Create: `apps/api/__test__/match/match.squad.service.test.ts`

- [x] **Step 1: 테스트 파일 작성**

`apps/api/__test__/match/match.squad.service.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { MatchSquadService } from "../../src/match/match.squad.service";
import { AppError } from "../../src/lib/appError";

const mockRepo = {
  findByMatch: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  addPlayer: jest.fn<() => Promise<any>>(),
  removePlayer: jest.fn<() => Promise<any>>(),
  confirmSquad: jest.fn<() => Promise<any>>(),
  findConfirmedWithPlayers: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
} as any;

const service = new MatchSquadService(mockRepo);

describe("MatchSquadService - addPlayer", () => {
  beforeEach(() => jest.clearAllMocks());

  test("선수 추가 성공", async () => {
    mockRepo.addPlayer.mockResolvedValue({ id: 1, matchId: 10, playerId: "p1" });
    const result = await service.addPlayer(10, "p1");
    expect(mockRepo.addPlayer).toHaveBeenCalledWith(10, "p1");
    expect(result.matchId).toBe(10);
  });
});

describe("MatchSquadService - confirmSquad", () => {
  beforeEach(() => jest.clearAllMocks());

  test("스쿼드 확정 호출", async () => {
    mockRepo.confirmSquad.mockResolvedValue({ count: 3 });
    const result = await service.confirmSquad(10, 5);
    expect(mockRepo.confirmSquad).toHaveBeenCalledWith(10, 5);
    expect(result.count).toBe(3);
  });
});
```

- [x] **Step 2: 테스트 실행 — FAIL**

```bash
cd /Users/juno/work/football/apps/api
npx jest --testPathPattern="match.squad.service" --no-coverage 2>&1 | tail -10
```

Expected: FAIL — module not found

- [x] **Step 3: match.squad.repo.ts 작성**

`apps/api/src/match/match.squad.repo.ts`:

```typescript
import { PrismaClient } from "../generated/client";

export class MatchSquadRepository {
  constructor(private prisma: PrismaClient) {}

  findByMatch(matchId: number) {
    return this.prisma.matchSquad.findMany({
      where: { matchId },
      include: {
        player: { select: { id: true, playerName: true, position: true, userId: true } },
      },
      orderBy: { player: { playerName: "asc" } },
    });
  }

  addPlayer(matchId: number, playerId: string) {
    return this.prisma.matchSquad.upsert({
      where: { matchId_playerId: { matchId, playerId } },
      create: { matchId, playerId },
      update: {},
    });
  }

  removePlayer(matchId: number, playerId: string) {
    return this.prisma.matchSquad.delete({
      where: { matchId_playerId: { matchId, playerId } },
    });
  }

  confirmSquad(matchId: number, confirmedById: number) {
    return this.prisma.matchSquad.updateMany({
      where: { matchId },
      data: { isConfirmed: true, confirmedAt: new Date(), confirmedById },
    });
  }

  findConfirmedWithPlayers(matchId: number) {
    return this.prisma.matchSquad.findMany({
      where: { matchId, isConfirmed: true },
      include: {
        player: {
          select: { id: true, playerName: true, userId: true },
        },
        match: {
          select: { id: true, date: true, homeTeamName: true, awayTeamName: true, venue: true },
        },
      },
    });
  }

  findUnnotifiedForDate(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return this.prisma.matchSquad.findMany({
      where: {
        isConfirmed: true,
        notifiedAt: null,
        match: { date: { gte: start, lte: end } },
      },
      include: {
        player: { select: { id: true, playerName: true, userId: true } },
        match: {
          select: { id: true, date: true, homeTeamName: true, awayTeamName: true, venue: true },
        },
      },
    });
  }

  markNotified(matchId: number) {
    return this.prisma.matchSquad.updateMany({
      where: { matchId, notifiedAt: null },
      data: { notifiedAt: new Date() },
    });
  }
}
```

- [x] **Step 4: match.squad.service.ts 작성**

`apps/api/src/match/match.squad.service.ts`:

```typescript
import { MatchSquadRepository } from "./match.squad.repo";

export class MatchSquadService {
  constructor(private repo: MatchSquadRepository) {}

  getSquad(matchId: number) {
    return this.repo.findByMatch(matchId);
  }

  addPlayer(matchId: number, playerId: string) {
    return this.repo.addPlayer(matchId, playerId);
  }

  removePlayer(matchId: number, playerId: string) {
    return this.repo.removePlayer(matchId, playerId);
  }

  confirmSquad(matchId: number, confirmedById: number) {
    return this.repo.confirmSquad(matchId, confirmedById);
  }
}
```

- [x] **Step 5: match.squad.controller.ts 작성**

`apps/api/src/match/match.squad.controller.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { MatchSquadService } from "./match.squad.service";

const CONFIRM_ROLES = ["ADMIN", "COACHING_STAFF"] as const;
const MANAGE_ROLES = ["ADMIN", "COACHING_STAFF", "FRONT_OFFICE"] as const;

export class MatchSquadController {
  constructor(private service: MatchSquadService) {}

  getSquad = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = Number(req.params["id"]);
      const squad = await this.service.getSquad(matchId);
      res.json(squad);
    } catch (err) { next(err); }
  };

  addPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!MANAGE_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const matchId = Number(req.params["id"]);
      const { playerId } = req.body as { playerId: string };
      if (!playerId) throw new AppError(400, "PLAYER_ID_REQUIRED");
      const entry = await this.service.addPlayer(matchId, playerId);
      res.status(201).json(entry);
    } catch (err) { next(err); }
  };

  removePlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!MANAGE_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const matchId = Number(req.params["id"]);
      const { playerId } = req.body as { playerId: string };
      if (!playerId) throw new AppError(400, "PLAYER_ID_REQUIRED");
      await this.service.removePlayer(matchId, playerId);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  confirmSquad = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!CONFIRM_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const matchId = Number(req.params["id"]);
      const result = await this.service.confirmSquad(matchId, req.user!.id);
      res.json({ confirmed: result.count });
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 6: match.routes.ts에 squad 라우트 추가**

`apps/api/src/match/match.routes.ts`에 기존 import 아래에 추가:

```typescript
import { MatchSquadRepository } from "./match.squad.repo";
import { MatchSquadService } from "./match.squad.service";
import { MatchSquadController } from "./match.squad.controller";
```

기존 `export default router;` 위에 추가:

```typescript
const squadRepo = new MatchSquadRepository(getPrisma());
const squadService = new MatchSquadService(squadRepo);
const squadController = new MatchSquadController(squadService);

// 스쿼드 조회
router.get("/:id/squad", auth, squadController.getSquad);
// 스쿼드 선수 추가 (ADMIN, COACHING_STAFF, FRONT_OFFICE)
router.post("/:id/squad", auth, squadController.addPlayer);
// 스쿼드 선수 제거
router.delete("/:id/squad", auth, squadController.removePlayer);
// 스쿼드 확정 (ADMIN, COACHING_STAFF)
router.post("/:id/squad/confirm", auth, squadController.confirmSquad);
```

- [x] **Step 7: 테스트 실행 — PASS**

```bash
npx jest --testPathPattern="match.squad.service" --no-coverage 2>&1 | tail -10
```

Expected: 2 tests passed

- [x] **Step 8: TS 컴파일 확인**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [x] **Step 9: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/match/match.squad.repo.ts apps/api/src/match/match.squad.service.ts apps/api/src/match/match.squad.controller.ts apps/api/src/match/match.routes.ts apps/api/__test__/match/match.squad.service.test.ts
git commit -m "feat(match): MatchSquad API — add/remove/confirm squad with routes"
```

---

## Task 6: 경기 D-1 알림 Cron

**Files:**
- Create: `apps/api/src/jobs/matchDayNotification.ts`
- Modify: `apps/api/src/server.ts`

- [x] **Step 1: matchDayNotification.ts 작성**

`apps/api/src/jobs/matchDayNotification.ts`:

```typescript
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { MatchSquadRepository } from "../match/match.squad.repo";
import { NotificationService } from "../notification/notification.service";
import { NotificationRepository } from "../notification/notification.repo";

export function startMatchDayNotificationJob() {
  // 매일 18:00 실행
  cron.schedule("0 18 * * *", async () => {
    const prisma = getPrisma();
    const squadRepo = new MatchSquadRepository(prisma);
    const notifService = new NotificationService(new NotificationRepository(prisma));

    // 내일 날짜 범위
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const entries = await squadRepo.findUnnotifiedForDate(tomorrow);
    if (entries.length === 0) return;

    // matchId별로 그룹핑해서 알림 발송
    const matchGroups = new Map<number, typeof entries>();
    for (const entry of entries) {
      const list = matchGroups.get(entry.matchId) ?? [];
      list.push(entry);
      matchGroups.set(entry.matchId, list);
    }

    for (const [matchId, squadEntries] of matchGroups) {
      const matchInfo = squadEntries[0]!.match;
      for (const entry of squadEntries) {
        const userId = entry.player.userId;
        if (!userId) continue;
        void notifService
          .notifyMatchDayReminder(userId, {
            date: matchInfo.date,
            homeTeamName: matchInfo.homeTeamName,
            awayTeamName: matchInfo.awayTeamName,
            venue: matchInfo.venue ?? null,
          })
          .catch(console.error);
      }
      // 발송 완료 후 notifiedAt 마킹
      void squadRepo.markNotified(matchId).catch(console.error);
    }
  });
}
```

- [x] **Step 2: server.ts에 cron 등록**

`apps/api/src/server.ts`에서 기존 cron import 섹션에 추가:

```typescript
import { startMatchDayNotificationJob } from "./jobs/matchDayNotification";
```

기존 cron 시작 코드 아래에:

```typescript
startMatchDayNotificationJob();
```

- [x] **Step 3: TS 컴파일 확인**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [x] **Step 4: 전체 테스트 확인**

```bash
npx jest --no-coverage 2>&1 | grep "Test Suites:\|Tests:"
```

Expected: 신규 실패 없음 (기존 10 failed 유지, 새 테스트는 모두 pass)

- [x] **Step 5: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/jobs/matchDayNotification.ts apps/api/src/server.ts
git commit -m "feat(jobs): match day D-1 notification cron at 18:00"
```

---

## 스펙 커버리지 체크

| 스펙 섹션 | 담당 Task |
|-----------|-----------|
| §5.2 자동 알림 발송 (번호 충돌 시 선수 알림) | Task 3 |
| §5.2 관리자 RBAC 백오피스 (기존 retire/reactivate) | 기구현 |
| §6 경기 D-1 알림 (스쿼드 확정 + 18시 cron) | Task 5, 6 |
| §7.1 무단 출결 즉시 알림 (선수 본인) | Task 4 |
| §7.1 3:1 법칙 누적 전환 알림 | Task 4 (기존 calcEffectiveAbsences 재활용) |
| §7.1 페널티 알림 (선수 본인) | Task 4 |
| §7.2 알림 포함 정보 (근태구분·누적·페널티) | Task 2, 4 |
| 알림 채널 (카카오톡·왓츠앱) | in-app DB 저장으로 구현, 채널 어댑터는 후속 태스크로 분리 |
