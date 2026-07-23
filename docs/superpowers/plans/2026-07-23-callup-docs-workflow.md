# 유소년 콜업 서류 확인 워크플로우 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유소년 콜업 워크플로우에 유소년 감독 + 의무팀 서류 확인 단계를 추가한다.

**Architecture:** 기존 `REQUESTED → APPROVED` 흐름 사이에 `DOCS_SUBMITTED` 상태를 삽입. `PlayerCallup`에 `youthCoachConfirmed`/`medicalConfirmed` boolean 필드를 추가하고 양쪽이 모두 true가 되면 자동으로 `DOCS_SUBMITTED`로 전환 + GM/TD 알림. 새 엔드포인트 2개(`confirm-youth`, `confirm-medical`)를 추가하고 기존 `approve` 체크 조건을 `DOCS_SUBMITTED`로 변경.

**Tech Stack:** Prisma (PostgreSQL), Hono/Express, React + shadcn/ui, TypeScript

---

## 파일 맵

| 파일 | 변경 유형 |
|------|-----------|
| `apps/api/prisma/schema.prisma` | 수정 |
| `apps/api/prisma/migrations/20260723000001_callup_docs_workflow/migration.sql` | 신규 |
| `apps/api/src/notification/notification.repo.ts` | 수정 (헬퍼 2개 추가) |
| `apps/api/src/player-callup/player-callup.repo.ts` | 수정 (SELECT 확장, 메서드 3개 추가) |
| `apps/api/src/player-callup/player-callup.service.ts` | 수정 (create/approve 변경, 메서드 2개 추가) |
| `apps/api/src/player-callup/player-callup.controller.ts` | 수정 (핸들러 2개 추가) |
| `apps/api/src/player-callup/player-callup.routes.ts` | 수정 (라우트 2개 추가) |
| `apps/api/src/auth/auth.repo.ts` | 수정 (teamId SELECT 추가) |
| `apps/api/__test__/player-callup/player-callup.service.test.ts` | 수정 |
| `football/src/types/auth.ts` | 수정 (UserDto에 teamId) |
| `football/src/types/player-callup.ts` | 수정 |
| `football/src/services/player-callup.service.ts` | 수정 |
| `football/src/pages/transfers/PlayerCallupPage.tsx` | 수정 |

---

## Task 1: Schema 변경 및 Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260723000001_callup_docs_workflow/migration.sql`

- [ ] **Step 1: schema.prisma — PlayerCallupStatus에 DOCS_SUBMITTED 추가**

`enum PlayerCallupStatus` 블록을 찾아 아래처럼 수정:

```prisma
enum PlayerCallupStatus {
  REQUESTED
  DOCS_SUBMITTED
  APPROVED
  REJECTED
  COMPLETED
}
```

- [ ] **Step 2: schema.prisma — NotificationType에 CALLUP_DOCS_READY 추가**

`enum NotificationType` 블록 안 `CALLUP_REJECTED` 바로 아래에 추가:

```prisma
  CALLUP_DOCS_READY
```

- [ ] **Step 3: schema.prisma — PlayerCallup 모델에 boolean 필드 추가**

`model PlayerCallup` 안 `status` 필드 바로 아래에 추가:

```prisma
  youthCoachConfirmed Boolean            @default(false)
  medicalConfirmed    Boolean            @default(false)
```

- [ ] **Step 4: Migration 파일 작성**

`apps/api/prisma/migrations/20260723000001_callup_docs_workflow/migration.sql` 파일 생성:

```sql
-- AlterEnum: PlayerCallupStatus에 DOCS_SUBMITTED 추가
ALTER TYPE "PlayerCallupStatus" ADD VALUE 'DOCS_SUBMITTED';

-- AlterEnum: NotificationType에 CALLUP_DOCS_READY 추가
ALTER TYPE "NotificationType" ADD VALUE 'CALLUP_DOCS_READY';

-- AlterTable: PlayerCallup에 boolean 필드 추가
ALTER TABLE "PlayerCallup" ADD COLUMN "youthCoachConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlayerCallup" ADD COLUMN "medicalConfirmed" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 5: Migration 적용 및 클라이언트 재생성**

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

Expected: `Applied 1 migration`, 에러 없음.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260723000001_callup_docs_workflow/
git commit -m "feat(callup): schema — DOCS_SUBMITTED 상태 및 서류 확인 필드 추가"
```

