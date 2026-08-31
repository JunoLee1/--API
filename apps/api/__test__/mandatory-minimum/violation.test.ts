import { describe, test, expect, jest } from "@jest/globals";
import { detectMinimumViolation } from "../../src/mandatory-minimum/violation";
import type { PrismaClient } from "../../src/generated/client";

type Tier = { id: number; name: string; cost: number };

const makePrisma = (opts: {
  planId?: number | null;
  mandatoryMinimum?: number;
  tiers?: Tier[];
}) => {
  const findUnique = jest.fn().mockImplementation((_args: any) => {
    if (opts.planId === null) return Promise.resolve(null);
    return Promise.resolve({
      id: opts.planId ?? 10,
      mandatoryMinimum: opts.mandatoryMinimum ?? 0,
      tiers: opts.tiers ?? [],
    });
  });
  return {
    budgetCategoryPlan: { findUnique } as any,
    __findUnique: findUnique,
  };
};

describe("detectMinimumViolation", () => {
  test("Basic=100, newMinimum=200 → violated=true, delta=100", async () => {
    const prisma = makePrisma({
      planId: 10,
      mandatoryMinimum: 200,
      tiers: [{ id: 1, name: "Basic", cost: 100 }],
    });
    const result = await detectMinimumViolation(
      prisma as unknown as PrismaClient,
      10,
    );
    expect(result.violated).toBe(true);
    expect(result.basicCost).toBe(100);
    expect(result.newMinimum).toBe(200);
    expect(result.violationDelta).toBe(100);
  });

  test("Basic=300, newMinimum=200 → violated=false, delta=0", async () => {
    const prisma = makePrisma({
      planId: 10,
      mandatoryMinimum: 200,
      tiers: [{ id: 1, name: "Basic", cost: 300 }],
    });
    const result = await detectMinimumViolation(
      prisma as unknown as PrismaClient,
      10,
    );
    expect(result.violated).toBe(false);
    expect(result.basicCost).toBe(300);
    expect(result.newMinimum).toBe(200);
    expect(result.violationDelta).toBe(0);
  });

  test("Basic=200, newMinimum=200 → 동등 (violated=false)", async () => {
    const prisma = makePrisma({
      planId: 10,
      mandatoryMinimum: 200,
      tiers: [{ id: 1, name: "Basic", cost: 200 }],
    });
    const result = await detectMinimumViolation(
      prisma as unknown as PrismaClient,
      10,
    );
    // 위반은 엄격한 < 만 (같으면 딱 맞음)
    expect(result.violated).toBe(false);
    expect(result.violationDelta).toBe(0);
  });

  test("Basic 티어 없음 (다른 티어만 있음) → violated=false, basicCost=null", async () => {
    const prisma = makePrisma({
      planId: 10,
      mandatoryMinimum: 200,
      tiers: [
        { id: 1, name: "Standard", cost: 150 },
        { id: 2, name: "Premium", cost: 400 },
      ],
    });
    const result = await detectMinimumViolation(
      prisma as unknown as PrismaClient,
      10,
    );
    expect(result.violated).toBe(false);
    expect(result.basicCost).toBeNull();
    expect(result.newMinimum).toBe(200);
    expect(result.violationDelta).toBe(0);
  });

  test("티어 배열 비어있음 → violated=false, basicCost=null", async () => {
    const prisma = makePrisma({
      planId: 10,
      mandatoryMinimum: 500,
      tiers: [],
    });
    const result = await detectMinimumViolation(
      prisma as unknown as PrismaClient,
      10,
    );
    expect(result.violated).toBe(false);
    expect(result.basicCost).toBeNull();
    expect(result.violationDelta).toBe(0);
  });

  test("categoryPlan 없음 → 404 CATEGORY_PLAN_NOT_FOUND", async () => {
    const prisma = makePrisma({ planId: null });
    await expect(
      detectMinimumViolation(prisma as unknown as PrismaClient, 999),
    ).rejects.toMatchObject({ statusCode: 404, code: "CATEGORY_PLAN_NOT_FOUND" });
  });

  test("mandatoryMinimum=0 + Basic=0 → violated=false (0 = 0)", async () => {
    const prisma = makePrisma({
      planId: 10,
      mandatoryMinimum: 0,
      tiers: [{ id: 1, name: "Basic", cost: 0 }],
    });
    const result = await detectMinimumViolation(
      prisma as unknown as PrismaClient,
      10,
    );
    expect(result.violated).toBe(false);
    expect(result.basicCost).toBe(0);
    expect(result.newMinimum).toBe(0);
  });
});
