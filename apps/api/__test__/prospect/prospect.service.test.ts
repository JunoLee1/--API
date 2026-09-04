import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { ProspectService } from "../../src/prospect/prospect.service";

const activeProspect = {
  id: 1,
  name: "John Doe",
  nationality: "English",
  position: "STRIKER",
  currentTeam: "FC Example",
  notes: null,
  status: "ACTIVE" as const,
  convertedPlayerId: null,
  createdAt: new Date(),
};

const signedProspect = {
  ...activeProspect,
  status: "SIGNED" as const,
  convertedPlayerId: "player-uuid",
};

const mockRepo = {
  findAll: jest.fn<() => Promise<any[]>>().mockResolvedValue([activeProspect]),
  findById: jest.fn<() => Promise<any>>().mockResolvedValue(activeProspect),
  create: jest.fn<() => Promise<any>>().mockResolvedValue(activeProspect),
  update: jest.fn<() => Promise<any>>().mockResolvedValue(activeProspect),
  updateStatus: jest.fn<() => Promise<any>>().mockResolvedValue({ ...activeProspect, status: "ARCHIVED" }),
  sign: jest.fn<() => Promise<any>>().mockResolvedValue(signedProspect),
  recordMedicalResult: jest.fn<() => Promise<any>>(),
  addNegotiationLog: jest.fn<() => Promise<any>>(),
  getNegotiationLogs: jest.fn<() => Promise<any[]>>(),
} as any;

const service = new ProspectService(mockRepo);

describe("ProspectService - updateStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  test("ACTIVE → ARCHIVED succeeds", async () => {
    mockRepo.findById.mockResolvedValue(activeProspect);
    mockRepo.updateStatus.mockResolvedValue({ ...activeProspect, status: "ARCHIVED" });

    const result = await service.updateStatus(1, { status: "ARCHIVED" });

    expect(result.status).toBe("ARCHIVED");
  });

  test("SIGNED status via updateStatus → 400 USE_SIGN_ENDPOINT", async () => {
    await expect(async () => service.updateStatus(1, { status: "SIGNED" })).rejects.toMatchObject({
      statusCode: 400,
      code: "USE_SIGN_ENDPOINT",
    });
  });

  test("non-existent prospect via getById → 404", async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.getById(99)).rejects.toMatchObject({
      statusCode: 404,
      code: "PROSPECT_NOT_FOUND",
    });
  });
});

describe("ProspectService - sign", () => {
  beforeEach(() => jest.clearAllMocks());

  const signDto = {
    dateOfBirth: "1995-06-15",
    height: 180,
    weight: 75,
    nationalityId: 1,
    contractStartDate: "2024-07-01",
    contractEndDate: "2026-06-30",
    salary: 5000000,
  };

  test("sign succeeds and returns signed prospect", async () => {
    mockRepo.sign.mockResolvedValue(signedProspect);

    const result = await service.sign(1, signDto);

    expect(result.status).toBe("SIGNED");
    expect(mockRepo.sign).toHaveBeenCalledWith(1, signDto);
  });

  test("sign on non-existent prospect → repo propagates 404", async () => {
    mockRepo.sign.mockRejectedValue({ statusCode: 404, code: "PROSPECT_NOT_FOUND" });

    await expect(service.sign(99, signDto)).rejects.toMatchObject({
      statusCode: 404,
      code: "PROSPECT_NOT_FOUND",
    });
  });

  test("sign on non-CONTRACT_PENDING prospect → repo propagates 409", async () => {
    mockRepo.sign.mockRejectedValue({ statusCode: 409, code: "INVALID_STATUS_TRANSITION" });

    await expect(service.sign(1, signDto)).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_STATUS_TRANSITION",
    });
  });

  test("sign with signingBonus — repo에 signingBonus 전달", async () => {
    const dtoWithBonus = { ...signDto, signingBonus: 10_000_000 };
    mockRepo.sign.mockResolvedValue(signedProspect);
    await service.sign(1, dtoWithBonus);
    expect(mockRepo.sign).toHaveBeenCalledWith(1, dtoWithBonus);
  });
});

// ─── recordMedicalResult ──────────────────────────────────────────────────────

describe("ProspectService.recordMedicalResult", () => {
  beforeEach(() => jest.clearAllMocks());

  const medicalProspect = { ...activeProspect, status: "MEDICAL_TEST" as const };

  test("MEDICAL_TEST가 아니면 409", async () => {
    mockRepo.findById.mockResolvedValue(activeProspect);
    await expect(service.recordMedicalResult(1, { result: "pass" }))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_RECORD_MEDICAL_NON_PENDING" });
  });

  test("pass — CONTRACT_PENDING으로 전환", async () => {
    mockRepo.findById.mockResolvedValue(medicalProspect);
    mockRepo.recordMedicalResult.mockResolvedValue({ ...medicalProspect, status: "CONTRACT_PENDING" });
    const result = await service.recordMedicalResult(1, { result: "pass" });
    expect(mockRepo.recordMedicalResult).toHaveBeenCalledWith(1, { result: "pass" });
    expect(result.status).toBe("CONTRACT_PENDING");
  });

  test("fail — medicalNotes와 함께 ARCHIVED로 전환", async () => {
    mockRepo.findById.mockResolvedValue(medicalProspect);
    mockRepo.recordMedicalResult.mockResolvedValue({ ...medicalProspect, status: "ARCHIVED" });
    await service.recordMedicalResult(1, { result: "fail", medicalNotes: "심장 이상" });
    expect(mockRepo.recordMedicalResult).toHaveBeenCalledWith(1, { result: "fail", medicalNotes: "심장 이상" });
  });
});

// ─── addNegotiationLog / getNegotiationLogs ───────────────────────────────────

describe("ProspectService.addNegotiationLog", () => {
  beforeEach(() => jest.clearAllMocks());

  test("SIGNED이면 409", async () => {
    mockRepo.findById.mockResolvedValue(signedProspect);
    await expect(service.addNegotiationLog(1, { type: "CLUB_TO_CLUB", note: "첫 제안" }, 10))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_LOG_NEGOTIATION_ON_NON_ACTIVE" });
  });

  test("CONTRACT_PENDING이면 성공", async () => {
    const contractPending = { ...activeProspect, status: "CONTRACT_PENDING" as const };
    mockRepo.findById.mockResolvedValue(contractPending);
    const log = { id: 1, type: "PLAYER", note: "연봉 협상" };
    mockRepo.addNegotiationLog.mockResolvedValue(log);
    const result = await service.addNegotiationLog(1, { type: "PLAYER", note: "연봉 협상" }, 10);
    expect(mockRepo.addNegotiationLog).toHaveBeenCalledWith(1, { type: "PLAYER", note: "연봉 협상" }, 10);
    expect(result.id).toBe(1);
  });

  test("getNegotiationLogs — repo에 위임", async () => {
    mockRepo.getNegotiationLogs.mockResolvedValue([{ id: 1 }]);
    const result = await service.getNegotiationLogs(1);
    expect(mockRepo.getNegotiationLogs).toHaveBeenCalledWith(1);
    expect(result).toHaveLength(1);
  });
});
