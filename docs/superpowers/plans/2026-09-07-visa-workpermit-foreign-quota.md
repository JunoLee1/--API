# 비자·노동허가·외국인 쿼터 관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 외국인 선수 서명 시 K리그 등록 쿼터 초과 차단, 비자 불확실 시 CONTRACT_PENDING 진입 차단, 서명 후 노동허가 상태 업데이트 기능을 추가한다.

**Architecture:** 기존 `ProspectService.sign()` / `recordMedicalResult()` / `updateStatus()` 에 게이트를 삽입하고, Player 모듈에 `PATCH /players/:id/work-permit` 엔드포인트를 신규 추가한다. 쿼터 규정은 `LeagueLevel` enum 기준 상수로 하드코딩한다.

**Tech Stack:** Express + Prisma (TypeScript) + React/Vite (FE)

---

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `apps/api/src/lib/foreign-quota.ts` | 신규 — 쿼터 상수 + helper |
| `apps/api/src/prospect/prospect.repo.ts` | `getForeignPlayerCount()` 추가 |
| `apps/api/src/prospect/prospect.service.ts` | `sign()` 쿼터 체크, `recordMedicalResult()` + `updateStatus()` 비자 게이트 |
| `apps/api/src/prospect/prospect.service.test.ts` | 신규 테스트 3개 |
| `apps/api/src/player/player.repo.ts` | `updateWorkPermit()` + `findById` select에 workPermit 필드 추가 |
| `apps/api/src/player/player.service.ts` | `updateWorkPermit()` 추가 |
| `apps/api/src/player/player.controller.ts` | `updateWorkPermit` 핸들러 추가 |
| `apps/api/src/player/player.routes.ts` | `PATCH /:id/work-permit` 라우트 등록 |
| `football/src/types/player.ts` | `PlayerDetail`에 `workPermitStatus`, `workPermitExpiry` 추가 |
| `football/src/services/player.service.ts` | `updateWorkPermit()` API 호출 추가 |
| `football/src/pages/players/PlayerDetailPage.tsx` | Work Permit 카드 + 업데이트 UI |
| `football/src/pages/prospects/ProspectDetailSheet.tsx` | `VISA_ELIGIBILITY_UNCERTAIN` 에러 토스트 처리 |

---

## Task 1: 외국인 쿼터 상수 파일 생성

**Files:**
- Create: `apps/api/src/lib/foreign-quota.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// apps/api/src/lib/foreign-quota.ts
import { LeagueLevel } from "../generated/enums";

export const FOREIGN_QUOTA: Partial<Record<LeagueLevel, number>> = {
  [LeagueLevel.K_LEAGUE_1]: 5,
  [LeagueLevel.K_LEAGUE_2]: 4,
};

export function getForeignQuota(leagueLevel: LeagueLevel | null | undefined): number {
  if (!leagueLevel) return Infinity;
  return FOREIGN_QUOTA[leagueLevel] ?? Infinity;
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/api/src/lib/foreign-quota.ts
git commit -m "feat: 외국인 선수 쿼터 상수 파일 추가"
```

---

## Task 2: Prospect Repo — `getForeignPlayerCount()` 추가

**Files:**
- Modify: `apps/api/src/prospect/prospect.repo.ts`

현재 repo에는 외국인 선수 수 조회 메서드가 없음. 활성 시즌 리그 레벨 + 현재 외국인 선수 수를 한 번에 반환하는 메서드를 추가한다.

- [ ] **Step 1: 메서드 추가** — `export class ProspectRepository` 내 기존 메서드들 아래에 추가

```typescript
async getForeignPlayerCount(): Promise<{ leagueLevel: import('../generated/enums').LeagueLevel | null; count: number }> {
  const [season, count] = await Promise.all([
    this.prisma.season.findFirst({ where: { status: 'ACTIVE' }, select: { leagueLevel: true } }),
    this.prisma.player.count({
      where: {
        status: 'ACTIVE',
        workPermitStatus: { not: 'NOT_REQUIRED' },
      },
    }),
  ]);
  return { leagueLevel: season?.leagueLevel ?? null, count };
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/api/src/prospect/prospect.repo.ts
git commit -m "feat(prospect): 외국인 선수 수 조회 메서드 추가"
```

---

## Task 3: Prospect Service — 서명 시 쿼터 게이트

**Files:**
- Modify: `apps/api/src/prospect/prospect.service.ts`
- Modify: `apps/api/src/prospect/prospect.service.test.ts`

- [ ] **Step 1: foreign-quota import 추가** — 파일 상단 import에 추가

```typescript
import { getForeignQuota } from "../lib/foreign-quota";
```

