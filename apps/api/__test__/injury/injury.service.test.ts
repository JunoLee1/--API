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

describe("InjuryService — allowedActivities write guard", () => {
  let service: InjuryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InjuryService(mockRepo as any, mockNotifRepo as any);
    mockRepo.findById.mockResolvedValue({ id: 1 });
  });

  test("MEDICAL_DIRECTOR can set allowedActivities", async () => {
    mockRepo.upsertReport.mockResolvedValue({ matchAvailable: null, medicalSignedAt: null, allowedActivities: "Water rehab only" });

    await service.saveReport(1, { allowedActivities: "Water rehab only" }, 99, { role: "COACHING_STAFF", coachingRole: "MEDICAL_DIRECTOR" });

    expect(mockRepo.upsertReport).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ allowedActivities: "Water rehab only" }),
      99,
    );
  });

  test("HEAD_COACH cannot set allowedActivities — field is stripped", async () => {
    mockRepo.upsertReport.mockResolvedValue({ matchAvailable: null, medicalSignedAt: null, allowedActivities: null });

    await service.saveReport(1, { allowedActivities: "Full training" }, 99, { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" });

    const calledDto = (mockRepo.upsertReport as jest.Mock).mock.calls[0][1];
    expect(calledDto.allowedActivities).toBeUndefined();
  });
});

describe("InjuryService — matchAvailable soft gate", () => {
  let service: InjuryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InjuryService(mockRepo as any, mockNotifRepo as any);
    mockRepo.findById.mockResolvedValue({ id: 1 });
  });

  test("matchAvailable=true without medical signature returns warning", async () => {
    mockRepo.upsertReport.mockResolvedValue({ matchAvailable: true, medicalSignedAt: null });

    const result = await service.saveReport(1, { matchAvailable: true }, 99, { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" });

    expect((result as any)._warning).toBe("MATCH_AVAILABLE_WITHOUT_MEDICAL_CLEARANCE");
  });

  test("matchAvailable=true with medical signature returns no warning", async () => {
    mockRepo.upsertReport.mockResolvedValue({ matchAvailable: true, medicalSignedAt: new Date() });

    const result = await service.saveReport(1, { matchAvailable: true }, 99, { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" });

    expect((result as any)._warning).toBeUndefined();
  });

  test("matchAvailable=false never returns warning", async () => {
    mockRepo.upsertReport.mockResolvedValue({ matchAvailable: false, medicalSignedAt: null });

    const result = await service.saveReport(1, { matchAvailable: false }, 99, { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" });

    expect((result as any)._warning).toBeUndefined();
  });
});

describe("InjuryService — RETURNED notification", () => {
  let service: InjuryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InjuryService(mockRepo as any, mockNotifRepo as any);
    mockRepo.findById.mockResolvedValue({ id: 1, playerId: "p1", status: "READY_TO_RETURN" });
    mockRepo.updateStatus.mockResolvedValue({ id: 1, status: "RETURNED" });
    mockRepo.getPlayerWithGuardian.mockResolvedValue({ playerName: "Kim", guardianId: null });
    mockRepo.countAvailableByZone.mockResolvedValue({ GK: 3, DEF: 5, MID: 4, FWD: 3 });
    mockNotifRepo.createForCoachingStaff.mockResolvedValue(undefined);
    mockNotifRepo.createForMedicalStaff.mockResolvedValue(undefined);
  });

  test("RETURNED status notifies both coaching staff and medical staff", async () => {
    await service.updateStatus(1, { status: "RETURNED" });

    expect(mockNotifRepo.createForCoachingStaff).toHaveBeenCalledWith(
      "INJURY_RETURNED",
      expect.any(Function),
      1,
    );
    expect(mockNotifRepo.createForMedicalStaff).toHaveBeenCalledWith(
      "INJURY_RETURNED",
      expect.any(Function),
      1,
    );
  });
});
