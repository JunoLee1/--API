# 유소년 모듈 Plan 3: 사고 보고서 (IncidentReport + ExternalReport 수정)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유소년 전용 사고 보고서(IncidentReport) 엔티티를 구현하고, 학부모 알림 발송 및 공기관 외부 보고서 연계까지 완성한다. ExternalReport의 injuryId를 optional로 전환해 IncidentReport에서도 생성 가능하게 한다.

**Architecture:** `IncidentReport` 독립 엔티티 (DRAFT→SUBMITTED→SIGNED). SUBMITTED 시 GUARDIAN에게 인앱 알림. SIGNED(양 서명 완료) 시 기존 `ExternalReport` 레코드 생성. ExternalReport.injuryId optional 전환 + incidentReportId 추가. DB CHECK 제약: injuryId OR incidentReportId 중 하나 필수.

**Tech Stack:** Prisma migration, Express BE, React FE

**의존성:** Plan 1 완료 필요 (GUARDIAN 역할, createForGuardian 메서드)

---

## 파일 맵

### BE — 신규
- `apps/api/src/incident-report/dto/incident-report.dto.ts`
- `apps/api/src/incident-report/incident-report.repo.ts`
- `apps/api/src/incident-report/incident-report.service.ts`
- `apps/api/src/incident-report/incident-report.controller.ts`
- `apps/api/src/incident-report/incident-report.routes.ts`
- `apps/api/__test__/incident-report/incident-report.service.test.ts`

### BE — 수정
- `apps/api/prisma/schema.prisma` — IncidentReport 모델, ExternalReport 스키마 변경
- `apps/api/src/apiRouter.ts` — incident-report 라우트 등록

### FE — 신규
- `football/src/types/incident-report.ts`
- `football/src/services/incidentReport.service.ts`
- `football/src/pages/youth/IncidentReportPage.tsx`
- `football/src/pages/youth/IncidentReportFormDialog.tsx`

### FE — 수정
- `football/src/App.tsx` — `/incident-reports` 라우트 추가

---

## Task 1: Schema 마이그레이션 — IncidentReport + ExternalReport 수정

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: IncidentReportType enum 추가**

schema.prisma에 추가:

```prisma
enum IncidentReportStatus {
  DRAFT
  SUBMITTED
  SIGNED
}

enum IncidentType {
  MATCH
  TRAINING
}
```

- [ ] **Step 2: IncidentReport 모델 추가**

YouthRegistration 모델 아래에 추가:

```prisma
model IncidentReport {
  id                 Int                  @id @default(autoincrement())
  playerId           String
  teamId             Int
  type               IncidentType
  matchId            Int?
  sessionId          Int?
  description        String               @db.Text
  reportedById       Int
  supervisorSigned   Boolean              @default(false)
  medicalSigned      Boolean              @default(false)
  injuryId           Int?
  status             IncidentReportStatus @default(DRAFT)
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt

  player       Player           @relation(fields: [playerId], references: [id])
  team         Team             @relation(fields: [teamId], references: [id])
  match        Match?           @relation(fields: [matchId], references: [id])
  session      TrainingSession? @relation(fields: [sessionId], references: [id])
  reportedBy   User             @relation("IncidentReporter", fields: [reportedById], references: [id])
  injury       Injury?          @relation(fields: [injuryId], references: [id])
  externalReports ExternalReport[]
}
```

- [ ] **Step 3: ExternalReport 수정 — injuryId optional + incidentReportId 추가**

`model ExternalReport` 내:
```prisma
// 기존: injuryId Int
// 변경: injuryId Int?
injuryId           Int?
incidentReportId   Int?
```

relations 블록도 수정:
```prisma
// 기존: injury Injury @relation(...)
// 변경:
injury          Injury?          @relation(fields: [injuryId], references: [id], onDelete: Cascade)
incidentReport  IncidentReport?  @relation(fields: [incidentReportId], references: [id], onDelete: Cascade)
```

`@@unique([injuryId, target])` 제약 삭제 후 아래로 교체:
```prisma
@@unique([injuryId, target])
@@unique([incidentReportId, target])
```

- [ ] **Step 4: 역관계 추가**

Player 모델에:
```prisma
incidentReports    IncidentReport[]
```

