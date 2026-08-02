# 부서 계층 구조 설계 — 재무관리 · 자산관리

> 날짜: 2026-08-01  
> 범위: Department 모델 계층화, 재무/자산 분리, 접근 제어

---

## 배경

현재 `Department` 모델은 플랫 구조(`id, name, isActive`)로 계층 개념이 없다.  
클럽 조직에 재무관리·자산관리 상위 부서와 그 하위 팀이 존재하므로, ERP가 이를 반영해야 한다.  
목적: 인사 조직도, 부서별 예산 귀속, 데이터 접근 필터링.

---

## 확정 구조

```
재무관리 (parentId: null)   ← FINANCE_MANAGER 담당
자산관리 (parentId: null)   ← ASSET_MANAGER 담당 (신규 역할)
  ├── HR
  ├── 선수 장비관리          ← football ERP 내 구현
  ├── 의료기기 관리          ← football ERP 내 구현
  ├── 시설관리               ← 자산관리ERP 위임 (조직도 목적으로만 존재)
  └── IT 자산관리            ← 자산관리ERP 위임 (조직도 목적으로만 존재)
```

재무관리는 예산 편성·재무 보고·운영비 집행 전담.  
자산관리는 인사·장비·의료기기 총괄. 시설·IT는 자산관리ERP로 위임.  
두 부서는 겸임 없이 독립 운영.

### 시스템 분리 원칙

| 부서 | 구현 위치 | 이유 |
|------|----------|------|
| HR | football ERP | StaffRecord·HrReport와 결합 |
| 선수 장비관리 | football ERP | Player·Team·Season과 tight 결합 |
| 의료기기 관리 | football ERP | MedicalExpense·Injury와 결합 |
| 시설관리 | 자산관리ERP | 순수 물적 자산, 도메인 결합 없음 |
| IT 자산관리 | 자산관리ERP | 순수 물적 자산, 도메인 결합 없음 |

시설관리·IT 자산관리는 football ERP `Department` 테이블에 org chart 용도로만 존재.  
실제 자산 라이프사이클(취득·감가상각·유지보수)은 자산관리ERP가 담당.

---

## 섹션 1 — 데이터 모델

### Department (schema.prisma)

```prisma
model Department {
  id           Int           @id @default(autoincrement())
  name         String        @unique
  parentId     Int?
  parent       Department?   @relation("DepartmentHierarchy", fields: [parentId], references: [id])
  children     Department[]  @relation("DepartmentHierarchy")
  isActive     Boolean       @default(true)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  staffRecords StaffRecord[]
  expenses     OperatingExpense[]
}
```

### 시드 데이터

| name | parentId |
|------|----------|
| 재무관리 | null |
| 자산관리 | null |
| HR | 자산관리.id |
| 선수 장비관리 | 자산관리.id |
| 의료기기 관리 | 자산관리.id |
| 시설관리 | 자산관리.id |
| IT 자산관리 | 자산관리.id |

### frontOfficeRole enum 추가

```prisma
enum FrontOfficeRole {
  GM
  TD
  CONTRACT_MANAGER
  SCOUT
  EQUIPMENT_MANAGER
  TACTICAL_ANALYST
  FINANCE_MANAGER
  ASSET_MANAGER   // 신규
}
```

---

## 섹션 2 — 예산 연동

`BudgetCategoryPlan`(Knapsack 최적화)은 변경하지 않는다.  
지출 귀속만 추가한다.

### OperatingExpense 변경

```prisma
model OperatingExpense {
  // 기존 필드 유지
  departmentId Int?
  department   Department? @relation(fields: [departmentId], references: [id])
}
```

- 지출 등록 시 담당 부서 태깅 (optional)
- TRAVEL·SCOUTING·YOUTH 카테고리처럼 특정 하위 부서에 귀속되지 않는 지출은 `departmentId = null`
- 부서별 지출 집계: `GROUP BY departmentId`

---

## 섹션 3 — 접근 제어

별도 권한 미들웨어 추가 없음. 기존 Role + frontOfficeRole 유지.  
부서는 **데이터 필터** 역할만 담당.

| 역할 | 접근 범위 |
|------|----------|
| ADMIN | 전 부서 |
| GM | 전 부서 |
| FINANCE_MANAGER | 재무관리 scope (BudgetCategoryPlan, OperatingExpense 전체) |
| ASSET_MANAGER | 자산관리 + 하위 4개 부서 전체 |
| EQUIPMENT_MANAGER | 선수 장비관리 부서 데이터 |
| 기타 하위 부서 직원 | 본인 소속 departmentId 데이터만 |

구현: 각 서비스에서 `req.user.staffRecord.departmentId`를 조회해 WHERE 조건 추가.  
ASSET_MANAGER는 `department.parentId = 자산관리.id` 포함 자식 부서까지 자동 포함.

---

## 미결 사항

- 시설관리·HR·의료기기 관리 담당 frontOfficeRole 추가 여부 → 나중에 결정
- FINANCE_MANAGER의 OperatingExpense 전체 열람 범위 확정 필요 (재무관리 소속 지출만 vs. 전체)
