import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { NotificationService } from "../../src/notification/notification.service";

const mockRepo = {
  createForUser: jest.fn<() => Promise<any>>().mockResolvedValue({}),
  createForHeadCoach: jest.fn<() => Promise<any>>().mockResolvedValue({}),
} as any;

// Socket.io mock
jest.mock("../../src/lib/io", () => ({
  getIO: () => ({ to: () => ({ emit: jest.fn() }) }),
}));

const service = new NotificationService(mockRepo);

describe("NotificationService - notifyJerseyConflict", () => {
  beforeEach(() => jest.clearAllMocks());

  test("OCCUPIED 사유로 선수에게 알림", async () => {
    await service.notifyJerseyConflict(42, 7, "OCCUPIED");
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      42, "JERSEY_NUMBER_CONFLICT",
      expect.any(Function),
    );
  });

  test("RETIRED 사유로 알림", async () => {
    await service.notifyJerseyConflict(42, 10, "RETIRED");
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      42, "JERSEY_NUMBER_CONFLICT",
      expect.any(Function),
    );
  });
});

describe("NotificationService - notifyAttendanceUnauthorized", () => {
  beforeEach(() => jest.clearAllMocks());

  test("무단 지각 알림", async () => {
    await service.notifyAttendanceUnauthorized(10, "LATE", new Date("2026-07-20"), 1, 0);
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      10, "ATTENDANCE_UNAUTHORIZED",
      expect.any(Function),
    );
  });

  test("무단 결근 알림", async () => {
    await service.notifyAttendanceUnauthorized(10, "ABSENT", new Date("2026-07-20"), 1, 1);
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      10, "ATTENDANCE_UNAUTHORIZED",
      expect.any(Function),
    );
  });
});

describe("NotificationService - notifyAttendancePenaltyPlayer", () => {
  beforeEach(() => jest.clearAllMocks());

  test("페널티 경고 알림", async () => {
    await service.notifyAttendancePenaltyPlayer(10, 3);
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      10, "ATTENDANCE_PENALTY_PLAYER",
      expect.any(Function),
    );
  });
});

describe("NotificationService - notifyMatchDayReminder", () => {
  beforeEach(() => jest.clearAllMocks());

  test("경기 D-1 알림", async () => {
    const match = {
      date: new Date("2026-07-21T10:00:00Z"),
      homeTeamName: "FC Seoul",
      awayTeamName: "Busan IPark",
      venue: "서울월드컵경기장",
    };
    await service.notifyMatchDayReminder(10, match);
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      10, "MATCH_DAY_REMINDER",
      expect.any(Function),
    );
  });
});