- [ ] **Step 2: `sign()` 메서드 수정** — 기존 `sign()` 전체를 아래로 교체

```typescript
async sign(id: number, dto: SignProspectDto) {
  if (dto.workPermitStatus && dto.workPermitStatus !== 'NOT_REQUIRED') {
    const { leagueLevel, count } = await this.repo.getForeignPlayerCount();
    const limit = getForeignQuota(leagueLevel);
    if (count >= limit) throw new AppError(409, 'FOREIGN_QUOTA_EXCEEDED');
  }
  const result = await this.repo.sign(id, dto);
  void notificationService.notifyProspectSigned(result.name).catch(console.error);
  return result;
}
```

- [ ] **Step 3: 테스트 작성** — `prospect.service.test.ts`에 describe 블록 추가

```typescript
describe('ProspectService.sign — 외국인 쿼터', () => {
  it('workPermitStatus가 NOT_REQUIRED이면 쿼터 체크 없이 통과', async () => {
    const repo = makeRepo({ sign: jest.fn().mockResolvedValue({ name: '홍길동' }) });
    const service = new ProspectService(repo);
    await service.sign(1, { workPermitStatus: 'NOT_REQUIRED' } as any);
    expect(repo.getForeignPlayerCount).not.toHaveBeenCalled();
  });

  it('K리그1 쿼터 5명 초과 시 FOREIGN_QUOTA_EXCEEDED 409', async () => {
    const repo = makeRepo({
      getForeignPlayerCount: jest.fn().mockResolvedValue({ leagueLevel: 'K_LEAGUE_1', count: 5 }),
    });
    const service = new ProspectService(repo);
    await expect(
      service.sign(1, { workPermitStatus: 'PENDING' } as any)
    ).rejects.toMatchObject({ statusCode: 409, message: 'FOREIGN_QUOTA_EXCEEDED' });
  });

  it('K리그1 쿼터 4명이면 통과', async () => {
    const repo = makeRepo({
      getForeignPlayerCount: jest.fn().mockResolvedValue({ leagueLevel: 'K_LEAGUE_1', count: 4 }),
      sign: jest.fn().mockResolvedValue({ name: '외국인' }),
    });
    const service = new ProspectService(repo);
    await expect(service.sign(1, { workPermitStatus: 'PENDING' } as any)).resolves.toBeDefined();
  });
});
```

`makeRepo`에 `getForeignPlayerCount: jest.fn()` 추가:

```typescript
const makeRepo = (overrides: Partial<ProspectRepository> = {}): ProspectRepository => ({
  // 기존 목 메서드들...
  getForeignPlayerCount: jest.fn().mockResolvedValue({ leagueLevel: 'K_LEAGUE_1', count: 0 }),
  ...overrides,
} as unknown as ProspectRepository);
```

- [ ] **Step 4: 테스트 실행**

```bash
cd apps/api && npx jest prospect.service.test.ts --testNamePattern="쿼터" --no-coverage
```