---

## Task 2: Notification 헬퍼 추가

**Files:**
- Modify: `apps/api/src/notification/notification.repo.ts`

- [ ] **Step 1: createForYouthHeadCoach 헬퍼 추가**

`createForHeadCoach` 메서드 아래에 추가:

```typescript
createForYouthHeadCoach(fromTeamId: number, type: string, title: string, body: string, entityId?: number) {
  return this.prisma.$transaction(async (tx) => {
    const coaches = await tx.user.findMany({
      where: { role: "COACHING_STAFF", coachingRole: "HEAD_COACH", teamId: fromTeamId },
      select: { id: true },
    });
    if (coaches.length === 0) return;
    await tx.notification.createMany({
      data: coaches.map((u) => ({ userId: u.id, type, title, body, entityId })) as any,
    });
  });
}
```

- [ ] **Step 2: createForMedicalStaff 헬퍼 추가**

`createForYouthHeadCoach` 아래에 추가:

```typescript
createForMedicalStaff(type: string, title: string, body: string, entityId?: number) {
  return this.prisma.$transaction(async (tx) => {
    const medics = await tx.user.findMany({
      where: { role: "COACHING_STAFF", coachingRole: "MEDICAL" },
      select: { id: true },
    });
    if (medics.length === 0) return;
    await tx.notification.createMany({
      data: medics.map((u) => ({ userId: u.id, type, title, body, entityId })) as any,
    });
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/notification/notification.repo.ts
git commit -m "feat(callup): notification repo — 유소년 감독/의무팀 알림 헬퍼 추가"
```

---

## Task 3: PlayerCallup Repository 확장

**Files:**
- Modify: `apps/api/src/player-callup/player-callup.repo.ts`

- [ ] **Step 1: SELECT에 새 필드 추가**

파일 상단 `const SELECT` 객체에 `youthCoachConfirmed`와 `medicalConfirmed` 추가:

```typescript
const SELECT = {
  id: true,
  status: true,
  reason: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  youthCoachConfirmed: true,
  medicalConfirmed: true,
  player: { select: { id: true, playerName: true, position: true, guardianId: true } },
  fromTeam: { select: { id: true, name: true } },
  toTeam: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, nickname: true } },
  approvedBy: { select: { id: true, nickname: true } },
} as const;
```

- [ ] **Step 2: confirmYouth 메서드 추가**

`complete` 메서드 아래에 추가:

```typescript
confirmYouth(id: number) {
  return this.prisma.playerCallup.update({
    where: { id },
    data: { youthCoachConfirmed: true },
    select: SELECT,
  });
}
```

- [ ] **Step 3: confirmMedical 메서드 추가**

`confirmYouth` 아래에 추가:

```typescript
confirmMedical(id: number) {
  return this.prisma.playerCallup.update({
    where: { id },
    data: { medicalConfirmed: true },
    select: SELECT,
  });
}
```

- [ ] **Step 4: submitDocs 메서드 추가**

`confirmMedical` 아래에 추가:

```typescript
submitDocs(id: number) {
  return this.prisma.playerCallup.update({
    where: { id },
    data: { status: "DOCS_SUBMITTED" },
    select: SELECT,
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/player-callup/player-callup.repo.ts
git commit -m "feat(callup): repo — SELECT 확장, confirmYouth/Medical/submitDocs 추가"
```

---

## Task 4: PlayerCallup Service 변경

**Files:**
- Modify: `apps/api/src/player-callup/player-callup.service.ts`

- [ ] **Step 1: create() — 알림 수신자 변경**

기존 `create()` 메서드의 `void this.notifRepo.createForGM(...)` 호출을 제거하고 아래로 교체:

```typescript
async create(dto: CreateCallupDto, requestedById: number) {
  const callup = await this.repo.create({ ...dto, requestedById });

  void this.notifRepo
    .createForYouthHeadCoach(
      callup.fromTeam.id,
      "CALLUP_REQUESTED",
      "유소년 콜업 서류 요청",
      `${callup.player.playerName} 선수의 1군 콜업 서류 확인이 필요합니다.`,
      callup.id,
    )
    .catch(console.error);

  void this.notifRepo
    .createForMedicalStaff(
      "CALLUP_REQUESTED",
      "유소년 콜업 서류 요청",
      `${callup.player.playerName} 선수의 1군 콜업 의무 서류 확인이 필요합니다.`,
      callup.id,
    )
    .catch(console.error);

  const guardianId = callup.player.guardianId;
  if (guardianId) {
    void this.notifRepo
      .createForGuardian(
        guardianId,
        "CALLUP_REQUESTED",
        "1군 콜업 요청",
        `${callup.player.playerName} 선수에게 1군 콜업 요청이 들어왔습니다.`,
        callup.id,
      )
      .catch(console.error);
  }

  return callup;
}
```

