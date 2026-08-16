import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { MatchLineupRepository } from "../../src/match/match.lineup.repo";

const mockFindMany = jest.fn();
const mockPrisma = {
  injury: { findMany: mockFindMany },
} as any;

describe("MatchLineupRepository — BH9 matchAvailable bypass", () => {
  let repo: MatchLineupRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new MatchLineupRepository(mockPrisma);
  });

  test("matchAvailable=true + medicalSignedAt 있으면 결과에서 제외", async () => {
    mockFindMany.mockResolvedValue([
      { playerId: "p1" }, // 일반 부상 → 포함
      // p2는 matchAvailable=true + medicalSignedAt → 쿼리에서 제외되므로 반환 안 됨
    ]);
    const result = await repo.findActiveInjuredPlayerIds(["p1", "p2"]);
    expect(result.map(r => r.playerId)).toEqual(["p1"]);
  });

  test("matchAvailable=true 지만 medicalSignedAt=null이면 여전히 블록", async () => {
    mockFindMany.mockResolvedValue([
      { playerId: "p1" },
      { playerId: "p2" }, // medicalSignedAt 없음 → 블록 유지
    ]);
    const result = await repo.findActiveInjuredPlayerIds(["p1", "p2"]);
    expect(result.map(r => r.playerId)).toContain("p2");
  });
});
