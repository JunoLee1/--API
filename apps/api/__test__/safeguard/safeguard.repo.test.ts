import { describe, test, jest, expect, beforeEach } from "@jest/globals";

const mockPrisma = {
  user: { update: jest.fn() },
  safeguardReport: { update: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
};

jest.mock("../../src/lib/prisma", () => ({ getPrisma: () => mockPrisma }));

import { SafeguardRepository } from "../../src/safeguard/safeguard.repo";

describe("SafeguardRepository — suspendedAt", () => {
  let repo: SafeguardRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SafeguardRepository(mockPrisma as any);
  });

  test("suspendUser sets suspendedAt to current timestamp", async () => {
    const before = new Date();
    (mockPrisma.user.update as jest.Mock).mockResolvedValue({ id: 1, isSuspended: true, suspendedAt: new Date() });

    await repo.suspendUser(1);

    const updateArgs = (mockPrisma.user.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data.isSuspended).toBe(true);
    expect(updateArgs.data.suspendedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.suspendedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
