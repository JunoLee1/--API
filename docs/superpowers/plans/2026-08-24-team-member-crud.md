# 팀원 CRUD (Team Member Management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 팀장 (`Department.headId` 로 지정된 유저) 이 자기 leaf 부서의 팀원 (`UserDepartment` 관계) 를 직접 관리할 수 있는 CRUD API + UI 를 만든다. 겸직 유저는 remove 시 안전 (다른 부서 있음), 단독 소속은 transfer 강제. 팀장 승계는 부서장 (parent.head) 만 가능. DeptRole 을 6-value 세분화하여 조직도 표현 강화.

**Why:**
- 현재 `UserDepartment` 는 스키마·seed 로만 세팅됨. **팀장이 자기 팀원을 UI 로 관리할 API 자체가 없음.**
- 팀원 이동 (`transfer`), 승계 (팀장 임명), 겸직 관리 등은 admin 이 직접 DB 조작하거나 seed 수정으로 해결하는 상태 → 실사용 시 관리자 부담.
- `DeptRole` 이 `MANAGER/MEMBER` 2-value 뿐이라 부팀장·선임·인턴 등 조직도 표현 불가.
- 팀장 부재 (휴가·공석) 시 승인 blocked 문제는 future concern (별도 `deputyHeadId` 추가 시 완화 가능, 이 plan 밖).

**Architecture:**
- `UserDepartment` 기존 join table 재사용 (composite PK `(userId, departmentId)` → **겸직 이미 지원**).
- `DeptRole` enum 확장: `MANAGER, MEMBER` → `LEADER, DEPUTY, MANAGER, SENIOR, MEMBER, INTERN` (기존 값 그대로 + 4 신규).
- `Department.headId` 는 **승인 권한 판정** 소스로 계속 사용 (asset-request / hiring-dispatch / medical-partnership 재사용). `UserDepartment.role` 은 조직도 표현 용도로 분리.
- 팀장 승계 (`Department.headId` update) 는 부서장 (`parent.headId`) 또는 admin 만.
- 신규 유저 create 는 **HiringDispatch 담당** (팀원 CRUD 는 assign 만).
- 자기 승인 차단 (팀장이 자신 remove/role 변경 X), 단독 소속 이관 강제, audit log.

**Tech Stack:** Prisma + PostgreSQL, Express, Jest, React + TypeScript.

**Related Plans / Specs:**
- `docs/superpowers/plans/2026-08-23-asset-request-workflow.md` — `Department.headId` = LEADER stage 승인권자 (동일 사용)
- `docs/superpowers/plans/2026-08-24-hiring-dispatch.md` — 신규 유저 create 담당 (팀원 CRUD 는 이 흐름 안 침범)
- CONTEXT.md `## Department (부서)` L1235-1250 — 결재 워크플로우 leaf.head=팀장, parent.head=부서장 도식

---

## 🔴 Grill 결정 (2026-08-24)

**재논의 금지.**

### Q1: "팀장" 정의
- **선택: A — `Department.headId` 재사용**
- 근거: CONTEXT.md L1250 + 3개 workflow (asset-request/hiring-dispatch/medical-partnership) 이미 hard-wired. 복수 팀장 (C) 로 가면 승인 로직 전체 재설계 필요 → scope creep.
- 후속 여지: 필요 시 `Department.deputyHeadId Int?` non-breaking 추가.

### Q2: CRUD 스코프
- **선택: A — 자기 leaf dept 만 + admin/GM escape hatch**
- 팀장 = `Department.headId === userId` 인 leaf dept 만 관리
- ADMIN/SUPER_ADMIN/GM 은 어느 dept 든 CRUD 가능 (재배치 필요 시)
- 부서장 재귀 관리 (B) 는 복잡. 부서장은 leaf 팀장 임명 (Q6-1) 만.

### Q3: DeptRole 확장 (A → C 변경 확정)
- **선택: C — 6-value enum**
- 신규 enum:
  ```prisma
  enum DeptRole {
    LEADER      // 팀장급 (organizational label; approval authority = Department.headId)
    DEPUTY      // 부팀장 / 대행
    MANAGER     // 실무 관리자 (기존)
    SENIOR      // 선임 개별 기여자
    MEMBER      // 팀원 (기존)
    INTERN      // 인턴
  }
  ```
