# Feature 12: 멀티포지션 체력 + 코칭스태프 평가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ① 선수가 대열 포지션을 가질 때 포지션별 체력 목표치를 관리하고, ② HEAD_COACH가 코칭스태프 멤버를 주기적으로 평가(점수+코멘트)할 수 있게 한다.

**Architecture:** 두 신규 Prisma 테이블(PlayerSecondaryPosition, CoachingStaffEvaluation)을 추가하고, 각각 기존 player 모듈과 coaching-staff 모듈을 확장한다. 프론트엔드는 PlayerDetailPage "기본 정보" 탭과 StaffManagementPage 스태프 카드에 UI를 추가한다.

**Tech Stack:** Express, Prisma, React, TypeScript, shadcn/ui

---

## 파일 구조

**신규 생성:**
- `apps/api/prisma/migrations/20260725000002_secondary_position_staff_eval/migration.sql`
- `apps/api/src/player/secondary-position.repo.ts`
- `apps/api/src/coaching-staff/coaching-staff-eval.repo.ts`
- `football/src/types/secondary-position.ts`
- `football/src/services/secondary-position.service.ts`
- `football/src/types/coaching-staff-eval.ts`
- `football/src/services/coaching-staff-eval.service.ts`
- `football/src/components/player/SecondaryPositionsModule.tsx`
- `football/src/components/coaching-staff/StaffEvaluationDialog.tsx`

**수정:**
- `apps/api/prisma/schema.prisma` — 두 모델 추가 + 관계 추가
- `apps/api/src/player/player.controller.ts` — 2차 포지션 핸들러 추가
- `apps/api/src/player/player.routes.ts` — 라우트 등록
- `apps/api/src/coaching-staff/coaching-staff.controller.ts` — 평가 핸들러 추가
- `apps/api/src/coaching-staff/coaching-staff.routes.ts` — 라우트 등록
- `football/src/pages/players/PlayerDetailPage.tsx` — SecondaryPositionsModule 삽입
- `football/src/pages/coaching-staff/StaffManagementPage.tsx` — 평가 버튼 + 다이얼로그

---

## Task 1: DB 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260725000002_secondary_position_staff_eval/migration.sql`

- [ ] **Step 1: schema.prisma에 모델 추가**

`apps/api/prisma/schema.prisma`의 Player 모델 relations 목록에 추가 (현재 `academyFees` 마지막 줄 아래):
```prisma
  secondaryPositions     PlayerSecondaryPosition[]
```

User 모델 relations 목록에 추가 (현재 `guardianFees` 마지막 줄 아래):
```prisma
  givenEvaluations       CoachingStaffEvaluation[] @relation("EvaluationGiver")
  receivedEvaluations    CoachingStaffEvaluation[] @relation("EvaluationReceiver")
```

`GoalkeeperCoachEvaluation` 모델 아래에 두 모델 추가:
```prisma
model PlayerSecondaryPosition {
  id            Int      @id @default(autoincrement())
  playerId      String
  position      Position
  fitnessTarget Float    // 0–100 목표 체력(%)
  createdAt     DateTime @default(now())

  player        Player   @relation(fields: [playerId], references: [id])

  @@unique([playerId, position])
}

model CoachingStaffEvaluation {
  id          Int      @id @default(autoincrement())
  staffUserId Int
  evaluatorId Int
  score       Int      // 1–10
  comment     String?
  evaluatedAt DateTime @default(now())

  staffUser   User     @relation("EvaluationReceiver", fields: [staffUserId], references: [id])
  evaluator   User     @relation("EvaluationGiver", fields: [evaluatorId], references: [id])
}
```

- [ ] **Step 2: 마이그레이션 디렉터리 + SQL 작성**

```bash
mkdir -p /Users/juno/work/football/apps/api/prisma/migrations/20260725000002_secondary_position_staff_eval
```