- [ ] **Step 2: approve() — 상태 체크 조건 변경**

`approve()` 메서드 안의 체크를 변경:

```typescript
async approve(id: number, approvedById: number) {
  const callup = await this.repo.findById(id);
  if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
  if (callup.status !== "DOCS_SUBMITTED") throw new AppError(409, "INVALID_STATUS");

  const updated = await this.repo.approve(id, approvedById);
  await this.repo.updatePlayerTeam(callup.player.id, callup.toTeam.id);
  await writeAuditLog({ actorId: approvedById, action: "CALLUP_APPROVED", targetId: id });

  void this.notifRepo
    .createForUser(
      callup.requestedBy.id,
      "CALLUP_APPROVED",
      "콜업 승인",
      `${callup.player.playerName} 선수의 1군 콜업이 승인됐습니다.`,
      id,
    )
    .catch(console.error);

  return updated;
}
```

Note: 기존 `createForHeadCoach` 대신 `createForUser(callup.requestedBy.id, ...)` — 신청자 본인에게만 알림.

- [ ] **Step 3: reject() — 상태 체크 조건 변경**

`reject()` 메서드 안의 체크를 변경:

```typescript
async reject(id: number, approvedById: number, dto: RejectCallupDto) {
  const callup = await this.repo.findById(id);
  if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
  if (callup.status !== "DOCS_SUBMITTED") throw new AppError(409, "INVALID_STATUS");
  if (!dto.reason?.trim()) throw new AppError(400, "REASON_REQUIRED");

  const updated = await this.repo.reject(id, approvedById, dto.reason);
  await writeAuditLog({ actorId: approvedById, action: "CALLUP_REJECTED", targetId: id });

  void this.notifRepo
    .createForUser(
      callup.requestedBy.id,
      "CALLUP_REJECTED",
      "콜업 거절",
      `${callup.player.playerName} 선수의 1군 콜업이 거절됐습니다. 사유: ${dto.reason}`,
      id,
    )
    .catch(console.error);

  return updated;
}
```

- [ ] **Step 4: confirmYouth() 메서드 추가**

`reject()` 아래에 추가:

```typescript
async confirmYouth(id: number, actorId: number, actorTeamId: number | null) {
  const callup = await this.repo.findById(id);
  if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
  if (callup.status !== "REQUESTED") throw new AppError(409, "INVALID_STATUS");
  if (actorTeamId !== callup.fromTeam.id) throw new AppError(403, "FORBIDDEN");

  const updated = await this.repo.confirmYouth(id);

  if (updated.medicalConfirmed) {
    const submitted = await this.repo.submitDocs(id);
    void this.notifRepo.createForGM("CALLUP_DOCS_READY", "콜업 서류 완료", `${callup.player.playerName} 선수 콜업 서류가 완료됐습니다. 최종 승인을 진행해주세요.`, id).catch(console.error);
    void this.notifRepo.createForTD("CALLUP_DOCS_READY", "콜업 서류 완료", `${callup.player.playerName} 선수 콜업 서류가 완료됐습니다.`, id).catch(console.error);
    return submitted;
  }

  return updated;
}
```

- [ ] **Step 5: confirmMedical() 메서드 추가**

`confirmYouth()` 아래에 추가:

```typescript
async confirmMedical(id: number, actorId: number) {
  const callup = await this.repo.findById(id);
  if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
  if (callup.status !== "REQUESTED") throw new AppError(409, "INVALID_STATUS");

  const updated = await this.repo.confirmMedical(id);

  if (updated.youthCoachConfirmed) {
    const submitted = await this.repo.submitDocs(id);
    void this.notifRepo.createForGM("CALLUP_DOCS_READY", "콜업 서류 완료", `${callup.player.playerName} 선수 콜업 서류가 완료됐습니다. 최종 승인을 진행해주세요.`, id).catch(console.error);
    void this.notifRepo.createForTD("CALLUP_DOCS_READY", "콜업 서류 완료", `${callup.player.playerName} 선수 콜업 서류가 완료됐습니다.`, id).catch(console.error);
    return submitted;
  }

  return updated;
}
```

