import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TeamService } from "../../src/team/team.service";

const mockRepo = {
  updateLiteFlag: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1, name: "Youth FC", isLite: true }),
  findById: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1, name: "Youth FC", isLite: false }),
  findAll: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  create: jest.fn(),
  update: jest.fn(),
} as any;

const service = new TeamService(mockRepo);

describe("TeamService - setLiteMode", () => {
  beforeEach(() => jest.clearAllMocks());

  test("ADMIN이 아닌 역할 → 403 FORBIDDEN", async () => {
    await expect(service.setLiteMode(1, true, "COACHING_STAFF")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    expect(mockRepo.updateLiteFlag).not.toHaveBeenCalled();
  });

  test("존재하지 않는 팀 → 404 TEAM_NOT_FOUND", async () => {
    mockRepo.findById.mockResolvedValueOnce(null);
    await expect(service.setLiteMode(99, true, "ADMIN")).rejects.toMatchObject({
      statusCode: 404,
      code: "TEAM_NOT_FOUND",
    });
  });

  test("ADMIN이 isLite=true로 변경 성공", async () => {
    const result = await service.setLiteMode(1, true, "ADMIN");
    expect(mockRepo.updateLiteFlag).toHaveBeenCalledWith(1, true);
    expect(result.isLite).toBe(true);
  });

  test("ADMIN이 isLite=false로 변경 성공", async () => {
    mockRepo.updateLiteFlag.mockResolvedValueOnce({ id: 1, name: "Youth FC", isLite: false });
    await service.setLiteMode(1, false, "ADMIN");
    expect(mockRepo.updateLiteFlag).toHaveBeenCalledWith(1, false);
  });
});