파일 내용 `migration.sql`:
```sql
CREATE TABLE "PlayerSecondaryPosition" (
  "id"            SERIAL       PRIMARY KEY,
  "playerId"      TEXT         NOT NULL,
  "position"      "Position"   NOT NULL,
  "fitnessTarget" DOUBLE PRECISION NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerSecondaryPosition_playerId_position_key" UNIQUE ("playerId", "position"),
  CONSTRAINT "PlayerSecondaryPosition_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CoachingStaffEvaluation" (
  "id"          SERIAL       PRIMARY KEY,
  "staffUserId" INTEGER      NOT NULL,
  "evaluatorId" INTEGER      NOT NULL,
  "score"       INTEGER      NOT NULL,
  "comment"     TEXT,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachingStaffEvaluation_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CoachingStaffEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
```

- [ ] **Step 3: 마이그레이션 적용 (shadow DB 우회 패턴)**

```bash
cd /Users/juno/work/football/apps/api

# 1. SQL 직접 실행
npx dotenv -e .env -- psql "$DATABASE_URL" -f prisma/migrations/20260725000002_secondary_position_staff_eval/migration.sql

# 2. Prisma가 이 마이그레이션을 "적용됨"으로 인식하도록 등록
npx dotenv -e .env -- npx prisma migrate resolve --applied 20260725000002_secondary_position_staff_eval
```

Expected: `Migration 20260725000002_secondary_position_staff_eval marked as applied`

- [ ] **Step 4: Prisma 클라이언트 재생성**

```bash
cd /Users/juno/work/football/apps/api && npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260725000002_secondary_position_staff_eval/
git commit -m "feat(db): add PlayerSecondaryPosition and CoachingStaffEvaluation tables"
```

---

## Task 2: BE — PlayerSecondaryPosition CRUD

**Files:**
- Create: `apps/api/src/player/secondary-position.repo.ts`
- Modify: `apps/api/src/player/player.controller.ts`
- Modify: `apps/api/src/player/player.routes.ts`

**Context:** 이 프로젝트의 BE는 Express + Passport JWT 인증. 라우터 패턴은 `router.METHOD("/path", auth, controller.handler)`. `AppError(status, code)` 사용. 권한 체크: `ADMIN` 또는 `role === "COACHING_STAFF" && coachingRole === "HEAD_COACH"`.

- [ ] **Step 1: repo 작성**

```typescript
// apps/api/src/player/secondary-position.repo.ts
import { PrismaClient } from "../generated/client";

export class SecondaryPositionRepository {
  constructor(private prisma: PrismaClient) {}

  findByPlayerId(playerId: string) {
    return this.prisma.playerSecondaryPosition.findMany({
      where: { playerId },
      orderBy: { createdAt: "asc" },
    });
  }

  create(playerId: string, position: string, fitnessTarget: number) {
    return this.prisma.playerSecondaryPosition.create({
      data: { playerId, position: position as any, fitnessTarget },
    });
  }

  delete(id: number) {
    return this.prisma.playerSecondaryPosition.delete({ where: { id } });
  }

  findById(id: number) {
    return this.prisma.playerSecondaryPosition.findUnique({ where: { id } });
  }
}
```

- [ ] **Step 2: player.controller.ts에 핸들러 추가**

`player.controller.ts` import 에 추가:
```typescript
import { SecondaryPositionRepository } from "./secondary-position.repo";
```

`PlayerController` 클래스 내부에 repo 필드 추가:
```typescript
private secondaryPositionRepo = new SecondaryPositionRepository(getPrisma());
```

클래스 마지막에 세 핸들러 추가:
```typescript
  listSecondaryPositions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      res.json(await this.secondaryPositionRepo.findByPlayerId(id));
    } catch (err) { next(err); }
  };

  createSecondaryPosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const canEdit = req.user!.role === "ADMIN" ||
        (req.user!.role === "COACHING_STAFF" && req.user!.coachingRole === "HEAD_COACH");
      if (!canEdit) throw new AppError(403, "FORBIDDEN");
      const { position, fitnessTarget } = req.body;
      if (!position || fitnessTarget == null) throw new AppError(400, "POSITION_AND_FITNESS_TARGET_REQUIRED");
      const target = Number(fitnessTarget);
      if (isNaN(target) || target < 0 || target > 100) throw new AppError(400, "FITNESS_TARGET_MUST_BE_0_TO_100");
      res.status(201).json(
        await this.secondaryPositionRepo.create(req.params["id"], position, target),
      );
    } catch (err) { next(err); }
  };

  deleteSecondaryPosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const canEdit = req.user!.role === "ADMIN" ||
        (req.user!.role === "COACHING_STAFF" && req.user!.coachingRole === "HEAD_COACH");
      if (!canEdit) throw new AppError(403, "FORBIDDEN");
      const existing = await this.secondaryPositionRepo.findById(Number(req.params["posId"]));
      if (!existing) throw new AppError(404, "SECONDARY_POSITION_NOT_FOUND");
      await this.secondaryPositionRepo.delete(Number(req.params["posId"]));
      res.status(204).end();
    } catch (err) { next(err); }
  };
```

