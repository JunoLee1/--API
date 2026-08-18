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
