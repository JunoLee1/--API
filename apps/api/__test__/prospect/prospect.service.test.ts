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
});
