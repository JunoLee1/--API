# PRE_SHORTLIST 단계 도입 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 영입 후보 파이프라인에 `PRE_SHORTLIST`("적극 검토 중") 단계를 필수 경로로 삽입하고, SHORTLIST 정원(5명)을 BE에서 강제한다.

**Architecture:** Prisma enum에 `PRE_SHORTLIST` 추가 → BE Repo VALID_TRANSITIONS 업데이트 + `countByStatus` 메서드 → Service 게이트 로직(MUST_GO_THROUGH_PRE_SHORTLIST, SHORTLIST_FULL, VIDEO_EVAL_REQUIRED) + `/shortlist-capacity` 엔드포인트 → FE 타입·서비스·ProspectsPage 순으로 적용한다.

**Tech Stack:** Prisma (PostgreSQL), Express, TypeScript, React + Vite, shadcn/ui, Jest

---

### Task 1: Prisma 스키마 — PRE_SHORTLIST enum 추가 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (line ~547)

- [ ] **Step 1: schema.prisma 수정**

`ProspectStatus` enum에 `PRE_SHORTLIST`를 LONGLIST 바로 다음에 추가한다:

```prisma
enum ProspectStatus {
  LONGLIST
  PRE_SHORTLIST
  SHORTLIST
  ACTIVE
  MEDICAL_TEST
  CONTRACT_PENDING
  SIGNED
  ARCHIVED
}
```

- [ ] **Step 2: 마이그레이션 실행**

```bash
cd apps/api && npx prisma migrate dev --name add_pre_shortlist_status
```

Expected: `The following migration(s) have been applied: .../add_pre_shortlist_status.sql`

- [ ] **Step 3: 클라이언트 재생성 확인**

```bash
grep "PRE_SHORTLIST" apps/api/src/generated/enums.ts
```

Expected: `PRE_SHORTLIST: 'PRE_SHORTLIST',` 출력

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/migrations apps/api/prisma/schema.prisma apps/api/src/generated
git commit -m "feat: ProspectStatus enum에 PRE_SHORTLIST 추가"
```

---

### Task 2: BE Repo — VALID_TRANSITIONS 업데이트 + countByStatus 추가

**Files:**
- Modify: `apps/api/src/prospect/prospect.repo.ts` (lines 25–33, 끝 부분)

> **주의:** Prisma 재생성 후 `ProspectStatus`에 `PRE_SHORTLIST`가 포함되므로 `VALID_TRANSITIONS`의 `Record<ProspectStatus, ...>` 타입에 해당 키가 없으면 TypeScript 컴파일 에러가 발생한다. 이 Task에서 바로 수정한다.

- [ ] **Step 1: VALID_TRANSITIONS 업데이트**

`apps/api/src/prospect/prospect.repo.ts` 25–33번째 줄의 `VALID_TRANSITIONS`를 아래로 교체:

```ts
const VALID_TRANSITIONS: Record<ProspectStatus, ProspectStatus[]> = {
  LONGLIST:         ["PRE_SHORTLIST", "ARCHIVED"],
  PRE_SHORTLIST:    ["SHORTLIST", "ARCHIVED"],
  SHORTLIST:        ["ACTIVE", "ARCHIVED"],
  ACTIVE:           ["MEDICAL_TEST", "ARCHIVED"],
  MEDICAL_TEST:     ["CONTRACT_PENDING", "ARCHIVED"],
  CONTRACT_PENDING: ["ARCHIVED"],
  SIGNED:           [],
  ARCHIVED:         [],
};
```

- [ ] **Step 2: countByStatus 메서드 추가**

`ProspectRepository` 클래스 안, `checkAcquisitionGate` 바로 위에 추가:

```ts
countByStatus(status: ProspectStatus) {
  return this.prisma.prospect.count({ where: { status } });
}
```

- [ ] **Step 3: 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/prospect/prospect.repo.ts
git commit -m "feat: repo — PRE_SHORTLIST VALID_TRANSITIONS 추가, countByStatus 메서드"
```

---

### Task 3: BE Service 테스트 — 실패하는 테스트 먼저 작성 (TDD)

**Files:**
- Modify: `apps/api/src/prospect/prospect.service.test.ts`