Expected: 3 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/prospect/prospect.service.ts apps/api/src/prospect/prospect.service.test.ts
git commit -m "feat(prospect): 서명 시 외국인 쿼터 초과 차단"
```

---

## Task 4: Prospect Service — 비자 게이트 (CONTRACT_PENDING 차단)

**Files:**
- Modify: `apps/api/src/prospect/prospect.service.ts`
- Modify: `apps/api/src/prospect/prospect.service.test.ts`

CONTRACT_PENDING 진입 경로가 두 곳:
1. `recordMedicalResult(pass)` — 주 경로
2. `updateStatus({ status: 'CONTRACT_PENDING' })` — 직접 전환 경로

둘 다 게이트 추가.

- [ ] **Step 1: `recordMedicalResult()` 수정**

```typescript
async recordMedicalResult(id: number, dto: ProspectMedicalResultDto) {
  const prospect = await this.getById(id);
  if (prospect.status !== "MEDICAL_TEST") throw new AppError(409, "CANNOT_RECORD_MEDICAL_NON_PENDING");
  if (dto.result === 'pass' && prospect.visaRequired && prospect.visaEligibility === 'UNCERTAIN') {
    throw new AppError(400, 'VISA_ELIGIBILITY_UNCERTAIN');
  }
  return this.repo.recordMedicalResult(id, dto);
}
```

- [ ] **Step 2: `updateStatus()` 수정** — `SHORTLIST` 블록 아래에 추가

```typescript
if (dto.status === "CONTRACT_PENDING") {
  const prospect = await this.repo.findById(id);
  if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
  if (prospect.visaRequired && prospect.visaEligibility === 'UNCERTAIN') {
    throw new AppError(400, 'VISA_ELIGIBILITY_UNCERTAIN');
  }
}
```

- [ ] **Step 3: 테스트 추가**

```typescript
describe('ProspectService — 비자 게이트', () => {
  it('visaRequired=true + UNCERTAIN이면 recordMedicalResult(pass) 시 400', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue({
        id: 1, status: 'MEDICAL_TEST', visaRequired: true, visaEligibility: 'UNCERTAIN',
      }),
    }));
    await expect(service.recordMedicalResult(1, { result: 'pass' }))
      .rejects.toMatchObject({ statusCode: 400, message: 'VISA_ELIGIBILITY_UNCERTAIN' });
  });

  it('visaRequired=false이면 UNCERTAIN이어도 통과', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue({
        id: 1, status: 'MEDICAL_TEST', visaRequired: false, visaEligibility: 'UNCERTAIN',
      }),
      recordMedicalResult: jest.fn().mockResolvedValue({ id: 1, status: 'CONTRACT_PENDING' }),
    }));
    await expect(service.recordMedicalResult(1, { result: 'pass' })).resolves.toBeDefined();
  });

  it('updateStatus → CONTRACT_PENDING, UNCERTAIN이면 400', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue({
        id: 1, status: 'MEDICAL_TEST', visaRequired: true, visaEligibility: 'UNCERTAIN',
      }),
    }));
    await expect(service.updateStatus(1, { status: 'CONTRACT_PENDING' }))
      .rejects.toMatchObject({ statusCode: 400, message: 'VISA_ELIGIBILITY_UNCERTAIN' });
  });
});
```

- [ ] **Step 4: 테스트 실행**

```bash
cd apps/api && npx jest prospect.service.test.ts --testNamePattern="비자" --no-coverage
```

Expected: 3 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/prospect/prospect.service.ts apps/api/src/prospect/prospect.service.test.ts
git commit -m "feat(prospect): CONTRACT_PENDING 진입 시 비자 불확실 차단"
```

---

## Task 5: Player BE — Work Permit 업데이트 엔드포인트

**Files:**
- Modify: `apps/api/src/player/player.repo.ts`
- Modify: `apps/api/src/player/player.service.ts`
- Modify: `apps/api/src/player/player.controller.ts`
- Modify: `apps/api/src/player/player.routes.ts`

- [ ] **Step 1: `player.repo.ts` — `findById` select에 workPermit 필드 추가**

`findById` 메서드의 `select` 블록에 두 필드 추가 (line ~47, `...PLAYER_SELECT,` 아래):

```typescript
workPermitStatus: true,
workPermitExpiry: true,
```

- [ ] **Step 2: `player.repo.ts` — `updateWorkPermit()` 메서드 추가**

class 내 기존 메서드 아래에 추가:

```typescript
updateWorkPermit(id: string, data: { workPermitStatus: string; workPermitExpiry?: Date | null }) {
  return this.prisma.player.update({
    where: { id },
    data: {
      workPermitStatus: data.workPermitStatus as any,
      ...(data.workPermitExpiry !== undefined && { workPermitExpiry: data.workPermitExpiry }),
    },
    select: { id: true, workPermitStatus: true, workPermitExpiry: true },
  });
}
```

- [ ] **Step 3: `player.service.ts` — `updateWorkPermit()` 추가**

```typescript
async updateWorkPermit(id: string, dto: { workPermitStatus: string; workPermitExpiry?: string }) {
  const player = await this.repo.findById(id);
  if (!player) throw new AppError(404, 'PLAYER_NOT_FOUND');
  if (dto.workPermitStatus === 'NOT_REQUIRED') throw new AppError(400, 'CANNOT_SET_NOT_REQUIRED');
  if (dto.workPermitStatus === 'APPROVED' && !dto.workPermitExpiry) {
    throw new AppError(400, 'EXPIRY_DATE_REQUIRED');
  }
  return this.repo.updateWorkPermit(id, {
    workPermitStatus: dto.workPermitStatus,
    workPermitExpiry: dto.workPermitExpiry ? new Date(dto.workPermitExpiry) : undefined,
  });
}
```

- [ ] **Step 4: `player.controller.ts` — 핸들러 추가**

기존 핸들러들 아래에 추가:

```typescript
updateWorkPermit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, frontOfficeRole } = requireUser(req);
    const canUpdate =
      isAdminLike(role) ||
      role === 'GM' ||
      (role === 'FRONT_OFFICE' && (frontOfficeRole === 'TD' || frontOfficeRole === 'CONTRACT_MANAGER'));
    if (!canUpdate) throw new AppError(403, 'FORBIDDEN');
    res.json(await this.service.updateWorkPermit(req.params['id']!, req.body));
  } catch (err) { next(err); }
};
```

