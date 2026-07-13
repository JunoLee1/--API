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

const mockRepo = {
  findAll: jest.fn<() => Promise<any[]>>().mockResolvedValue([activeProspect]),
  findById: jest.fn<() => Promise<any>>().mockResolvedValue(activeProspect),
  create: jest.fn<() => Promise<any>>().mockResolvedValue(activeProspect),
  update: jest.fn<() => Promise<any>>().mockResolvedValue(activeProspect),
  updateStatus: jest.fn<() => Promise<any>>().mockResolvedValue({ ...activeProspect, status: "SIGNED", convertedPlayerId: "player-uuid" }),
} as any;

const service = new ProspectService(mockRepo);

describe("ProspectService - updateStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  test("ACTIVE → SIGNED with convertedPlayerId succeeds", async () => {
    mockRepo.findById.mockResolvedValue(activeProspect);
    mockRepo.updateStatus.mockResolvedValue({ ...activeProspect, status: "SIGNED", convertedPlayerId: "player-uuid" });

    const result = await service.updateStatus(1, { status: "SIGNED", convertedPlayerId: "player-uuid" });

    expect(result.status).toBe("SIGNED");
    expect(result.convertedPlayerId).toBe("player-uuid");
  });

  test("ACTIVE → ARCHIVED succeeds", async () => {
    mockRepo.findById.mockResolvedValue(activeProspect);
    mockRepo.updateStatus.mockResolvedValue({ ...activeProspect, status: "ARCHIVED" });

    const result = await service.updateStatus(1, { status: "ARCHIVED" });

    expect(result.status).toBe("ARCHIVED");
  });

  test("ACTIVE → SIGNED without convertedPlayerId → 400", async () => {
    mockRepo.findById.mockResolvedValue(activeProspect);

    await expect(service.updateStatus(1, { status: "SIGNED" })).rejects.toMatchObject({
      statusCode: 400,
      code: "SIGNED_REQUIRES_CONVERTED_PLAYER_ID",
    });
  });

  test("ARCHIVED → ACTIVE is invalid → 409", async () => {
    mockRepo.findById.mockResolvedValue({ ...activeProspect, status: "ARCHIVED" });

    await expect(service.updateStatus(1, { status: "ACTIVE" })).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_STATUS_TRANSITION",
    });
  });

  test("SIGNED → ACTIVE is invalid → 409", async () => {
    mockRepo.findById.mockResolvedValue({ ...activeProspect, status: "SIGNED" });

    await expect(service.updateStatus(1, { status: "ACTIVE" })).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_STATUS_TRANSITION",
    });
  });

  test("non-existent prospect → 404", async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.updateStatus(99, { status: "ARCHIVED" })).rejects.toMatchObject({
      statusCode: 404,
      code: "PROSPECT_NOT_FOUND",
    });
  });
});
