# 자산관리부서(Feature 16) Feature Design

**Date:** 2026-08-05
**Issues:** #132, #133, #134, #135
**Branch:** feat/asset-mgmt-feature

---

## 1. 목표

자산관리부서 산하 4개 팀(HR, IT자산, 운영재무, 시설관리)의 부서 내 업무 흐름을 ERP에서 처리한다.
각 팀은 독립된 API 모듈로 구현하되, 운영재무팀(16-3)이 허브 역할을 하여 타 팀의 지출을 자동으로 장부에 기록한다.

---

## 2. 공통 권한 흐름

```
요청
→ auth (JWT 검증, 비로그인 401)
→ requireRole(팀 역할) (403)
→ controller
```

### 역할 매핑 (기존 FrontOfficeRole 활용)

| 팀 | 팀장 역할 | 직원 역할 | 부서장 |
|---|---|---|---|
| 16-1 HR | HR_MANAGER | HR_STAFF | GM / ADMIN |
| 16-2 IT자산 | ASSET_MANAGER | ASSET_STAFF | GM / ADMIN |
| 16-3 운영재무 | FINANCE_MANAGER | FINANCE_STAFF | GM / ADMIN |
| 16-4 시설관리 | FACILITY_MANAGER | FACILITY_STAFF | GM / ADMIN |

### 결재 2단계

- **1차 승인**: 팀장 (MANAGER 역할)
- **2차 승인**: 부서장 (GM / ADMIN)
- 2차 승인 완료 후 해당 문서 `isLocked = true` → 이후 수정 불가

---

## 3. 신규 모듈 구조

```
src/
├── hr/                        # 16-1
│   ├── hr.routes.ts
│   ├── hr.controller.ts
│   ├── hr.service.ts
│   ├── hr.repo.ts
│   └── dto/hr.dto.ts
├── software-license/          # 16-2
│   ├── software-license.routes.ts
│   ├── software-license.controller.ts
│   ├── software-license.service.ts
│   ├── software-license.repo.ts
│   └── dto/software-license.dto.ts
├── ledger/                    # 16-3
│   ├── ledger.routes.ts
│   ├── ledger.controller.ts
│   ├── ledger.service.ts
│   ├── ledger.repo.ts
│   └── dto/ledger.dto.ts
├── sales/                     # 16-3
│   ├── sales.routes.ts
│   ├── sales.controller.ts
│   ├── sales.service.ts
│   ├── sales.repo.ts
│   └── dto/sales.dto.ts
└── inventory/                 # 16-4
    ├── inventory.routes.ts
    ├── inventory.controller.ts
    ├── inventory.service.ts
    ├── inventory.repo.ts
    └── dto/inventory.dto.ts
```

### 기존 모듈 변경

| 파일 | 변경 내용 |
|---|---|
| `src/payroll/run/payroll-run.service.ts` | 2차 승인 메서드 추가, netPay < 0 시 400, confirm 후 isLocked |
| `src/payroll/run/payroll-run.repo.ts` | secondApprove 쿼리 추가 |
| `src/equipment/equipment.service.ts` | depreciation 계산, seat limit 체크, expiresAt 알림 |
| `src/equipment/equipment.repo.ts` | 감가상각 관련 쿼리 |
| `src/facility/maintenance/maintenance.service.ts` | isLocked 체크, 고가 수리 시 재무 상신 |
| `src/staff-record/staff-record.service.ts` | 409 중복 체크(email/employeeId), 404, terminatedAt |
| `src/lib/email.ts` | sendPayrollApprovedEmail 추가 |
| `src/apiRouter.ts` | 신규 5개 라우터 등록 |

---

## 4. API — 16-1 HR 팀

### 기존 payroll 모듈 확장

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| PATCH | `/api/payroll/salaries/:id/runs/:runId/second-approve` | 2차 승인 (isLocked) | GM / ADMIN |
| POST | `/api/payroll/documents` | HR 문서 업로드 | HR_MANAGER / HR_STAFF |
| GET | `/api/payroll/dashboard` | HR 대시보드 | HR_MANAGER / HR_STAFF |

