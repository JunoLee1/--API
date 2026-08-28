import { DepartmentAssetKitService } from "../../src/department-asset-kit/department-asset-kit.service";
import type { DepartmentAssetKitRepository } from "../../src/department-asset-kit/department-asset-kit.repo";
import type { PrismaClient } from "../../src/generated/client";
import { AppError } from "../../src/lib/appError";

jest.mock("../../src/lib/auditLog", () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

const DEPT_ID = 10;
const CATEGORY_ID = 55;
const ACTOR = 100;

const makeRepo = (
  overrides: Partial<DepartmentAssetKitRepository> = {},
): DepartmentAssetKitRepository =>
  ({
    findByDepartment: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockImplementation(async (departmentId: number, data: any) => ({
      id: 1,
      departmentId,
      assetItems: data.assetItems,
      defaultExpenseCategoryId: data.defaultExpenseCategoryId,
      createdById: data.actorId,
      updatedById: null,
      expenseCategory: { id: data.defaultExpenseCategoryId, code: "CAT", label: "cat" },
    })),
    deleteByDepartment: jest.fn().mockResolvedValue({ id: 1 }),
    ...overrides,
  } as unknown as DepartmentAssetKitRepository);

const makePrisma = (overrides: Partial<any> = {}): PrismaClient =>
  ({
    department: {
      findUnique: jest.fn().mockResolvedValue({ id: DEPT_ID }),
    },
    expenseCategory: {
      findUnique: jest.fn().mockResolvedValue({ id: CATEGORY_ID, isActive: true }),
    },
    equipmentItem: {
      findMany: jest.fn().mockImplementation(async ({ where }: any) => {
        const ids: number[] = where?.id?.in ?? [];
        return ids.map((id) => ({ id }));
      }),
    },
    ...overrides,
  } as unknown as PrismaClient);

const makeService = (repo = makeRepo(), prisma = makePrisma()) =>
  new DepartmentAssetKitService(repo, prisma);

describe("DepartmentAssetKitService.getByDepartment", () => {
  it("returns null when no kit exists", async () => {
    const svc = makeService();
    const result = await svc.getByDepartment(DEPT_ID);
    expect(result).toBeNull();
  });

  it("returns the existing kit", async () => {
    const repo = makeRepo({
      findByDepartment: jest.fn().mockResolvedValue({
        id: 1,
        departmentId: DEPT_ID,
        assetItems: [{ equipmentItemId: 1, quantity: 2 }],
        defaultExpenseCategoryId: CATEGORY_ID,
      }),
    });
    const svc = makeService(repo);
    const result = await svc.getByDepartment(DEPT_ID);
    expect(result?.departmentId).toBe(DEPT_ID);
  });

  it("throws 400 on non-positive departmentId", async () => {
    await expect(makeService().getByDepartment(0)).rejects.toThrow(
      new AppError(400, "INVALID_DEPARTMENT_ID"),
    );
  });
});

describe("DepartmentAssetKitService.upsert", () => {
  const validDto = {
    assetItems: [
      { equipmentItemId: 1, quantity: 2 },
      { equipmentItemId: 2, quantity: 1, note: "노트북 지참자 예외" },
    ],
    defaultExpenseCategoryId: CATEGORY_ID,
  };

  it("creates a new kit for a department with none", async () => {
    const repo = makeRepo();
    const svc = makeService(repo);
    const result = await svc.upsert(DEPT_ID, validDto, ACTOR);
    expect(repo.upsert).toHaveBeenCalledWith(
      DEPT_ID,
      expect.objectContaining({
        assetItems: [
          { equipmentItemId: 1, quantity: 2 },
          { equipmentItemId: 2, quantity: 1, note: "노트북 지참자 예외" },
        ],
        defaultExpenseCategoryId: CATEGORY_ID,
        actorId: ACTOR,
      }),
    );
    expect(result.departmentId).toBe(DEPT_ID);
  });

  it("normalizes empty-string note to omitted", async () => {
    const repo = makeRepo();
    const svc = makeService(repo);
    await svc.upsert(
      DEPT_ID,
      {
        assetItems: [{ equipmentItemId: 1, quantity: 1, note: "   " }],
        defaultExpenseCategoryId: CATEGORY_ID,
      },
      ACTOR,
    );
    const call = (repo.upsert as jest.Mock).mock.calls[0];
    expect(call[1].assetItems[0]).toEqual({ equipmentItemId: 1, quantity: 1 });
  });

  it("throws ASSET_ITEMS_REQUIRED on empty list", async () => {
    const svc = makeService();
    await expect(
      svc.upsert(
        DEPT_ID,
        { assetItems: [], defaultExpenseCategoryId: CATEGORY_ID },
        ACTOR,
      ),
    ).rejects.toThrow(new AppError(400, "ASSET_ITEMS_REQUIRED"));
  });

  it("throws INVALID_EQUIPMENT_ITEM_ID on non-positive id", async () => {
    const svc = makeService();
    await expect(
      svc.upsert(
        DEPT_ID,
        {
          assetItems: [{ equipmentItemId: 0, quantity: 1 }],
          defaultExpenseCategoryId: CATEGORY_ID,
        },
        ACTOR,
      ),
    ).rejects.toThrow(new AppError(400, "INVALID_EQUIPMENT_ITEM_ID"));
  });

  it("throws INVALID_QUANTITY on quantity ≤ 0", async () => {
    const svc = makeService();
    await expect(
      svc.upsert(
        DEPT_ID,
        {
          assetItems: [{ equipmentItemId: 1, quantity: 0 }],
          defaultExpenseCategoryId: CATEGORY_ID,
        },
        ACTOR,
      ),
    ).rejects.toThrow(new AppError(400, "INVALID_QUANTITY"));
  });

  it("throws DUPLICATE_EQUIPMENT_ITEM on duplicate ids", async () => {
    const svc = makeService();
    await expect(
      svc.upsert(
        DEPT_ID,
        {
          assetItems: [
            { equipmentItemId: 1, quantity: 1 },
            { equipmentItemId: 1, quantity: 2 },
          ],
          defaultExpenseCategoryId: CATEGORY_ID,
        },
        ACTOR,
      ),
    ).rejects.toThrow(new AppError(400, "DUPLICATE_EQUIPMENT_ITEM"));
  });

  it("throws NOTE_TOO_LONG when note > 200 chars", async () => {
    const svc = makeService();
    await expect(
      svc.upsert(
        DEPT_ID,
        {
          assetItems: [{ equipmentItemId: 1, quantity: 1, note: "x".repeat(201) }],
          defaultExpenseCategoryId: CATEGORY_ID,
        },
        ACTOR,
      ),
    ).rejects.toThrow(new AppError(400, "NOTE_TOO_LONG"));
  });

  it("throws 404 DEPARTMENT_NOT_FOUND when department missing", async () => {
    const prisma = makePrisma({
      department: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    await expect(makeService(makeRepo(), prisma).upsert(DEPT_ID, validDto, ACTOR)).rejects.toThrow(
      new AppError(404, "DEPARTMENT_NOT_FOUND"),
    );
  });

  it("throws EXPENSE_CATEGORY_NOT_FOUND when category missing", async () => {
    const prisma = makePrisma({
      expenseCategory: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    await expect(makeService(makeRepo(), prisma).upsert(DEPT_ID, validDto, ACTOR)).rejects.toThrow(
      new AppError(400, "EXPENSE_CATEGORY_NOT_FOUND"),
    );
  });

  it("throws EXPENSE_CATEGORY_INACTIVE when category inactive", async () => {
    const prisma = makePrisma({
      expenseCategory: {
        findUnique: jest.fn().mockResolvedValue({ id: CATEGORY_ID, isActive: false }),
      },
    });
    await expect(makeService(makeRepo(), prisma).upsert(DEPT_ID, validDto, ACTOR)).rejects.toThrow(
      new AppError(400, "EXPENSE_CATEGORY_INACTIVE"),
    );
  });

  it("throws EQUIPMENT_ITEM_NOT_FOUND when any id missing", async () => {
    const prisma = makePrisma({
      equipmentItem: {
        // Only id 1 exists — id 2 is missing.
        findMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      },
    });
    await expect(makeService(makeRepo(), prisma).upsert(DEPT_ID, validDto, ACTOR)).rejects.toThrow(
      new AppError(400, "EQUIPMENT_ITEM_NOT_FOUND"),
    );
  });
});

describe("DepartmentAssetKitService.remove", () => {
  it("deletes an existing kit", async () => {
    const repo = makeRepo({
      findByDepartment: jest.fn().mockResolvedValue({ id: 42, departmentId: DEPT_ID }),
    });
    const svc = makeService(repo);
    const result = await svc.remove(DEPT_ID, ACTOR);
    expect(repo.deleteByDepartment).toHaveBeenCalledWith(DEPT_ID);
    expect(result.id).toBe(1);
  });

  it("throws 404 KIT_NOT_FOUND when no kit exists", async () => {
    const svc = makeService();
    await expect(svc.remove(DEPT_ID, ACTOR)).rejects.toThrow(
      new AppError(404, "KIT_NOT_FOUND"),
    );
  });
});
