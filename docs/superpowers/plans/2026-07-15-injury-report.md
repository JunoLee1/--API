# InjuryReport (의료 보고서) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부상 기록(Injury)에 구조화된 임상 의료 보고서(InjuryReport) 엔티티를 추가하고, FE에서 상세 페이지로 조회·작성·수정하며, 감독(HEAD_COACH)·트레이너(PHYSICAL_COACH)·의료팀(MEDICAL/MEDICAL_DIRECTOR) 3자가 복귀 계획에 서명(조율)할 수 있게 한다.

**Architecture:** `Injury`와 1:1로 연결된 `InjuryReport` 모델을 Prisma에 추가한다. 모델에는 임상 필드 외에 3자 서명 타임스탬프(`coachSignedAt/By`, `trainerSignedAt/By`, `medicalSignedAt/By`)가 포함된다. BE는 기존 `/injuries` 라우터에 `/:id/report` (GET/PUT)과 `/:id/report/sign` (POST/DELETE) 엔드포인트를 추가. FE는 새 `InjuryDetailPage`(`/injuries/:id`)를 만들고, 기존 `InjuriesPage` 테이블 행을 클릭하면 해당 페이지로 이동하게 한다.

**Tech Stack:** Express 5, Prisma 7, PostgreSQL, React 18, TypeScript, shadcn/ui

---

## File Map

| 파일 | 작업 |
|------|------|
| `apps/api/prisma/schema.prisma` | `InjuryReport` 모델 + `RehabStage` / `RiskLevel` / `SecurityLevel` 열거형 추가 |
| `apps/api/prisma/migrations/20260715000003_add_injury_report/migration.sql` | 신규 생성 |
| `apps/api/src/injury/dto/injury.dto.ts` | `UpsertInjuryReportDto` 추가 |
| `apps/api/src/injury/injury.repo.ts` | `findReport`, `upsertReport` 추가 |
| `apps/api/src/injury/injury.service.ts` | `getReport`, `saveReport` 추가 |
| `apps/api/src/injury/injury.controller.ts` | `getReport`, `saveReport`, `signReport`, `unsignReport` 핸들러 추가 |
| `apps/api/src/injury/injury.routes.ts` | `GET /:id/report`, `PUT /:id/report`, `POST /:id/report/sign`, `DELETE /:id/report/sign` 추가 |
| `football/src/types/injury.ts` | `InjuryReport` 타입 + 레이블 맵 추가 |
| `football/src/services/injury.service.ts` | `getReport`, `saveReport` 추가 |
| `football/src/pages/injuries/InjuryDetailPage.tsx` | 신규 생성 |
| `football/src/App.tsx` | `/injuries/:id` 라우트 추가 |
| `football/src/pages/injuries/InjuriesPage.tsx` | 테이블 행 클릭 → 상세 페이지 이동 |

---

### Task 1: Prisma 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260715000003_add_injury_report/migration.sql`

- [ ] **Step 1: schema.prisma에 열거형 추가**

`Injury` 모델 정의 아래(또는 파일 끝)에 다음을 추가한다.

```prisma
enum RehabStage {
  INITIAL_TREATMENT
  ACUTE_TREATMENT
  REHABILITATION
  RETURN_TRAINING
  CLEARED
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
}

enum SecurityLevel {
  INTERNAL
  MEDICAL
  PRIVATE
}
```

- [ ] **Step 2: schema.prisma에 InjuryReport 모델 추가**

열거형 바로 아래에 추가한다.

```prisma
model InjuryReport {
  id                 Int            @id @default(autoincrement())
  injuryId           Int            @unique
  diagnosisName      String?
  treatmentContent   String?        @db.Text
  rehabStage         RehabStage?
  trainingReturnDate DateTime?
  matchAvailable     Boolean?
  reinjuryRisk       RiskLevel?
  medicalOpinion     String?        @db.Text
  securityLevel      SecurityLevel  @default(INTERNAL)

  // 복귀 계획 3자 서명
  coachSignedAt      DateTime?
  coachSignedById    Int?
  trainerSignedAt    DateTime?
  trainerSignedById  Int?
  medicalSignedAt    DateTime?
  medicalSignedById  Int?

  createdById        Int
  updatedById        Int?
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt

  injury         Injury @relation(fields: [injuryId], references: [id], onDelete: Cascade)
  createdBy      User   @relation("InjuryReportCreator", fields: [createdById], references: [id])
  updatedBy      User?  @relation("InjuryReportUpdater", fields: [updatedById], references: [id])
  coachSigner    User?  @relation("InjuryReportCoachSigner", fields: [coachSignedById], references: [id])
  trainerSigner  User?  @relation("InjuryReportTrainerSigner", fields: [trainerSignedById], references: [id])
  medicalSigner  User?  @relation("InjuryReportMedicalSigner", fields: [medicalSignedById], references: [id])
}
```

- [ ] **Step 3: Injury 모델에 역방향 관계 추가**