`player.controller.ts` 상단 import에 `isAdminLike` 이미 있는지 확인 후 없으면 추가:

```typescript
import { isAdminLike } from '../lib/permissions';
```

- [ ] **Step 5: `player.routes.ts` — 라우트 등록**

기존 라우트들 중 `PATCH /:id` 위에 추가 (더 구체적인 경로가 먼저):

```typescript
router.patch("/:id/work-permit", auth, controller.updateWorkPermit);
```

- [ ] **Step 6: API 수동 테스트**

```bash
# 서버 실행 후
curl -X PATCH http://localhost:3000/players/PLAYER_ID/work-permit \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workPermitStatus":"APPROVED","workPermitExpiry":"2027-09-01"}'
# 예상: { id, workPermitStatus: "APPROVED", workPermitExpiry: "2027-09-01T00:00:00.000Z" }
```

- [ ] **Step 7: 커밋**

```bash
git add apps/api/src/player/player.repo.ts apps/api/src/player/player.service.ts \
        apps/api/src/player/player.controller.ts apps/api/src/player/player.routes.ts
git commit -m "feat(player): 노동허가 상태 업데이트 엔드포인트 추가"
```

---

## Task 6: FE 타입 + API 서비스

**Files:**
- Modify: `football/src/types/player.ts`
- Modify: `football/src/services/player.service.ts`

- [ ] **Step 1: `types/player.ts` — `WorkPermitStatus` 타입 추가 + `PlayerDetail` 확장**

파일 상단 타입 정의 영역에 추가:

```typescript
export type WorkPermitStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED'

export const WORK_PERMIT_LABEL: Record<WorkPermitStatus, string> = {
  NOT_REQUIRED: '해당없음',
  PENDING: '진행중',
  APPROVED: '취득완료',
  REJECTED: '거절',
}

export const WORK_PERMIT_STYLE: Record<WorkPermitStatus, string> = {
  NOT_REQUIRED: 'text-muted-foreground',
  PENDING: 'text-yellow-600',
  APPROVED: 'text-green-600',
  REJECTED: 'text-red-600',
}
```

`PlayerDetail` interface에 두 필드 추가:

```typescript
export interface PlayerDetail extends Player {
  // 기존 필드들...
  workPermitStatus: WorkPermitStatus
  workPermitExpiry: string | null
}
```

- [ ] **Step 2: `services/player.service.ts` — `updateWorkPermit()` 추가**

기존 메서드들 아래에 추가:

```typescript
updateWorkPermit(
  playerId: string,
  dto: { workPermitStatus: string; workPermitExpiry?: string }
) {
  return api.patch(`/players/${playerId}/work-permit`, dto);
}
```

(`api`는 기존 axios 인스턴스 — 파일 상단 import 패턴 따를 것)

- [ ] **Step 3: 커밋**

```bash
git add football/src/types/player.ts football/src/services/player.service.ts
git commit -m "feat(fe): PlayerDetail workPermit 타입 + updateWorkPermit API 추가"
```

---

## Task 7: FE PlayerDetailPage — Work Permit 카드

**Files:**
- Modify: `football/src/pages/players/PlayerDetailPage.tsx`

`PlayerDetailPage`에 Work Permit 섹션 추가. 기존 선수 기본정보 카드 아래에 배치.

- [ ] **Step 1: state + import 추가**

파일 상단 import에 추가:

```typescript
import { WorkPermitStatus, WORK_PERMIT_LABEL, WORK_PERMIT_STYLE } from '@/types/player'
import { playerService } from '@/services/player.service'
```

컴포넌트 내 state 추가:

```typescript
const [wpStatus, setWpStatus] = useState<WorkPermitStatus>(player.workPermitStatus)
const [wpExpiry, setWpExpiry] = useState(player.workPermitExpiry ?? '')
const [wpSaving, setWpSaving] = useState(false)
```

- [ ] **Step 2: canUpdateWorkPermit 권한 계산**

컴포넌트 내 기존 권한 변수들 근처에 추가:

```typescript
const canUpdateWorkPermit =
  user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'GM' ||
  (user?.role === 'FRONT_OFFICE' &&
    (user?.frontOfficeRole === 'TD' || user?.frontOfficeRole === 'CONTRACT_MANAGER'))
```

- [ ] **Step 3: handleWorkPermitSave 핸들러 추가**

