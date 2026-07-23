# External Report 제출 추적 & 알림 자동화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 외부 의무보고서(ExternalReport)에 dueDate 자동 계산, 제출 완료 기록(submittedAt/submittedNote), MEDICAL_DIRECTOR 알림, 마감 임박/초과 cron 알림을 추가한다.

**Architecture:** 스키마에 `submittedAt`/`submittedNote` 필드를 추가하고, 보고서 생성 시 대상 기관별 고정 기준으로 dueDate를 자동 계산한다. 상태 변경은 `PATCH /:injuryId/external-reports/:reportId/status` 엔드포인트로 처리하고, `node-cron`이 매일 자정에 마감 2일 전/초과 알림을 MEDICAL_DIRECTOR에게 발송한다.

**Tech Stack:** Express + Prisma 7 + PostgreSQL + node-cron / React + TypeScript + shadcn/ui

---

## 파일 구조

| 파일 | 변경 |
|------|------|
| `apps/api/prisma/schema.prisma` | ExternalReport에 `submittedAt`, `submittedNote` 추가 |
| `apps/api/prisma/migrations/.../migration.sql` | 신규 마이그레이션 (수동 적용) |
| `apps/api/src/injury/injury.repo.ts` | `createExternalReports` 시그니처 변경, `findExternalReportById`, `updateExternalReportStatus` 추가 |
| `apps/api/src/injury/injury.service.ts` | `DUE_DAYS` 상수, notifRepo 주입, `updateExternalReportStatus` 추가 |
| `apps/api/src/injury/injury.routes.ts` | notifRepo 와이어링, PATCH 라우트 추가 |
| `apps/api/src/injury/injury.controller.ts` | `updateExternalReportStatus` 추가 |
| `apps/api/src/jobs/externalReportReminder.ts` | **신규** — node-cron 마감 알림 job |
| `apps/api/src/server.ts` | cron job 등록 |
| `apps/api/__test__/injury/injury.assessment.test.ts` | 상태 변경 + dueDate 테스트 추가 |
| `football/src/types/injury.ts` | `ExternalReport`에 `submittedAt`, `submittedNote` 추가 |
| `football/src/services/injury.service.ts` | `updateExternalReportStatus` 추가 |
| `football/src/pages/injuries/InjuryDetailPage.tsx` | 상태 변경 UI (MEDICAL 전용 인라인 폼) |

---

### Task 1: 스키마 — submittedAt, submittedNote 추가 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_external_report_submission_fields/migration.sql`

- [x] **Step 1: schema.prisma 수정**

`ExternalReport` 모델의 `dueDate` 아래에 두 필드를 추가한다.

```prisma
model ExternalReport {
  id            Int                  @id @default(autoincrement())
  injuryId      Int
  target        ExternalReportTarget
  status        ExternalReportStatus @default(PENDING_SUBMISSION)
  reportData    Json
  dueDate       DateTime?
  submittedAt   DateTime?
  submittedNote String?
  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt

  injury Injury @relation(fields: [injuryId], references: [id], onDelete: Cascade)

  @@unique([injuryId, target])
}
```

- [x] **Step 2: 마이그레이션 파일 생성 (shadow DB 우회)**

```bash
cd apps/api
npx prisma migrate dev --name external_report_submission_fields --create-only
```

`prisma/migrations/<timestamp>_external_report_submission_fields/migration.sql` 파일이 생성된다.

생성된 파일을 열어 내용을 아래로 교체한다 (Prisma가 생성한 SQL이 이미 맞으면 그대로 둠):

```sql
ALTER TABLE "ExternalReport" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "ExternalReport" ADD COLUMN "submittedNote" TEXT;
```

- [x] **Step 3: 마이그레이션 수동 적용**

```bash
psql $DATABASE_URL -f prisma/migrations/<timestamp>_external_report_submission_fields/migration.sql
npx prisma migrate resolve --applied <timestamp>_external_report_submission_fields
```

- [x] **Step 4: Prisma 클라이언트 재생성**

```bash
npx prisma generate
```