- 기존 `MANAGER`/`MEMBER` 값 유지 → backfill 불필요, migration 는 `ALTER TYPE ... ADD VALUE` 4개
- **주의:** `Department.headId` 와 `UserDepartment.role = LEADER` 는 다른 개념:
  - `Department.headId` → 승인 권한 판정 (Q1 A)
  - `UserDepartment.role` → 조직도 표현
  - 두 필드는 sync 필수 아님

### Q4: 팀원 추가 방식
- **선택: A — 기존 유저 assign 만 (`UserDepartment.create`)**
- 신규 유저 create 는 **HiringDispatch** 흐름 (재무·임원·HR 3-stage 결재) 담당. 팀원 CRUD 는 이 흐름 우회 금지.
- 팀장은 email 로 기존 유저 검색 → assign

### Q5: 팀원 제거 / 이관
- **선택: D — remove + transfer 병행**
- 겸직 유저 (다른 dept 소속 있음): 그냥 remove (`UserDepartment.delete`)
- 단독 소속 유저 (마지막 dept): **transfer 강제** — `toDeptId` 파라미터 필수. 무소속 유저 방지.
- soft delete (`leftAt`) 는 이 plan 밖 (별도 audit trail 확장 논의)

### Q6-1: 팀장 승계
- **선택: B — 부서장 (`parent.headId`) 만 leaf 팀장 임명 가능 (+ admin)**
- 팀장이 자기 후계자 직접 임명 (A) 은 셀프 승계 위험
- HR only (C) 는 지나치게 중앙집권

### Q7: 감사 로그
- 모든 CRUD 는 `writeAuditLog` (기존 helper) fire-and-forget:
  - `TEAM_MEMBER_ADDED` (targetId=userId, detail={deptId, role})
  - `TEAM_MEMBER_REMOVED` (detail={deptId, reason?})
  - `TEAM_MEMBER_TRANSFERRED` (detail={fromDeptId, toDeptId})
  - `TEAM_MEMBER_ROLE_CHANGED` (detail={deptId, oldRole, newRole})
  - `DEPARTMENT_HEAD_CHANGED` (targetId=deptId, detail={oldHeadId, newHeadId})

### Q8: API 엔드포인트
- `GET    /departments/:deptId/members` — list
- `POST   /departments/:deptId/members` — assign `{ userId, role }`
- `PATCH  /departments/:deptId/members/:userId` — role 변경 `{ role }`
- `DELETE /departments/:deptId/members/:userId` — remove (단독 소속 시 400 `MUST_TRANSFER`)
- `POST   /departments/:deptId/members/:userId/transfer` — `{ toDeptId, toRole? }` (단독 소속·이관 모두 지원)
- `PATCH  /departments/:deptId/head` — 팀장 임명/승계 `{ newHeadId }` (부서장 or admin)

권한 gate (route middleware):
- list/assign/role/remove/transfer: `Department.headId === userId` OR `isAdminLike(role)`
- head update: `parent.headId === userId` OR `isAdminLike(role)`
- ALL: self-approval 차단 (userId != requesterId 조건 필요한 케이스 — role change, remove, head 자기 임명)

### Q9: Frontend
- `DepartmentMembersPage.tsx` (`/departments/:id/members`) — 팀원 리스트 + assign/remove/transfer/role 버튼
- Nav 노출 조건: `useCurrentUser()` + `department.headId === user.id` 인 leaf dept 있으면 표시
- ADMIN/GM 은 dept select dropdown 으로 임의 부서 접근

---

## Task 1: 착수 확인 + 브랜치

- [ ] **Step 1: 관련 model 필드 최신 상태 확인**
```bash
grep -B1 -A15 "^model UserDepartment\|^model Department\|^enum DeptRole" apps/api/prisma/schema.prisma
```
확인 사항:
- `UserDepartment` composite PK `(userId, departmentId)` 유지
- `Department.headId Int?` 유지 + relation
- `DeptRole` 기존 값 (`MANAGER, MEMBER`) 확인

- [ ] **Step 2: 기존 department 모듈 확인**
```bash
grep -n "router\." apps/api/src/department/department.routes.ts
```
기존 routes: list/create/get/update/delete/headcount. member CRUD 없음 (이 plan 이 추가).

- [ ] **Step 3: 브랜치 생성**
```bash
git checkout -b feat/team-member-crud
```

---