- [ ] **Step 6: TypeScript 빌드 확인**

```bash
cd apps/api
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/player-callup/player-callup.service.ts
git commit -m "feat(callup): service — 서류 확인 흐름 구현, approve/reject 조건 변경"
```

---

## Task 5: Controller & Routes

**Files:**
- Modify: `apps/api/src/player-callup/player-callup.controller.ts`
- Modify: `apps/api/src/player-callup/player-callup.routes.ts`

- [ ] **Step 1: controller — confirmYouth 핸들러 추가**

`complete` 핸들러 아래에 추가:

```typescript
confirmYouth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, coachingRole, teamId } = req.user!;
    if (role !== "COACHING_STAFF" || coachingRole !== "HEAD_COACH") {
      throw new AppError(403, "FORBIDDEN");
    }
    res.json(await this.service.confirmYouth(Number(req.params["id"]), req.user!.id, teamId ?? null));
  } catch (err) { next(err); }
};
```

- [ ] **Step 2: controller — confirmMedical 핸들러 추가**

`confirmYouth` 핸들러 아래에 추가:

```typescript
confirmMedical = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, coachingRole } = req.user!;
    if (role !== "COACHING_STAFF" || coachingRole !== "MEDICAL") {
      throw new AppError(403, "FORBIDDEN");
    }
    res.json(await this.service.confirmMedical(Number(req.params["id"]), req.user!.id));
  } catch (err) { next(err); }
};
```

- [ ] **Step 3: routes — 새 라우트 등록**

`router.patch("/:id/complete", ...)` 아래에 추가:

```typescript
router.patch("/:id/confirm-youth", auth, controller.confirmYouth);
router.patch("/:id/confirm-medical", auth, controller.confirmMedical);
```

- [ ] **Step 4: TypeScript 빌드 확인**

```bash
cd apps/api
npx tsc --noEmit
```

Expected: 에러 없음. `req.user!.teamId` 관련 타입 오류가 나면 Task 6에서 해결됨.

Note: `req.user`의 타입에 `teamId`가 없을 경우 `apps/api/src/@types/express/index.d.ts` 또는 passport strategy 파일에서 User 타입 확인 후 `teamId?: number | null` 추가.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/player-callup/player-callup.controller.ts apps/api/src/player-callup/player-callup.routes.ts
git commit -m "feat(callup): controller/routes — confirm-youth, confirm-medical 엔드포인트 추가"
```

---

## Task 6: req.user 타입 확장 및 Auth repo 수정

**Files:**
- Modify: `apps/api/src/auth/auth.repo.ts`

- [ ] **Step 1: auth.repo.ts — findById SELECT에 teamId 추가**

line 38 근처 `findById` 메서드의 select 객체에 `teamId: true` 추가:

```typescript
findById(id: number) {
  return this.prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      nickname: true,
      role: true,
      coachingRole: true,
      frontOfficeRole: true,
      teamId: true,
    },
  });
}
```

- [ ] **Step 2: req.user 타입에 teamId 추가**

`apps/api/src/@types/express/index.d.ts` 파일(없으면 해당 경로에 생성) 또는 passport strategy가 `User` 타입을 선언하는 곳을 찾아 `teamId?: number | null` 추가.

파일 위치 확인:
```bash
find apps/api/src -name "*.d.ts" | head -10
grep -rn "declare global\|Express.User\|req.user" apps/api/src --include="*.ts" | grep -v generated | head -10
```

찾은 파일에서 `User` 인터페이스에 `teamId?: number | null` 추가.

- [ ] **Step 3: TypeScript 빌드 확인**

```bash
cd apps/api
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth/auth.repo.ts
git commit -m "feat(callup): auth repo — /me에 teamId 포함"
```

---

## Task 7: 기존 테스트 업데이트

**Files:**
- Modify: `apps/api/__test__/player-callup/player-callup.service.test.ts`

- [ ] **Step 1: 기존 'approve 처리' 테스트 수정**

현재 테스트는 `REQUESTED` 상태에서 바로 `approve`를 호출하는데, 이제 `DOCS_SUBMITTED` 상태여야 한다. 아래처럼 수정:

```typescript
it('유소년감독 확인', async () => {
  const r = await repo().confirmYouth(callupId);
  expect(r.youthCoachConfirmed).toBe(true);
  expect(r.status).toBe('REQUESTED'); // medicalConfirmed 아직 false
});