Team 모델에:
```prisma
incidentReports    IncidentReport[]
```

Match 모델에:
```prisma
incidentReports    IncidentReport[]
```

TrainingSession 모델에:
```prisma
incidentReports    IncidentReport[]
```

User 모델에:
```prisma
reportedIncidents  IncidentReport[]  @relation("IncidentReporter")
```

Injury 모델에:
```prisma
incidentReports    IncidentReport[]
externalReports    ExternalReport[]  // 이미 있는지 확인 후 없으면 추가
```

- [ ] **Step 5: 마이그레이션 실행**

```bash
cd apps/api
npx prisma migrate dev --name add-incident-report-external-report-update
```

Expected: 마이그레이션 성공. `injuryId nullable` 경고가 뜰 수 있으나 정상.

- [ ] **Step 6: Prisma generate**

```bash
npx prisma generate
```

- [ ] **Step 7: 기존 ExternalReport 쿼리 TypeScript 확인**

```bash
npx tsc --noEmit 2>&1 | grep -i "externalReport\|injuryId" | head -10
```

`injuryId`가 optional이 됐으므로 기존 injury.service.ts의 `injuryId` 사용 부분에서 타입 에러가 나면 `injuryId: injuryId` 형태로 명시적 전달하도록 수정.

- [ ] **Step 8: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(youth): IncidentReport 모델 + ExternalReport injuryId optional"
```

---

## Task 2: IncidentReport DTO + Repository

**Files:**
- Create: `apps/api/src/incident-report/dto/incident-report.dto.ts`
- Create: `apps/api/src/incident-report/incident-report.repo.ts`

- [ ] **Step 1: DTO 작성**

`apps/api/src/incident-report/dto/incident-report.dto.ts`:

```typescript
import { z } from "zod";

export const CreateIncidentReportSchema = z.object({
  playerId: z.string(),
  teamId: z.number().int(),
  type: z.enum(["MATCH", "TRAINING"]),
  matchId: z.number().int().optional(),
  sessionId: z.number().int().optional(),
  description: z.string().min(10),
});

export const SignIncidentReportSchema = z.object({
  role: z.enum(["SUPERVISOR", "MEDICAL"]),
});

export const LinkInjurySchema = z.object({
  injuryId: z.number().int(),
});

export const IncidentReportListQuerySchema = z.object({
  teamId: z.coerce.number().int().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "SIGNED"]).optional(),
  playerId: z.string().optional(),
});

export type CreateIncidentReportDto = z.infer<typeof CreateIncidentReportSchema>;
export type SignIncidentReportDto = z.infer<typeof SignIncidentReportSchema>;
export type IncidentReportListQuery = z.infer<typeof IncidentReportListQuerySchema>;
```

- [ ] **Step 2: Repository 작성**

`apps/api/src/incident-report/incident-report.repo.ts`:

```typescript
import type { PrismaClient } from "../generated/client";
import type { CreateIncidentReportDto, IncidentReportListQuery } from "./dto/incident-report.dto";
import type { ExternalReportTarget } from "../generated/enums";

const INCLUDE = {
  player: { select: { id: true, playerName: true, guardianId: true } },
  team: { select: { id: true, name: true } },
  reportedBy: { select: { id: true, username: true } },
  injury: { select: { id: true, bodyPart: true } },
};

