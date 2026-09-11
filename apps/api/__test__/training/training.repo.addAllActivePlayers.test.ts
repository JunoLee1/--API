import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TrainingRepository } from "../../src/training/training.repo";

const mockFindMany = jest.fn().mockResolvedValue([]);
const mockCreateMany = jest.fn().mockResolvedValue({ count: 0 });

const mockPrisma = {
  player: { findMany: mockFindMany },
  trainingParticipant: { createMany: mockCreateMany },
  trainingResult: { createMany: mockCreateMany },
} as any;

const repo = new TrainingRepository(mockPrisma);

beforeEach(() => {
  jest.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
});

describe("TrainingRepository.addAllActivePlayers — 팀 타입 필터 (#520)", () => {
  test("teamId 없을 때 FIRST_TEAM 선수만 조회한다", async () => {
    await repo.addAllActivePlayers(1, null);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          team: { type: "FIRST_TEAM" },
        }),
      })
    );
  });

  test("teamId 없을 때 teamId 필터가 포함되지 않는다", async () => {
    await repo.addAllActivePlayers(1, null);
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg).not.toHaveProperty("teamId");
  });

  test("teamId 있을 때 해당 팀 선수만 조회한다", async () => {
    await repo.addAllActivePlayers(1, 5);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: 5,
        }),
      })
    );
  });

  test("teamId 있을 때 team.type 필터가 포함되지 않는다", async () => {
    await repo.addAllActivePlayers(1, 5);
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg).not.toHaveProperty("team");
  });
});