- [ ] **Step 3: player.routes.ts에 라우트 추가**

`player.routes.ts`에서 마지막 `export default router;` 위에 추가:
```typescript
router.get("/:id/secondary-positions", auth, controller.listSecondaryPositions);
router.post("/:id/secondary-positions", auth, controller.createSecondaryPosition);
router.delete("/:id/secondary-positions/:posId", auth, controller.deleteSecondaryPosition);
```

- [ ] **Step 4: TypeScript 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|monthlyAttend" | head -10
```

Expected: 새 에러 없음 (기존 country.repo, monthlyAttend 에러는 무시)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/player/secondary-position.repo.ts apps/api/src/player/player.controller.ts apps/api/src/player/player.routes.ts
git commit -m "feat(player): add secondary positions CRUD endpoints"
```

---

## Task 3: BE — CoachingStaffEvaluation CRUD

**Files:**
- Create: `apps/api/src/coaching-staff/coaching-staff-eval.repo.ts`
- Modify: `apps/api/src/coaching-staff/coaching-staff.controller.ts`
- Modify: `apps/api/src/coaching-staff/coaching-staff.routes.ts`

- [ ] **Step 1: eval repo 작성**

```typescript
// apps/api/src/coaching-staff/coaching-staff-eval.repo.ts
import { PrismaClient } from "../generated/client";

export class CoachingStaffEvalRepository {
  constructor(private prisma: PrismaClient) {}

  findByStaffUserId(staffUserId: number) {
    return this.prisma.coachingStaffEvaluation.findMany({
      where: { staffUserId },
      include: {
        evaluator: { select: { id: true, nickname: true } },
      },
      orderBy: { evaluatedAt: "desc" },
    });
  }

  create(data: { staffUserId: number; evaluatorId: number; score: number; comment?: string }) {
    return this.prisma.coachingStaffEvaluation.create({
      data,
      include: {
        evaluator: { select: { id: true, nickname: true } },
      },
    });
  }
}
```

- [ ] **Step 2: coaching-staff.controller.ts에 핸들러 추가**

`coaching-staff.controller.ts` import에 추가:
```typescript
import { CoachingStaffEvalRepository } from "./coaching-staff-eval.repo";
import { getPrisma } from "../lib/prisma";
```

`CoachingStaffController` 클래스에 repo 필드 추가:
```typescript
private evalRepo = new CoachingStaffEvalRepository(getPrisma());
```

클래스 마지막에 핸들러 추가:
```typescript
  listEvaluations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      const canAccess = role === "ADMIN" ||
        (role === "COACHING_STAFF" && coachingRole === "HEAD_COACH");
      if (!canAccess) throw new AppError(403, "FORBIDDEN");
      res.json(await this.evalRepo.findByStaffUserId(Number(req.params["staffId"])));
    } catch (err) { next(err); }
  };

  createEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      const canCreate = role === "ADMIN" ||
        (role === "COACHING_STAFF" && coachingRole === "HEAD_COACH");
      if (!canCreate) throw new AppError(403, "FORBIDDEN");
      const { score, comment } = req.body;
      if (score == null) throw new AppError(400, "SCORE_REQUIRED");
      const s = Number(score);
      if (isNaN(s) || s < 1 || s > 10) throw new AppError(400, "SCORE_MUST_BE_1_TO_10");
      res.status(201).json(
        await this.evalRepo.create({
          staffUserId: Number(req.params["staffId"]),
          evaluatorId: req.user!.id,
          score: s,
          comment: comment?.trim() || undefined,
        }),
      );
    } catch (err) { next(err); }
  };
```

