import { describe, test, expect } from "@jest/globals";
import { canReadFinance, canWriteHR, canReadHR } from "../../src/lib/permissions";
import { computeStaffTurnoverRate } from "../../src/hr-report/hr-report.service";

describe("payroll authorization", () => {
  test("canReadFinance: GM can read", () => {
    expect(canReadFinance("GM", null)).toBe(true);
  });

  test("canReadFinance: PLAYER cannot read", () => {
    expect(canReadFinance("PLAYER", null)).toBe(false);
  });

  test("canReadFinance: AGENT cannot read", () => {
    expect(canReadFinance("AGENT", null)).toBe(false);
  });

  test("canWriteHR: HR_MANAGER can write", () => {
    expect(canWriteHR("FRONT_OFFICE", "HR_MANAGER")).toBe(true);
  });

  test("canReadHR: HR_STAFF can read", () => {
    expect(canReadHR("FRONT_OFFICE", "HR_STAFF")).toBe(true);
  });

  test("canReadHR: COACHING_STAFF cannot read HR", () => {
    expect(canReadHR("COACHING_STAFF", null)).toBe(false);
  });
});

describe("computeStaffTurnoverRate", () => {
  test("returns 0 when no terminations", () => {
    expect(computeStaffTurnoverRate(0, 10)).toBeCloseTo(0, 1);
  });

  test("computes rate correctly", () => {
    expect(computeStaffTurnoverRate(2, 10)).toBeCloseTo(20, 1);
  });

  test("returns 0 when headcount is 0", () => {
    expect(computeStaffTurnoverRate(0, 0)).toBe(0);
  });
});

// Pure circular-reference detection logic mirroring department.service.ts (Y3)
function detectsCycle(id: number, parentId: number, ancestors: { id: number; parentId: number | null }[]): boolean {
  if (parentId === id) return true;
  let cursor: number | null = ancestors.find((a) => a.id === parentId)?.parentId ?? null;
  while (cursor !== null) {
    if (cursor === id) return true;
    cursor = ancestors.find((a) => a.id === cursor)?.parentId ?? null;
  }
  return false;
}

describe("department circular reference detection", () => {
  test("direct self-parent is a cycle", () => {
    expect(detectsCycle(1, 1, [])).toBe(true);
  });

  test("ancestor chain cycle detected", () => {
    const ancestors = [{ id: 3, parentId: 2 }, { id: 2, parentId: 1 }, { id: 1, parentId: null }];
    expect(detectsCycle(1, 3, ancestors)).toBe(true);
  });

  test("valid parent is not a cycle", () => {
    const ancestors = [{ id: 2, parentId: null }];
    expect(detectsCycle(3, 2, ancestors)).toBe(false);
  });
});
