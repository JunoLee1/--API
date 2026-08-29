# Staff Salary Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/api/prisma/seed.ts`에 21명 직원(User) 각각의 `StaffRecord` + `StaffSalary` + 6개월치 `PayrollRun` (+ 선택적 `StaffAllowance`) seed 데이터를 추가한다. Payroll 모듈이 실 데이터로 동작하게 만들고, `WageCapKPI` 확장 (별도 plan `2026-08-23-available-budget-kpi.md`)의 `staffSalary.actual` 값이 계산되게 한다.

**Architecture:** Idempotent seed 함수 `seedStaffSalaries()` 추가. User email로 매칭해서 각 role별 baseSalary 부여. 2026-01-01 부터 유효 (activeSeason 기간). Jan~Jun 2026 6개월치 PAID PayrollRun.

**Tech Stack:** Prisma seed script (TypeScript). 마이그레이션 없음.

**Scope 제한:**
- 선수 급여는 별개 (기존 `Contract.salary` seed 이미 있음)
- 복잡한 StaffAllowance 구조 없음 (야근/식비 flat 2개만)
- 자동 payroll 실행(cron)은 별개

---

## File Structure

**Modified:**
- `apps/api/prisma/seed.ts` — `seedStaffSalaries()` 함수 추가, `main()`에서 호출

**No changes:**
- 스키마 (기존 StaffRecord/StaffSalary/PayrollRun/StaffAllowance 모두 존재)
- 마이그레이션

---

## Baseline data (Role별 baseSalary in KRW annual)

| Role / 세부 | baseSalary | 근거 |
|-----|--------:|-----|
| ADMIN | 150,000,000 | 최고 임원 |
| GM | 200,000,000 | 스포츠 최고 책임자 |
| FRONT_OFFICE TD | 130,000,000 | 기술이사 |
| FRONT_OFFICE FINANCE_MANAGER | 120,000,000 | 부문 매니저 |
| FRONT_OFFICE HR_MANAGER | 120,000,000 | 부문 매니저 |
| FRONT_OFFICE ASSET_MANAGER | 110,000,000 | 부문 매니저 |
| FRONT_OFFICE FACILITY_MANAGER | 100,000,000 | 부문 매니저 |
| FRONT_OFFICE SCOUT | 80,000,000 | 전문직 |
| FRONT_OFFICE FINANCE_STAFF | 65,000,000 | 실무 |
| FRONT_OFFICE HR_STAFF | 60,000,000 | 실무 |
| FRONT_OFFICE ASSET_STAFF | 60,000,000 | 실무 |
| FRONT_OFFICE FACILITY_STAFF | 55,000,000 | 실무 |
| COACHING_STAFF HEAD_COACH | 250,000,000 | 최고 감독진 |
| COACHING_STAFF MEDICAL_DIRECTOR | 130,000,000 | 의료 총괄 |
| COACHING_STAFF ASSISTANT_COACH | 120,000,000 | 수석코치 |
| COACHING_STAFF ATTACKING_COACH | 100,000,000 | 포지션 코치 |
| COACHING_STAFF DEFENSIVE_COACH | 100,000,000 | 포지션 코치 |
| COACHING_STAFF GOALKEEPER_COACH | 95,000,000 | GK 전문 |
| COACHING_STAFF PHYSICAL_COACH | 90,000,000 | 체력 |
| COACHING_STAFF SET_PIECE_COACH | 90,000,000 | 세트피스 |
| COACHING_STAFF MEDICAL | 80,000,000 | 의료 스태프 |

**Total 21명, 예상 합계 ≈ 2.3B KRW/year**. 중복 role (예: HEAD_COACH 2명, ASSISTANT_COACH 2명 등) 각각 동일 baseSalary 적용.

---

## Task 1: 스키마 확인 + StaffAllowance shape 확인

**Files:**
- Read: `apps/api/prisma/schema.prisma`
- Read: DB 상태

- [ ] **Step 1: 실제 User 목록 확인**

```bash
psql football -c "SELECT id, email, role, \"coachingRole\", \"frontOfficeRole\" FROM \"User\" WHERE role IN ('ADMIN','GM','FRONT_OFFICE','COACHING_STAFF') ORDER BY id;"
```

