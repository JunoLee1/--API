# ADR 0018: 의무기기 대여 워크플로우

**Status:** Accepted
**Date:** 2026-08-25

## Context

의무팀 기기 대여가 기존 `EquipmentLoan`과 구분 없이 처리되고 있다. 팀장 사전 승인 경로만 존재하며 응급 상황(선수 부상·경기 중 긴급 처치) 대여 경로가 없어 현장 운영이 임의 처리로 흘러간다. 또한 병원(HOSPITAL) 파트너 스폰서십 할인이 대여 비용에 반영되지 않아 예산이 과다 계상되고, 의무비 지출 추적을 위한 OperatingExpense 기록이 없다.

**문제점:**
- 응급 대여 경로 부재 → 감사 불가
- 파트너 할인 미적용 → 예산 과다 계상
- OperatingExpense 기록 부재 → 의무비 지출 추적 불가
- 의무사 / 의무팀장 권한 분리 불명확

## Decision

**의무팀 전용 기기 대여 별도 모델 + 응급 fast-rent 경로 + 파트너 할인 자동 계산**을 채택한다.

**1. `MedicalEquipmentLoanLedger` 별도 모델 (Grill Q8)**
- `EquipmentLoan`과 1:1 FK 연결
- 응급/파트너/할인/예산 컬럼 포함: `isEmergency`, `emergencyReason`, `partnerId`, `partnerContractId`, `sponsorshipId`, `discountRate`, `originalCost`, `finalCost`, `overrideReason`, `budgetLineId`, `operatingExpenseId`
- 기존 `EquipmentLoanStatus` 변경 없음 — 별도 `MedicalEquipmentLoanStatus` enum 사용 (도메인 분리)

**2. `MedicalEquipmentLoanStatus` 신규 enum**
```
DRAFT (일반 경로) → APPROVED → ISSUED → RETURNED
                  ↘ REJECTED

EMERGENCY_ISSUED → EMERGENCY_PENDING_POST_APPROVAL → EMERGENCY_RESOLVED → RETURNED
                  ↘ EMERGENCY_REJECTED (즉시 반납 요구, Q3)
```

**3. 응급 fast-rent 경로 (Q1, Q2, Q9)**
- 요청자 self-flag with `emergencyReason` (필수) — 팀장 사후 검증
- 예산 체크만 skip; 파트너/할인은 조회·계산·기록 유지
- 즉시 `EMERGENCY_ISSUED` → `EMERGENCY_PENDING_POST_APPROVAL`
- 다음 근무일(D+1) 09:00까지 팀장 사후 승인 SLA — 미승인 시 부서장 escalate

**4. `resolvePartnerDiscount` 헬퍼 (Q4, Q5)**
- `EquipmentItem.partnerId` 기반 조회
- 우선순위: `Sponsorship` (ACTIVE, contractEnd > now) > `PartnerContract` (ACTIVE + discountRate)
- Sponsorship 있으면 100% (무상); 없으면 `PartnerContract.discountRate` 적용; 둘 다 없으면 0 (외부 유상)
- `overrideReason` 필수로 팀장 수동 override 가능

**5. 예산 체크 + OperatingExpense (Q6)**
- 항상 BudgetLine remaining 검증 (응급 제외 Q9)
- finalCost=0 (무상) 이어도 OperatingExpense(amount=0) 기록 — 회계 일관성
- 응급 경로: 사후 승인 시 budgetLineId backfill로 예산 라인 연결

**6. 권한 (Grill 결정)**
- `canRequestMedicalEquipmentLoan`: CoachRole `MEDICAL` / `MEDICAL_DIRECTOR` or admin
- `canApproveMedicalEquipmentLoan`: CoachRole `MEDICAL_DIRECTOR` or admin
- 자기 자신 승인 불가 (admin 제외)

**7. 반려 처리 (Q3)**
- 일반 반려: EquipmentLoan → REJECTED, OperatingExpense PENDING → CANCELLED
- 응급 반려: `EMERGENCY_REJECTED` + 즉시 반납 요구 알림 (이중 알림: REJECTED + RETURN_REQUIRED)

## Alternatives Considered

**기존 `EquipmentLoanStatus`에 `EMERGENCY_*` 추가:**
기각 — 기존 장비 대여(팀장 사전 승인) 워크플로우에 영향 범위 크고, 도메인 혼재. 별도 모델 + enum이 경계 설정 명확.

**예산 체크 응급 시에도 강제:**
기각 (Q9) — 현장 운영 불가. 응급 상황에서 예산 라인 확보 대기는 비실용적.

**Sponsorship과 PartnerContract 동시 만족 조건:**
기각 (Q4) — OR 조건 (하나만 있어도 통과). 정확도 > 보수주의.

**OperatingExpense 무상(amount=0) 미기록:**
기각 (Q6) — 회계 일관성 우선. 무상 대여도 추적 가능하고 감시 가능.

## Consequences

**Positive:**
- 응급 대여 감시 추적 가능 — 현장 운영 신뢰성 확보
- 병원 파트너 할인 자동 반영 — 예산 정확성
- 의무비 OperatingExpense 일관 기록 — 지출 추적·보고 가능
- 기존 `EquipmentLoan` 워크플로우 무영향
- 별도 enum + 모델로 도메인 명확화

**Negative:**
- 신규 모듈 + schema 확장 + cron 추가 (D+1 09:00 escalation)
- `Sponsorship.attachedContractId` optional → Sponsorship이 PartnerContract 없이 단독 존재 시 파트너 매칭 불가. 팀장 수동 override로 보완 필수.
- 결재함(approval inbox) UI는 이 ADR 범위 밖 — 별도 follow-up plan 필요

## Related

- **Plan:** `docs/superpowers/plans/2026-08-25-medical-equipment-loan-workflow.md` (Tasks 1~11)
- **Schema:** `MedicalEquipmentLoanLedger`, `MedicalEquipmentLoanStatus`, `MedicalEquipmentLoanStatus` notification types
- **Related ADRs:** 0013 (asset-request approval), 0015 (hiring-dispatch workflow)
- **Grill Session:** 2026-08-25, Q1~Q10 decisions locked