export class IncidentReportRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: IncidentReportListQuery) {
    return this.prisma.incidentReport.findMany({
      where: {
        ...(query.teamId && { teamId: query.teamId }),
        ...(query.status && { status: query.status }),
        ...(query.playerId && { playerId: query.playerId }),
      },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.incidentReport.findUnique({ where: { id }, include: INCLUDE });
  }

  create(data: CreateIncidentReportDto & { reportedById: number }) {
    return this.prisma.incidentReport.create({
      data: { ...data, status: "DRAFT" },
      include: INCLUDE,
    });
  }

  submit(id: number) {
    return this.prisma.incidentReport.update({
      where: { id },
      data: { status: "SUBMITTED" },
      include: INCLUDE,
    });
  }

  sign(id: number, isSupervisor: boolean, isMedical: boolean) {
    return this.prisma.incidentReport.update({
      where: { id },
      data: {
        ...(isSupervisor && { supervisorSigned: true }),
        ...(isMedical && { medicalSigned: true }),
      },
      include: INCLUDE,
    });
  }

  markSigned(id: number) {
    return this.prisma.incidentReport.update({ where: { id }, data: { status: "SIGNED" } });
  }

  createExternalReports(incidentReportId: number, targets: { target: ExternalReportTarget; dueDate: Date }[], reportData: object) {
    return this.prisma.externalReport.createMany({
      data: targets.map(t => ({
        incidentReportId,
        target: t.target,
        dueDate: t.dueDate,
        reportData,
        status: "PENDING_SUBMISSION",
      })),
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/incident-report/dto/ apps/api/src/incident-report/incident-report.repo.ts
git commit -m "feat(youth): IncidentReport DTO and Repository"
```

---

## Task 3: IncidentReport Service (TDD)

**Files:**
- Create: `apps/api/src/incident-report/incident-report.service.ts`
- Create: `apps/api/__test__/incident-report/incident-report.service.test.ts`

- [ ] **Step 1: failing test 작성**

`apps/api/__test__/incident-report/incident-report.service.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { IncidentReportService } from "../../src/incident-report/incident-report.service";

const mockRepo = {
  findAll: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  findById: jest.fn(),
  create: jest.fn(),
  submit: jest.fn(),
  sign: jest.fn(),
  markSigned: jest.fn(),
  createExternalReports: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 2 }),
} as any;

const mockNotifRepo = {
  createForGuardian: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
} as any;

const service = new IncidentReportService(mockRepo, mockNotifRepo);

describe("IncidentReportService - submit", () => {
  beforeEach(() => jest.clearAllMocks());

  test("DRAFT만 제출 가능", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, status: "SUBMITTED" });
    await expect(service.submit(1)).rejects.toMatchObject({ statusCode: 409, code: "INVALID_STATUS" });
  });

  test("SUBMITTED 전환 시 GUARDIAN에게 알림 발송", async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1, status: "DRAFT", player: { playerName: "홍길동", guardianId: 10 }, teamId: 1,
    });
    mockRepo.submit.mockResolvedValue({ id: 1, status: "SUBMITTED" });

    await service.submit(1);

    expect(mockNotifRepo.createForGuardian).toHaveBeenCalledWith(
      10, "INCIDENT_REPORT_SUBMITTED", expect.any(String), expect.any(String), 1,
    );
  });

  test("guardianId 없으면 알림 미발송", async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1, status: "DRAFT", player: { playerName: "홍길동", guardianId: null }, teamId: 1,
    });
    mockRepo.submit.mockResolvedValue({ id: 1, status: "SUBMITTED" });

    await service.submit(1);

    expect(mockNotifRepo.createForGuardian).not.toHaveBeenCalled();
  });
});

describe("IncidentReportService - sign", () => {
  beforeEach(() => jest.clearAllMocks());

  test("SUBMITTED 상태만 서명 가능", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, status: "DRAFT", supervisorSigned: false, medicalSigned: false });
    await expect(service.sign(1, "SUPERVISOR")).rejects.toMatchObject({ statusCode: 409, code: "INVALID_STATUS" });
  });

  test("SUPERVISOR 서명 처리", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, status: "SUBMITTED", supervisorSigned: false, medicalSigned: false });
    mockRepo.sign.mockResolvedValue({ id: 1, supervisorSigned: true, medicalSigned: false });

    await service.sign(1, "SUPERVISOR");

    expect(mockRepo.sign).toHaveBeenCalledWith(1, true, false);
    expect(mockRepo.markSigned).not.toHaveBeenCalled(); // 양측 서명 미완료
  });

  test("양측 서명 완료 시 SIGNED 전환 + ExternalReport 생성", async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1, status: "SUBMITTED", supervisorSigned: true, medicalSigned: false,
      player: { playerName: "홍길동" }, description: "넘어짐",
    });
    mockRepo.sign.mockResolvedValue({ id: 1, supervisorSigned: true, medicalSigned: true });

    await service.sign(1, "MEDICAL");

    expect(mockRepo.markSigned).toHaveBeenCalledWith(1);
    expect(mockRepo.createExternalReports).toHaveBeenCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({ target: "EDUCATION_OFFICE" }),
        expect.objectContaining({ target: "SCHOOL_SAFETY" }),
      ]),
      expect.any(Object),
    );
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd apps/api && npx jest __test__/incident-report/incident-report.service.test.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Service 구현**