## Task 2: Prisma schema — `DeptRole` 확장

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: `DeptRole` enum 4 신규 값 추가**
```prisma
enum DeptRole {
  LEADER      // 신규
  DEPUTY      // 신규
  MANAGER     // 기존
  SENIOR      // 신규
  MEMBER      // 기존
  INTERN      // 신규
}
```
- `UserDepartment.role` 필드 default 는 그대로 `MEMBER`.
- 기존 데이터 (`MANAGER`, `MEMBER`) 는 값 이름 동일이라 backfill 불필요.

- [ ] **Step 2: `prisma format` + `validate`**
```bash
cd apps/api && npx prisma format && npx prisma validate
```

- [ ] **Step 3: Commit**
```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): expand DeptRole enum with LEADER/DEPUTY/SENIOR/INTERN"
```

---

## Task 3: Migration + local 검증

- [ ] **Step 1: Create migration**
```bash
cd apps/api
npx prisma migrate dev --create-only --name dept_role_expand
```
- shadow-DB replay 실패 시 handcraft:
```sql
ALTER TYPE "DeptRole" ADD VALUE IF NOT EXISTS 'LEADER';
ALTER TYPE "DeptRole" ADD VALUE IF NOT EXISTS 'DEPUTY';
ALTER TYPE "DeptRole" ADD VALUE IF NOT EXISTS 'SENIOR';
ALTER TYPE "DeptRole" ADD VALUE IF NOT EXISTS 'INTERN';
```

- [ ] **Step 2: 로컬 apply**
```bash
npx prisma migrate deploy
```

- [ ] **Step 3: Commit**
```bash
git add apps/api/prisma/migrations/*_dept_role_expand/
git commit -m "feat(migration): expand DeptRole enum values"
```

---

## Task 4: 백엔드 — team-member CRUD

**Files:**
- Modify: `apps/api/src/department/department.repo.ts` — member CRUD 메소드 추가
- Modify: `apps/api/src/department/department.service.ts` — 권한·검증 로직
- Modify: `apps/api/src/department/department.controller.ts` — endpoint handlers
- Modify: `apps/api/src/department/department.routes.ts` — route 등록

기존 department 모듈 확장 (신규 모듈 X — 관심사 동일).

- [ ] **Step 1: Repository 확장**
```typescript
// department.repo.ts
findMembers(deptId: number): Promise<Array<{ user, role, joinedAt }>>
addMember(deptId: number, userId: number, role: DeptRole, tx?: PrismaClient)
updateMemberRole(deptId: number, userId: number, role: DeptRole, tx?)
removeMember(deptId: number, userId: number, tx?)
transferMember(fromDeptId: number, toDeptId: number, userId: number, toRole?: DeptRole, tx?)  // atomic within $transaction
countUserDepartments(userId: number): Promise<number>
updateHead(deptId: number, newHeadId: number | null, tx?)
```

