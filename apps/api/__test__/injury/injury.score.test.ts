import { describe, test, expect } from "@jest/globals";
import {
  calculateMedicalScore,
  calculateFunctionalScore,
  calculateModifierScore,
  calculateTotalScore,
} from "../../src/injury/injury.score";

describe("calculateMedicalScore", () => {
  test("최대 통증 + 부종 + ROM 0 → 40", () => {
    expect(calculateMedicalScore(10, true, 0)).toBeCloseTo(40);
  });
  test("통증 없음 + 부종 없음 + ROM 100 → 0", () => {
    expect(calculateMedicalScore(0, false, 100)).toBeCloseTo(0);
  });
  test("중간 케이스: painLevel=5, swelling=true, rom=50 → 25", () => {
    // pain: 5/10*20=10, swelling: 10, rom: (100-50)/100*10=5 → 25
    expect(calculateMedicalScore(5, true, 50)).toBeCloseTo(25);
  });
});

describe("calculateFunctionalScore", () => {
  test("기능 전혀 없음 (0,0,0) → 40", () => {
    expect(calculateFunctionalScore(0, 0, 0)).toBeCloseTo(40);
  });
  test("완전 회복 (100,100,100) → 0", () => {
    expect(calculateFunctionalScore(100, 100, 100)).toBeCloseTo(0);
  });
  test("평균 50 → 20", () => {
    expect(calculateFunctionalScore(50, 50, 50)).toBeCloseTo(20);
  });
});

describe("calculateModifierScore", () => {
  test("최대 불안 + 최대 위험 포지션 (100,100) → 20", () => {
    expect(calculateModifierScore(100, 100)).toBeCloseTo(20);
  });
  test("안정 + 저위험 (0,0) → 0", () => {
    expect(calculateModifierScore(0, 0)).toBeCloseTo(0);
  });
});

describe("calculateTotalScore", () => {
  test("임계점 초과 케이스 → totalScore ≥ 80", () => {
    const result = calculateTotalScore({
      painLevel: 10, hasSwelling: true, romScore: 0,
      strengthScore: 0, sprintScore: 0, jumpScore: 0,
      psychScore: 100, positionRiskScore: 100,
    });
    expect(result.totalScore).toBeCloseTo(100);
    expect(result.medicalScore).toBeCloseTo(40);
    expect(result.functionalScore).toBeCloseTo(40);
    expect(result.modifierScore).toBeCloseTo(20);
  });
  test("경미한 부상 → totalScore < 80", () => {
    const result = calculateTotalScore({
      painLevel: 2, hasSwelling: false, romScore: 90,
      strengthScore: 85, sprintScore: 80, jumpScore: 85,
      psychScore: 10, positionRiskScore: 20,
    });
    expect(result.totalScore).toBeLessThan(80);
  });
});