- [x] **Step 5: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(injury): add submittedAt, submittedNote to ExternalReport schema"
```

---

### Task 2: BE — dueDate 자동 계산 + 생성 즉시 MEDICAL_DIRECTOR 알림

**Files:**
- Modify: `apps/api/src/injury/injury.repo.ts`
- Modify: `apps/api/src/injury/injury.service.ts`
- Modify: `apps/api/src/injury/injury.routes.ts`
- Test: `apps/api/__test__/injury/injury.assessment.test.ts`

- [x] **Step 1: 실패 테스트 작성**

`apps/api/__test__/injury/injury.assessment.test.ts` 파일 하단에 추가한다.
기존 파일은 controller 유닛 테스트(mock service)이므로 같은 패턴을 따른다:

```typescript
describe("InjuryController - updateExternalReportStatus (미구현 상태에서 실패 확인용)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("컨트롤러에 updateExternalReportStatus가 없으면 undefined", () => {
    // @ts-expect-error — 아직 메서드가 없으므로 타입 오류 발생이 정상
    expect(controller.updateExternalReportStatus).toBeUndefined();
  });
})
```

- [x] **Step 2: 테스트 실행 — FAIL 확인**

```bash
npx jest __test__/injury/injury.assessment.test.ts --no-coverage
```

Expected: FAIL (dueDate가 null)

- [x] **Step 3: `injury.repo.ts` — createExternalReports 시그니처 변경**

`createExternalReports` 메서드를 아래로 교체한다:

```typescript
async createExternalReports(
  injuryId: number,
  targets: { target: ExternalReportTarget; dueDate: Date }[],
  reportData: object
) {
  await this.prisma.externalReport.createMany({
    data: targets.map(({ target, dueDate }) => ({ injuryId, target, reportData, dueDate })),
    skipDuplicates: true,
  });
}
```

- [x] **Step 4: `injury.service.ts` — DUE_DAYS 상수 + notifRepo 주입 + processAssessment 수정**

파일 상단 import에 `NotificationRepository`와 `ExternalReportStatus`를 추가한다:

```typescript
import { NotificationRepository } from "../notification/notification.repo";
import { ExternalReportTarget, ExternalReportStatus } from "../generated/enums";
```

파일 상단(imports 아래, class 밖)에 상수를 추가한다:

```typescript
const DUE_DAYS: Record<ExternalReportTarget, number> = {
  EDUCATION_OFFICE: 3,
  SCHOOL_SAFETY: 3,
  INSURANCE: 5,
  LEAGUE: 7,
  FEDERATION: 7,
};
```

클래스 생성자를 변경한다:

```typescript
export class InjuryService {
  constructor(
    private repo: InjuryRepository,
    private notifRepo: NotificationRepository,
  ) {}
```

`processAssessment` 안의 `createExternalReports` 호출부와 그 아래를 교체한다. 기존 코드:

```typescript
await this.repo.createExternalReports(injuryId, targets, reportData);
```

교체 후:

```typescript
const now = new Date();
const targetsWithDue = targets.map((target) => {
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + DUE_DAYS[target]);
  return { target, dueDate };
});
await this.repo.createExternalReports(injuryId, targetsWithDue, reportData);

try {
  await this.notifRepo.createForMedicalDirector(
    "EXTERNAL_REPORT_CREATED",
    "외부 의무보고서 생성됨",
    `부상 #${injuryId}에 대해 외부 의무보고서 ${targets.length}건이 생성됐습니다. 제출 기한을 확인하세요.`,
  );
} catch {
  // 알림 실패는 치명적이지 않음
}
```

- [x] **Step 5: `injury.routes.ts` — notifRepo 와이어링**

```typescript
import { Router } from "express";
import passport from "passport";
import { InjuryController } from "./injury.controller";
import { InjuryService } from "./injury.service";
import { InjuryRepository } from "./injury.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new InjuryRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const service = new InjuryService(repo, notifRepo);
const controller = new InjuryController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/stats", auth, controller.getStats);
router.get("/player/:playerId", auth, controller.getByPlayer);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id/status", auth, controller.updateStatus);
router.get("/:id/report", auth, controller.getReport);
router.put("/:id/report", auth, controller.saveReport);
router.post("/:id/report/sign", auth, controller.signReport);
router.delete("/:id/report/sign", auth, controller.unsignReport);

// Assessment
router.get("/:id/assessment", auth, controller.getAssessment);
router.put("/:id/assessment", auth, controller.processAssessment);

// External Reports
router.get("/:id/external-reports", auth, controller.getExternalReports);
router.patch("/:id/external-reports/:reportId/status", auth, controller.updateExternalReportStatus);

