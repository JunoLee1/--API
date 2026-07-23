# 미완성 알림·기능 완성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 월간 출석률 80% 미만 알림, WorkPermit 만료 임박 알림(cron), LOAN_IN 임대 종료 시 데이터 export 세 가지 미완성 기능을 완성한다.

**Architecture:** (1) 두 개의 cron job 파일을 추가하고 server.ts에 등록한다. (2) LOAN_IN export는 BE에 `GET /transfers/:id/export` 엔드포인트를 추가하고 FE TransfersPage에서 다운로드 버튼을 노출한다. NotificationType enum에 `WORK_PERMIT_EXPIRY_SOON`을 추가하고 schema를 push한다.

**Tech Stack:** Express + Prisma + TypeScript, node-cron, React + Vite + shadcn/ui

---

## 파일 구조

```
apps/api/prisma/schema.prisma                        ← WORK_PERMIT_EXPIRY_SOON enum 추가
apps/api/src/jobs/monthlyAttendanceCheck.ts          ← 신규 (월간 출석률 cron)
apps/api/src/jobs/workPermitExpiryCheck.ts           ← 신규 (workPermit 만료 cron)
apps/api/src/server.ts                               ← 두 job 등록
apps/api/src/transfer/transfer.repo.ts               ← exportLoanInData() 추가
apps/api/src/transfer/transfer.service.ts            ← exportLoanIn() 추가
apps/api/src/transfer/transfer.controller.ts         ← exportLoanIn 핸들러 추가
apps/api/src/transfer/transfer.routes.ts             ← GET /:id/export 라우트 추가
football/src/pages/transfers/TransfersPage.tsx       ← LOAN_IN export 버튼 추가
```

---

## Group A: 월간 출석률 80% 미만 알림

### Task 1: 월간 출석률 순수 함수 + 단위 테스트

**Files:**
- Create: `apps/api/__test__/training/monthly.attendance.test.ts`
- Create: (함수는 Task 2에서 `monthlyAttendanceCheck.ts`에 정의)

- [x] **Step 1: 순수 함수 테스트 작성**

```typescript
// apps/api/__test__/training/monthly.attendance.test.ts
import { calcMonthlyAttendanceRate } from '../../src/jobs/monthlyAttendanceCheck';

describe('calcMonthlyAttendanceRate', () => {
  it('출석 + 공결 / 전체', () => {
    expect(calcMonthlyAttendanceRate(8, 1, 10)).toBeCloseTo(0.9);
  });

  it('전체 세션 0이면 null 반환', () => {
    expect(calcMonthlyAttendanceRate(0, 0, 0)).toBeNull();
  });

  it('80% 미만 케이스', () => {
    // present=6, authorized=0, total=10 → 60%
    expect(calcMonthlyAttendanceRate(6, 0, 10)).toBeCloseTo(0.6);
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

```bash
cd apps/api && npx jest monthly.attendance --no-coverage 2>&1 | tail -5
```
Expected: `Cannot find module '../../src/jobs/monthlyAttendanceCheck'`

---

### Task 2: monthlyAttendanceCheck.ts 구현

**Files:**
- Create: `apps/api/src/jobs/monthlyAttendanceCheck.ts`

- [x] **Step 1: 파일 작성**

```typescript
// apps/api/src/jobs/monthlyAttendanceCheck.ts
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";

export function calcMonthlyAttendanceRate(
  present: number,
  authorizedAbsences: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return (present + authorizedAbsences) / total;
}

export function startMonthlyAttendanceCheckJob() {
  // 매월 1일 자정 실행 — 전월 출석률 체크
  cron.schedule("0 0 1 * *", async () => {
    const prisma = getPrisma();
    const notifRepo = new NotificationRepository(prisma);

    const now = new Date();
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 전월 세션 목록
    const sessions = await prisma.trainingSession.findMany({
      where: {
        date: { gte: firstOfLastMonth, lt: firstOfThisMonth },
        isApproved: true,
      },
      select: { id: true },
    });

    if (sessions.length === 0) return;
    const sessionIds = sessions.map((s) => s.id);

    // 선수별 출석 집계
    const results = await prisma.trainingResult.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { playerId: true, attendance: true },
    });

    const playerMap = new Map<string, { present: number; authorized: number; total: number }>();
    for (const r of results) {
      if (!playerMap.has(r.playerId)) {
        playerMap.set(r.playerId, { present: 0, authorized: 0, total: 0 });
      }
      const stat = playerMap.get(r.playerId)!;
      stat.total++;
      if (r.attendance === "PRESENT") stat.present++;
      else if (r.attendance === "ABSENT_AUTHORIZED" || r.attendance === "LATE_AUTHORIZED") stat.authorized++;
    }

    const monthLabel = `${firstOfLastMonth.getFullYear()}년 ${firstOfLastMonth.getMonth() + 1}월`;

    for (const [playerId, stat] of playerMap.entries()) {
      const rate = calcMonthlyAttendanceRate(stat.present, stat.authorized, stat.total);
      if (rate === null || rate >= 0.8) continue;

      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: { playerName: true },
      });
      if (!player) continue;

      void notifRepo
        .createForCoachingStaff(
          "TRAINING_ATTENDANCE_WARNING",
          "월간 출석률 80% 미만",
          `${player.playerName} 선수의 ${monthLabel} 출석률이 ${Math.round(rate * 100)}%입니다.`,
          undefined,
        )
        .catch(console.error);
    }
  });
}
```

- [x] **Step 2: 테스트 통과 확인**

```bash
cd apps/api && npx jest monthly.attendance --no-coverage 2>&1 | tail -5
```
Expected: `Tests: 3 passed`

- [x] **Step 3: Commit**

```bash
git add apps/api/src/jobs/monthlyAttendanceCheck.ts apps/api/__test__/training/monthly.attendance.test.ts
git commit -m "feat(attendance): add monthly 80% attendance rate check cron job"
```

---

## Group B: WorkPermit 만료 임박 알림

### Task 3: schema에 WORK_PERMIT_EXPIRY_SOON 추가 + DB push

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: NotificationType enum에 추가**

`schema.prisma`에서 `enum NotificationType {` 블록을 찾아 마지막 항목 다음에 추가:

```prisma
  TRAINING_SESSION_PENDING
  WORK_PERMIT_EXPIRY_SOON   // ← 추가
}
```

- [x] **Step 2: DB push + 클라이언트 재생성**

```bash
cd apps/api && npx prisma db push && npx prisma generate
```
Expected: `Your database is now in sync with your Prisma schema.`

- [x] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add WORK_PERMIT_EXPIRY_SOON NotificationType"
```