> **배경:** 현재 `makeRepo`에는 `countByStatus`가 없고, 기존 SHORTLIST gate 테스트들은 `findById`를 mock하지 않는다. 이번 Task에서 기존 테스트를 수정하고 새 케이스를 추가한다. 구현은 Task 4에서 한다.

- [ ] **Step 1: makeRepo에 countByStatus 추가**

`makeRepo` 함수의 mock 객체에 `countByStatus` 추가 (기본값: 정원 미초과 상태):

```ts
const makeRepo = (overrides: Partial<ProspectRepository> = {}): ProspectRepository => ({
  checkDuplicate: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn().mockResolvedValue({ id: 1, status: 'SHORTLIST' }),
  sign: jest.fn(),
  recordMedicalResult: jest.fn(),
  addNegotiationLog: jest.fn(),
  getNegotiationLogs: jest.fn(),
  addVideoEvaluation: jest.fn(),
  getVideoEvaluations: jest.fn(),
  getLatestVideoEvaluation: jest.fn(),
  addEvaluationLog: jest.fn(),
  getEvaluationLogs: jest.fn(),
  checkAcquisitionGate: jest.fn(),
  countByStatus: jest.fn().mockResolvedValue(0),  // 추가: 기본값 0 (정원 미초과)
  ...overrides,
} as unknown as ProspectRepository);
```

- [ ] **Step 2: 기존 SHORTLIST gate 테스트에 findById mock 추가**

기존 `'ProspectService.updateStatus — SHORTLIST gate'` describe 블록의 모든 테스트에 `findById` mock을 추가한다. 각 테스트에서 `makeRepo(...)` 안에 아래를 추가:

```ts
findById: jest.fn().mockResolvedValue({ id: 1, status: 'PRE_SHORTLIST' }),
```

예시 — 첫 번째 테스트 전체:
```ts
it('최신 VideoEvaluation 없으면 VIDEO_EVAL_REQUIRED 400', async () => {
  const service = new ProspectService(makeRepo({
    findById: jest.fn().mockResolvedValue({ id: 1, status: 'PRE_SHORTLIST' }),
    getLatestVideoEvaluation: jest.fn().mockResolvedValue(null),
  }));
  await expect(service.updateStatus(1, { status: 'SHORTLIST' }))
    .rejects.toThrow(new AppError(400, 'VIDEO_EVAL_REQUIRED'));
});
```

나머지 3개도 동일하게 `findById` mock 추가.

- [ ] **Step 3: 새 테스트 케이스 추가 (SHORTLIST gate describe 안)**

기존 describe 블록 끝에 아래 3개 케이스 추가:

```ts
it('LONGLIST에서 SHORTLIST 직행 시 MUST_GO_THROUGH_PRE_SHORTLIST 400', async () => {
  const service = new ProspectService(makeRepo({
    findById: jest.fn().mockResolvedValue({ id: 1, status: 'LONGLIST' }),
  }));
  await expect(service.updateStatus(1, { status: 'SHORTLIST' }))
    .rejects.toThrow(new AppError(400, 'MUST_GO_THROUGH_PRE_SHORTLIST'));
});

it('SHORTLIST 정원 5명 초과 시 SHORTLIST_FULL 409', async () => {
  const service = new ProspectService(makeRepo({
    findById: jest.fn().mockResolvedValue({ id: 1, status: 'PRE_SHORTLIST' }),
    countByStatus: jest.fn().mockResolvedValue(5),
  }));
  await expect(service.updateStatus(1, { status: 'SHORTLIST' }))
    .rejects.toThrow(new AppError(409, 'SHORTLIST_FULL'));
});

it('PRE_SHORTLIST + 정원 미초과 + VIDEO_EVAL PASS면 repo.updateStatus 호출', async () => {
  const updateStatus = jest.fn().mockResolvedValue({ id: 1, status: 'SHORTLIST' });
  const service = new ProspectService(makeRepo({
    findById: jest.fn().mockResolvedValue({ id: 1, status: 'PRE_SHORTLIST' }),
    countByStatus: jest.fn().mockResolvedValue(4),
    getLatestVideoEvaluation: jest.fn().mockResolvedValue({ result: 'PASS' }),
    updateStatus,
  }));
  await service.updateStatus(1, { status: 'SHORTLIST' });
  expect(updateStatus).toHaveBeenCalledWith(1, 'SHORTLIST');
});
```