`apps/api/src/incident-report/incident-report.service.ts`:

```typescript
import { AppError } from "../lib/appError";
import type { IncidentReportRepository } from "./incident-report.repo";
import type { NotificationRepository } from "../notification/notification.repo";
import type { CreateIncidentReportDto, IncidentReportListQuery } from "./dto/incident-report.dto";

const YOUTH_EXTERNAL_TARGETS = [
  { target: "EDUCATION_OFFICE" as const, daysUntilDue: 3 },
  { target: "SCHOOL_SAFETY" as const, daysUntilDue: 7 },
];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export class IncidentReportService {
  constructor(
    private repo: IncidentReportRepository,
    private notifRepo: NotificationRepository,
  ) {}

  getAll(query: IncidentReportListQuery) {
    return this.repo.findAll(query);
  }

  async getById(id: number) {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "INCIDENT_REPORT_NOT_FOUND");
    return report;
  }

  create(dto: CreateIncidentReportDto, reportedById: number) {
    return this.repo.create({ ...dto, reportedById });
  }

  async submit(id: number) {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "INCIDENT_REPORT_NOT_FOUND");
    if (report.status !== "DRAFT") throw new AppError(409, "INVALID_STATUS");

    const updated = await this.repo.submit(id);

    if (report.player.guardianId) {
      void this.notifRepo
        .createForGuardian(
          report.player.guardianId,
          "INCIDENT_REPORT_SUBMITTED",
          "사고 보고서 접수",
          `${report.player.playerName} 선수의 사고 보고서가 접수됐습니다.`,
          id,
        )
        .catch(console.error);
    }

    return updated;
  }

  async sign(id: number, role: "SUPERVISOR" | "MEDICAL") {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "INCIDENT_REPORT_NOT_FOUND");
    if (report.status !== "SUBMITTED") throw new AppError(409, "INVALID_STATUS");

    const isSupervisor = role === "SUPERVISOR";
    const isMedical = role === "MEDICAL";

    const updated = await this.repo.sign(id, isSupervisor, isMedical);

    const bothSigned =
      (isSupervisor ? true : report.supervisorSigned) &&
      (isMedical ? true : report.medicalSigned);

    if (bothSigned) {
      await this.repo.markSigned(id);
      const now = new Date();
      await this.repo.createExternalReports(
        id,
        YOUTH_EXTERNAL_TARGETS.map(t => ({ target: t.target, dueDate: addDays(now, t.daysUntilDue) })),
        { incidentReportId: id, playerName: report.player.playerName, description: report.description },
      );
    }

    return updated;
  }
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
cd apps/api && npx jest __test__/incident-report/incident-report.service.test.ts --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/incident-report/ apps/api/__test__/incident-report/
git commit -m "feat(youth): IncidentReportService TDD"
```

---

## Task 4: Controller + Routes + apiRouter 등록

**Files:**
- Create: `apps/api/src/incident-report/incident-report.controller.ts`
- Create: `apps/api/src/incident-report/incident-report.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: Controller 작성**

`apps/api/src/incident-report/incident-report.controller.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import type { IncidentReportService } from "./incident-report.service";
import {
  CreateIncidentReportSchema,
  SignIncidentReportSchema,
  IncidentReportListQuerySchema,
} from "./dto/incident-report.dto";

export class IncidentReportController {
  constructor(private service: IncidentReportService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = IncidentReportListQuerySchema.parse(req.query);
      res.json(await this.service.getAll(query));
    } catch (e) { next(e); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params.id)));
    } catch (e) { next(e); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = CreateIncidentReportSchema.parse(req.body);
      res.status(201).json(await this.service.create(dto, (req.user as any).id));
    } catch (e) { next(e); }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.submit(Number(req.params.id)));
    } catch (e) { next(e); }
  };

  sign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = SignIncidentReportSchema.parse(req.body);
      res.json(await this.service.sign(Number(req.params.id), role));
    } catch (e) { next(e); }
  };
}
```

- [ ] **Step 2: Routes 작성**

`apps/api/src/incident-report/incident-report.routes.ts`:

```typescript
import { Router } from "express";
import passport from "passport";
import { IncidentReportController } from "./incident-report.controller";
import { IncidentReportService } from "./incident-report.service";
import { IncidentReportRepository } from "./incident-report.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new IncidentReportRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const service = new IncidentReportService(repo, notifRepo);
const controller = new IncidentReportController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.getAll);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id/submit", auth, controller.submit);
router.patch("/:id/sign", auth, controller.sign);

