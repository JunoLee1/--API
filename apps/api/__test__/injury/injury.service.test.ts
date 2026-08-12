import { describe, test, jest, expect, beforeEach } from "@jest/globals";

const mockRepo = {
  findById: jest.fn(),
  findReport: jest.fn(),
  upsertReport: jest.fn(),
  getPlayerWithGuardian: jest.fn(),
  updateStatus: jest.fn(),
  countAvailableByZone: jest.fn(),
};
const mockNotifRepo = {
  createForCoachingStaff: jest.fn(),
  createForMedicalStaff: jest.fn(),
  createForMedicalDirector: jest.fn(),
  createForHeadCoach: jest.fn(),
};

jest.mock("../../src/lib/prisma", () => ({ getPrisma: () => ({}) }));
jest.mock("../../src/lib/io", () => ({ getIO: () => ({ to: () => ({ emit: jest.fn() }) }) }));
jest.mock("../../src/lib/auditLog", () => ({ writeAuditLog: jest.fn().mockResolvedValue(undefined) }));

import { InjuryService } from "../../src/injury/injury.service";

describe("InjuryService — securityLevel gate", () => {
  let service: InjuryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InjuryService(mockRepo as any, mockNotifRepo as any);
  });

  test("PRIVATE report is accessible by ADMIN", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.findReport.mockResolvedValue({ securityLevel: "PRIVATE", matchAvailable: null, medicalSignedAt: null });

    const result = await service.getReport(1, { role: "ADMIN", coachingRole: null });
    expect(result).toBeDefined();
  });

  test("PRIVATE report is accessible by MEDICAL_DIRECTOR", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.findReport.mockResolvedValue({ securityLevel: "PRIVATE", matchAvailable: null, medicalSignedAt: null });

    const result = await service.getReport(1, { role: "COACHING_STAFF", coachingRole: "MEDICAL_DIRECTOR" });
    expect(result).toBeDefined();
  });

  test("PRIVATE report is blocked for HEAD_COACH", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.findReport.mockResolvedValue({ securityLevel: "PRIVATE", matchAvailable: null, medicalSignedAt: null });

    await expect(
      service.getReport(1, { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("INTERNAL report is accessible by HEAD_COACH", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.findReport.mockResolvedValue({ securityLevel: "INTERNAL", matchAvailable: null, medicalSignedAt: null });

    const result = await service.getReport(1, { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" });
    expect(result).toBeDefined();
  });
});
