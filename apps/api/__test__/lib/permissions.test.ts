import { describe, test, expect } from "@jest/globals";
import { hasPermission, Permission } from "../../src/lib/permissions";

describe("GUARDIAN permissions", () => {
  test("GUARDIAN has no special permissions", () => {
    expect(hasPermission("GUARDIAN", Permission.SYSTEM_MANAGE)).toBe(false);
    expect(hasPermission("GUARDIAN", Permission.FINANCE_APPROVE)).toBe(false);
    expect(hasPermission("GUARDIAN", Permission.VIEW_TEAM_RANKING)).toBe(false);
  });

  test("existing roles unaffected", () => {
    expect(hasPermission("ADMIN", Permission.SYSTEM_MANAGE)).toBe(true);
    expect(hasPermission("PLAYER", Permission.VIEW_TEAM_RANKING)).toBe(true);
  });
});

describe("requireSuperAdmin", () => {
  const { requireSuperAdmin } = require("../../src/lib/permissions");
  const { AppError } = require("../../src/lib/appError");

  test("SUPER_ADMIN이면 throw 없음", () => {
    expect(() => requireSuperAdmin({ user: { role: "SUPER_ADMIN" } } as any)).not.toThrow();
  });

  test("ADMIN이면 403", () => {
    expect(() => requireSuperAdmin({ user: { role: "ADMIN" } } as any)).toThrow(AppError);
  });

  test("user 없으면 403", () => {
    expect(() => requireSuperAdmin({} as any)).toThrow(AppError);
  });
});

describe("canReadFinance", () => {
  const { canReadFinance } = require("../../src/lib/permissions");

  test("ADMIN → true", () => expect(canReadFinance("ADMIN", null)).toBe(true));
  test("SUPER_ADMIN → true", () => expect(canReadFinance("SUPER_ADMIN", null)).toBe(true));
  test("GM → true", () => expect(canReadFinance("GM", null)).toBe(true));
  test("FRONT_OFFICE + FINANCE_MANAGER → true", () => expect(canReadFinance("FRONT_OFFICE", "FINANCE_MANAGER")).toBe(true));
  test("FRONT_OFFICE + FINANCE_STAFF → true", () => expect(canReadFinance("FRONT_OFFICE", "FINANCE_STAFF")).toBe(true));
  test("FRONT_OFFICE + TD → false", () => expect(canReadFinance("FRONT_OFFICE", "TD")).toBe(false));
  test("COACHING_STAFF → false", () => expect(canReadFinance("COACHING_STAFF", null)).toBe(false));
});

describe("canWriteFinance", () => {
  const { canWriteFinance } = require("../../src/lib/permissions");

  test("ADMIN → true", () => expect(canWriteFinance("ADMIN", null)).toBe(true));
  test("GM → true", () => expect(canWriteFinance("GM", null)).toBe(true));
  test("FRONT_OFFICE + FINANCE_MANAGER → true", () => expect(canWriteFinance("FRONT_OFFICE", "FINANCE_MANAGER")).toBe(true));
  test("FRONT_OFFICE + FINANCE_STAFF → false", () => expect(canWriteFinance("FRONT_OFFICE", "FINANCE_STAFF")).toBe(false));
  test("FRONT_OFFICE + TD → false", () => expect(canWriteFinance("FRONT_OFFICE", "TD")).toBe(false));
});

describe("canReadHR", () => {
  const { canReadHR } = require("../../src/lib/permissions");

  test("ADMIN → true", () => expect(canReadHR("ADMIN", null)).toBe(true));
  test("GM → true", () => expect(canReadHR("GM", null)).toBe(true));
  test("FRONT_OFFICE + HR_MANAGER → true", () => expect(canReadHR("FRONT_OFFICE", "HR_MANAGER")).toBe(true));
  test("FRONT_OFFICE + HR_STAFF → true", () => expect(canReadHR("FRONT_OFFICE", "HR_STAFF")).toBe(true));
  test("FRONT_OFFICE + TD → false", () => expect(canReadHR("FRONT_OFFICE", "TD")).toBe(false));
  test("PLAYER → false", () => expect(canReadHR("PLAYER", null)).toBe(false));
});

describe("canWriteHR", () => {
  const { canWriteHR } = require("../../src/lib/permissions");

  test("ADMIN → true", () => expect(canWriteHR("ADMIN", null)).toBe(true));
  test("GM → true", () => expect(canWriteHR("GM", null)).toBe(true));
  test("FRONT_OFFICE + HR_MANAGER → true", () => expect(canWriteHR("FRONT_OFFICE", "HR_MANAGER")).toBe(true));
  test("FRONT_OFFICE + HR_STAFF → false", () => expect(canWriteHR("FRONT_OFFICE", "HR_STAFF")).toBe(false));
});

describe("canManageTD", () => {
  const { canManageTD } = require("../../src/lib/permissions");

  test("ADMIN → true", () => expect(canManageTD("ADMIN", null)).toBe(true));
  test("GM → true", () => expect(canManageTD("GM", null)).toBe(true));
  test("FRONT_OFFICE + TD → true", () => expect(canManageTD("FRONT_OFFICE", "TD")).toBe(true));
  test("FRONT_OFFICE + HR_MANAGER → false", () => expect(canManageTD("FRONT_OFFICE", "HR_MANAGER")).toBe(false));
  test("COACHING_STAFF → false", () => expect(canManageTD("COACHING_STAFF", null)).toBe(false));
});