export default router;
```

- [ ] **Step 3: apiRouter.ts에 등록**

```typescript
import incidentReportRouter from "./incident-report/incident-report.routes";
// ...
apiRouter.use("/incident-reports", incidentReportRouter);
```

- [ ] **Step 4: 서버 기동 확인**

```bash
cd apps/api && npm run dev
```

Expected: 에러 없이 시작

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/incident-report/ apps/api/src/apiRouter.ts
git commit -m "feat(youth): IncidentReport controller, routes, API 등록"
```

---

## Task 5: FE — IncidentReport 목록 + 생성 + 서명

**Files:**
- Create: `football/src/types/incident-report.ts`
- Create: `football/src/services/incidentReport.service.ts`
- Create: `football/src/pages/youth/IncidentReportFormDialog.tsx`
- Create: `football/src/pages/youth/IncidentReportPage.tsx`
- Modify: `football/src/App.tsx`

- [ ] **Step 1: 타입 정의**

`football/src/types/incident-report.ts`:

```typescript
export type IncidentReportStatus = 'DRAFT' | 'SUBMITTED' | 'SIGNED'
export type IncidentType = 'MATCH' | 'TRAINING'

export interface IncidentReport {
  id: number
  playerId: string
  player: { id: string; playerName: string; guardianId: number | null }
  teamId: number
  team: { id: number; name: string }
  type: IncidentType
  matchId: number | null
  sessionId: number | null
  description: string
  reportedById: number
  reportedBy: { id: number; username: string }
  supervisorSigned: boolean
  medicalSigned: boolean
  injuryId: number | null
  status: IncidentReportStatus
  createdAt: string
}

export interface CreateIncidentReportPayload {
  playerId: string
  teamId: number
  type: IncidentType
  matchId?: number
  sessionId?: number
  description: string
}
```

- [ ] **Step 2: API 서비스**

`football/src/services/incidentReport.service.ts`:

```typescript
import api from '@/lib/api'
import type { IncidentReport, CreateIncidentReportPayload } from '@/types/incident-report'

export const incidentReportApi = {
  getAll: (params?: { teamId?: number; status?: string }) =>
    api.get<IncidentReport[]>('/incident-reports', { params }).then(r => r.data),

  getById: (id: number) =>
    api.get<IncidentReport>(`/incident-reports/${id}`).then(r => r.data),

  create: (payload: CreateIncidentReportPayload) =>
    api.post<IncidentReport>('/incident-reports', payload).then(r => r.data),

  submit: (id: number) =>
    api.patch<IncidentReport>(`/incident-reports/${id}/submit`).then(r => r.data),

  sign: (id: number, role: 'SUPERVISOR' | 'MEDICAL') =>
    api.patch<IncidentReport>(`/incident-reports/${id}/sign`, { role }).then(r => r.data),
}
```

- [ ] **Step 3: 생성 다이얼로그**

`football/src/pages/youth/IncidentReportFormDialog.tsx`:

