# Payroll Management Design

**Date:** 2026-08-03  
**Endpoints:** `/api/payroll/configs`, `/api/payroll/salaries`

---

## Overview

급여 설정(PayrollConfig), 직원 급여(StaffSalary), 수당(StaffAllowance), 급여 실행(PayrollRun) CRUD API. PayrollRun 생성 시 baseSalary + allowances → grossPay, 해당 country의 활성 PayrollConfig 요율 합산 → totalDeductions, grossPay - totalDeductions → netPay 자동 계산.

---

## API Endpoints

### PayrollConfig

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/payroll/configs` | 목록 (country 필터) |
| POST | `/api/payroll/configs` | 생성 |
| PATCH | `/api/payroll/configs/:id` | 수정 |

### StaffSalary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/payroll/salaries` | 목록 (country 필터) |
| POST | `/api/payroll/salaries` | 생성 |
| GET | `/api/payroll/salaries/:id` | 상세 (allowances 포함) |
| PATCH | `/api/payroll/salaries/:id` | 수정 |

### StaffAllowance (StaffSalary 서브리소스)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/payroll/salaries/:id/allowances` | 수당 목록 |
| POST | `/api/payroll/salaries/:id/allowances` | 수당 추가 |
| PATCH | `/api/payroll/salaries/:id/allowances/:aid` | 수당 수정 |
| DELETE | `/api/payroll/salaries/:id/allowances/:aid` | 수당 삭제 |

### PayrollRun (StaffSalary 서브리소스)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/payroll/salaries/:id/runs` | 급여 실행 목록 |
| POST | `/api/payroll/salaries/:id/runs` | 급여 실행 (자동 계산) |
| PATCH | `/api/payroll/salaries/:id/runs/:runId` | CONFIRM |

---

## Auto-Computation Logic

`POST /api/payroll/salaries/:id/runs` 시:

1. `StaffSalary` + `StaffAllowance` 목록 로드
2. `grossPay = baseSalary + Σ(allowances.amount)`
3. `activeConfigs` = `staffSalary.country`와 동일하고 `effectiveFrom ≤ month`인 config를 `(country, insuranceType)` 그룹별 최신 1개씩 선택
4. `totalDeductions = Σ(grossPay × config.employeeRate)` (각 activeConfig에 대해)
5. `netPay = grossPay - totalDeductions`
6. `PayrollRun` 생성 (`status: DRAFT`)
7. `@@unique([staffSalaryId, month])` 위반 시 409 `PAYROLL_RUN_ALREADY_EXISTS`
8. `activeConfigs`가 비어 있으면 422 `NO_PAYROLL_CONFIG_FOR_COUNTRY`

Decimal 연산: Prisma `Decimal` 타입으로 저장, `toFixed(2)` 반올림 처리.

---

## CONFIRM Logic

`PATCH /api/payroll/salaries/:id/runs/:runId` with `{ status: "CONFIRMED" }`:

- `status === "CONFIRMED"` 이미 확정된 경우 409 `ALREADY_CONFIRMED`
- `confirmedById: req.user!.id`, `confirmedAt: new Date()` 자동 설정

---

## Permissions

| 액션 | 허용 역할 |
|------|-----------|
| 조회 | 전체 인증 유저 |
| Config / Salary / Allowance / Run 생성·수정·삭제 | ADMIN, FRONT_OFFICE(FINANCE_MANAGER) |
| Run CONFIRM | ADMIN만 |

```ts
const canWrite = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" || (role === "FRONT_OFFICE" && foRole === "FINANCE_MANAGER");

const canConfirm = (role: string) => role === "ADMIN";
```

---

## Module Structure

```
apps/api/src/payroll/
├── payroll.routes.ts
├── config/
│   ├── dto/config.dto.ts
│   ├── config.repo.ts
│   ├── config.service.ts
│   └── config.controller.ts
├── salary/
│   ├── dto/salary.dto.ts
│   ├── salary.repo.ts
│   ├── salary.service.ts
│   └── salary.controller.ts
├── allowance/
│   ├── dto/allowance.dto.ts
│   ├── allowance.repo.ts
│   ├── allowance.service.ts
│   └── allowance.controller.ts
└── run/
    ├── dto/run.dto.ts
    ├── run.repo.ts
    ├── run.service.ts
    └── run.controller.ts
```

`payroll.routes.ts`에서 `/configs`와 `/salaries` 서브라우터 마운트. Allowance 및 Run 라우트는 salary 라우터 내에서 `/:id/allowances`, `/:id/runs`로 처리.  
`apiRouter.ts`에 `/api/payroll` 등록.

---

## Key Types

```ts
// config/dto/config.dto.ts
interface CreatePayrollConfigDto {
  country: PayrollCountry;        // KR | UK
  insuranceType: string;
  employeeRate: number;           // e.g., 0.045
  employerRate: number;
  effectiveFrom: string;          // ISO date string
}

interface UpdatePayrollConfigDto {
  employeeRate?: number;
  employerRate?: number;
}

interface PayrollConfigListQuery {
  country?: PayrollCountry;
}

// salary/dto/salary.dto.ts
interface CreateSalaryDto {
  userId?: number;
  staffRecordId?: number;
  baseSalary: number;
  country: PayrollCountry;
  effectiveFrom: string;
}

interface UpdateSalaryDto {
  baseSalary?: number;
  country?: PayrollCountry;
  effectiveFrom?: string;
}

interface SalaryListQuery {
  country?: PayrollCountry;
}

// allowance/dto/allowance.dto.ts
interface CreateAllowanceDto {
  name: string;
  amount: number;
  taxable?: boolean;              // default true
}

interface UpdateAllowanceDto {
  name?: string;
  amount?: number;
  taxable?: boolean;
}

// run/dto/run.dto.ts
interface CreateRunDto {
  month: string;                  // ISO date string (YYYY-MM-01 형식 권장)
}

interface ConfirmRunDto {
  status: "CONFIRMED";
}
```

---

## Error Codes

| 상황 | 상태코드 | 코드 |
|------|----------|------|
| Salary 없음 | 404 | `SALARY_NOT_FOUND` |
| Allowance 없음 | 404 | `ALLOWANCE_NOT_FOUND` |
| Config 없음 | 404 | `PAYROLL_CONFIG_NOT_FOUND` |
| Run 없음 | 404 | `PAYROLL_RUN_NOT_FOUND` |
| 이미 CONFIRMED | 409 | `ALREADY_CONFIRMED` |
| 같은 달 Run 존재 | 409 | `PAYROLL_RUN_ALREADY_EXISTS` |
| 해당 country config 없음 | 422 | `NO_PAYROLL_CONFIG_FOR_COUNTRY` |
| 권한 없음 | 403 | `FORBIDDEN` |

---

## Out of Scope

- 급여 실행 삭제 (확정 취소 없음)
- 급여 명세서 PDF 생성
- employerRate 기반 회사 부담분 별도 추적
- 급여 이력 비교/diff
