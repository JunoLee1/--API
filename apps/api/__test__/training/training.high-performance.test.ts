import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TrainingService } from "../../src/training/training.service";

const mockRepo = {
  findById: jest.fn(),
  approve: jest.fn(),
  findPlayerUserId: jest.fn(),
} as any;
const mockNotifRepo = {
  createForHeadCoach: jest.fn().mockResolvedValue(undefined),
  createForUser: jest.fn().mockResolvedValue(undefined),
} as any;

describe("TrainingService — BH8 high performance notification", () => {
  let service: TrainingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrainingService(mockRepo, mockNotifRepo);
    mockRepo.approve.mockResolvedValue({ id: 1, isApproved: true, approvedById: 2 });
  });

  test("80+ 선수 있으면 HEAD_COACH 알림 + 선수 본인 알림", async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      isApproved: false,
      results: [
        { attendance: "PRESENT", performanceScore: 85, playerId: "p1", player: { playerName: "김민준" } },
        { attendance: "PRESENT", performanceScore: 70, playerId: "p2", player: { playerName: "이준" } },
      ],
    });
    mockRepo.findPlayerUserId.mockResolvedValue({ userId: 17 });

    await service.approveSession(1, 2);

    expect(mockNotifRepo.createForHeadCoach).toHaveBeenCalledWith(
      "TRAINING_HIGH_PERFORMANCE_PLAYER",
      expect.any(Function),
      1
    );
    expect(mockNotifRepo.createForUser).toHaveBeenCalledWith(
      17, "TRAINING_HIGH_PERFORMANCE_SELF", expect.any(Function), 1
    );
    // 70점 선수(p2)는 알림 없음
    expect(mockNotifRepo.createForUser).toHaveBeenCalledTimes(1);
  });

  test("80+ 선수 없으면 고퍼포먼스 알림 없음", async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      isApproved: false,
      results: [
        { attendance: "PRESENT", performanceScore: 75, playerId: "p1", player: { playerName: "김민준" } },
      ],
    });

    await service.approveSession(1, 2);

    expect(mockNotifRepo.createForHeadCoach).not.toHaveBeenCalledWith(
      "TRAINING_HIGH_PERFORMANCE_PLAYER",
      expect.any(Function),
      expect.anything()
    );
  });

  test("ABSENT_AUTHORIZED 선수는 고퍼포먼스 체크 제외", async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      isApproved: false,
      results: [
        { attendance: "ABSENT_AUTHORIZED", performanceScore: 90, playerId: "p1", player: { playerName: "김민준" } },
      ],
    });

    await service.approveSession(1, 2);

    expect(mockNotifRepo.createForHeadCoach).not.toHaveBeenCalledWith(
      "TRAINING_HIGH_PERFORMANCE_PLAYER",
      expect.any(Function),
      expect.anything()
    );
  });
});