- [ ] **Step 4: 테스트 실행 — 실패 확인**

```bash
cd apps/api && npx jest src/prospect/prospect.service.test.ts --verbose
```

Expected: 새 3개 테스트 FAIL, 기존 테스트도 일부 FAIL (findById mock 없는 것들)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/prospect/prospect.service.test.ts
git commit -m "test: PRE_SHORTLIST 게이트 테스트 추가 (RED)"
```

---

### Task 4: BE Service — SHORTLIST_CAPACITY + updateStatus 게이트 + getShortlistCapacity

**Files:**
- Modify: `apps/api/src/prospect/prospect.service.ts`

- [ ] **Step 1: SHORTLIST_CAPACITY 상수 추가**

파일 상단의 `NON_ACTIVE_STATUSES` 바로 위에 추가:

```ts
const SHORTLIST_CAPACITY = 5;
```

- [ ] **Step 2: NON_ACTIVE_STATUSES에 PRE_SHORTLIST 추가**

기존:
```ts
const NON_ACTIVE_STATUSES: ProspectStatus[] = ["LONGLIST", "SHORTLIST", "SIGNED", "ARCHIVED"];
```

변경:
```ts
const NON_ACTIVE_STATUSES: ProspectStatus[] = ["LONGLIST", "PRE_SHORTLIST", "SHORTLIST", "SIGNED", "ARCHIVED"];
```

- [ ] **Step 3: updateStatus 메서드 교체**

기존 `updateStatus` 전체를 아래로 교체:

```ts
async updateStatus(id: number, dto: TransitionProspectStatusDto) {
  if (dto.status === "SIGNED") throw new AppError(400, "USE_SIGN_ENDPOINT");
  if (dto.status === "SHORTLIST") {
    const prospect = await this.repo.findById(id);
    if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
    if (prospect.status === "LONGLIST") throw new AppError(400, "MUST_GO_THROUGH_PRE_SHORTLIST");
    const count = await this.repo.countByStatus("SHORTLIST");
    if (count >= SHORTLIST_CAPACITY) throw new AppError(409, "SHORTLIST_FULL");
    const latest = await this.repo.getLatestVideoEvaluation(id);
    if (!latest || latest.result !== "PASS") throw new AppError(400, "VIDEO_EVAL_REQUIRED");
  }
  return this.repo.updateStatus(id, dto.status);
}
```

- [ ] **Step 4: getShortlistCapacity 메서드 추가**

`updateStatus` 바로 아래에 추가:

```ts
async getShortlistCapacity() {
  const current = await this.repo.countByStatus("SHORTLIST");
  return { capacity: SHORTLIST_CAPACITY, current };
}
```

- [ ] **Step 5: 테스트 실행 — 전부 통과 확인**

```bash
cd apps/api && npx jest src/prospect/prospect.service.test.ts --verbose
```

Expected: 전체 PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/prospect/prospect.service.ts
git commit -m "feat: service — PRE_SHORTLIST 게이트, SHORTLIST 정원 제한, getShortlistCapacity"
```

---

### Task 5: BE DTO + Controller + Routes — shortlist-capacity 엔드포인트

**Files:**
- Modify: `apps/api/src/prospect/dto/prospect.dto.ts` (line 10)
- Modify: `apps/api/src/prospect/prospect.controller.ts`
- Modify: `apps/api/src/prospect/prospect.routes.ts`

- [ ] **Step 1: CreateProspectDto status 허용값 수정**

`apps/api/src/prospect/dto/prospect.dto.ts` 10번째 줄:

기존:
```ts
status?: 'LONGLIST' | 'SHORTLIST';
```

변경:
```ts
status?: 'LONGLIST' | 'PRE_SHORTLIST';
```

- [ ] **Step 2: Controller에 getShortlistCapacity 핸들러 추가**

`apps/api/src/prospect/prospect.controller.ts`의 `checkAcquisitionGate` 핸들러 바로 아래에 추가:

```ts
getShortlistCapacity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, coachingRole } = requireUser(req);
    if (!canRead(role, coachingRole)) throw new AppError(403, "FORBIDDEN");
    res.status(200).json(await this.service.getShortlistCapacity());
  } catch (err) { next(err); }
};
```

- [ ] **Step 3: Routes에 shortlist-capacity 경로 추가**

`apps/api/src/prospect/prospect.routes.ts`에서 `router.get("/check-duplicate", ...)` 바로 아래에 추가:

```ts
router.get("/shortlist-capacity", auth, controller.getShortlistCapacity);
```

> **주의:** `/:id` 라우트보다 반드시 앞에 있어야 Express가 id로 잘못 파싱하지 않는다. 현재 파일에서 `check-duplicate` 다음이 올바른 위치다.

- [ ] **Step 4: 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/prospect/dto/prospect.dto.ts \
        apps/api/src/prospect/prospect.controller.ts \
        apps/api/src/prospect/prospect.routes.ts
git commit -m "feat: shortlist-capacity 엔드포인트 추가, CreateProspectDto status 허용값 수정"
```

---

### Task 6: FE 타입 — ProspectStatus + STATUS_LABEL/STYLE + CreateProspectDto

**Files:**
- Modify: `football/src/types/prospect.ts` (lines 3, 30, 55–73)

- [ ] **Step 1: ProspectStatus 타입에 PRE_SHORTLIST 추가**

`football/src/types/prospect.ts` 3번째 줄:

기존:
```ts
export type ProspectStatus = 'LONGLIST' | 'SHORTLIST' | 'ACTIVE' | 'MEDICAL_TEST' | 'CONTRACT_PENDING' | 'SIGNED' | 'ARCHIVED'
```

변경:
```ts
export type ProspectStatus = 'LONGLIST' | 'PRE_SHORTLIST' | 'SHORTLIST' | 'ACTIVE' | 'MEDICAL_TEST' | 'CONTRACT_PENDING' | 'SIGNED' | 'ARCHIVED'
```

- [ ] **Step 2: CreateProspectDto status 허용값 수정**

30번째 줄:

기존:
```ts
status?: 'LONGLIST' | 'SHORTLIST'
```

변경:
```ts
status?: 'LONGLIST' | 'PRE_SHORTLIST'
```

- [ ] **Step 3: STATUS_LABEL에 PRE_SHORTLIST 추가**

55–63번째 줄의 `STATUS_LABEL`:

```ts
export const STATUS_LABEL: Record<ProspectStatus, string> = {
  LONGLIST: '롱리스트',
  PRE_SHORTLIST: '적극 검토 중',
  SHORTLIST: '쇼트리스트',
  ACTIVE: '협상 중',
  MEDICAL_TEST: '메디컬 테스트',
  CONTRACT_PENDING: '계약 검토',
  SIGNED: '계약 완료',
  ARCHIVED: '보류',
}
```

- [ ] **Step 4: STATUS_STYLE에 PRE_SHORTLIST 추가**

65–73번째 줄의 `STATUS_STYLE`:

```ts
export const STATUS_STYLE: Record<ProspectStatus, string> = {
  LONGLIST: 'bg-slate-100 text-slate-700 border-slate-200',
  PRE_SHORTLIST: 'bg-sky-100 text-sky-700 border-sky-200',
  SHORTLIST: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  ACTIVE: 'bg-blue-100 text-blue-800 border-blue-200',
  MEDICAL_TEST: 'bg-purple-100 text-purple-800 border-purple-200',
  CONTRACT_PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  SIGNED: 'bg-green-100 text-green-800 border-green-200',
  ARCHIVED: 'bg-gray-100 text-gray-500 border-gray-200',
}
```

- [ ] **Step 5: 타입 에러 확인**

```bash
cd football && npx tsc --noEmit
```

Expected: 에러 없음 (Record에 모든 키가 채워졌으므로)

- [ ] **Step 6: Commit**

```bash
git add football/src/types/prospect.ts
git commit -m "feat: FE ProspectStatus에 PRE_SHORTLIST 타입/라벨/스타일 추가"
```

---

### Task 7: FE Service — shortlistCapacity API 추가

**Files:**
- Modify: `football/src/services/prospect.service.ts` (끝 부분)

- [ ] **Step 1: shortlistCapacity API 추가**

`prospectApi` 객체 안 `acquisitionGateCheck` 바로 아래에 추가:

```ts
shortlistCapacity: () =>
  api.get<{ capacity: number; current: number }>('/prospects/shortlist-capacity'),