`apps/api/prisma/schema.prisma`의 `model Injury { ... }` 블록 안에 다음을 추가한다.

```prisma
  injuryReport InjuryReport?
```

- [ ] **Step 4: User 모델에 역방향 관계 추가**

`model User { ... }` 블록 안에 다음을 추가한다.

```prisma
  createdInjuryReports  InjuryReport[] @relation("InjuryReportCreator")
  updatedInjuryReports  InjuryReport[] @relation("InjuryReportUpdater")
  coachSignedReports    InjuryReport[] @relation("InjuryReportCoachSigner")
  trainerSignedReports  InjuryReport[] @relation("InjuryReportTrainerSigner")
  medicalSignedReports  InjuryReport[] @relation("InjuryReportMedicalSigner")
```

- [ ] **Step 5: 마이그레이션 SQL 파일 생성**

`apps/api/prisma/migrations/20260715000003_add_injury_report/migration.sql` 파일을 만든다.

```sql
-- CreateEnum
CREATE TYPE "RehabStage" AS ENUM ('INITIAL_TREATMENT', 'ACUTE_TREATMENT', 'REHABILITATION', 'RETURN_TRAINING', 'CLEARED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SecurityLevel" AS ENUM ('INTERNAL', 'MEDICAL', 'PRIVATE');

-- CreateTable
CREATE TABLE "InjuryReport" (
    "id" SERIAL NOT NULL,
    "injuryId" INTEGER NOT NULL,
    "diagnosisName" TEXT,
    "treatmentContent" TEXT,
    "rehabStage" "RehabStage",
    "trainingReturnDate" TIMESTAMP(3),
    "matchAvailable" BOOLEAN,
    "reinjuryRisk" "RiskLevel",
    "medicalOpinion" TEXT,
    "securityLevel" "SecurityLevel" NOT NULL DEFAULT 'INTERNAL',
    "coachSignedAt" TIMESTAMP(3),
    "coachSignedById" INTEGER,
    "trainerSignedAt" TIMESTAMP(3),
    "trainerSignedById" INTEGER,
    "medicalSignedAt" TIMESTAMP(3),
    "medicalSignedById" INTEGER,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InjuryReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InjuryReport_injuryId_key" ON "InjuryReport"("injuryId");

-- AddForeignKey
ALTER TABLE "InjuryReport" ADD CONSTRAINT "InjuryReport_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "Injury"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryReport" ADD CONSTRAINT "InjuryReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryReport" ADD CONSTRAINT "InjuryReport_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryReport" ADD CONSTRAINT "InjuryReport_coachSignedById_fkey" FOREIGN KEY ("coachSignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryReport" ADD CONSTRAINT "InjuryReport_trainerSignedById_fkey" FOREIGN KEY ("trainerSignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryReport" ADD CONSTRAINT "InjuryReport_medicalSignedById_fkey" FOREIGN KEY ("medicalSignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 6: 마이그레이션 적용**

```bash
cd /Users/juno/work/football/apps/api
npx prisma migrate resolve --applied 20260715000003_add_injury_report
npx prisma db execute --file prisma/migrations/20260715000003_add_injury_report/migration.sql
npx prisma generate
```

Expected: `Prisma Client generated` 출력.

- [ ] **Step 7: 커밋**

```bash
git add apps/api/prisma/
git commit -m "feat: add InjuryReport model with RehabStage/RiskLevel/SecurityLevel enums"
```

---

### Task 2: BE — DTO + Repository

**Files:**
- Modify: `apps/api/src/injury/dto/injury.dto.ts`
- Modify: `apps/api/src/injury/injury.repo.ts`

- [ ] **Step 1: DTO 추가**

`apps/api/src/injury/dto/injury.dto.ts` 파일에 import와 인터페이스를 추가한다.

```typescript
import { InjuryCause, InjuryStatus, HospitalType, RehabStage, RiskLevel, SecurityLevel } from "../../generated/enums";

export interface CreateInjuryDto {
  playerId: string;
  bodyPart: string;
  cause: InjuryCause;
  expectedReturnDate?: string;
  medicalStaffId: number;
  hospitalType?: HospitalType;
  partnerId?: number;
  customHospitalName?: string;
}

export interface UpdateInjuryStatusDto {
  status: InjuryStatus;
  expectedReturnDate?: string;
}