export default router;
```

- [x] **Step 6: 테스트 실행 — PASS 확인**

```bash
npx jest __test__/injury/injury.assessment.test.ts --no-coverage
```

Expected: PASS (dueDate가 올바르게 설정됨)

- [x] **Step 7: 커밋**

```bash
git add apps/api/src/injury/ apps/api/__test__/injury/injury.assessment.test.ts
git commit -m "feat(injury): auto-calculate dueDate on ExternalReport creation, notify MEDICAL_DIRECTOR"
```

---

### Task 3: BE — 상태 변경 엔드포인트 (TDD)

**Files:**
- Modify: `apps/api/src/injury/injury.repo.ts`
- Modify: `apps/api/src/injury/injury.service.ts`
- Modify: `apps/api/src/injury/injury.controller.ts`
- Test: `apps/api/__test__/injury/injury.assessment.test.ts`

- [x] **Step 1: 실패 테스트 작성**

`apps/api/__test__/injury/injury.assessment.test.ts`의 기존 `mockService` 객체에 `updateExternalReportStatus`를 추가하고, 새 describe 블록을 파일 하단에 추가한다.

먼저 파일 상단의 `mockService` 정의에 메서드를 추가한다:

```typescript
const mockService = {
  // ...기존 메서드들...
  getExternalReports: jest.fn(),
  updateExternalReportStatus: jest.fn(),  // ← 추가
} as any;
```

파일 하단에 describe 블록 추가:

```typescript
describe("InjuryController - updateExternalReportStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  test("MEDICAL → service 호출 후 200", async () => {
    const mockReport = { id: 7, status: "SUBMITTED", submittedNote: "이메일 발송 완료", submittedAt: new Date().toISOString() };
    mockService.updateExternalReportStatus.mockResolvedValue(mockReport);

    const req = mockReq({ params: { id: "1", reportId: "7" }, body: { status: "SUBMITTED", note: "이메일 발송 완료" } });
    const res = mockRes();
    await controller.updateExternalReportStatus(req, res, mockNext);

    expect(mockService.updateExternalReportStatus).toHaveBeenCalledWith(7, "SUBMITTED", "이메일 발송 완료");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockReport);
  });

  test("FRONT_OFFICE → 403, service 미호출", async () => {
    const req = mockReq({
      user: { id: 3, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "GM" },
      params: { id: "1", reportId: "7" },
      body: { status: "SUBMITTED" },
    });
    const res = mockRes();
    await controller.updateExternalReportStatus(req, res, mockNext);

    expect(mockService.updateExternalReportStatus).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("service가 AppError 404 던지면 next로 전달", async () => {
    const { AppError } = await import("../../src/lib/appError");
    mockService.updateExternalReportStatus.mockRejectedValue(new AppError(404, "EXTERNAL_REPORT_NOT_FOUND"));

    const req = mockReq({ params: { id: "1", reportId: "999" }, body: { status: "SUBMITTED" } });
    const res = mockRes();
    await controller.updateExternalReportStatus(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });
});
```

- [x] **Step 2: 테스트 실행 — FAIL 확인**

```bash
npx jest __test__/injury/injury.assessment.test.ts --no-coverage
```

Expected: FAIL (route not found)

- [x] **Step 3: `injury.repo.ts` — findExternalReportById, updateExternalReportStatus 추가**

`getExternalReports` 아래에 두 메서드를 추가한다:

```typescript
findExternalReportById(id: number) {
  return this.prisma.externalReport.findUnique({ where: { id } });
}

updateExternalReportStatus(
  reportId: number,
  status: ExternalReportStatus,
  note?: string
) {
  const data: {
    status: ExternalReportStatus;
    submittedAt?: Date;
    submittedNote?: string;
  } = { status };

  if (status === "SUBMITTED") {
    data.submittedAt = new Date();
  }
  if (note !== undefined) {
    data.submittedNote = note;
  }

  return this.prisma.externalReport.update({
    where: { id: reportId },
    data,
  });
}
```

import에 `ExternalReportStatus` 추가:

```typescript
import { ExternalReportTarget, ExternalReportStatus } from "../generated/enums";
```

- [x] **Step 4: `injury.service.ts` — updateExternalReportStatus 추가**

`getExternalReports` 아래에 추가:

```typescript
async updateExternalReportStatus(
  reportId: number,
  status: ExternalReportStatus,
  note?: string
) {
  const report = await this.repo.findExternalReportById(reportId);
  if (!report) throw new AppError(404, "EXTERNAL_REPORT_NOT_FOUND");
  return this.repo.updateExternalReportStatus(reportId, status, note);
}
```

- [x] **Step 5: `injury.controller.ts` — updateExternalReportStatus 추가**

`getExternalReports` 아래에 추가:

```typescript
updateExternalReportStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!MEDICAL_ROLES.includes(req.user!.role as MedicalRole)) throw new AppError(403, "FORBIDDEN");
    const { status, note } = req.body;
    const result = await this.service.updateExternalReportStatus(
      Number(req.params["reportId"]),
      status,
      note,
    );
    res.status(200).json(result);
  } catch (err) { next(err); }
};
```

- [x] **Step 6: 테스트 실행 — PASS 확인**

```bash
npx jest __test__/injury/injury.assessment.test.ts --no-coverage
```

Expected: PASS (전체 injury 테스트 통과)

- [x] **Step 7: 커밋**

```bash
git add apps/api/src/injury/ apps/api/__test__/injury/injury.assessment.test.ts
git commit -m "feat(injury): add PATCH external-report status endpoint with MEDICAL guard (TDD)"
```

---

### Task 4: BE — node-cron 마감 알림 job

**Files:**
- Create: `apps/api/src/jobs/externalReportReminder.ts`
- Modify: `apps/api/src/server.ts`

- [x] **Step 1: node-cron 설치**

```bash
cd apps/api
npm install node-cron
npm install -D @types/node-cron
```

- [x] **Step 2: cron job 파일 생성**

`apps/api/src/jobs/externalReportReminder.ts`를 생성한다:

```typescript
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";