- [ ] **Step 2: StaffAllowance 스키마 확인**

```bash
grep -B1 -A10 "^model StaffAllowance" apps/api/prisma/schema.prisma
```

필드 확인 후 seed에 반영. 예: `staffSalaryId Int`, `name String`, `amount Decimal`, `type enum?` 등.

---

## Task 2: seedStaffSalaries() 함수 작성

**Files:**
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: 함수 스켈레톤 추가**

```typescript
// seed.ts 하단 (main() 위)

const SALARY_TABLE: Record<string, number> = {
  "ADMIN": 150_000_000,
  "GM": 200_000_000,
  "TD": 130_000_000,
  "FINANCE_MANAGER": 120_000_000,
  "HR_MANAGER": 120_000_000,
  "ASSET_MANAGER": 110_000_000,
  "FACILITY_MANAGER": 100_000_000,
  "SCOUT": 80_000_000,
  "FINANCE_STAFF": 65_000_000,
  "HR_STAFF": 60_000_000,
  "ASSET_STAFF": 60_000_000,
  "FACILITY_STAFF": 55_000_000,
  "HEAD_COACH": 250_000_000,
  "MEDICAL_DIRECTOR": 130_000_000,
  "ASSISTANT_COACH": 120_000_000,
  "ATTACKING_COACH": 100_000_000,
  "DEFENSIVE_COACH": 100_000_000,
  "GOALKEEPER_COACH": 95_000_000,
  "PHYSICAL_COACH": 90_000_000,
  "SET_PIECE_COACH": 90_000_000,
  "MEDICAL": 80_000_000,
};

function resolveBaseSalary(role: string, coachingRole: string | null, frontOfficeRole: string | null): number {
  if (role === "ADMIN") return SALARY_TABLE["ADMIN"]!;
  if (role === "GM") return SALARY_TABLE["GM"]!;
  if (frontOfficeRole && SALARY_TABLE[frontOfficeRole]) return SALARY_TABLE[frontOfficeRole]!;
  if (coachingRole && SALARY_TABLE[coachingRole]) return SALARY_TABLE[coachingRole]!;
  return 50_000_000;   // fallback
}

async function seedStaffSalaries() {
  const staffUsers = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "GM", "FRONT_OFFICE", "COACHING_STAFF"] } },
    select: { id: true, username: true, email: true, role: true, coachingRole: true, frontOfficeRole: true, phoneNumberId: true },
    orderBy: { id: "asc" },
  });

  const effectiveFrom = new Date("2026-01-01");
  const monthsToSeed = [0, 1, 2, 3, 4, 5];   // Jan~Jun 2026

  for (const user of staffUsers) {
    const baseSalary = resolveBaseSalary(user.role, user.coachingRole, user.frontOfficeRole);

    // 1. StaffRecord upsert (email unique key로 매칭)
    const roleLabel = user.frontOfficeRole ?? user.coachingRole ?? user.role;
    const staffRecord = user.email
      ? await prisma.staffRecord.upsert({
          where: { email: user.email },
          update: {},
          create: {
            name: user.username ?? user.email,
            role: roleLabel ?? "STAFF",
            email: user.email,
            isActive: true,
            createdById: 1,   // admin id
          },
        })
      : null;

    // 2. StaffSalary upsert — userId 기준으로 중복 방지 (unique 인덱스 없으면 findFirst + create)
    let staffSalary = await prisma.staffSalary.findFirst({
      where: { userId: user.id, effectiveTo: null },
    });
    if (!staffSalary) {
      staffSalary = await prisma.staffSalary.create({
        data: {
          userId: user.id,
          staffRecordId: staffRecord?.id,
          baseSalary,
          country: "KR",
          effectiveFrom,
        },
      });
    }

    // 3. PayrollRun 6개월치 (Jan~Jun 2026 PAID)
    for (const m of monthsToSeed) {
      const month = new Date(2026, m, 1);
      const gross = Math.round(baseSalary / 12);
      const ded = Math.round(gross * 0.15);
      const net = gross - ded;
      const existing = await prisma.payrollRun.findFirst({
        where: { staffSalaryId: staffSalary.id, month },
      });
      if (!existing) {
        await prisma.payrollRun.create({
          data: {
            staffSalaryId: staffSalary.id,
            month,
            grossPay: gross,
            totalDeductions: ded,
            netPay: net,
            status: "PAID",
            isLocked: true,
          },
        });
      }
    }

    // 4. (선택) StaffAllowance — 야근·식비. Task 1 스키마 확인 후 조정
    // await prisma.staffAllowance.upsert(...)
  }

  console.log(`[seed] Staff salaries seeded for ${staffUsers.length} users`);
}
```

