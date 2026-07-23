import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { NotificationRepository } from "../../src/notification/notification.repo";

const mockPrisma = {
  notification: {
    create: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
  },
} as any;

const repo = new NotificationRepository(mockPrisma);

describe("NotificationRepository - createForGuardian", () => {
  beforeEach(() => jest.clearAllMocks());

  test("sends notification to specific guardian user", async () => {
    await repo.createForGuardian(10, "YOUTH_REGISTRATION_STATUS_CHANGED", "입단 승인", "승인되었습니다.", 5);
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 10,
        type: "YOUTH_REGISTRATION_STATUS_CHANGED",
        title: "입단 승인",
        body: "승인되었습니다.",
        entityId: 5,
      }),
    });
  });
});
