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
