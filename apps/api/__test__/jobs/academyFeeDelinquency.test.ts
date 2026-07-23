import { describe, test, jest, expect, beforeEach } from "@jest/globals";

const mockService = {
  processOverdue: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
} as any;

jest.mock("../../src/academy-fee/academy-fee.service", () => ({
  AcademyFeeService: jest.fn().mockImplementation(() => mockService),
}));
jest.mock("../../src/academy-fee/academy-fee.repo", () => ({ AcademyFeeRepository: jest.fn() }));
jest.mock("../../src/notification/notification.repo", () => ({ NotificationRepository: jest.fn() }));
jest.mock("../../src/lib/prisma", () => ({ getPrisma: jest.fn().mockReturnValue({}) }));

import { runDelinquencyCheck } from "../../src/jobs/academyFeeDelinquency";

describe("academyFeeDelinquency job", () => {
  beforeEach(() => jest.clearAllMocks());
  test("processOverdue를 호출한다", async () => {
    await runDelinquencyCheck();
    expect(mockService.processOverdue).toHaveBeenCalledTimes(1);
  });
});
