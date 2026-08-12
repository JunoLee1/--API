import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TacticalRepository } from "../../src/tactical/tactical.repo";

const mockUpdate = jest.fn();
const mockPrisma = {
  tacticalAnalysis: { update: mockUpdate },
} as any;

describe("TacticalRepository — threat scores", () => {
  let repo: TacticalRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TacticalRepository(mockPrisma);
  });

  test("update() passes opponentPressureScore to Prisma", async () => {
    mockUpdate.mockResolvedValue({ id: 1, opponentPressureScore: 7 });
    await repo.update(1, { opponentPressureScore: 7 });
    const call = mockUpdate.mock.calls[0]![0] as any;
    expect(call.data.opponentPressureScore).toBe(7);
  });

  test("update() passes 0 for opponentSetPieceScore when 0 is given", async () => {
    mockUpdate.mockResolvedValue({ id: 1, opponentSetPieceScore: 0 });
    await repo.update(1, { opponentSetPieceScore: 0 });
    const call = mockUpdate.mock.calls[0]![0] as any;
    expect(call.data.opponentSetPieceScore).toBe(0);
  });

  test("update() omits threat score fields when not provided", async () => {
    mockUpdate.mockResolvedValue({ id: 1 });
    await repo.update(1, { formation: "4-3-3" });
    const call = mockUpdate.mock.calls[0]![0] as any;
    expect(call.data.opponentPressureScore).toBeUndefined();
    expect(call.data.opponentSetPieceScore).toBeUndefined();
    expect(call.data.opponentCounterScore).toBeUndefined();
  });
});