```

- [ ] **Step 2: 타입 확인**

```bash
cd football && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add football/src/services/prospect.service.ts
git commit -m "feat: prospectApi에 shortlistCapacity 추가"
```

---

### Task 8: FE ProspectsPage — 전체 업데이트

**Files:**
- Modify: `football/src/pages/prospects/ProspectsPage.tsx`

> **배경:** 변경 지점이 여러 곳이다. 파일 전체 구조를 파악하고 각 Step을 순서대로 적용한다. 컴파일 에러가 나면 마지막 Step의 `tsc` 확인 전에 진행 중인 Step을 완료하라.

- [ ] **Step 1: STATUSES 배열에 PRE_SHORTLIST 추가 (line 37)**

기존:
```ts
const STATUSES: (ProspectStatus | 'ALL')[] = ['ALL', 'LONGLIST', 'SHORTLIST', 'ACTIVE', 'MEDICAL_TEST', 'CONTRACT_PENDING', 'SIGNED', 'ARCHIVED']
```

변경:
```ts
const STATUSES: (ProspectStatus | 'ALL')[] = ['ALL', 'LONGLIST', 'PRE_SHORTLIST', 'SHORTLIST', 'ACTIVE', 'MEDICAL_TEST', 'CONTRACT_PENDING', 'SIGNED', 'ARCHIVED']
```

- [ ] **Step 2: CreateProspectDialog — listStatus 타입 + SelectValue + SelectContent 수정 (lines 67, 157–166)**

`CreateProspectDto.status`가 `'LONGLIST' | 'PRE_SHORTLIST'`만 허용하므로 `listStatus`도 동일하게 2개로 맞춘다.

`listStatus` state 타입 변경:
```ts
const [listStatus, setListStatus] = useState<'LONGLIST' | 'PRE_SHORTLIST'>('LONGLIST')
```

`onValueChange` 타입 캐스트 업데이트:
```ts
onValueChange={(v) => setListStatus(v as 'LONGLIST' | 'PRE_SHORTLIST')}
```

`SelectValue`의 표시 텍스트 변경 (삼항 연산자 → STATUS_LABEL):
```tsx
<SelectValue>
  {listStatus === 'LONGLIST' ? '롱리스트' : '적극 검토 중'}
</SelectValue>
```

`SelectContent` 항목 변경 (SHORTLIST 제거, PRE_SHORTLIST 추가):
```tsx
<SelectContent>
  <SelectItem value="LONGLIST">롱리스트</SelectItem>
  <SelectItem value="PRE_SHORTLIST">적극 검토 중</SelectItem>
