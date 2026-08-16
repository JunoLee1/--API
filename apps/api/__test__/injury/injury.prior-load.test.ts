import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { InjuryService } from "../../src/injury/injury.service";

const mockRepo = {
  create: jest.fn(),
  updatePriorWeeklyLoad: jest.fn(),
  findById: jest.fn(),
} as any;
const mockNotifRepo = { createForCoachingStaff: jest.fn() } as any;
const mockLoadRepo = {
  getWeeklyLoadTotal: jest.fn(),
} as any;

describe("InjuryService — priorWeeklyLoad auto-populate (BH4)", () => {
  let service: InjuryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InjuryService(mockRepo, mockNotifRepo, mockLoadRepo);
    mockRepo.create.mockResolvedValue({ id: 10, playerId: "player-001" });
    mockRepo.updatePriorWeeklyLoad.mockResolvedValue(undefined);
  });

  test("createInjury 후 getWeeklyLoadTotal 조회 → updatePriorWeeklyLoad 호출", async () => {
    mockLoadRepo.getWeeklyLoadTotal.mockResolvedValue(420);
    await service.createInjury({ playerId: "player-001", bodyPart: "KNEE", cause: "TRAINING" } as any);
    // fire-and-forget이므로 microtask flush 필요
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockLoadRepo.getWeeklyLoadTotal).toHaveBeenCalledWith("player-001", expect.any(Date));
    expect(mockRepo.updatePriorWeeklyLoad).toHaveBeenCalledWith(10, 420);
  });

  test("loadTotal이 0이면 updatePriorWeeklyLoad 호출 안 함", async () => {
    mockLoadRepo.getWeeklyLoadTotal.mockResolvedValue(0);
    await service.createInjury({ playerId: "player-001", bodyPart: "KNEE", cause: "TRAINING" } as any);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockRepo.updatePriorWeeklyLoad).not.toHaveBeenCalled();
  });
});
