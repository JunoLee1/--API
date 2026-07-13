import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { AdminService } from "../../src/admin/admin.service";

const mockRepo = {
  listUsers: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  findById: jest.fn(),
  updateRole: jest.fn(),
  setDeleted: jest.fn(),
  getLinkedData: jest.fn(),
  hardDelete: jest.fn(),
} as any;

const service = new AdminService(mockRepo);

describe("AdminService - listUsers", () => {
  beforeEach(() => jest.clearAllMocks());

  test("delegates to repo with filters", async () => {
    const filters = { role: "COACHING_STAFF" as const };
    mockRepo.listUsers.mockResolvedValue([{ id: 1 }]);
    const result = await service.listUsers(filters);
    expect(mockRepo.listUsers).toHaveBeenCalledWith(filters);
    expect(result).toHaveLength(1);
  });
});

describe("AdminService - getUserById", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns user when found", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, username: "juno", isDeleted: false });
    const result = await service.getUserById(1);
    expect(result.id).toBe(1);
  });

  test("throws 404 when not found", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.getUserById(99)).rejects.toMatchObject({
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });
  });
});

describe("AdminService - updateUserRole", () => {
  beforeEach(() => jest.clearAllMocks());

  test("cannot change own role → 403", async () => {
    await expect(service.updateUserRole(1, { role: "FRONT_OFFICE" }, 1)).rejects.toMatchObject({
      statusCode: 403,
      code: "CANNOT_MODIFY_SELF",
    });
  });

  test("throws 404 when user not found", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.updateUserRole(2, { role: "FRONT_OFFICE" }, 1)).rejects.toMatchObject({
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });
  });

  test("clears coachingRole when switching from COACHING_STAFF to FRONT_OFFICE", async () => {
    mockRepo.findById.mockResolvedValue({ id: 2, role: "COACHING_STAFF", coachingRole: "HEAD_COACH" });
    mockRepo.updateRole.mockResolvedValue({ id: 2, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "GM" });

    await service.updateUserRole(2, { role: "FRONT_OFFICE", frontOfficeRole: "GM" }, 1);

    expect(mockRepo.updateRole).toHaveBeenCalledWith(2, "FRONT_OFFICE", null, "GM");
  });

  test("clears frontOfficeRole when switching to COACHING_STAFF", async () => {
    mockRepo.findById.mockResolvedValue({ id: 3, role: "FRONT_OFFICE", frontOfficeRole: "SCOUT" });
    mockRepo.updateRole.mockResolvedValue({ id: 3, role: "COACHING_STAFF", coachingRole: "HEAD_COACH", frontOfficeRole: null });

    await service.updateUserRole(3, { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" }, 1);

    expect(mockRepo.updateRole).toHaveBeenCalledWith(3, "COACHING_STAFF", "HEAD_COACH", null);
  });
});

describe("AdminService - deactivateUser", () => {
  beforeEach(() => jest.clearAllMocks());

  test("cannot deactivate self → 403", async () => {
    await expect(service.deactivateUser(1, 1)).rejects.toMatchObject({
      statusCode: 403,
      code: "CANNOT_MODIFY_SELF",
    });
  });

  test("throws 404 when user not found", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.deactivateUser(2, 1)).rejects.toMatchObject({
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });
  });

  test("sets isDeleted = true", async () => {
    mockRepo.findById.mockResolvedValue({ id: 2, isDeleted: false });
    mockRepo.setDeleted.mockResolvedValue({ id: 2, isDeleted: true });

    await service.deactivateUser(2, 1);

    expect(mockRepo.setDeleted).toHaveBeenCalledWith(2, true);
  });
});

describe("AdminService - reactivateUser", () => {
  beforeEach(() => jest.clearAllMocks());

  test("throws 404 when not found", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.reactivateUser(2)).rejects.toMatchObject({
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });
  });

  test("sets isDeleted = false", async () => {
    mockRepo.findById.mockResolvedValue({ id: 2, isDeleted: true });
    mockRepo.setDeleted.mockResolvedValue({ id: 2, isDeleted: false });

    await service.reactivateUser(2);

    expect(mockRepo.setDeleted).toHaveBeenCalledWith(2, false);
  });
});

describe("AdminService - deleteUser", () => {
  beforeEach(() => jest.clearAllMocks());

  test("cannot delete self → 403", async () => {
    await expect(service.deleteUser(1, 1)).rejects.toMatchObject({
      statusCode: 403,
      code: "CANNOT_MODIFY_SELF",
    });
  });

  test("throws 404 when user not found", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.deleteUser(2, 1)).rejects.toMatchObject({
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });
  });

  test("throws 409 when user has linked contracts", async () => {
    mockRepo.findById.mockResolvedValue({ id: 2, isDeleted: false });
    mockRepo.getLinkedData.mockResolvedValue({
      player: null,
      _count: { managedContracts: 2, createdSessions: 0, approvedSessions: 0, tacticalAnalyses: 0, managedInjuries: 0, agentPlayers: 0, recallRequests: 0, recallApprovals: 0 },
    });

    await expect(service.deleteUser(2, 1)).rejects.toMatchObject({
      statusCode: 409,
      code: "USER_HAS_LINKED_DATA",
    });
  });

  test("hard deletes when no linked data", async () => {
    mockRepo.findById.mockResolvedValue({ id: 2, isDeleted: true });
    mockRepo.getLinkedData.mockResolvedValue({
      player: null,
      _count: { managedContracts: 0, createdSessions: 0, approvedSessions: 0, tacticalAnalyses: 0, managedInjuries: 0, agentPlayers: 0, recallRequests: 0, recallApprovals: 0 },
    });
    mockRepo.hardDelete.mockResolvedValue(undefined);

    await service.deleteUser(2, 1);

    expect(mockRepo.hardDelete).toHaveBeenCalledWith(2);
  });
});