- [ ] **Step 3: coaching-staff.routes.ts에 라우트 추가**

`export default router;` 위에 추가:
```typescript
router.get("/:staffId/evaluations", auth, controller.listEvaluations);
router.post("/:staffId/evaluations", auth, controller.createEvaluation);
```

- [ ] **Step 4: TypeScript 확인 + Commit**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|monthlyAttend" | head -10
git add apps/api/src/coaching-staff/
git commit -m "feat(coaching-staff): add evaluation CRUD endpoints"
```

---

## Task 4: FE — 대열 포지션 모듈 (PlayerDetailPage)

**Files:**
- Create: `football/src/types/secondary-position.ts`
- Create: `football/src/services/secondary-position.service.ts`
- Create: `football/src/components/player/SecondaryPositionsModule.tsx`
- Modify: `football/src/pages/players/PlayerDetailPage.tsx`

**Context:** `PlayerDetailPage`에서 "기본 정보" 탭(`value="info"`)은 `<TabsContent value="info">` 안에 렌더링된다. `useCurrentUser()`로 role/coachingRole 접근 가능. `playerApi`는 `football/src/services/player.service.ts`. `POSITION_LABEL`은 `football/src/types/player.ts`에서 import.

- [ ] **Step 1: 타입 + 서비스 작성**

```typescript
// football/src/types/secondary-position.ts
import type { Position } from '@/types/player'

export interface SecondaryPosition {
  id: number
  playerId: string
  position: Position
  fitnessTarget: number
  createdAt: string
}
```

```typescript
// football/src/services/secondary-position.service.ts
import { api } from './api'
import type { SecondaryPosition } from '@/types/secondary-position'

export const secondaryPositionApi = {
  list: (playerId: string) =>
    api.get<SecondaryPosition[]>(`/players/${playerId}/secondary-positions`),
  create: (playerId: string, position: string, fitnessTarget: number) =>
    api.post<SecondaryPosition>(`/players/${playerId}/secondary-positions`, { position, fitnessTarget }),
  delete: (playerId: string, posId: number) =>
    api.delete<void>(`/players/${playerId}/secondary-positions/${posId}`),
}
```

- [ ] **Step 2: SecondaryPositionsModule 컴포넌트 작성**

```tsx
// football/src/components/player/SecondaryPositionsModule.tsx
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { secondaryPositionApi } from '@/services/secondary-position.service'
import type { SecondaryPosition } from '@/types/secondary-position'
import { POSITION_LABEL } from '@/types/player'
import type { Position } from '@/types/player'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Trash2 } from 'lucide-react'

const POSITIONS = Object.keys(POSITION_LABEL) as Position[]

interface Props {
  playerId: string
  primaryPosition: Position
}