export interface UpsertInjuryReportDto {
  diagnosisName?: string;
  treatmentContent?: string;
  rehabStage?: RehabStage;
  trainingReturnDate?: string;
  matchAvailable?: boolean;
  reinjuryRisk?: RiskLevel;
  medicalOpinion?: string;
  securityLevel?: SecurityLevel;
}
```

- [ ] **Step 2: Repo에 INJURY_REPORT_SELECT 상수 + 메서드 추가**

`apps/api/src/injury/injury.repo.ts` 파일에 다음을 추가한다. 기존 import에 `UpsertInjuryReportDto`를 포함시키고, 클래스 안에 두 메서드를 추가한다.

```typescript
import { CreateInjuryDto, UpdateInjuryStatusDto, UpsertInjuryReportDto } from "./dto/injury.dto";
```

클래스 바디 안 (기존 `getStats` 메서드 앞에 추가):

```typescript
private INJURY_REPORT_SELECT = {
  id: true,
  injuryId: true,
  diagnosisName: true,
  treatmentContent: true,
  rehabStage: true,
  trainingReturnDate: true,
  matchAvailable: true,
  reinjuryRisk: true,
  medicalOpinion: true,
  securityLevel: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, nickname: true } },
  updatedBy: { select: { id: true, nickname: true } },
} as const;

findReport(injuryId: number) {
  return this.prisma.injuryReport.findUnique({
    where: { injuryId },
    select: this.INJURY_REPORT_SELECT,
  });
}

upsertReport(injuryId: number, dto: UpsertInjuryReportDto, userId: number) {
  const data = {
    diagnosisName: dto.diagnosisName ?? null,
    treatmentContent: dto.treatmentContent ?? null,
    rehabStage: dto.rehabStage ?? null,
    trainingReturnDate: dto.trainingReturnDate ? new Date(dto.trainingReturnDate) : null,
    matchAvailable: dto.matchAvailable ?? null,
    reinjuryRisk: dto.reinjuryRisk ?? null,
    medicalOpinion: dto.medicalOpinion ?? null,
    securityLevel: dto.securityLevel ?? "INTERNAL" as const,
  };
  return this.prisma.injuryReport.upsert({
    where: { injuryId },
    create: { ...data, injuryId, createdById: userId },
    update: { ...data, updatedById: userId },
    select: this.INJURY_REPORT_SELECT,
  });
}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/api/src/injury/dto/injury.dto.ts apps/api/src/injury/injury.repo.ts
git commit -m "feat: add InjuryReport DTO and repo methods (findReport, upsertReport)"
```

---

### Task 3: BE — Service + Controller + Routes

**Files:**
- Modify: `apps/api/src/injury/injury.service.ts`
- Modify: `apps/api/src/injury/injury.controller.ts`
- Modify: `apps/api/src/injury/injury.routes.ts`

- [ ] **Step 1: Service에 getReport, saveReport 추가**

`apps/api/src/injury/injury.service.ts`의 기존 `getStats` 앞에 추가한다.

```typescript
async getReport(injuryId: number) {
  const injury = await this.repo.findById(injuryId);
  if (!injury) throw new AppError(404, "INJURY_NOT_FOUND");
  return this.repo.findReport(injuryId);
}

async saveReport(injuryId: number, dto: UpsertInjuryReportDto, userId: number) {
  const injury = await this.repo.findById(injuryId);
  if (!injury) throw new AppError(404, "INJURY_NOT_FOUND");
  return this.repo.upsertReport(injuryId, dto, userId);
}
```

import에 `UpsertInjuryReportDto`를 추가한다.

```typescript
import { CreateInjuryDto, UpdateInjuryStatusDto, UpsertInjuryReportDto } from "./dto/injury.dto";
```

- [ ] **Step 2: Controller에 getReport, saveReport 핸들러 추가**

`apps/api/src/injury/injury.controller.ts`의 기존 `updateStatus` 핸들러 뒤에 추가한다.

```typescript
getReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await this.service.getReport(Number(req.params["id"]));
    res.status(200).json(report ?? null);
  } catch (err) { next(err); }
};

saveReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!MEDICAL_ROLES.includes(req.user!.role as MedicalRole)) throw new AppError(403, "FORBIDDEN");
    res.status(200).json(
      await this.service.saveReport(Number(req.params["id"]), req.body, req.user!.id)
    );
  } catch (err) { next(err); }
};
```

- [ ] **Step 3: Routes에 엔드포인트 추가**

`apps/api/src/injury/injury.routes.ts`에서 `router.patch("/:id/status", ...)` 아래에 추가한다.

```typescript
router.get("/:id/report", auth, controller.getReport);
router.put("/:id/report", auth, controller.saveReport);
```

- [ ] **Step 4: 커밋**

```bash
git add apps/api/src/injury/injury.service.ts apps/api/src/injury/injury.controller.ts apps/api/src/injury/injury.routes.ts
git commit -m "feat: add getReport/saveReport endpoints to injury API"
```

---

### Task 4: FE — 타입 + 서비스

**Files:**
- Modify: `football/src/types/injury.ts`
- Modify: `football/src/services/injury.service.ts`

- [ ] **Step 1: injury.ts에 InjuryReport 타입 + 레이블 추가**

`football/src/types/injury.ts` 파일 끝에 추가한다.

```typescript
export type RehabStage =
  | 'INITIAL_TREATMENT'
  | 'ACUTE_TREATMENT'
  | 'REHABILITATION'
  | 'RETURN_TRAINING'
  | 'CLEARED'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type SecurityLevel = 'INTERNAL' | 'MEDICAL' | 'PRIVATE'