export function startExternalReportReminderJob() {
  cron.schedule("0 0 * * *", async () => {
    const prisma = getPrisma();
    const notifRepo = new NotificationRepository(prisma);
    const now = new Date();

    const twoDaysFromNow = new Date(now);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const upcoming = await prisma.externalReport.findMany({
      where: {
        status: { in: ["PENDING_SUBMISSION", "SUPPLEMENT_REQUESTED"] },
        dueDate: { gte: now, lte: twoDaysFromNow },
      },
    });

    if (upcoming.length > 0) {
      try {
        await notifRepo.createForMedicalDirector(
          "EXTERNAL_REPORT_DUE_SOON",
          "외부 의무보고서 마감 임박",
          `마감 2일 이내 미제출 보고서가 ${upcoming.length}건 있습니다.`,
        );
      } catch (err) {
        console.error("[cron] 마감 임박 알림 실패:", err);
      }
    }

    const overdue = await prisma.externalReport.findMany({
      where: {
        status: { in: ["PENDING_SUBMISSION", "SUPPLEMENT_REQUESTED"] },
        dueDate: { lt: now },
      },
    });

    if (overdue.length > 0) {
      try {
        await notifRepo.createForMedicalDirector(
          "EXTERNAL_REPORT_OVERDUE",
          "외부 의무보고서 마감 초과",
          `미제출 보고서 ${overdue.length}건이 마감을 초과했습니다.`,
        );
      } catch (err) {
        console.error("[cron] 마감 초과 알림 실패:", err);
      }
    }
  });
}
```

- [x] **Step 3: `server.ts`에 cron 등록**

`server.ts` 상단에 import 추가:

```typescript
import { startExternalReportReminderJob } from "./jobs/externalReportReminder";
```

`httpServer.listen(...)` 호출 아래에 추가:

```typescript
httpServer.listen(PORT, () => console.log(`API server running on port ${PORT}`));
startExternalReportReminderJob();
```

- [x] **Step 4: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 5: 커밋**

```bash
git add apps/api/src/jobs/ apps/api/src/server.ts apps/api/package.json apps/api/package-lock.json
git commit -m "feat(injury): add node-cron job for external report due-soon and overdue notifications"
```

---

### Task 5: FE — 타입 + 서비스 + 상태 변경 UI

**Files:**
- Modify: `football/src/types/injury.ts`
- Modify: `football/src/services/injury.service.ts`
- Modify: `football/src/pages/injuries/InjuryDetailPage.tsx`

- [x] **Step 1: `types/injury.ts` — ExternalReport 인터페이스 업데이트**

`ExternalReport` 인터페이스를 아래로 교체한다:

```typescript
export interface ExternalReport {
  id: number
  injuryId: number
  target: ExternalReportTarget
  status: ExternalReportStatus
  reportData: Record<string, unknown>
  dueDate: string | null
  submittedAt: string | null
  submittedNote: string | null
  createdAt: string
}
```

- [x] **Step 2: `services/injury.service.ts` — updateExternalReportStatus 추가**

`getExternalReports` 아래에 추가:

```typescript
updateExternalReportStatus: (
  injuryId: number,
  reportId: number,
  status: ExternalReportStatus,
  note?: string
) =>
  api.patch<ExternalReport>(
    `/injuries/${injuryId}/external-reports/${reportId}/status`,
    { status, note }
  ),