### 기존 staff-record 모듈 확장

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| POST | `/api/staff-records` | 신규 직원 등록 (409: 중복 email/employeeId) | HR_MANAGER |
| GET | `/api/staff-records/:id` | 직원 상세 (404: 없음) | HR_MANAGER / HR_STAFF |
| PATCH | `/api/staff-records/:id/terminate` | 퇴사 처리 (terminatedAt 설정) | HR_MANAGER |

### 비즈니스 규칙

1. **netPay 음수 방지**: `computePayroll` 시 `netPay = max(0, grossPay - totalDeductions)`. netPay가 음수로 계산되면 400 `NEGATIVE_NET_PAY` 반환.
2. **2차 승인 잠금**: `PATCH /runs/:runId/second-approve` 호출 시 `isLocked = true`, 이후 수정 시 400 `PAYROLL_LOCKED`.
3. **중복 등록 방지**: `email` 또는 `employeeId` 중복 시 409 `STAFF_ALREADY_EXISTS`.
4. **퇴사 처리 시 권한 회수**: `terminatedAt` 설정과 동시에 해당 User의 `isActive = false` 처리 (로그인 차단).
5. **문서 업로드 파일 검증**: `.pdf`, `.docx`, `.xlsx`, `.hwp` 만 허용. 초과(10MB) 시 413. 기타 형식 시 400 `INVALID_FILE_TYPE`.
6. **PII 마스킹**: `staffSalary.bankAccount`, `staffRecord.residentNumber` 응답 시 뒷자리 `*` 처리. 서비스 레이어에서 응답 객체 변환.

---

## 5. API — 16-2 IT 자산관리팀

### 기존 equipment 모듈 확장

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| PATCH | `/api/equipment/units/:unitId/depreciation` | 감가상각 수동 계산 트리거 | ASSET_MANAGER |
| GET | `/api/equipment/units/:unitId/depreciation` | 감가상각 현황 조회 | ASSET_MANAGER / ASSET_STAFF |
| POST | `/api/equipment/units/:unitId/assign-user` | 직원/선수에게 유닛 할당 (404/409) | ASSET_MANAGER |

### 신규: software-license 모듈

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/software-licenses` | 라이선스 목록 | ASSET_MANAGER / ASSET_STAFF |
| POST | `/api/software-licenses` | 라이선스 등록 | ASSET_MANAGER |
| GET | `/api/software-licenses/:id` | 상세 | ASSET_MANAGER / ASSET_STAFF |
| PATCH | `/api/software-licenses/:id` | 수정 | ASSET_MANAGER |
| POST | `/api/software-licenses/:id/assign` | 시트 할당 (400: seat 초과) | ASSET_MANAGER |
| DELETE | `/api/software-licenses/:id/assign/:userId` | 시트 회수 | ASSET_MANAGER |

### 비즈니스 규칙

1. **감가상각 계산**:
   - 전자기기(`category = TACTICAL | REHABILITATION` 또는 `isHighValue = true`): 정률법(DECLINING_BALANCE). `bookValue = bookValue × (1 - depreciationRate)` 월별 적용.
   - 일반 비품: 정액법(STRAIGHT_LINE). `bookValue = purchaseValue - (purchaseValue / lifeMonths) × elapsedMonths`.
   - `bookValue < 0` 시 400 `NEGATIVE_BOOK_VALUE`.
2. **고가/저가 분류**: 등록 시 `purchaseValue >= 500000` → `isHighValue = true` 자동 설정.
3. **할당 중복 방지**: `IN_USE` 상태 유닛 재할당 시 409 `UNIT_ALREADY_ASSIGNED`.
4. **존재하지 않는 대상 할당**: userId/playerId가 없거나 퇴사/이적 처리된 경우 404 `USER_NOT_FOUND`.
5. **라이선스 시트 초과**: `usedSeats >= totalSeats` 시 400 `LICENSE_SEAT_EXCEEDED`.
6. **30일 만료 알림**: `expiresAt` 기준 D-30 크론 잡 → 알림 `IT_ASSET_EXPIRY_SOON`.
7. **RETIRED 상태 재무 동기화**: 유닛 RETIRED 처리 시 → `LedgerEntry(type: EXPENSE, category: EQUIPMENT_PURCHASE, amount: bookValue × -1, isRefund: true)` 자동 생성.

---

## 6. API — 16-3 운영재무팀

### 기존 financial-report 모듈 확장

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| PATCH | `/api/financial-reports/:seasonId/second-approve` | 2차 승인 잠금 | GM / ADMIN |

### 신규: ledger 모듈 (입출금 장부)

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/ledger` | 전체 장부 조회 (필터: type, category, dateRange) | FINANCE_MANAGER / FINANCE_STAFF / GM / ADMIN |
| POST | `/api/ledger` | 수기 장부 항목 등록 | FINANCE_MANAGER |
| GET | `/api/ledger/:id` | 항목 상세 | FINANCE_MANAGER / FINANCE_STAFF |
| POST | `/api/ledger/:id/refund` | 환불/취소 항목 등록 (isRefund: true, amount 음수) | FINANCE_MANAGER |