export interface InjuryReport {
  id: number
  injuryId: number
  diagnosisName: string | null
  treatmentContent: string | null
  rehabStage: RehabStage | null
  trainingReturnDate: string | null
  matchAvailable: boolean | null
  reinjuryRisk: RiskLevel | null
  medicalOpinion: string | null
  securityLevel: SecurityLevel
  createdById: number
  updatedById: number | null
  createdAt: string
  updatedAt: string
  createdBy: { id: number; nickname: string }
  updatedBy: { id: number; nickname: string } | null
}

export const REHAB_STAGE_LABEL: Record<RehabStage, string> = {
  INITIAL_TREATMENT: '초기 처치',
  ACUTE_TREATMENT: '급성기 치료',
  REHABILITATION: '재활 운동',
  RETURN_TRAINING: '복귀 훈련',
  CLEARED: '완전 복귀',
}

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  LOW: '낮음',
  MEDIUM: '중간',
  HIGH: '높음',
}

export const RISK_LEVEL_STYLE: Record<RiskLevel, string> = {
  LOW: 'bg-green-50 text-green-700 border-green-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-red-50 text-red-700 border-red-200',
}

export const SECURITY_LEVEL_LABEL: Record<SecurityLevel, string> = {
  INTERNAL: '내부',
  MEDICAL: '의료팀만',
  PRIVATE: '선수 + 의료팀',
}
```

- [ ] **Step 2: injury.service.ts에 API 메서드 추가**

`football/src/services/injury.service.ts`에 import에 새 타입들을 추가하고, `injuryApi` 객체에 메서드를 추가한다.

```typescript
import type { Injury, InjuryDetail, InjuryStatus, InjuryCause, HospitalType, InjuryReport, RehabStage, RiskLevel, SecurityLevel } from '@/types/injury'
```

`injuryApi` 객체 안 `stats` 아래에 추가:

```typescript
  getReport: (injuryId: number) =>
    api.get<InjuryReport | null>(`/injuries/${injuryId}/report`),

  saveReport: (injuryId: number, payload: {
    diagnosisName?: string
    treatmentContent?: string
    rehabStage?: RehabStage
    trainingReturnDate?: string
    matchAvailable?: boolean
    reinjuryRisk?: RiskLevel
    medicalOpinion?: string
    securityLevel?: SecurityLevel
  }) => api.put<InjuryReport>(`/injuries/${injuryId}/report`, payload),
```

- [ ] **Step 3: 커밋**

```bash
git add football/src/types/injury.ts football/src/services/injury.service.ts
git commit -m "feat: add InjuryReport FE types and API service methods"
```

---

### Task 5: FE — InjuryDetailPage + 라우팅

**Files:**
- Create: `football/src/pages/injuries/InjuryDetailPage.tsx`
- Modify: `football/src/App.tsx`
- Modify: `football/src/pages/injuries/InjuriesPage.tsx`

- [ ] **Step 1: InjuryDetailPage.tsx 생성**

`football/src/pages/injuries/InjuryDetailPage.tsx` 파일을 생성한다.

선수명/포지션/부상일자는 `injuryApi.get(id)`로 가져온 `InjuryDetail`에서 표시(읽기 전용)하고, 의료 보고서 필드는 `injuryApi.getReport(id)`로 가져와 폼에 바인딩 후 `injuryApi.saveReport`로 저장한다.

```typescript
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { injuryApi } from '@/services/injury.service'
import type { InjuryDetail, InjuryReport, RehabStage, RiskLevel, SecurityLevel } from '@/types/injury'
import {
  INJURY_STATUS_LABEL, INJURY_STATUS_STYLE,
  CAUSE_LABEL,
  REHAB_STAGE_LABEL, RISK_LEVEL_LABEL, RISK_LEVEL_STYLE, SECURITY_LEVEL_LABEL,
} from '@/types/injury'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { ArrowLeft, User } from 'lucide-react'
import { POSITION_LABEL } from '@/types/player'

const REHAB_STAGES: RehabStage[] = ['INITIAL_TREATMENT', 'ACUTE_TREATMENT', 'REHABILITATION', 'RETURN_TRAINING', 'CLEARED']
const RISK_LEVELS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH']
const SECURITY_LEVELS: SecurityLevel[] = ['INTERNAL', 'MEDICAL', 'PRIVATE']