- [ ] **Step 2: main()에서 호출**

seed.ts `main()` 마지막(선수 계약 이후)에 추가:
```typescript
await seedStaffSalaries();
```

- [ ] **Step 3: TS 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep seed | head -5
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seed.ts
git commit -m "chore(seed): add StaffRecord + StaffSalary + 6-month PayrollRun for 21 staff users"
```

---

## Task 3: 실행 + 검증

- [ ] **Step 1: seed 실행**

```bash
cd apps/api && npx prisma db seed 2>&1 | tail -20
```

Expected: `[seed] Staff salaries seeded for 21 users`, no errors.

- [ ] **Step 2: DB 검증**

```bash
psql football -c "SELECT COUNT(*) AS staff_records FROM \"StaffRecord\";"     # 21
psql football -c "SELECT COUNT(*) AS staff_salaries FROM \"StaffSalary\";"    # 21
psql football -c "SELECT COUNT(*) AS payroll_runs FROM \"PayrollRun\";"       # 126
psql football -Atc "SELECT SUM(\"baseSalary\") FROM \"StaffSalary\";"        # ~ 2.3B
psql football -Atc "SELECT SUM(\"grossPay\") FROM \"PayrollRun\";"           # ~ 1.15B (6개월치)
```

- [ ] **Step 3: WageCapKPI 스모크 (available-budget-kpi PR 머지 후에만)**

```bash
# admin 로그인 → curl /api/seasons/active/wage-cap-kpi
# 응답에 staffSalary.actual > 0 (약 1.15B/6=190M 근사) 확인
```

---

## Task 4: PR 생성 + 머지

- [ ] **Step 1: 브랜치 + 커밋**

```bash
git checkout -b chore/seed-staff-salary
# ... 앞서 커밋들 이미 있음
git push -u origin chore/seed-staff-salary
```

- [ ] **Step 2: PR**

```bash
gh pr create --title "chore(seed): staff salary + payroll seed for 21 users" \
             --body "$(cat <<'EOF'
## Summary
- 21명 직원 User에 StaffRecord + StaffSalary + 6개월치 PayrollRun (Jan~Jun 2026 PAID) 시드 추가
- 역할별 realistic baseSalary (총 ~2.3B KRW/year)
- Payroll 모듈이 실 데이터로 동작 시작 → WageCapKPI staffSalary.actual 계산 가능

## Depends on / Related
- 관련: `2026-08-23-available-budget-kpi.md` plan — 이 seed가 `staffSalary.actual` KPI를 유의미하게 만듦
- Memory: `project_football_seed_staff_salary_missing.md` 해결

## Test plan
- [x] `prisma db seed` 성공
- [x] StaffRecord/StaffSalary 21 rows, PayrollRun 126 rows
- [ ] /api/seasons/active/wage-cap-kpi 응답에 staffSalary.actual > 0
- [ ] 재실행 시 idempotent (row 수 변동 없음)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge <PR#> --squash --delete-branch
```

---

## Self-Review

**Spec coverage:**
- ✅ 21명 직원 각각 StaffRecord + StaffSalary + 6개월치 PayrollRun
- ✅ 역할별 realistic baseSalary
- ✅ Idempotent (upsert / findFirst 패턴)
- ✅ WageCapKPI staffSalary.actual 활성화 조건 충족

**Non-goals:**
- 스키마 변경 없음
- 선수 급여 seed (이미 존재)
- Cron 자동 PayrollRun 생성
- StaffAllowance 복잡한 구조 (Task 1에서 결정)

**Follow-ups:**
- 실 세션 시작 후 payroll 자동 생성 job 확인
- 역사적 StaffSalary 변경 이력 seed (연봉 인상 시나리오)
- 국가별 payroll (`country`) 다양화 (지금은 KR만)