```typescript
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { incidentReportApi } from '@/services/incidentReport.service'
import type { CreateIncidentReportPayload } from '@/types/incident-report'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  players: { id: string; playerName: string; teamId: number }[]
}

export function IncidentReportFormDialog({ open, onClose, onCreated, players }: Props) {
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '')
  const [type, setType] = useState<'MATCH' | 'TRAINING'>('TRAINING')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPlayer = players.find(p => p.id === playerId)

  const handleSubmit = async () => {
    if (!selectedPlayer) return
    setLoading(true)
    setError(null)
    try {
      const payload: CreateIncidentReportPayload = {
        playerId,
        teamId: selectedPlayer.teamId,
        type,
        description,
      }
      await incidentReportApi.create(payload)
      onCreated()
      onClose()
      setDescription('')
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>사고 보고서 작성</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>선수</Label>
            <select className="w-full border rounded px-3 py-2 text-sm" value={playerId} onChange={e => setPlayerId(e.target.value)}>
              {players.map(p => <option key={p.id} value={p.id}>{p.playerName}</option>)}
            </select>
          </div>
          <div>
            <Label>발생 유형</Label>
            <div className="flex gap-3 mt-1">
              {(['TRAINING', 'MATCH'] as const).map(t => (
                <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={type === t} onChange={() => setType(t)} />
                  {t === 'TRAINING' ? '훈련 중' : '경기 중'}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>사건 내용 (육하원칙)</Label>
            <Textarea
              rows={5}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="언제, 어디서, 누가, 무엇을, 어떻게, 왜..."
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button onClick={handleSubmit} disabled={loading || !description.trim()}>{loading ? '저장 중...' : '초안 저장'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: 목록 페이지**

`football/src/pages/youth/IncidentReportPage.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { incidentReportApi } from '@/services/incidentReport.service'
import type { IncidentReport } from '@/types/incident-report'
import { IncidentReportFormDialog } from './IncidentReportFormDialog'

const STATUS_LABEL = { DRAFT: '초안', SUBMITTED: '제출됨', SIGNED: '서명완료' }
const STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'default'> = {
  DRAFT: 'outline', SUBMITTED: 'secondary', SIGNED: 'default',
}

export default function IncidentReportPage() {
  const [reports, setReports] = useState<IncidentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setReports(await incidentReportApi.getAll()) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSign = async (id: number, role: 'SUPERVISOR' | 'MEDICAL') => {
    await incidentReportApi.sign(id, role)
    load()
  }

  const handleSubmit = async (id: number) => {
    await incidentReportApi.submit(id)
    load()
  }

  const allPlayers = reports.map(r => ({ id: r.playerId, playerName: r.player.playerName, teamId: r.teamId }))
  const uniquePlayers = [...new Map(allPlayers.map(p => [p.id, p])).values()]

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">사고 보고서</h1>
        <Button onClick={() => setDialogOpen(true)}>+ 보고서 작성</Button>
      </div>

      {loading ? <p className="text-muted-foreground">불러오는 중...</p> : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{r.player.playerName}</span>
                  <span className="text-muted-foreground text-sm ml-2">({r.type === 'MATCH' ? '경기 중' : '훈련 중'})</span>
                </div>
                <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>감독서명: {r.supervisorSigned ? '✅' : '❌'}</span>
                <span>의무서명: {r.medicalSigned ? '✅' : '❌'}</span>
              </div>
              {r.status === 'DRAFT' && (
                <Button size="sm" variant="outline" onClick={() => handleSubmit(r.id)}>제출</Button>
              )}
              {r.status === 'SUBMITTED' && (
                <div className="flex gap-2">
                  {!r.supervisorSigned && <Button size="sm" variant="outline" onClick={() => handleSign(r.id, 'SUPERVISOR')}>감독 서명</Button>}
                  {!r.medicalSigned && <Button size="sm" variant="outline" onClick={() => handleSign(r.id, 'MEDICAL')}>의무팀 서명</Button>}
                </div>
              )}
            </div>
          ))}
          {reports.length === 0 && <p className="text-muted-foreground">사고 보고서가 없습니다.</p>}
        </div>
      )}

      <IncidentReportFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={load}
        players={uniquePlayers}
      />
    </div>
  )
}
```

- [ ] **Step 5: App.tsx에 라우트 추가**

```typescript
import IncidentReportPage from './pages/youth/IncidentReportPage'
// Routes 내:
<Route path="/incident-reports" element={<IncidentReportPage />} />
```

- [ ] **Step 6: 브라우저 확인**

`/incident-reports` 페이지에서:
1. 보고서 초안 작성 → DRAFT 상태 확인
2. 제출 버튼 → SUBMITTED 전환 + GUARDIAN 알림 발송 확인
3. 감독 서명 + 의무팀 서명 → SIGNED 전환 + ExternalReport 생성 확인

- [ ] **Step 7: 전체 테스트**

```bash
cd apps/api && npx jest --no-coverage && npx tsc --noEmit
cd ../football && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(youth): Plan 3 완료 - IncidentReport BE/FE + ExternalReport 수정"
```
