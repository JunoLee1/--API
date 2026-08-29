import { calculateCapacity, validateInvariants } from "../../src/budget-plan/capacity";
import { AppError } from "../../src/lib/appError";

describe("calculateCapacity", () => {
  test("totalOperatingBudget − Σ Basic.cost − contingencyReserve 반환", () => {
    const capacity = calculateCapacity(
      { totalOperatingBudget: 1000, contingencyReserve: 100 },
      [{ cost: 300 }, { cost: 200 }],
    );
    expect(capacity).toBe(400); // 1000 - 500 - 100
  });

  test("contingencyReserve null → 0 취급", () => {
    const capacity = calculateCapacity(
      { totalOperatingBudget: 1000, contingencyReserve: null },
      [{ cost: 300 }],
    );
    expect(capacity).toBe(700);
  });

  test("totalOperatingBudget null → 0 취급, capacity 는 음수 가능", () => {
    const capacity = calculateCapacity(
      { totalOperatingBudget: null, contingencyReserve: 100 },
      [{ cost: 300 }],
    );
    expect(capacity).toBe(-400); // 0 - 300 - 100
  });

  test("Basic 티어 합계가 예산 초과 → 음수 반환", () => {
    const capacity = calculateCapacity(
      { totalOperatingBudget: 500, contingencyReserve: 100 },
      [{ cost: 300 }, { cost: 300 }],
    );
    expect(capacity).toBe(-200); // 500 - 600 - 100
  });

  test("티어 없음 → totalOperatingBudget − contingencyReserve", () => {
    const capacity = calculateCapacity(
      { totalOperatingBudget: 1000, contingencyReserve: 100 },
      [],
    );
    expect(capacity).toBe(900);
  });
});

describe("validateInvariants", () => {
  test("모든 카테고리 Basic.cost ≥ mandatoryMinimum → 통과", () => {
    expect(() =>
      validateInvariants([
        { categoryId: 1, mandatoryMinimum: 200, basicCost: 300 },
        { categoryId: 2, mandatoryMinimum: 100, basicCost: 100 },
      ]),
    ).not.toThrow();
  });

  test("한 카테고리 Basic < mandatoryMinimum → 400 BASIC_BELOW_MANDATORY_MIN", () => {
    expect(() =>
      validateInvariants([
        { categoryId: 1, mandatoryMinimum: 500, basicCost: 300 },
      ]),
    ).toThrow(AppError);
    try {
      validateInvariants([{ categoryId: 1, mandatoryMinimum: 500, basicCost: 300 }]);
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("BASIC_BELOW_MANDATORY_MIN");
    }
  });

  test("에러 detail 에 위반 카테고리 목록 포함", () => {
    try {
      validateInvariants([
        { categoryId: 1, mandatoryMinimum: 500, basicCost: 300 },
        { categoryId: 2, mandatoryMinimum: 100, basicCost: 100 },
        { categoryId: 3, mandatoryMinimum: 200, basicCost: 100 },
      ]);
    } catch (err: any) {
      expect(err.message).toContain("1");
      expect(err.message).toContain("3");
      expect(err.message).not.toContain("2");
    }
  });
});
