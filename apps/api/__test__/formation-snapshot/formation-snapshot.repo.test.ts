import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { FormationSnapshotRepository } from "../../src/formation-snapshot/formation-snapshot.repo";

const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockDelete = jest.fn();
const mockPrisma = {
  formationSnapshot: { create: mockCreate, findMany: mockFindMany, delete: mockDelete },
} as any;

describe("FormationSnapshotRepository", () => {
  let repo: FormationSnapshotRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new FormationSnapshotRepository(mockPrisma);
  });

  test("create() passes all DTO fields to Prisma", async () => {
    mockCreate.mockResolvedValue({ id: 1, matchId: 5, minute: 35, formation: "4-4-2", changeReason: "injury" });
    await repo.create({ matchId: 5, minute: 35, formation: "4-4-2", changeReason: "injury" }, 1);
    const call = mockCreate.mock.calls[0]![0] as any;
    expect(call.data.matchId).toBe(5);
    expect(call.data.minute).toBe(35);
    expect(call.data.formation).toBe("4-4-2");
    expect(call.data.changeReason).toBe("injury");
    expect(call.data.createdById).toBe(1);
  });

  test("findByMatch() queries by matchId ordered by minute asc", async () => {
    mockFindMany.mockResolvedValue([]);
    await repo.findByMatch(5);
    const call = mockFindMany.mock.calls[0]![0] as any;
    expect(call.where.matchId).toBe(5);
    expect(call.orderBy.minute).toBe("asc");
  });

  test("create() omits minute and changeReason from data when not provided", async () => {
    mockCreate.mockResolvedValue({ id: 2, matchId: 3, formation: "4-3-3" });
    await repo.create({ matchId: 3, formation: "4-3-3" }, 2);
    const call = mockCreate.mock.calls[0]![0] as any;
    expect(call.data.minute).toBeUndefined();
    expect(call.data.changeReason).toBeUndefined();
    expect(call.data.formation).toBe("4-3-3");
  });

  test("remove() calls delete with correct id", async () => {
    mockDelete.mockResolvedValue({ id: 3 });
    await repo.remove(3);
    const call = mockDelete.mock.calls[0]![0] as any;
    expect(call.where.id).toBe(3);
  });
});