### 신규: sales 모듈 (매출 관리)

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/sales` | 매출 목록 (필터: type, dateRange) | FINANCE_MANAGER / FINANCE_STAFF |
| POST | `/api/sales` | 매출 등록 (quantity 또는 totalAmount 음수 시 400) | FINANCE_MANAGER |
| GET | `/api/sales/summary` | 시즌 집계 (티켓/유니폼/기타 합계) | FINANCE_MANAGER / FINANCE_STAFF / GM |

### 비즈니스 규칙

1. **음수 매출 방지**: `quantity < 0` 또는 `totalAmount < 0` 시 400 `NEGATIVE_SALES_VALUE`.
2. **환불 기록**: 환불은 삭제가 아닌 새 `LedgerEntry(isRefund: true, amount: 음수)` 생성. 원본 항목 유지.
3. **다중 통화**: 등록 시 `currency + exchangeRate` 입력. `amountKrw = amount × exchangeRate` 자동 계산. 저장 시 항상 `amountKrw` 저장.
4. **스폰서십 계약 검증**: `Sponsorship` 생성 시 Club의 `vatNumber`, `companyNumber`, `businessRegNumber` 모두 non-null 체크. 누락 시 404 `CLUB_REG_INFO_MISSING`.
5. **예산 초과 방지**: `OperatingExpense` 등록 시 해당 카테고리 `BudgetTier` 잔여 예산 확인. 초과 시 400 `BUDGET_EXCEEDED` (또는 GM 특별 승인 요청 알림 발송).
6. **타 팀 자동 동기화** (fire-and-forget):
   - HR `PayrollRun` 2차 승인 시 → `LedgerEntry(category: SALARY, amount: netPay)`
   - Equipment RETIRED 시 → `LedgerEntry(category: EQUIPMENT_PURCHASE, amount: -bookValue)`
   - MaintenanceRequest 완료(RESOLVED) 시 → `LedgerEntry(category: FACILITY_REPAIR, amount: actualCost)`
   - SponsorshipPayment 완료 시 → `LedgerEntry(category: SPONSORSHIP, amount: amount, type: INCOME)`
7. **학부모 회비 조회**: `GET /api/ledger?category=ACADEMY_FEE` 로 기존 AcademyFee 데이터 조회 가능.

---

## 7. API — 16-4 시설관리팀

### 기존 facility 모듈 확장

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| PATCH | `/api/facility/maintenance/:id/lock` | 결재 완료 후 잠금 | GM / ADMIN |
| POST | `/api/facility/maintenance/:id/submit-finance` | 고가 수리 재무팀 상신 | FACILITY_MANAGER |

### 신규: inventory 모듈 (소모품/자재 재고)

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/inventory` | 재고 목록 (임계치 이하 항목 표시) | FACILITY_MANAGER / FACILITY_STAFF |
| POST | `/api/inventory` | 재고 항목 등록 | FACILITY_MANAGER |
| PATCH | `/api/inventory/:id/quantity` | 재고 수량 조정 | FACILITY_MANAGER / FACILITY_STAFF |
| GET | `/api/inventory/alerts` | 임계치 미만 항목만 조회 | FACILITY_MANAGER / FACILITY_STAFF / GM |

### 비즈니스 규칙

