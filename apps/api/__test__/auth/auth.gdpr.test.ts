import { describe, test, jest, expect, beforeEach } from "@jest/globals";

process.env["PHONE_ENCRYPTION_KEY"] = "a".repeat(64);

const mockWriteAuditLog = jest.fn().mockResolvedValue(undefined);
jest.mock("../../src/lib/auditLog", () => ({ writeAuditLog: mockWriteAuditLog }));
jest.mock("../../src/lib/hash", () => ({ hashPassword: jest.fn(), comparePassword: jest.fn() }));
jest.mock("../../src/lib/crypto", () => ({ encrypt: jest.fn(), decrypt: jest.fn() }));
jest.mock("../../src/lib/token", () => ({ generateTokens: jest.fn() }));

const mockRepo = {
  findById: jest.fn(),
  anonymizeUser: jest.fn(),
  exportUserData: jest.fn(),
};

jest.mock("../../src/lib/prisma", () => ({ getPrisma: () => ({}) }));

import { AuthService } from "../../src/auth/auth.service";

describe("AuthService — GDPR", () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(mockRepo as any);
  });

  test("gdprErasure calls anonymizeUser and writes audit log", async () => {
    mockRepo.findById.mockResolvedValue({ id: 5, email: "test@example.com", isDeleted: false });
    mockRepo.anonymizeUser.mockResolvedValue({ id: 5, email: "deleted_5@deleted.com", isDeleted: true });

    await service.gdprErasure(5, 1);

    expect(mockRepo.anonymizeUser).toHaveBeenCalledWith(5);
    await Promise.resolve();
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: "GDPR_ERASURE_REQUESTED", targetId: 5 })
    );
  });

  test("gdprErasure throws 404 if user not found", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.gdprErasure(999, 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  test("gdprExport returns user data for ADMIN", async () => {
    mockRepo.exportUserData.mockResolvedValue({ profile: { id: 5 }, player: null, contracts: [] });

    const result = await service.gdprExport(5, 1, "ADMIN");

    expect(mockRepo.exportUserData).toHaveBeenCalledWith(5);
    expect(result.profile.id).toBe(5);
  });

  test("gdprExport returns user data when self-requesting", async () => {
    mockRepo.exportUserData.mockResolvedValue({ profile: { id: 5 }, player: null, contracts: [] });

    const result = await service.gdprExport(5, 5, "PLAYER");

    expect(mockRepo.exportUserData).toHaveBeenCalledWith(5);
    expect(result.profile.id).toBe(5);
  });

  test("gdprExport throws 403 when non-admin requests another user", async () => {
    await expect(service.gdprExport(5, 99, "PLAYER")).rejects.toMatchObject({ statusCode: 403 });
  });
});