export function InjuryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()

  const [injury, setInjury] = useState<InjuryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // form state
  const [diagnosisName, setDiagnosisName] = useState('')
  const [treatmentContent, setTreatmentContent] = useState('')
  const [rehabStage, setRehabStage] = useState<RehabStage | ''>('')
  const [trainingReturnDate, setTrainingReturnDate] = useState('')
  const [matchAvailable, setMatchAvailable] = useState<boolean | ''>('')
  const [reinjuryRisk, setReinjuryRisk] = useState<RiskLevel | ''>('')
  const [medicalOpinion, setMedicalOpinion] = useState('')
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>('INTERNAL')

  const isMedical = user?.role === 'ADMIN' ||
    (user?.role === 'COACHING_STAFF' && (user?.coachingRole === 'MEDICAL' || user?.coachingRole === 'MEDICAL_DIRECTOR'))

  function fillForm(r: InjuryReport) {
    setDiagnosisName(r.diagnosisName ?? '')
    setTreatmentContent(r.treatmentContent ?? '')
    setRehabStage(r.rehabStage ?? '')
    setTrainingReturnDate(r.trainingReturnDate ? r.trainingReturnDate.slice(0, 10) : '')
    setMatchAvailable(r.matchAvailable ?? '')
    setReinjuryRisk(r.reinjuryRisk ?? '')
    setMedicalOpinion(r.medicalOpinion ?? '')
    setSecurityLevel(r.securityLevel)
  }

  useEffect(() => {
    if (!id) return
    Promise.all([
      injuryApi.get(Number(id)),
      injuryApi.getReport(Number(id)),
    ])
      .then(([inj, report]) => {
        setInjury(inj)
        if (report) fillForm(report)
      })
      .catch(() => { toast.error('불러오지 못했습니다.'); navigate('/injuries') })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    try {
      await injuryApi.saveReport(Number(id), {
        diagnosisName: diagnosisName || undefined,
        treatmentContent: treatmentContent || undefined,
        rehabStage: rehabStage || undefined,
        trainingReturnDate: trainingReturnDate || undefined,
        matchAvailable: matchAvailable === '' ? undefined : matchAvailable,
        reinjuryRisk: reinjuryRisk || undefined,
        medicalOpinion: medicalOpinion || undefined,
        securityLevel,
      })
      toast.success('의료 보고서가 저장됐습니다.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }
  if (!injury) return null

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/injuries')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">부상 상세 / 의료 보고서</h1>
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs mt-0.5 ${INJURY_STATUS_STYLE[injury.status]}`}>
            {INJURY_STATUS_LABEL[injury.status]}
          </span>
        </div>
        {isMedical && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-8">

          {/* 기본 정보 (읽기 전용) */}
          <div>
            <h2 className="text-sm font-semibold mb-3">기본 정보</h2>
            <div className="rounded-lg border bg-muted/40 px-4 py-3 flex items-center gap-3 mb-4">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="text-sm">
                <p className="font-medium">{injury.player.playerName}</p>
                <p className="text-muted-foreground text-xs">
                  {POSITION_LABEL[injury.player.position as keyof typeof POSITION_LABEL] ?? '—'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">부상 부위</p>
                <p className="font-medium">{injury.bodyPart}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">발생 원인</p>
                <p className="font-medium">{CAUSE_LABEL[injury.cause]}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">부상 일자</p>
                <p className="font-medium tabular-nums">
                  {new Date(injury.occurredAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">복귀 예정일</p>
                <p className="font-medium tabular-nums">
                  {injury.expectedReturnDate
                    ? new Date(injury.expectedReturnDate).toLocaleDateString('ko-KR')
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* 의료 보고서 폼 */}
          <div>
            <h2 className="text-sm font-semibold mb-3">의료 보고서</h2>
            {!isMedical && (
              <p className="text-sm text-muted-foreground mb-4">의료팀만 작성할 수 있습니다.</p>
            )}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>진단명</Label>
                <Input
                  placeholder="예: 우측 전방십자인대 파열"
                  value={diagnosisName}
                  onChange={(e) => setDiagnosisName(e.target.value)}
                  disabled={!isMedical}
                />
              </div>

              <div className="space-y-1.5">
                <Label>치료 내용</Label>
                <Textarea
                  placeholder="치료 방법, 처방 내용 등"
                  value={treatmentContent}
                  onChange={(e) => setTreatmentContent(e.target.value)}
                  rows={3}
                  disabled={!isMedical}
                />
              </div>

              <div className="space-y-1.5">
                <Label>재활 단계</Label>
                <Select
                  value={rehabStage}
                  onValueChange={(v) => setRehabStage(v as RehabStage)}
                  disabled={!isMedical}
                >
                  <SelectTrigger>
                    <span>{rehabStage ? REHAB_STAGE_LABEL[rehabStage] : <span className="text-muted-foreground">선택 안 함</span>}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {REHAB_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{REHAB_STAGE_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>훈련 복귀 가능 시점</Label>
                  <Input
                    type="date"
                    value={trainingReturnDate}
                    onChange={(e) => setTrainingReturnDate(e.target.value)}
                    disabled={!isMedical}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>경기 출전 가능 여부</Label>
                  <Select
                    value={matchAvailable === '' ? '' : String(matchAvailable)}
                    onValueChange={(v) => setMatchAvailable(v === '' ? '' : v === 'true')}
                    disabled={!isMedical}
                  >
                    <SelectTrigger>
                      <span>
                        {matchAvailable === ''
                          ? <span className="text-muted-foreground">선택 안 함</span>
                          : matchAvailable ? '가능' : '불가'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">가능</SelectItem>
                      <SelectItem value="false">불가</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>재부상 위험</Label>
                <Select
                  value={reinjuryRisk}
                  onValueChange={(v) => setReinjuryRisk(v as RiskLevel)}
                  disabled={!isMedical}
                >
                  <SelectTrigger>
                    {reinjuryRisk
                      ? <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${RISK_LEVEL_STYLE[reinjuryRisk]}`}>{RISK_LEVEL_LABEL[reinjuryRisk]}</span>
                      : <span className="text-muted-foreground">선택 안 함</span>}
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map((r) => (
                      <SelectItem key={r} value={r}>{RISK_LEVEL_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>의학적 소견</Label>
                <Textarea
                  placeholder="의사 소견, 권고 사항 등"
                  value={medicalOpinion}
                  onChange={(e) => setMedicalOpinion(e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                  disabled={!isMedical}
                />
              </div>

              <div className="space-y-1.5">
                <Label>보안 등급</Label>
                <Select
                  value={securityLevel}
                  onValueChange={(v) => setSecurityLevel(v as SecurityLevel)}
                  disabled={!isMedical}
                >
                  <SelectTrigger>
                    <span>{SECURITY_LEVEL_LABEL[securityLevel]}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {SECURITY_LEVELS.map((s) => (
                      <SelectItem key={s} value={s}>{SECURITY_LEVEL_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: App.tsx에 라우트 추가**

`football/src/App.tsx`에 import와 Route를 추가한다.

import 추가:
```typescript
import { InjuryDetailPage } from '@/pages/injuries/InjuryDetailPage'
```

`<Route path="/injuries" element={<InjuriesPage />} />` 아래에 추가:
```tsx
<Route path="/injuries/:id" element={<InjuryDetailPage />} />
```

- [ ] **Step 3: InjuriesPage 테이블 행 클릭 추가**

`football/src/pages/injuries/InjuriesPage.tsx`에서 테이블 `TableRow`에 `useNavigate`를 사용해 클릭 이벤트를 추가한다.

파일 상단에 `useNavigate` import 추가 (이미 있으므로 확인):
```typescript
import { useNavigate } from 'react-router-dom'  // 없으면 추가
```

컴포넌트 안에 추가:
```typescript
const navigate = useNavigate()
```

기존 `injuries.map((inj) => (` 부분의 `TableRow`를:
```tsx
<TableRow key={inj.id} className="cursor-pointer" onClick={() => navigate(`/injuries/${inj.id}`)}>
```
로 변경한다. (기존에 `className`이 없으면 추가, 있으면 `cursor-pointer`를 더한다.)

- [ ] **Step 4: InjuryDetailPage의 player 필드 확인**

현재 `injuryApi.get(id)` → `InjuryDetail`에는 `player: { playerName: string }`만 있다. `position`을 표시하려면 BE `INJURY_SELECT`와 FE 타입을 수정해야 한다.

`apps/api/src/injury/injury.repo.ts`의 `findById` 메서드에서 `player` select를 확장한다:
```typescript
player: { select: { playerName: true, position: true } },
```

`football/src/types/injury.ts`의 `InjuryDetail`을 수정한다:
```typescript
export interface InjuryDetail extends Injury {
  player: { playerName: string; position: string }
  medicalStaff: { username: string }
}
```

- [ ] **Step 5: 타입 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -30
```

Expected: 오류 없음.

- [ ] **Step 6: 커밋**

```bash
git add football/src/pages/injuries/InjuryDetailPage.tsx football/src/App.tsx football/src/pages/injuries/InjuriesPage.tsx football/src/types/injury.ts football/src/services/injury.service.ts apps/api/src/injury/injury.repo.ts
git commit -m "feat: add InjuryDetailPage with InjuryReport form"
```

---

### Task 6: 복귀 계획 3자 서명 — BE + FE

감독(HEAD_COACH)·트레이너(PHYSICAL_COACH)·의료팀(MEDICAL/MEDICAL_DIRECTOR)이 각자 역할에 맞는 서명을 추가/제거할 수 있다. 세 명 모두 서명해야 복귀 계획 조율이 완료된다.

**Files:**
- Modify: `apps/api/src/injury/dto/injury.dto.ts`
- Modify: `apps/api/src/injury/injury.repo.ts`
- Modify: `apps/api/src/injury/injury.service.ts`
- Modify: `apps/api/src/injury/injury.controller.ts`
- Modify: `apps/api/src/injury/injury.routes.ts`
- Modify: `football/src/types/injury.ts`
- Modify: `football/src/services/injury.service.ts`
- Modify: `football/src/pages/injuries/InjuryDetailPage.tsx`

- [ ] **Step 1: InjuryReport 타입에 서명 필드 추가 (이미 Task 4에서 정의했다면 확인)**

`football/src/types/injury.ts`의 `InjuryReport` 인터페이스가 아래 필드를 포함하는지 확인한다. 없으면 추가한다.

```typescript
  coachSignedAt: string | null
  coachSignedById: number | null
  coachSigner: { id: number; nickname: string } | null
  trainerSignedAt: string | null
  trainerSignedById: number | null
  trainerSigner: { id: number; nickname: string } | null
  medicalSignedAt: string | null
  medicalSignedById: number | null
  medicalSigner: { id: number; nickname: string } | null
```

- [ ] **Step 2: BE Repo에 signReport, unsignReport 추가**

`apps/api/src/injury/injury.repo.ts`의 `INJURY_REPORT_SELECT` 상수에 서명 필드를 추가한다.

```typescript
private INJURY_REPORT_SELECT = {
  // ... 기존 필드들 ...
  coachSignedAt: true,
  coachSignedById: true,
  coachSigner: { select: { id: true, nickname: true } },
  trainerSignedAt: true,
  trainerSignedById: true,
  trainerSigner: { select: { id: true, nickname: true } },
  medicalSignedAt: true,
  medicalSignedById: true,
  medicalSigner: { select: { id: true, nickname: true } },
} as const;
```

클래스 안에 두 메서드를 추가한다:

```typescript
signReport(injuryId: number, role: 'COACH' | 'TRAINER' | 'MEDICAL', userId: number) {
  const now = new Date();
  const data =
    role === 'COACH'
      ? { coachSignedAt: now, coachSignedById: userId }
      : role === 'TRAINER'
        ? { trainerSignedAt: now, trainerSignedById: userId }
        : { medicalSignedAt: now, medicalSignedById: userId };
  return this.prisma.injuryReport.update({
    where: { injuryId },
    data,
    select: this.INJURY_REPORT_SELECT,
  });
}

unsignReport(injuryId: number, role: 'COACH' | 'TRAINER' | 'MEDICAL') {
  const data =
    role === 'COACH'
      ? { coachSignedAt: null, coachSignedById: null }
      : role === 'TRAINER'
        ? { trainerSignedAt: null, trainerSignedById: null }
        : { medicalSignedAt: null, medicalSignedById: null };
  return this.prisma.injuryReport.update({
    where: { injuryId },
    data,
    select: this.INJURY_REPORT_SELECT,
  });
}
```

- [ ] **Step 3: BE Service에 signReport, unsignReport 추가**

`apps/api/src/injury/injury.service.ts`에 추가한다.

```typescript
async signReport(injuryId: number, role: 'COACH' | 'TRAINER' | 'MEDICAL', userId: number) {
  const report = await this.repo.findReport(injuryId);
  if (!report) throw new AppError(404, "INJURY_REPORT_NOT_FOUND");
  return this.repo.signReport(injuryId, role, userId);
}

async unsignReport(injuryId: number, role: 'COACH' | 'TRAINER' | 'MEDICAL') {
  const report = await this.repo.findReport(injuryId);
  if (!report) throw new AppError(404, "INJURY_REPORT_NOT_FOUND");
  return this.repo.unsignReport(injuryId, role);
}
```

- [ ] **Step 4: BE Controller에 signReport, unsignReport 핸들러 추가**

`apps/api/src/injury/injury.controller.ts`에 추가한다. 역할 판별 로직: HEAD_COACH → COACH, PHYSICAL_COACH → TRAINER, MEDICAL/MEDICAL_DIRECTOR → MEDICAL. 위 세 역할에 해당하지 않으면 403.

```typescript
private getSignRole(user: Express.User): 'COACH' | 'TRAINER' | 'MEDICAL' | null {
  if (user.role === 'ADMIN') return 'MEDICAL';
  if (user.role === 'COACHING_STAFF') {
    if (user.coachingRole === 'HEAD_COACH') return 'COACH';
    if (user.coachingRole === 'PHYSICAL_COACH') return 'TRAINER';
    if (user.coachingRole === 'MEDICAL' || user.coachingRole === 'MEDICAL_DIRECTOR') return 'MEDICAL';
  }
  return null;
}

signReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = this.getSignRole(req.user!);
    if (!role) throw new AppError(403, "FORBIDDEN");
    res.status(200).json(
      await this.service.signReport(Number(req.params["id"]), role, req.user!.id)
    );
  } catch (err) { next(err); }
};

unsignReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = this.getSignRole(req.user!);
    if (!role) throw new AppError(403, "FORBIDDEN");
    res.status(200).json(
      await this.service.unsignReport(Number(req.params["id"]), role)
    );
  } catch (err) { next(err); }
};
```

- [ ] **Step 5: BE Routes에 서명 엔드포인트 추가**

`apps/api/src/injury/injury.routes.ts`에서 `PUT /:id/report` 아래에 추가한다.

```typescript
router.post("/:id/report/sign", auth, controller.signReport);
router.delete("/:id/report/sign", auth, controller.unsignReport);
```

- [ ] **Step 6: FE Service에 signReport, unsignReport 추가**

`football/src/services/injury.service.ts`의 `injuryApi` 객체에 추가한다.

```typescript
  signReport: (injuryId: number) =>
    api.post<InjuryReport>(`/injuries/${injuryId}/report/sign`, {}),

  unsignReport: (injuryId: number) =>
    api.delete<InjuryReport>(`/injuries/${injuryId}/report/sign`),
```

- [ ] **Step 7: FE InjuryDetailPage에 서명 UI 섹션 추가**

`football/src/pages/injuries/InjuryDetailPage.tsx`에서 `의료 보고서` 섹션 아래에 `복귀 계획 조율` 섹션을 추가한다.

`report` 상태를 별도로 관리한다. `handleSave` 이후와 초기 로드 시 `report` 상태를 업데이트한다. 서명/해제 버튼은 현재 사용자의 역할에 맞는 서명만 토글한다.

아래 코드를 `InjuryDetailPage` 컴포넌트 안에 추가한다.

상태 추가 (기존 form state 아래):
```typescript
const [report, setReport] = useState<InjuryReport | null>(null)
const [signing, setSigning] = useState(false)
```

`fillForm` 호출 시 `setReport(r)` 도 함께 호출하도록 `useEffect` 수정:
```typescript
.then(([inj, r]) => {
  setInjury(inj)
  if (r) { fillForm(r); setReport(r) }
})
```

`handleSave` 내 `saveReport` 반환값을 `setReport`에도 저장:
```typescript
const updated = await injuryApi.saveReport(Number(id), { ... })
setReport(updated)
```

역할별 서명 가능 여부 계산:
```typescript
const mySignRole =
  user?.role === 'ADMIN' ? 'MEDICAL' :
  user?.coachingRole === 'HEAD_COACH' ? 'COACH' :
  user?.coachingRole === 'PHYSICAL_COACH' ? 'TRAINER' :
  (user?.coachingRole === 'MEDICAL' || user?.coachingRole === 'MEDICAL_DIRECTOR') ? 'MEDICAL' :
  null

const handleToggleSign = async () => {
  if (!id || !mySignRole) return
  setSigning(true)
  try {
    const isSigned =
      mySignRole === 'COACH' ? !!report?.coachSignedAt :
      mySignRole === 'TRAINER' ? !!report?.trainerSignedAt :
      !!report?.medicalSignedAt
    const updated = isSigned
      ? await injuryApi.unsignReport(Number(id))
      : await injuryApi.signReport(Number(id))
    setReport(updated)
    toast.success(isSigned ? '서명이 취소됐습니다.' : '서명했습니다.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : '서명 처리에 실패했습니다.')
  } finally {
    setSigning(false)
  }
}
```

복귀 계획 조율 섹션 JSX (`의료 보고서` 섹션 아래에 추가):
```tsx
{report && (
  <div>
    <h2 className="text-sm font-semibold mb-3">복귀 계획 조율</h2>
    <p className="text-xs text-muted-foreground mb-3">
      감독·트레이너·의료팀 3자 모두 서명해야 복귀 계획이 확정됩니다.
    </p>
    <div className="space-y-2">
      {([
        { role: 'COACH', label: '감독', signedAt: report.coachSignedAt, signer: report.coachSigner },
        { role: 'TRAINER', label: '트레이너', signedAt: report.trainerSignedAt, signer: report.trainerSigner },
        { role: 'MEDICAL', label: '의료팀', signedAt: report.medicalSignedAt, signer: report.medicalSigner },
      ] as const).map(({ role, label, signedAt, signer }) => (
        <div key={role} className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${signedAt ? 'border-green-200 bg-green-50' : 'bg-muted/30'}`}>
          <div className="text-sm">
            <span className="font-medium">{label}</span>
            {signedAt && signer && (
              <span className="text-xs text-muted-foreground ml-2">
                {signer.nickname} · {new Date(signedAt).toLocaleDateString('ko-KR')}
              </span>
            )}
            {!signedAt && <span className="text-xs text-muted-foreground ml-2">미서명</span>}
          </div>
          {mySignRole === role && (
            <Button
              size="sm"
              variant={signedAt ? 'outline' : 'default'}
              onClick={handleToggleSign}
              disabled={signing}
              className={signedAt ? 'text-red-600 border-red-300 hover:bg-red-50' : ''}
            >
              {signing ? '처리 중...' : signedAt ? '서명 취소' : '서명'}
            </Button>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 8: 타입 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -30
```

Expected: 오류 없음.

- [ ] **Step 9: 커밋**

```bash
git add apps/api/src/injury/ football/src/types/injury.ts football/src/services/injury.service.ts football/src/pages/injuries/InjuryDetailPage.tsx
git commit -m "feat: add return plan 3-party sign-off (coach/trainer/medical)"
```