---

### Task 4: workPermitExpiryCheck.ts 구현

**Files:**
- Create: `apps/api/src/jobs/workPermitExpiryCheck.ts`

- [x] **Step 1: 파일 작성**

```typescript
// apps/api/src/jobs/workPermitExpiryCheck.ts
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";

export function startWorkPermitExpiryCheckJob() {
  // 매일 자정 실행
  cron.schedule("0 0 * * *", async () => {
    const prisma = getPrisma();
    const notifRepo = new NotificationRepository(prisma);

    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiring = await prisma.player.findMany({
      where: {
        workPermitStatus: "APPROVED",
        workPermitExpiry: { gte: now, lte: thirtyDaysFromNow },
      },
      select: { id: true, playerName: true, workPermitExpiry: true },
    });

    for (const player of expiring) {
      const expiry = player.workPermitExpiry!;
      const daysLeft = Math.ceil(
        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      void notifRepo
        .createForStaff(
          "WORK_PERMIT_EXPIRY_SOON",
          "노동허가 만료 임박",
          `${player.playerName} 선수의 노동허가가 ${daysLeft}일 후(${expiry.toLocaleDateString("ko-KR")}) 만료됩니다.`,
          undefined,
        )
        .catch(console.error);
    }
  });
}
```

> `createForStaff`는 ADMIN + FRONT_OFFICE 전원에게 발송하는 메서드. `NotificationRepository`에 이미 존재.

- [x] **Step 2: Commit**

```bash
git add apps/api/src/jobs/workPermitExpiryCheck.ts
git commit -m "feat(player): add work permit expiry cron alert (30-day warning)"
```

---

### Task 5: server.ts에 두 cron job 등록

**Files:**
- Modify: `apps/api/src/server.ts`

- [x] **Step 1: import 추가 및 등록**

`server.ts` 상단에:

```typescript
import { startExternalReportReminderJob } from "./jobs/externalReportReminder";
import { startMonthlyAttendanceCheckJob } from "./jobs/monthlyAttendanceCheck";
import { startWorkPermitExpiryCheckJob } from "./jobs/workPermitExpiryCheck";
```

파일 맨 하단에 추가:

```typescript
startExternalReportReminderJob();
startMonthlyAttendanceCheckJob();
startWorkPermitExpiryCheckJob();
```