- [ ] **Step 2: Service — 권한·검증**
```typescript
// department.service.ts
async listMembers(deptId, requesterId, role) {
  await this.assertLeaderOrAdmin(deptId, requesterId, role);
  return this.repo.findMembers(deptId);
}

async addMember(deptId, userId, memberRole, requesterId, role) {
  await this.assertLeaderOrAdmin(deptId, requesterId, role);
  const user = await this.userRepo.findById(userId);
  if (!user) throw new AppError(404, "USER_NOT_FOUND");
  // 이미 소속이면 400 (updateRole 로 유도)
  const existing = await this.repo.findMember(deptId, userId);
  if (existing) throw new AppError(400, "ALREADY_MEMBER");
  await this.repo.addMember(deptId, userId, memberRole);
  void writeAuditLog({...}).catch(console.error);
  return { ok: true };
}

async updateMemberRole(deptId, userId, newRole, requesterId, role) {
  await this.assertLeaderOrAdmin(deptId, requesterId, role);
  if (userId === requesterId) throw new AppError(403, "SELF_ROLE_CHANGE_FORBIDDEN");
  const existing = await this.repo.findMember(deptId, userId);
  if (!existing) throw new AppError(404, "NOT_MEMBER");
  await this.repo.updateMemberRole(deptId, userId, newRole);
  void writeAuditLog({...}).catch(console.error);
  return { ok: true };
}

async removeMember(deptId, userId, requesterId, role) {
  await this.assertLeaderOrAdmin(deptId, requesterId, role);
  if (userId === requesterId) throw new AppError(403, "SELF_REMOVAL_FORBIDDEN");
  // 단독 소속 검증 (Q5 D)
  const deptCount = await this.repo.countUserDepartments(userId);
  if (deptCount <= 1) throw new AppError(400, "MUST_TRANSFER");   // → transfer API 로 유도
  await this.repo.removeMember(deptId, userId);
  void writeAuditLog({...}).catch(console.error);
  return { ok: true };
}

async transferMember(fromDeptId, toDeptId, userId, toRole, requesterId, role) {
  // 팀장은 fromDeptId 만 검증 (자기 팀에서 다른 팀으로 보내는 것)
  await this.assertLeaderOrAdmin(fromDeptId, requesterId, role);
  if (userId === requesterId) throw new AppError(403, "SELF_TRANSFER_FORBIDDEN");
  if (fromDeptId === toDeptId) throw new AppError(400, "SAME_DEPARTMENT");
  const toDept = await this.repo.findById(toDeptId);
  if (!toDept) throw new AppError(404, "TARGET_DEPT_NOT_FOUND");
  await prisma.$transaction(async (tx) => {
    await this.repo.transferMember(fromDeptId, toDeptId, userId, toRole ?? 'MEMBER', tx);
  });
  void writeAuditLog({...}).catch(console.error);
  return { ok: true };
}

async updateHead(deptId, newHeadId, requesterId, role) {
  // Q6-1 B: parent.headId or admin
  const dept = await this.repo.findById(deptId);
  if (!dept) throw new AppError(404, "NOT_FOUND");
  const parent = dept.parentId ? await this.repo.findById(dept.parentId) : null;
  const isParentHead = parent && parent.headId === requesterId;
  if (!isParentHead && !isAdminLike(role)) throw new AppError(403, "FORBIDDEN");
  if (newHeadId === requesterId) throw new AppError(403, "SELF_HEAD_APPOINTMENT_FORBIDDEN");
  const newHead = await this.userRepo.findById(newHeadId);
  if (!newHead) throw new AppError(404, "USER_NOT_FOUND");
  const oldHeadId = dept.headId;
  await this.repo.updateHead(deptId, newHeadId);
  void writeAuditLog({ actorId: requesterId, action: 'DEPARTMENT_HEAD_CHANGED', targetId: deptId, detail: { oldHeadId, newHeadId } }).catch(console.error);
  return { ok: true };
}

// helper
private async assertLeaderOrAdmin(deptId, userId, role) {
  if (isAdminLike(role)) return;
  const dept = await this.repo.findById(deptId);
  if (!dept) throw new AppError(404, "NOT_FOUND");
  if (dept.headId !== userId) throw new AppError(403, "NOT_LEADER");
}
```

- [ ] **Step 3: Controller — endpoints**
- `listMembers`, `addMember`, `updateMemberRole`, `removeMember`, `transferMember`, `updateHead`
- 모두 `requireUser(req)` + role 전달

- [ ] **Step 4: Routes**
```typescript
router.get   ("/:deptId/members",                 auth, controller.listMembers);
router.post  ("/:deptId/members",                 auth, controller.addMember);
router.patch ("/:deptId/members/:userId",         auth, controller.updateMemberRole);
router.delete("/:deptId/members/:userId",         auth, controller.removeMember);
router.post  ("/:deptId/members/:userId/transfer", auth, controller.transferMember);
router.patch ("/:deptId/head",                    auth, controller.updateHead);
```

- [ ] **Step 5: Unit tests** — `apps/api/__test__/department/team-member-crud.test.ts`
- assertLeaderOrAdmin: 팀장 통과 / admin 통과 / 그 외 403
- addMember: 신규 assign 성공 / 이미 소속이면 400
- updateMemberRole: self → 403 / 성공 / 존재 안 하면 404
- removeMember: 단독 소속 → 400 MUST_TRANSFER / 겸직 → 성공
- transferMember: same dept → 400 / target 없으면 404 / $transaction atomic 검증
- updateHead: parent head 통과 / admin 통과 / 그 외 403 / 자기 임명 403
- audit log fire-and-forget 검증

- [ ] **Step 6: Commit**
```bash
git add apps/api/src/department/ apps/api/__test__/department/
git commit -m "feat(department): team member CRUD + head appointment API (leaf leaders + admin/parent head only)"
```

---

## Task 5: 알림 (선택)

MVP 는 알림 없음 (팀원 이동은 dept 내부 관리 흐름, 회사 전체 알림 필요성 낮음). 후속 요구 시:
- `TEAM_MEMBER_TRANSFERRED_IN` / `_OUT` — 이관 시 양쪽 부서 팀장 알림
- `DEPARTMENT_HEAD_CHANGED` — 부서 전체 팀원에게 알림 (신임 팀장 안내)