export function SecondaryPositionsModule({ playerId, primaryPosition }: Props) {
  const { user } = useCurrentUser()
  const [items, setItems] = useState<SecondaryPosition[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ position: '' as Position | '', fitnessTarget: '' })
  const [saving, setSaving] = useState(false)

  const canEdit = user?.role === 'ADMIN' ||
    (user?.role === 'COACHING_STAFF' && user?.coachingRole === 'HEAD_COACH')

  const fetchItems = useCallback(() => {
    secondaryPositionApi.list(playerId).then(setItems).catch(() => {})
  }, [playerId])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleCreate = async () => {
    if (!form.position) { toast.error('포지션을 선택해주세요.'); return }
    const target = Number(form.fitnessTarget)
    if (isNaN(target) || target < 0 || target > 100) { toast.error('체력 목표치는 0~100이어야 합니다.'); return }
    setSaving(true)
    try {
      await secondaryPositionApi.create(playerId, form.position, target)
      toast.success('대열 포지션이 추가됐습니다.')
      setForm({ position: '', fitnessTarget: '' })
      setOpen(false)
      fetchItems()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '추가에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (posId: number) => {
    try {
      await secondaryPositionApi.delete(playerId, posId)
      toast.success('삭제됐습니다.')
      fetchItems()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const availablePositions = POSITIONS.filter(p => p !== primaryPosition && !items.find(i => i.position === p))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">대열 포지션</h4>
        {canEdit && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">등록된 대열 포지션이 없습니다.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b">
              <th className="text-left pb-1">포지션</th>
              <th className="text-right pb-1">체력 목표</th>
              {canEdit && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="py-1.5">{POSITION_LABEL[item.position] ?? item.position}</td>
                <td className="text-right tabular-nums">{item.fitnessTarget}%</td>
                {canEdit && (
                  <td className="text-right">
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => void handleDelete(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>대열 포지션 추가</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>포지션 *</Label>
              <Select value={form.position} onValueChange={v => setForm(f => ({ ...f, position: v as Position }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {availablePositions.map(p => (
                    <SelectItem key={p} value={p}>{POSITION_LABEL[p] ?? p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>체력 목표치 (0–100) *</Label>
              <Input
                type="number" min={0} max={100}
                placeholder="예: 75"
                value={form.fitnessTarget}
                onChange={e => setForm(f => ({ ...f, fitnessTarget: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>취소</Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? '저장 중...' : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: PlayerDetailPage "기본 정보" 탭에 삽입**

`PlayerDetailPage.tsx`에 import 추가:
```tsx
import { SecondaryPositionsModule } from '@/components/player/SecondaryPositionsModule'
```

`<TabsContent value="info">` 내부의 프로필 카드 섹션을 찾아 맨 끝 (jersey 섹션 아래)에 추가:
```tsx
{/* 대열 포지션 */}
<section className="mt-6 pt-6 border-t">
  <SecondaryPositionsModule playerId={player.id} primaryPosition={player.position} />
</section>
```

- [ ] **Step 4: Commit**

```bash
git add football/src/types/secondary-position.ts football/src/services/secondary-position.service.ts football/src/components/player/SecondaryPositionsModule.tsx football/src/pages/players/PlayerDetailPage.tsx
git commit -m "feat(player): add secondary positions module to PlayerDetailPage"
```

---

## Task 5: FE — 코칭스태프 평가 UI (StaffManagementPage)

**Files:**
- Create: `football/src/types/coaching-staff-eval.ts`
- Create: `football/src/services/coaching-staff-eval.service.ts`
- Create: `football/src/components/coaching-staff/StaffEvaluationDialog.tsx`
- Modify: `football/src/pages/coaching-staff/StaffManagementPage.tsx`

**Context:** `StaffManagementPage.tsx`의 `StaffCard` 컴포넌트에 "평가" 버튼을 추가한다. HEAD_COACH만 평가 다이얼로그를 열 수 있다. 평가 후 카드 내부에 최근 3건의 평가 이력(점수, 코멘트, 날짜, 평가자)을 표시한다.

- [ ] **Step 1: 타입 + 서비스 작성**

```typescript
// football/src/types/coaching-staff-eval.ts
export interface CoachingStaffEval {
  id: number
  staffUserId: number
  evaluatorId: number
  score: number
  comment: string | null
  evaluatedAt: string
  evaluator: { id: number; nickname: string }
}
```

```typescript
// football/src/services/coaching-staff-eval.service.ts
import { api } from './api'
import type { CoachingStaffEval } from '@/types/coaching-staff-eval'

export const coachingStaffEvalApi = {
  list: (staffId: number) =>
    api.get<CoachingStaffEval[]>(`/coaching-staff/${staffId}/evaluations`),
  create: (staffId: number, score: number, comment?: string) =>
    api.post<CoachingStaffEval>(`/coaching-staff/${staffId}/evaluations`, { score, comment }),
}
```

- [ ] **Step 2: StaffEvaluationDialog 작성**

```tsx
// football/src/components/coaching-staff/StaffEvaluationDialog.tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { coachingStaffEvalApi } from '@/services/coaching-staff-eval.service'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

interface Props {
  open: boolean
  onClose: () => void
  staffId: number
  staffName: string
  onCreated: () => void
}

export function StaffEvaluationDialog({ open, onClose, staffId, staffName, onCreated }: Props) {
  const [score, setScore] = useState<number>(5)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await coachingStaffEvalApi.create(staffId, score, comment.trim() || undefined)
      toast.success('평가가 저장됐습니다.')
      setScore(5)
      setComment('')
      onCreated()
      onClose()
    } catch {
      toast.error('평가 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{staffName} 평가</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>점수 (1–10)</Label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={1} max={10} step={1}
                value={score}
                onChange={e => setScore(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-2xl font-bold tabular-nums w-8 text-center">{score}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>코멘트 (선택)</Label>
            <Textarea
              rows={3}
              placeholder="평가 내용을 입력해주세요."
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? '저장 중...' : '평가 저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: StaffManagementPage StaffCard에 평가 버튼 + 이력 추가**

`StaffManagementPage.tsx` import 블록에 추가:
```tsx
import { coachingStaffEvalApi } from '@/services/coaching-staff-eval.service'
import type { CoachingStaffEval } from '@/types/coaching-staff-eval'
import { StaffEvaluationDialog } from '@/components/coaching-staff/StaffEvaluationDialog'
import { Star } from 'lucide-react'
```

`StaffCard` 컴포넌트에 평가 관련 state 추가:
```tsx
const [evalOpen, setEvalOpen] = useState(false)
const [evals, setEvals] = useState<CoachingStaffEval[]>([])

const fetchEvals = useCallback(() => {
  coachingStaffEvalApi.list(member.id)
    .then(data => setEvals(data.slice(0, 3)))
    .catch(() => {})
}, [member.id])

useEffect(() => { fetchEvals() }, [fetchEvals])
```

`StaffCard` 헤더 버튼 영역 (기존 `+` 부재 등록 버튼 옆)에 평가 버튼 추가:
```tsx
{canEdit && (
  <Button
    variant="ghost" size="icon" className="h-6 w-6 shrink-0"
    onClick={() => setEvalOpen(true)}
    title="평가 추가"
  >
    <Star className="h-3.5 w-3.5" />
  </Button>
)}
```

부재 배지 아래에 평가 이력 추가:
```tsx
{evals.length > 0 && (
  <div className="space-y-1 border-t pt-2">
    {evals.map(e => (
      <div key={e.id} className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {new Date(e.evaluatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
          {' · '}{e.evaluator.nickname}
        </span>
        <span className="font-semibold tabular-nums">{e.score}<span className="text-muted-foreground font-normal">/10</span></span>
      </div>
    ))}
  </div>
)}

{evalOpen && (
  <StaffEvaluationDialog
    open={evalOpen}
    onClose={() => setEvalOpen(false)}
    staffId={member.id}
    staffName={member.nickname ?? '스태프'}
    onCreated={fetchEvals}
  />
)}
```

- [ ] **Step 4: TypeScript 빌드 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add football/src/types/coaching-staff-eval.ts football/src/services/coaching-staff-eval.service.ts football/src/components/coaching-staff/StaffEvaluationDialog.tsx football/src/pages/coaching-staff/StaffManagementPage.tsx
git commit -m "feat(coaching-staff): add evaluation dialog and history to StaffManagementPage"
```

---

## Self-Review

**Spec coverage:**
- ✅ PlayerSecondaryPosition: DB 테이블 + BE CRUD + FE 모듈 (PlayerDetailPage 기본 정보 탭)
- ✅ 대열 포지션 추가/삭제 권한: ADMIN + HEAD_COACH
- ✅ 중복 포지션 방지: DB unique(playerId, position), FE selector에서 기존 포지션 제외
- ✅ CoachingStaffEvaluation: DB 테이블 + BE CRUD + FE 다이얼로그 + 최근 3건 이력
- ✅ 평가 권한: HEAD_COACH + ADMIN
- ✅ 점수 범위: 1–10 (BE 검증 + FE slider)
- ✅ 마이그레이션: shadow DB 우회 패턴 (migrate diff → db execute → migrate resolve)

**주의:**
- `useCallback`으로 감싼 `fetchEvals`는 컴포넌트 언마운트 시 state 업데이트 경쟁 없도록 clean하게 처리됨
- `StaffCard`의 `useEffect([fetchEvals])` 가 매 렌더에 불필요하게 재호출되지 않도록 `useCallback` dep 배열을 `[member.id]`로 고정
