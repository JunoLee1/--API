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
      "등번호 7번 선택 불가",
      expect.stringContaining("이미 다른 선수가 사용 중"),
    );
  });

  test("RETIRED 사유로 알림", async () => {
    await service.notifyJerseyConflict(42, 10, "RETIRED");
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      42, "JERSEY_NUMBER_CONFLICT",
      "등번호 10번 선택 불가",
      expect.stringContaining("영구결번"),
    );
  });
});

describe("NotificationService - notifyAttendanceUnauthorized", () => {
  beforeEach(() => jest.clearAllMocks());

  test("무단 지각 알림", async () => {
    await service.notifyAttendanceUnauthorized(10, "LATE", new Date("2026-07-20"), 1, 0);
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      10, "ATTENDANCE_UNAUTHORIZED",
      expect.stringContaining("무단 지각"),
      expect.stringContaining("누적"),
    );
  });

  test("무단 결근 알림", async () => {
    await service.notifyAttendanceUnauthorized(10, "ABSENT", new Date("2026-07-20"), 1, 1);
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      10, "ATTENDANCE_UNAUTHORIZED",
      expect.stringContaining("무단 결근"),
      expect.any(String),
    );
  });
});

describe("NotificationService - notifyAttendancePenaltyPlayer", () => {
  beforeEach(() => jest.clearAllMocks());

  test("페널티 경고 알림", async () => {
    await service.notifyAttendancePenaltyPlayer(10, 3);
    expect(mockRepo.createForUser).toHaveBeenCalledWith(
      10, "ATTENDANCE_PENALTY_PLAYER",
      "출결 페널티 경고",
      expect.stringContaining("3회"),
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
      "내일 경기 알림",
      expect.stringContaining("FC Seoul"),
    );
  });
});