- [x] **Step 2: 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -10
```
Expected: no output (no errors)

- [x] **Step 3: Commit**

```bash
git add apps/api/src/server.ts
git commit -m "feat(jobs): register monthly attendance and work permit expiry cron jobs"
```

---

## Group C: LOAN_IN 임대 종료 시 데이터 export

### Task 6: export repo 메서드 추가

**Files:**
- Modify: `apps/api/src/transfer/transfer.repo.ts`

- [x] **Step 1: exportLoanInData 추가**

`transfer.repo.ts`의 기존 메서드들 다음에 추가:

```typescript
  async exportLoanInData(transferId: number) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
      select: {
        id: true,
        type: true,
        fromClub: true,
        toClub: true,
        startDate: true,
        endDate: true,
        playerId: true,
      },
    });
    if (!transfer || transfer.type !== "LOAN_IN") return null;

    const [player, trainingResults, injuries, matchStats] = await Promise.all([
      this.prisma.player.findUnique({
        where: { id: transfer.playerId },
        select: {
          id: true,
          playerName: true,
          position: true,
          nationality: true,
          dateOfBirth: true,
        },
      }),
      this.prisma.trainingResult.findMany({
        where: { playerId: transfer.playerId },
        select: {
          session: { select: { date: true, sessionType: true } },
          attendance: true,
          performanceScore: true,
          feedback: true,
        },
        orderBy: { session: { date: "asc" } },
      }),
      this.prisma.injury.findMany({
        where: { playerId: transfer.playerId },
        select: {
          bodyPart: true,
          cause: true,
          status: true,
          occurredAt: true,
          expectedReturnDate: true,
          returnedAt: true,
        },
        orderBy: { occurredAt: "asc" },
      }),
      this.prisma.playerMatchStats.findMany({
        where: { playerId: transfer.playerId },
        select: {
          match: { select: { date: true, opponent: true, homeScore: true, awayScore: true } },
          goals: true,
          assists: true,
          minutesPlayed: true,
          yellowCards: true,
          redCards: true,
        },
        orderBy: { match: { date: "asc" } },
      }),
    ]);

    return { transfer, player, trainingResults, injuries, matchStats };
  }
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/transfer/transfer.repo.ts
git commit -m "feat(transfer): add exportLoanInData repo method"
```

---

### Task 7: export service + controller + route 추가

**Files:**
- Modify: `apps/api/src/transfer/transfer.service.ts`
- Modify: `apps/api/src/transfer/transfer.controller.ts`
- Modify: `apps/api/src/transfer/transfer.routes.ts`

- [x] **Step 1: service에 메서드 추가**

`transfer.service.ts`의 마지막 메서드 다음:

```typescript
  async exportLoanIn(transferId: number) {
    const data = await this.repo.exportLoanInData(transferId);
    if (!data) throw new AppError(404, "TRANSFER_NOT_FOUND_OR_NOT_LOAN_IN");
    return data;
  }
```

- [x] **Step 2: controller에 핸들러 추가**

`transfer.controller.ts`의 마지막 핸들러 다음:

```typescript
  exportLoanIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      const isAdmin = role === "ADMIN";
      const isFrontOffice = role === "FRONT_OFFICE" && ["GM", "TD"].includes(frontOfficeRole ?? "");
      if (!isAdmin && !isFrontOffice) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.exportLoanIn(Number(req.params["id"])));
    } catch (err) { next(err); }
  };
```

- [x] **Step 3: route 추가**

`transfer.routes.ts`에서 기존 라우트 다음 (exports 이전):

```typescript
// LOAN_IN 데이터 export (ADMIN, GM, TD)
router.get("/:id/export", auth, controller.exportLoanIn);
```

- [x] **Step 4: 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -10
```
Expected: no output

- [x] **Step 5: Commit**

```bash
git add apps/api/src/transfer/transfer.service.ts apps/api/src/transfer/transfer.controller.ts apps/api/src/transfer/transfer.routes.ts
git commit -m "feat(transfer): add GET /:id/export endpoint for LOAN_IN player data"
```

---

### Task 8: FE — TransfersPage에 export 버튼 추가

**Files:**
- Modify: `football/src/pages/transfers/TransfersPage.tsx`
- Modify: `football/src/services/transfer.service.ts` (또는 생성)

- [x] **Step 1: transfer API 서비스에 export 메서드 추가**

`football/src/services/transfer.service.ts` 파일을 확인하고 `exportLoanIn` 메서드를 추가:

```typescript
exportLoanIn: (id: number) => api.get<unknown>(`/transfers/${id}/export`),
```

없으면 파일 먼저 읽은 후 추가한다.

- [x] **Step 2: TransfersPage에서 LOAN_IN export 버튼 추가**

`TransfersPage.tsx`에서 transfer 목록을 렌더링하는 테이블 행에 LOAN_IN 타입일 때 export 버튼을 추가한다.

먼저 파일을 읽어 정확한 위치를 파악한 후 다음 핸들러와 UI를 추가한다:

```typescript
// 핸들러
const handleExport = async (id: number, playerName: string) => {
  try {
    const data = await transferApi.exportLoanIn(id)
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `loan_in_export_${playerName}_${id}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.error('데이터 내보내기에 실패했습니다.')
  }
}
```

```tsx
// LOAN_IN 행의 액션 컬럼
{transfer.type === 'LOAN_IN' && (canExport) && (
  <Button
    size="sm"
    variant="outline"
    className="h-7 text-xs"
    onClick={(e) => { e.stopPropagation(); handleExport(transfer.id, transfer.player?.playerName ?? '') }}
  >
    데이터 내보내기
  </Button>
)}
```

> `canExport`: `user?.role === 'ADMIN' || ['GM','TD'].includes(user?.frontOfficeRole ?? '')`

- [x] **Step 3: FE 빌드 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -10
```
Expected: no output

- [x] **Step 4: Commit**

```bash
git add football/src/pages/transfers/TransfersPage.tsx football/src/services/transfer.service.ts
git commit -m "feat(transfer): add LOAN_IN data export button for GM/TD/ADMIN"
```

---

## 최종 확인

- [x] `npx jest monthly.attendance --no-coverage` — 3 passed
- [x] `cd apps/api && npx tsc --noEmit` — no errors
- [x] `cd football && npx tsc --noEmit` — no errors
- [x] LOAN_IN 이적 상세에서 "데이터 내보내기" 버튼 클릭 → JSON 다운로드 확인