it('의무팀 확인 → DOCS_SUBMITTED 자동 전환', async () => {
  const r = await repo().confirmMedical(callupId);
  expect(r.medicalConfirmed).toBe(true);
  // 양측 확인 완료 → submitDocs 호출은 service 레이어 책임
  // repo 단위 테스트에서는 boolean만 확인
});

it('submitDocs → DOCS_SUBMITTED 상태 전환', async () => {
  const r = await repo().submitDocs(callupId);
  expect(r.status).toBe('DOCS_SUBMITTED');
});

it('승인 처리 (DOCS_SUBMITTED → APPROVED)', async () => {
  const r = await repo().approve(callupId, gmUserId);
  expect(r.status).toBe('APPROVED');
});
```

- [ ] **Step 2: 테스트 실행**

```bash
cd apps/api
npx jest __test__/player-callup --runInBand
```

Expected: 전체 PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/__test__/player-callup/player-callup.service.test.ts
git commit -m "test(callup): 서류 확인 흐름 테스트 업데이트"
```

---

## Task 8: FE 타입 & 서비스 업데이트

**Files:**
- Modify: `football/src/types/auth.ts`
- Modify: `football/src/types/player-callup.ts`
- Modify: `football/src/services/player-callup.service.ts`

- [ ] **Step 1: UserDto에 teamId 추가**

`football/src/types/auth.ts`의 `UserDto` 인터페이스에 추가:

```typescript
export interface UserDto {
  id: number
  email: string
  username: string
  nickname: string
  role: Role
  coachingRole: CoachingRole | null
  frontOfficeRole: FrontOfficeRole | null
  isOutOfOffice: boolean
  teamId: number | null
}
```

- [ ] **Step 2: PlayerCallupStatus에 DOCS_SUBMITTED 추가**

`football/src/types/player-callup.ts` 전체 교체:

```typescript
export type PlayerCallupStatus = 'REQUESTED' | 'DOCS_SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED'

export const CALLUP_STATUS_LABEL: Record<PlayerCallupStatus, string> = {
  REQUESTED: '서류 수집 중',
  DOCS_SUBMITTED: '승인 대기',
  APPROVED: '승인',
  REJECTED: '거절',
  COMPLETED: '완료',
}

export const CALLUP_STATUS_STYLE: Record<PlayerCallupStatus, string> = {
  REQUESTED: 'border-yellow-300 text-yellow-700 bg-yellow-50',
  DOCS_SUBMITTED: 'border-blue-300 text-blue-700 bg-blue-50',
  APPROVED: 'border-green-300 text-green-700 bg-green-50',
  REJECTED: 'border-red-300 text-red-700 bg-red-50',
  COMPLETED: 'border-gray-300 text-gray-600 bg-gray-50',
}

export interface PlayerCallup {
  id: number
  status: PlayerCallupStatus
  reason: string
  startDate: string
  endDate: string | null
  createdAt: string
  youthCoachConfirmed: boolean
  medicalConfirmed: boolean
  player: { id: string; playerName: string; position: string }
  fromTeam: { id: number; name: string }
  toTeam: { id: number; name: string }
  requestedBy: { id: number; nickname: string }
  approvedBy: { id: number; nickname: string } | null
}

export interface CreateCallupDto {
  playerId: string
  fromTeamId: number
  toTeamId: number
  reason: string
  startDate: string
  endDate?: string
}
```

- [ ] **Step 3: callupApi에 confirmYouth/confirmMedical 추가**

`football/src/services/player-callup.service.ts`에 추가:

```typescript
confirmYouth: (id: number) =>
  api.patch<PlayerCallup>(`/player-callups/${id}/confirm-youth`, {}),

confirmMedical: (id: number) =>
  api.patch<PlayerCallup>(`/player-callups/${id}/confirm-medical`, {}),
```

- [ ] **Step 4: TypeScript 빌드 확인**

```bash
cd football
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add football/src/types/auth.ts football/src/types/player-callup.ts football/src/services/player-callup.service.ts
git commit -m "feat(callup): FE 타입/서비스 — DOCS_SUBMITTED, confirmYouth/Medical 추가"
```