1. **수리 대장 잠금**: `isLocked = true` 이후 PATCH 시 400 `MAINTENANCE_LOCKED`. FACILITY 팀 외 생성 시도 시 403.
2. **고가 수리 재무 상신**: `estimatedCost >= 1,000,000` 시 `submit-finance` 호출 가능 → `financeSubmittedAt = now()`, 알림 `FINANCE_SUBMIT_REQUIRED` 재무팀 발송.
3. **RESOLVED 시 장부 동기화**: status → RESOLVED 시 `LedgerEntry` fire-and-forget 생성 (6번 규칙).
4. **재고 임계치 알림**: `quantity <= minThreshold` 항목 존재 시 대시보드 경고. 크론 잡으로 일별 체크 → 알림 `INVENTORY_LOW_STOCK` 발송.
5. **타 부서 수리 요청 가시성**: `MaintenanceRequest` 목록 API는 전체 접근 가능 (auth만). 생성은 모든 역할 가능, 수정/승인은 FACILITY 팀만.

---

## 8. 에러 코드

| 상황 | HTTP | 코드 |
|---|---|---|
| 비로그인 | 401 | UNAUTHORIZED |
| 권한 없는 역할 | 403 | FORBIDDEN |
| 잠긴 문서 수정 시도 | 400 | PAYROLL_LOCKED / MAINTENANCE_LOCKED |
| netPay 음수 | 400 | NEGATIVE_NET_PAY |
| 감가상각 값 음수 | 400 | NEGATIVE_BOOK_VALUE |
| 매출 음수 | 400 | NEGATIVE_SALES_VALUE |
| 예산 초과 | 400 | BUDGET_EXCEEDED |
| 라이선스 시트 초과 | 400 | LICENSE_SEAT_EXCEEDED |
| 잘못된 파일 형식 | 400 | INVALID_FILE_TYPE |
| 파일 용량 초과 | 413 | FILE_TOO_LARGE |
| 직원 중복 등록 | 409 | STAFF_ALREADY_EXISTS |
| 기기 중복 할당 | 409 | UNIT_ALREADY_ASSIGNED |
| 직원/선수 없음 | 404 | USER_NOT_FOUND |
| 클럽 사업자 정보 없음 | 404 | CLUB_REG_INFO_MISSING |

---

## 9. 알림 (NotificationType 신규)

| 타입 | 트리거 | 수신자 |
|---|---|---|
| PAYROLL_SECOND_APPROVED | 급여 2차 승인 완료 | HR_STAFF, 해당 직원 |
| IT_ASSET_EXPIRY_SOON | 장비/라이선스 만료 D-30 | ASSET_MANAGER |
| IT_ASSET_RETIREMENT_SYNC | 장비 RETIRED → 재무 동기화 | FINANCE_MANAGER |
| INVENTORY_LOW_STOCK | 재고 임계치 이하 | FACILITY_MANAGER |
| FINANCE_SUBMIT_REQUIRED | 고가 수리 재무 상신 | FINANCE_MANAGER |
| LICENSE_SEAT_EXCEEDED | 라이선스 시트 초과 시도 | ASSET_MANAGER |

---

## 10. 크론 잡 (신규)

| 잡 | 주기 | 동작 |
|---|---|---|
| `startEquipmentExpiryAlertJob` | 매일 09:00 | `expiresAt < now + 30d` 인 EquipmentUnit/SoftwareLicense 알림 |
| `startInventoryThresholdJob` | 매일 09:00 | `quantity <= minThreshold` 인 FacilityInventoryItem 알림 |
| `startMonthlyDepreciationJob` | 매월 1일 00:00 | 활성 EquipmentUnit 감가상각 자동 계산 |

---

## 11. 구현 순서

1. **HR 확장** — payroll-run 2차 승인, netPay 보정, staff-record 중복/퇴사
2. **Equipment 확장** — 감가상각, 고가 분류, 할당 검증
3. **SoftwareLicense 모듈** — CRUD + 시트 관리
4. **Ledger 모듈** — CRUD + 다중 통화 + 환불
5. **Sales 모듈** — CRUD + 음수 검증
6. **Inventory 모듈** — CRUD + 임계치 알림
7. **Facility 확장** — isLocked, 재무 상신
8. **크론 잡 3개** — 장비 만료, 재고 임계치, 월별 감가상각
9. **타 팀 장부 자동 동기화** — payroll/equipment/facility/sponsorship → LedgerEntry
10. **전체 검증** — tsc, jest, E2E smoke