```

import에 `ExternalReportStatus` 타입이 포함되어 있는지 확인한다. 없으면 추가:

```typescript
import type { ..., ExternalReportStatus } from '@/types/injury'
```

- [x] **Step 3: `InjuryDetailPage.tsx` — 외부 보고서 섹션에 상태 변경 UI 추가**

파일 상단에서 기존 import를 확인하고, `useState`가 import되어 있는지 확인한다 (이미 있음).

외부 보고서 섹션(`{externalReports.length > 0 && (...)}`  블록)을 아래로 교체한다:

```tsx
{externalReports.length > 0 && (
  <section className="border rounded-lg p-5">
    <h2 className="text-sm font-semibold mb-3">외부 의무보고서</h2>
    <div className="space-y-3">
      {externalReports.map((r) => (
        <ExternalReportRow
          key={r.id}
          report={r}
          injuryId={injury!.id}
          isMedical={isMedical}
          onUpdated={(updated) =>
            setExternalReports((prev) =>
              prev.map((x) => (x.id === updated.id ? updated : x))
            )
          }
        />
      ))}
    </div>
  </section>
)}
```

`StatusTimeline` 컴포넌트 정의 바로 위에 `ExternalReportRow` 컴포넌트를 추가한다:

```tsx
function ExternalReportRow({
  report, injuryId, isMedical, onUpdated,
}: {
  report: ExternalReport
  injuryId: number
  isMedical: boolean
  onUpdated: (updated: ExternalReport) => void
}) {
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<ExternalReportStatus>(report.status)
  const [note, setNote] = useState(report.submittedNote ?? '')
  const [saving, setSaving] = useState(false)

  const NEXT_STATUSES: ExternalReportStatus[] = [
    'PENDING_SUBMISSION', 'SUBMITTED', 'SUPPLEMENT_REQUESTED', 'COMPLETED',
  ]

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await injuryApi.updateExternalReportStatus(
        injuryId, report.id, status, note || undefined
      )
      onUpdated(updated)
      setEditing(false)
      toast.success('상태가 변경됐습니다.')
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-b last:border-0 pb-3 last:pb-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {EXTERNAL_REPORT_TARGET_LABEL[report.target]}
        </span>
        <div className="flex items-center gap-2">
          {report.dueDate && (
            <span className="text-xs text-muted-foreground">
              마감 {new Date(report.dueDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${EXTERNAL_REPORT_STATUS_STYLE[report.status]}`}>
            {EXTERNAL_REPORT_STATUS_LABEL[report.status]}
          </span>
          {isMedical && !editing && (
            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditing(true)}>
              변경
            </Button>
          )}
        </div>
      </div>

      {report.submittedNote && !editing && (
        <p className="text-xs text-muted-foreground mt-1">메모: {report.submittedNote}</p>
      )}

      {editing && (
        <div className="mt-2 space-y-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ExternalReportStatus)}
            className="text-sm border rounded px-2 py-1 w-full"
          >
            {NEXT_STATUSES.map((s) => (
              <option key={s} value={s}>{EXTERNAL_REPORT_STATUS_LABEL[s]}</option>
            ))}
          </select>
          <Input
            placeholder="메모 (선택)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={saving}>
              취소
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [x] **Step 4: TypeScript 빌드 확인**

```bash
cd football && npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 5: 커밋**

```bash
git add football/src/types/injury.ts football/src/services/injury.service.ts football/src/pages/injuries/InjuryDetailPage.tsx
git commit -m "feat(injury): add external report status update UI with inline edit form"
```

---

## 완료 기준

- [x] `npx jest --testPathPattern="injury" --no-coverage` — 전체 PASS
- [x] MEDICAL 사용자가 InjuryDetailPage에서 보고서 상태를 SUBMITTED로 변경하면 `submittedAt`이 기록되고 메모가 저장됨
- [x] 80점 이상 평가 저장 시 ExternalReport의 `dueDate`가 대상 기관별로 자동 계산됨
- [x] MEDICAL_DIRECTOR 계정에 생성 즉시 알림이 도착함
- [x] cron이 자정에 실행되어 마감 2일 전 + 초과 보고서에 대한 알림을 발송함