---

## Task 9: PlayerCallupPage UI 업데이트

**Files:**
- Modify: `football/src/pages/transfers/PlayerCallupPage.tsx`

- [ ] **Step 1: STATUS_OPTIONS에 DOCS_SUBMITTED 추가**

```typescript
const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'REQUESTED', label: '서류 수집 중' },
  { value: 'DOCS_SUBMITTED', label: '승인 대기' },
  { value: 'APPROVED', label: '승인' },
  { value: 'REJECTED', label: '거절' },
  { value: 'COMPLETED', label: '완료' },
]
```

- [ ] **Step 2: isMedical 변수 추가**

`PlayerCallupPage` 컴포넌트 안 `isHeadCoach`/`isGM` 선언 아래에 추가:

```typescript
const isMedical = user?.coachingRole === 'MEDICAL'
const isYouthHeadCoach = user?.coachingRole === 'HEAD_COACH'
```

- [ ] **Step 3: handleConfirmYouth / handleConfirmMedical 핸들러 추가**

`handleComplete` 아래에 추가:

```typescript
const handleConfirmYouth = async (id: number) => {
  try {
    await callupApi.confirmYouth(id)
    toast.success('유소년 감독 확인 완료.')
    fetchCallups()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : '확인에 실패했습니다.')
  }
}

const handleConfirmMedical = async (id: number) => {
  try {
    await callupApi.confirmMedical(id)
    toast.success('의무팀 확인 완료.')
    fetchCallups()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : '확인에 실패했습니다.')
  }
}
```

- [ ] **Step 4: showActions 조건 확장**

```typescript
const showActions = isGM || isHeadCoach || isMedical
```

- [ ] **Step 5: 테이블 액션 컬럼 업데이트**

기존 `{showActions && (...)}` 블록의 내용을 아래로 교체:

```tsx
{showActions && (
  <TableCell>
    <div className="flex flex-col gap-1">
      {/* 서류 확인 현황 (REQUESTED 상태에서만 표시) */}
      {c.status === 'REQUESTED' && (
        <div className="flex gap-1 text-xs text-muted-foreground mb-1">
          <span className={c.youthCoachConfirmed ? 'text-green-600' : 'text-gray-400'}>
            {c.youthCoachConfirmed ? '✓ 감독' : '○ 감독'}
          </span>
          <span className={c.medicalConfirmed ? 'text-green-600' : 'text-gray-400'}>
            {c.medicalConfirmed ? '✓ 의무' : '○ 의무'}
          </span>
        </div>
      )}
      <div className="flex gap-1.5">
        {/* 유소년 감독 확인 버튼 */}
        {isYouthHeadCoach && c.status === 'REQUESTED' && user?.teamId === c.fromTeam.id && (
          <Button
            size="sm" variant="outline" className="h-7 text-xs"
            disabled={c.youthCoachConfirmed}
            onClick={() => handleConfirmYouth(c.id)}
          >
            {c.youthCoachConfirmed ? '감독 확인됨' : '감독 확인'}
          </Button>
        )}
        {/* 의무팀 확인 버튼 */}
        {isMedical && c.status === 'REQUESTED' && (
          <Button
            size="sm" variant="outline" className="h-7 text-xs"
            disabled={c.medicalConfirmed}
            onClick={() => handleConfirmMedical(c.id)}
          >
            {c.medicalConfirmed ? '의무 확인됨' : '의무 확인'}
          </Button>
        )}
        {/* GM 승인/거절 버튼 (DOCS_SUBMITTED 상태에서만) */}
        {isGM && c.status === 'DOCS_SUBMITTED' && (
          <>
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => handleApprove(c.id)}>
              승인
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600"
              onClick={() => setRejectId(c.id)}>
              거절
            </Button>
          </>
        )}
        {/* 완료 버튼 */}
        {(isGM || isHeadCoach) && c.status === 'APPROVED' && (
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => handleComplete(c.id)}>
            완료
          </Button>
        )}
      </div>
    </div>
  </TableCell>
)}
```

- [ ] **Step 6: TypeScript 빌드 확인**

```bash
cd football
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 7: Commit**

```bash
git add football/src/pages/transfers/PlayerCallupPage.tsx
git commit -m "feat(callup): UI — 서류 확인 현황 표시 및 감독/의무팀 확인 버튼 추가"
```