```typescript
const handleWorkPermitSave = async () => {
  setWpSaving(true)
  try {
    await playerService.updateWorkPermit(player.id, {
      workPermitStatus: wpStatus,
      ...(wpExpiry && { workPermitExpiry: wpExpiry }),
    })
    toast.success('노동허가 상태가 업데이트되었습니다')
  } catch (e: any) {
    const code = e?.response?.data?.error
    if (code === 'EXPIRY_DATE_REQUIRED') toast.error('APPROVED 시 만료일이 필요합니다')
    else toast.error('저장에 실패했습니다')
  } finally {
    setWpSaving(false)
  }
}
```

- [ ] **Step 4: Work Permit 카드 JSX 추가**

기존 선수정보 섹션 JSX 아래 적절한 위치에 추가:

```tsx
{player.workPermitStatus !== 'NOT_REQUIRED' && (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">노동허가</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">현재 상태:</span>
        <span className={`text-sm font-medium ${WORK_PERMIT_STYLE[player.workPermitStatus]}`}>
          {WORK_PERMIT_LABEL[player.workPermitStatus]}
        </span>
        {player.workPermitExpiry && (
          <span className="text-xs text-muted-foreground ml-2">
            만료: {new Date(player.workPermitExpiry).toLocaleDateString('ko-KR')}
          </span>
        )}
      </div>
      {canUpdateWorkPermit && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex gap-2 items-center">
            <Select value={wpStatus} onValueChange={(v) => setWpStatus(v as WorkPermitStatus)}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['PENDING', 'APPROVED', 'REJECTED'] as WorkPermitStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{WORK_PERMIT_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {wpStatus === 'APPROVED' && (
              <Input
                type="date"
                value={wpExpiry}
                onChange={(e) => setWpExpiry(e.target.value)}
                className="w-36 h-8 text-sm"
              />
            )}
            <Button size="sm" className="h-8" onClick={handleWorkPermitSave} disabled={wpSaving}>
              {wpSaving ? '저장중...' : '저장'}
            </Button>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
)}
```

(`Card`, `CardHeader`, `CardTitle`, `CardContent`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Input`, `Button`은 기존 import 패턴 참고해 추가할 것)

- [ ] **Step 5: 커밋**

```bash
git add football/src/pages/players/PlayerDetailPage.tsx
git commit -m "feat(fe): PlayerDetailPage 노동허가 상태 카드 + 업데이트 UI 추가"
```

---

## Task 8: FE ProspectDetailSheet — 비자 에러 처리

**Files:**
- Modify: `football/src/pages/prospects/ProspectDetailSheet.tsx`

상태 전환 실패 시 `VISA_ELIGIBILITY_UNCERTAIN` 에러 코드를 알기 쉬운 메시지로 표시.

- [ ] **Step 1: 상태 전환 핸들러 찾기**

`ProspectDetailSheet.tsx` 내 상태 전환을 호출하는 `try/catch` 블록을 찾아 에러 처리 추가. 현재 패턴:

```typescript
} catch (e: any) {
  toast.error('저장에 실패했습니다')
}
```

아래로 교체:

```typescript
} catch (e: any) {
  const code = e?.response?.data?.error
  if (code === 'VISA_ELIGIBILITY_UNCERTAIN') {
    toast.error('비자 취득 가능성이 불확실합니다. visaEligibility를 CONFIRMED으로 변경 후 진행하세요.')
  } else if (code === 'VIDEO_EVAL_REQUIRED') {
    toast.error('쇼트리스트 진입 전 비디오 평가 PASS가 필요합니다.')
  } else if (code === 'SHORTLIST_FULL') {
    toast.error('쇼트리스트 정원(5명)이 초과되었습니다.')
  } else {
    toast.error('상태 변경에 실패했습니다')
  }
}
```

(이 패턴이 `handleStatusChange` 등 여러 곳에 중복된다면 helper 함수로 추출)

- [ ] **Step 2: 커밋**

```bash
git add football/src/pages/prospects/ProspectDetailSheet.tsx
git commit -m "feat(fe): Prospect 상태 전환 에러 메시지 구체화"
```

---

## 전체 테스트

- [ ] 서버 기동 후 Prospect 서명 → 외국인 쿼터 초과 시 `409 FOREIGN_QUOTA_EXCEEDED` 확인
- [ ] Medical pass → `visaEligibility=UNCERTAIN`이면 `400 VISA_ELIGIBILITY_UNCERTAIN` 확인
- [ ] `PATCH /players/:id/work-permit` — TD 계정으로 APPROVED + 만료일 업데이트 확인
- [ ] PlayerDetailPage — 외국인 선수(workPermitStatus≠NOT_REQUIRED)에게만 Work Permit 카드 노출 확인