이 plan 밖 (non-goal).

---

## Task 6: Frontend

**Files:**
- Create: `football/src/pages/department/DepartmentMembersPage.tsx`
- Modify: `football/src/services/department.service.ts` — member CRUD API 함수
- Modify: `football/src/App.tsx` — route `/departments/:deptId/members`
- Modify: `football/src/layouts/AppShell.tsx` — nav 노출 조건 (팀장인 dept 있으면)
- Modify: `football/src/locales/{ko,en}/common.json`

주의사항:
- `<SelectItem label={...}>` 명시 (PR #336)
- Error code 매핑: `NOT_LEADER`, `SELF_ROLE_CHANGE_FORBIDDEN`, `SELF_REMOVAL_FORBIDDEN`, `MUST_TRANSFER`, `ALREADY_MEMBER`, `SAME_DEPARTMENT`, `TARGET_DEPT_NOT_FOUND`, `SELF_HEAD_APPOINTMENT_FORBIDDEN`

- [ ] **Step 1: Types + service**
```typescript
export const departmentMemberApi = {
  list(deptId: number): Promise<Member[]>
  add(deptId, userId, role): Promise<void>
  updateRole(deptId, userId, role): Promise<void>
  remove(deptId, userId): Promise<void>          // 단독 소속이면 MUST_TRANSFER 에러
  transfer(deptId, userId, toDeptId, toRole?): Promise<void>
  updateHead(deptId, newHeadId): Promise<void>
}
```

- [ ] **Step 2: `DepartmentMembersPage`**
- 상단: 부서 이름 + 팀장 표시 + (부서장/admin) "팀장 변경" 버튼
- 팀원 리스트 (name / role dropdown / 액션 버튼)
- Assign 다이얼로그: 유저 검색 (email autocomplete) + role 선택
- Remove 다이얼로그: 단독 소속 감지 시 자동 "이관 요청" 모드 전환 → target dept 선택 UI

- [ ] **Step 3: Nav 노출 조건**
```typescript
// AppShell.tsx
const { user } = useCurrentUser();
const [ledDepts, setLedDepts] = useState<Department[]>([]);
useEffect(() => {
  departmentApi.list().then(depts => 
    setLedDepts(depts.filter(d => d.headId === user?.id))
  );
}, [user?.id]);
// nav 항목 "팀원 관리" — ledDepts.length > 0 or isAdminLike(user.role) 이면 노출
```
- 여러 dept 팀장이면 dept select dropdown

- [ ] **Step 4: type-check + commit**

---

## Task 7: ADR + CONTEXT.md

**Files:**
- Create: `docs/adr/0016-team-member-crud.md`
- Modify: `CONTEXT.md`

- [ ] **Step 1: ADR 0016**
- Context: 팀장이 자기 팀원을 UI 로 관리할 API 부재. `Department.headId` 는 승인 권한 판정에만 쓰이고 조직도 표현·이동 관리 불가.
- Decision:
  - `Department.headId` 재사용 (승인 권한), `UserDepartment.role` 확장 (조직도)
  - `DeptRole` 6-value 확장 (LEADER/DEPUTY/MANAGER/SENIOR/MEMBER/INTERN)
  - 팀장 CRUD 스코프 = 자기 leaf dept 만 (+ admin escape)
  - 팀장 승계 = 부서장 (parent.head) 또는 admin 만
  - 신규 유저 create 는 HiringDispatch 담당 (이 API 는 assign 만)
- Alternatives:
  - 복수 팀장 (`Department.leaderIds Int[]`) → rejected (3개 workflow rewrite 필요)
  - 신규 유저 create 도 팀원 CRUD 에서 허용 → rejected (HiringDispatch 우회 위험)
- Consequences (+): 팀장 UI 자율성, admin 부담 감소, 조직도 세분화
- Consequences (-): DeptRole 4 값 추가 = enum migration, `Department.headId` vs `UserDepartment.role = LEADER` sync 없음 (설계 명시)

- [ ] **Step 2: CONTEXT.md 확장**
- 기존 `## Department (부서)` 섹션에 소절 추가:
  - "팀원 CRUD 는 `Department.headId` 인 유저 (+admin) 만 자기 leaf dept 관리 가능"
  - "DeptRole 은 조직도 표현, 승인 권한은 headId 로 판정"
  - "팀장 승계는 부서장 (parent.headId) 또는 admin 만"

- [ ] **Step 3: Commit**

---

## Task 8: 전체 스모크 + PR

- [ ] **Step 1: tsc + jest**
```bash
cd apps/api && npx tsc --noEmit && npx jest --testPathPattern="department"
cd football && npm run type-check
```

- [ ] **Step 2: E2E 시나리오**
1. 팀장 A 로그인 → 팀원 리스트 조회 → 신규 유저 B (email 검색) assign (role=MEMBER)
2. 팀장 A: B 의 role SENIOR 로 변경
3. 팀장 A: B remove → 성공 (B 가 다른 dept 도 있으면) or MUST_TRANSFER (단독이면 → transfer UI)
4. 팀장 A → 다른 팀장 C (다른 dept) 로 B 이관 (transfer)
5. 부서장 D 로그인 → 자기 leaf dept 중 하나 팀장 변경 (PATCH /:deptId/head) → 성공
6. 팀장 A 가 자기 자신 remove 시도 → 403 SELF_REMOVAL_FORBIDDEN
7. 일반 팀원 E 가 팀원 관리 시도 → 403 NOT_LEADER
8. ADMIN 이 임의 dept 조작 → 성공 (escape hatch)

- [ ] **Step 3: PR 생성**

---

## 위험 / 안전 노트

1. **self-approval 차단 3곳**: role change, remove, head 자기 임명 — 각각 명시 검증
2. **단독 소속 무소속화 방지** — `countUserDepartments <= 1` 시 remove 차단, transfer 강제
3. **transfer atomic** — `$transaction` 안에서 delete + create (fromDept row 삭제 + toDept row 생성). 실패 시 rollback.
4. **DeptRole enum ALTER** — Postgres 는 `ALTER TYPE ADD VALUE` 를 transaction 안에서 불가. Prisma migration 이 알아서 처리 (asset-request notification enum 확장 패턴 재사용).
5. **팀장 role 표시 불일치 허용** — `Department.headId=userA` 인데 `UserDepartment.role=MEMBER` 는 허용. Display 시 head 여부는 headId 검증. 팀장 UI 에서 role dropdown 은 참고용.
6. **Application-level `applicationId XOR hiringDispatchId`** 검증 — hiring-dispatch plan Q11-1 와 동일 주의 (이 plan 은 해당 없음, 참고만).

---

## Non-goals (Follow-up)

- **soft delete `UserDepartment.leftAt`** — 이관 audit trail. 필요 시 별도 plan.
- **`Department.deputyHeadId`** — 팀장 부재 시 대행. 실사용 문제 나오면 추가.
- **복수 팀장** (Q1 C) — 3개 workflow 재설계 필요 → 대규모 plan 필요.
- **팀원 이관 알림** — Task 5 non-goal.
- **소속 이력 (`UserDepartmentHistory`)** — 언제 어느 dept 소속이었는지 audit. 별도 plan.
- **팀장 자기 후계자 추천** (Q6-1 A) — 부서장이 최종 결정하되 팀장 추천 UI. 별도 plan.
- **부서장 재귀 관리** (Q2 B) — 부서장이 leaf 팀원까지 직접 조작. 별도 plan.

---

## Self-Review

**Grill decision coverage:**
- Q1 (headId 재사용) ✅ Task 4 `assertLeaderOrAdmin`
- Q2 (leaf 스코프 + admin escape) ✅ Task 4 service (isAdminLike + headId check)
- Q3 (DeptRole 6-value) ✅ Task 2 schema + Task 3 migration
- Q4 (assign only) ✅ Task 4 addMember (User.create 하지 않음)
- Q5 (remove + transfer) ✅ Task 4 service (`countUserDepartments <= 1` → MUST_TRANSFER)
- Q6-1 (부서장 승계) ✅ Task 4 updateHead (parent.headId check)
- Q7 (audit log) ✅ Task 4 각 메소드 fire-and-forget
- Q8 (API 엔드포인트) ✅ Task 4 Step 4 routes
- Q9 (Frontend + nav 조건) ✅ Task 6

**Safety:**
- Self-approval 3-stage (role change / remove / head appointment)
- 무소속 방지 (단독 소속 시 transfer 강제)
- $transaction on transfer
- audit log fire-and-forget
- Migration: enum ADD VALUE only (backfill 불필요, 기존 값 이름 유지)
