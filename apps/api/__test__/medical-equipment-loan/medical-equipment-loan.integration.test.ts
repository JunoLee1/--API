/**
 * Integration test scenarios — requires live PostgreSQL (test env).
 * Currently stubbed; implement when test DB is available.
 */

describe.skip("MedicalEquipmentLoan Integration (requires test DB)", () => {
  it("시나리오 1: 일반 대여 전체 라이프사이클 DRAFT → APPROVED → ISSUED → RETURNED", () => {});
  it("시나리오 2: 응급 대여 전체 라이프사이클 EMERGENCY_PENDING → EMERGENCY_RESOLVED → RETURNED", () => {});
  it("시나리오 3: 파트너 없음 → finalCost = originalCost, discountRate = 0", () => {});
  it("시나리오 4: Sponsorship 무상 → finalCost=0, OperatingExpense amount=0 생성", () => {});
  it("시나리오 5: BUDGET_EXCEEDED → 400, EquipmentLoan 미생성 (rollback)", () => {});
  it("시나리오 6: BUDGET_LINE_DEPT_MISMATCH → 400", () => {});
  it("시나리오 7: EMERGENCY_REJECTED → RETURN_REQUIRED 알림 + audit log", () => {});
  it("시나리오 8: escalation cron 중복 실행 → escalatedAt 한 번만 기록 (idempotent)", () => {});
  it("시나리오 9: 요청자 == 승인자 → 403 SELF_APPROVAL_FORBIDDEN", () => {});
  it("시나리오 10: overrideDiscountRate 있을 때 overrideReason 없으면 400", () => {});
});
