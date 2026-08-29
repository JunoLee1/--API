import {
  TRIGGER_MULTIPLIER,
  isWeightTrigger,
  isAdditionalTrigger,
  calculateTierValue,
  promoteTiers,
} from "../../src/budget-plan/promotion";
import type { TriggerType } from "../../src/generated/client";

describe("TRIGGER_MULTIPLIER (ADR 0020)", () => {
  test("가중 트리거 3개 배수 정의", () => {
    expect(TRIGGER_MULTIPLIER.MULTI_LOCATION).toBe(1.0);
    expect(TRIGGER_MULTIPLIER.DIRECT_BUSINESS).toBe(1.2);
    expect(TRIGGER_MULTIPLIER.PUBLIC_UTILITY).toBe(1.2);
  });

  test("가산 트리거 2개 배수 정의", () => {
    expect(TRIGGER_MULTIPLIER.HOME_MATCH).toBe(1.5);
    expect(TRIGGER_MULTIPLIER.WEEKEND_OVERTIME).toBe(1.3);
  });

  test("가중/가산 분류 헬퍼", () => {
    expect(isWeightTrigger("MULTI_LOCATION")).toBe(true);
    expect(isWeightTrigger("HOME_MATCH")).toBe(false);
    expect(isAdditionalTrigger("HOME_MATCH")).toBe(true);
    expect(isAdditionalTrigger("MULTI_LOCATION")).toBe(false);
  });
});

describe("calculateTierValue", () => {
  test("트리거 없음 → 0", () => {
    expect(calculateTierValue(100_000, [])).toBe(0);
  });

  test("단일 트리거 → deltaCost × multiplier", () => {
    expect(calculateTierValue(100_000, ["MULTI_LOCATION"])).toBe(100_000);
    expect(calculateTierValue(100_000, ["HOME_MATCH"])).toBe(150_000);
  });

  test("다중 트리거 → multiplier 합산", () => {
    // HOME_MATCH(1.5) + WEEKEND_OVERTIME(1.3) = 2.8
    expect(calculateTierValue(100_000, ["HOME_MATCH", "WEEKEND_OVERTIME"])).toBe(280_000);
  });

  test("가중+가산 조합", () => {
    // MULTI_LOCATION(1.0) + HOME_MATCH(1.5) = 2.5
    expect(calculateTierValue(200_000, ["MULTI_LOCATION", "HOME_MATCH"])).toBe(500_000);
  });
});

describe("promoteTiers (ADR 0019 rules)", () => {
  type Line = {
    categoryId: number;
    triggers: TriggerType[];
    standardDelta: number;
    premiumDelta: number;
  };

  const runPromote = (lines: Line[], basicCosts: Record<number, number>) => {
    const basicMap = new Map(Object.entries(basicCosts).map(([k, v]) => [Number(k), v]));
    return promoteTiers(lines, basicMap);
  };

  test("트리거 없음 → Basic 만, isSelected=true (강제 배정)", () => {
    const result = runPromote(
      [{ categoryId: 1, triggers: [], standardDelta: 0, premiumDelta: 0 }],
      { 1: 100_000 },
    );

    const cat1 = result.filter((t) => t.categoryId === 1);
    expect(cat1).toHaveLength(1);
    expect(cat1[0]).toMatchObject({ name: "Basic", cost: 100_000, isSelected: true });
  });

  test("가중 트리거 1개 → Basic + Standard 후보 (Standard isSelected=false)", () => {
    const result = runPromote(
      [{ categoryId: 1, triggers: ["MULTI_LOCATION"], standardDelta: 50_000, premiumDelta: 0 }],
      { 1: 100_000 },
    );

    const cat1 = result.filter((t) => t.categoryId === 1);
    expect(cat1).toHaveLength(2);
    expect(cat1[0]).toMatchObject({ name: "Basic", cost: 100_000, isSelected: true });
    expect(cat1[1]).toMatchObject({ name: "Standard", cost: 150_000, isSelected: false });
    // value(Standard) = 50_000 × 1.0 = 50_000
    expect(cat1[1]!.value).toBe(50_000);
  });

  test("가산 트리거 1개 → Basic + Standard + Premium 후보", () => {
    const result = runPromote(
      [{ categoryId: 1, triggers: ["HOME_MATCH"], standardDelta: 40_000, premiumDelta: 60_000 }],
      { 1: 200_000 },
    );

    const cat1 = result.filter((t) => t.categoryId === 1);
    expect(cat1).toHaveLength(3);
    expect(cat1[0]).toMatchObject({ name: "Basic", cost: 200_000 });
    expect(cat1[1]).toMatchObject({ name: "Standard", cost: 240_000 });
    expect(cat1[2]).toMatchObject({ name: "Premium", cost: 300_000 });
    // value(Standard) = 40_000 × 1.5 = 60_000
    expect(cat1[1]!.value).toBe(60_000);
    // value(Premium) = 60_000 × 1.5 = 90_000
    expect(cat1[2]!.value).toBe(90_000);
  });

  test("가중+가산 조합 → multiplier 합산 반영", () => {
    const result = runPromote(
      [
        {
          categoryId: 1,
          triggers: ["MULTI_LOCATION", "HOME_MATCH"],
          standardDelta: 100_000,
          premiumDelta: 0,
        },
      ],
      { 1: 500_000 },
    );

    const cat1 = result.filter((t) => t.categoryId === 1);
    expect(cat1).toHaveLength(3); // 가산 있으니 Premium 도 후보 (delta 0 이어도)
    // value(Standard) = 100_000 × (1.0 + 1.5) = 250_000
    expect(cat1[1]!.value).toBe(250_000);
    // Premium delta 0 이므로 cost=Standard, value=0
    expect(cat1[2]!.cost).toBe(600_000);
    expect(cat1[2]!.value).toBe(0);
  });

  test("여러 카테고리 처리", () => {
    const result = runPromote(
      [
        { categoryId: 1, triggers: [], standardDelta: 0, premiumDelta: 0 },
        { categoryId: 2, triggers: ["HOME_MATCH"], standardDelta: 30_000, premiumDelta: 40_000 },
      ],
      { 1: 100_000, 2: 200_000 },
    );

    expect(result.filter((t) => t.categoryId === 1)).toHaveLength(1);
    expect(result.filter((t) => t.categoryId === 2)).toHaveLength(3);
  });

  test("basicCost 맵에 없는 카테고리 → 스킵 (안전)", () => {
    const result = runPromote(
      [{ categoryId: 999, triggers: [], standardDelta: 0, premiumDelta: 0 }],
      { 1: 100_000 },
    );
    expect(result).toHaveLength(0);
  });
});