</SelectContent>
```

- [ ] **Step 3: ProspectsPage state에 shortlistCapacity 추가**

`ProspectsPage` 컴포넌트 state 선언부(`sheetOpen` 다음)에 추가:

```ts
const [shortlistCapacity, setShortlistCapacity] = useState<{ capacity: number; current: number } | null>(null)
```

- [ ] **Step 4: fetchShortlistCapacity 함수 추가**

`fetchProspects` 함수 바로 아래에 추가:

```ts
const fetchShortlistCapacity = () => {
  prospectApi.shortlistCapacity()
    .then(setShortlistCapacity)
    .catch(() => null)
}
```

- [ ] **Step 5: useEffect에서 마운트 시 capacity 조회 추가**

기존 `useEffect([statusFilter])` 바로 아래에 새 useEffect 추가:

```ts
useEffect(() => {
  fetchShortlistCapacity()
}, [])
```

- [ ] **Step 6: handleTransition에 에러 처리 추가 + 전환 성공 후 capacity 갱신**

기존 `handleTransition`의 try/catch 블록에서 아래 두 곳을 수정:

성공 후 `fetchProspects(s)` 호출 다음 줄에 추가:
```ts
fetchShortlistCapacity()
```

에러 처리에 `SHORTLIST_FULL`과 `MUST_GO_THROUGH_PRE_SHORTLIST` 케이스 추가:
```ts
} catch (err: unknown) {
  if (err instanceof Error && err.message.includes('VIDEO_EVAL_REQUIRED')) {
    toast.error('비디오 평가 PASS 필요 — 평가 탭에서 먼저 평가를 완료해주세요')
  } else if (err instanceof Error && err.message.includes('SHORTLIST_FULL')) {
    toast.error(`쇼트리스트 정원(${shortlistCapacity?.capacity ?? 5}명)이 꽉 찼습니다`)
  } else if (err instanceof Error && err.message.includes('MUST_GO_THROUGH_PRE_SHORTLIST')) {
    toast.error('적극 검토 단계를 거쳐야 쇼트리스트로 승격할 수 있습니다')
  } else {
    toast.error(err instanceof Error ? err.message : t('prospects.deleteFailed'))
  }
}
```

- [ ] **Step 7: renderActions — LONGLIST 케이스 버튼 변경 + PRE_SHORTLIST 케이스 추가**

`renderActions` 함수의 `case 'LONGLIST'` 블록을 아래로 교체:

```tsx
case 'LONGLIST':
  return canWrite ? (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" className="h-7 text-xs"
        onClick={() => handleTransition(p.id, 'PRE_SHORTLIST')}>평가 시작</Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
        onClick={() => handleTransition(p.id, 'ARCHIVED')}>{t('prospects.deleteButton')}</Button>
    </div>
  ) : null
case 'PRE_SHORTLIST':
  return canWrite ? (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" className="h-7 text-xs"
        onClick={() => handleTransition(p.id, 'SHORTLIST')}>쇼트리스트 승격</Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
        onClick={() => handleTransition(p.id, 'ARCHIVED')}>{t('prospects.deleteButton')}</Button>
    </div>
  ) : null
```

- [ ] **Step 8: 페이지 헤더에 SHORTLIST 정원 현황 표시**

페이지 헤더 영역(line ~566–575)의 `{canWrite && <Button ...>}` 바로 앞에 추가:

```tsx
{shortlistCapacity && (
  <span className={`text-sm font-medium ${shortlistCapacity.current >= shortlistCapacity.capacity ? 'text-red-600' : 'text-muted-foreground'}`}>
    쇼트리스트 {shortlistCapacity.current}/{shortlistCapacity.capacity}
  </span>
)}
```

- [ ] **Step 9: 타입 에러 확인**

```bash
cd football && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 10: Commit**

```bash
git add football/src/pages/prospects/ProspectsPage.tsx
git commit -m "feat: ProspectsPage — PRE_SHORTLIST 전환 버튼, SHORTLIST 정원 표시, 에러 처리"
```

---

### Task 9: CONTEXT.md 업데이트

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: 영입 후보 파이프라인 섹션 수정**

`CONTEXT.md`에서 Prospect 파이프라인 흐름을 기술하는 부분을 찾아 아래처럼 업데이트:

```
LONGLIST → PRE_SHORTLIST(적극 검토 중) → SHORTLIST → ACTIVE → MEDICAL_TEST → CONTRACT_PENDING → SIGNED
```

- `PRE_SHORTLIST`: 스카우트가 적극 평가 중인 단계. 하드 게이트 없음, 스카우트 판단으로 승격.
- `SHORTLIST`: 정원 5명 제한. PRE_SHORTLIST 통과 + VIDEO_EVAL PASS 필수. LONGLIST에서 직행 불가(`MUST_GO_THROUGH_PRE_SHORTLIST`).
- SHORTLIST 정원 초과 시 BE에서 `409 SHORTLIST_FULL` 반환.

- [ ] **Step 2: SHORTLIST_CAPACITY 정보 추가**

`SHORTLIST_CAPACITY = 5`는 `apps/api/src/prospect/prospect.service.ts` 상수로 정의됨을 기록.

- [ ] **Step 3: Commit**

```bash
git add CONTEXT.md
git commit -m "docs: PRE_SHORTLIST 단계 및 SHORTLIST 정원 정책 CONTEXT.md 반영"
```
