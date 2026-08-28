import { provisionNewEmployeeAssets } from "../../src/hiring-dispatch/provision-assets";
import type { PrismaClient } from "../../src/generated/client";
import type { NotificationRepository } from "../../src/notification/notification.repo";

const DISPATCH_ID = 42;
const DEPT_ID = 10;
const NEW_USER_ID = 700;
const CATEGORY_ID = 55;

/**
 * Prisma mock shape — only the tables `provisionNewEmployeeAssets` touches
 * are stubbed. `hiringDispatch.findUnique` returns the base dispatch fixture
 * unless overridden. `assetRequest.create` echoes the payload with an id so
 * assertions can inspect the DTO the helper built.
 */
const baseDispatch = {
  id: DISPATCH_ID,
  candidateName: "홍길동",
  departmentId: DEPT_ID,
  createdUserId: NEW_USER_ID,
};

const makePrisma = (overrides: Partial<any> = {}): PrismaClient => {
  const prisma: any = {
    hiringDispatch: {
      findUnique: jest.fn().mockResolvedValue(baseDispatch),
    },
    departmentDefaultAssetKit: {
      findUnique: jest.fn().mockResolvedValue({
        assetItems: [
          { equipmentItemId: 1, quantity: 2 },
          { equipmentItemId: 2, quantity: 1, note: "가죽 케이스" },
        ],
        defaultExpenseCategoryId: CATEGORY_ID,
      }),
    },
    equipmentItem: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1, name: "노트북", quantity: 10, trackedIndividually: false },
        { id: 2, name: "사원증", quantity: 5, trackedIndividually: false },
      ]),
    },
    equipmentUnit: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    assetRequest: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: Math.floor(Math.random() * 1000),
        ...data,
      })),
    },
    ...overrides,
  };
  return prisma as PrismaClient;
};

const makeNotif = (): NotificationRepository =>
  ({
    createForAssetManager: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationRepository);

/**
 * `createForAssetManager` is called with `void` outside `await`, so the test
 * needs to yield the event loop once before asserting on the mock.
 */
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("provisionNewEmployeeAssets", () => {
  it("no-op when dispatch is missing", async () => {
    const prisma = makePrisma({
      hiringDispatch: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const notif = makeNotif();
    await provisionNewEmployeeAssets(prisma, notif, DISPATCH_ID);
    expect((prisma.assetRequest.create as jest.Mock).mock.calls.length).toBe(0);
    expect((notif.createForAssetManager as jest.Mock).mock.calls.length).toBe(0);
  });

  it("no-op when dispatch has no createdUserId (defensive)", async () => {
    const prisma = makePrisma({
      hiringDispatch: {
        findUnique: jest.fn().mockResolvedValue({ ...baseDispatch, createdUserId: null }),
      },
    });
    const notif = makeNotif();
    await provisionNewEmployeeAssets(prisma, notif, DISPATCH_ID);
    expect((prisma.assetRequest.create as jest.Mock).mock.calls.length).toBe(0);
  });

  it("no-op when department has no default asset kit", async () => {
    const prisma = makePrisma({
      departmentDefaultAssetKit: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const notif = makeNotif();
    await provisionNewEmployeeAssets(prisma, notif, DISPATCH_ID);
    expect((prisma.assetRequest.create as jest.Mock).mock.calls.length).toBe(0);
    expect((notif.createForAssetManager as jest.Mock).mock.calls.length).toBe(0);
  });

  it("no-op when kit assetItems is empty array", async () => {
    const prisma = makePrisma({
      departmentDefaultAssetKit: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ assetItems: [], defaultExpenseCategoryId: CATEGORY_ID }),
      },
    });
    const notif = makeNotif();
    await provisionNewEmployeeAssets(prisma, notif, DISPATCH_ID);
    expect((prisma.assetRequest.create as jest.Mock).mock.calls.length).toBe(0);
  });

  it("creates one AssetRequest DRAFT per kit item with correct fields", async () => {
    const prisma = makePrisma();
    const notif = makeNotif();
    await provisionNewEmployeeAssets(prisma, notif, DISPATCH_ID);
    const calls = (prisma.assetRequest.create as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0].data).toEqual(
      expect.objectContaining({
        requesterId: NEW_USER_ID,
        departmentId: DEPT_ID,
        type: "HARDWARE",
        status: "DRAFT",
        equipmentItemId: 1,
        expenseCategoryId: CATEGORY_ID,
        expectedAmount: 0,
        isAutoProvisioned: true,
        provisionedFromDispatchId: DISPATCH_ID,
      }),
    );
    expect(calls[0][0].data.justification).toContain("홍길동");
    expect(calls[1][0].data.justification).toContain("가죽 케이스");
  });

  it("skips items whose EquipmentItem was deleted (defensive; no draft, no throw)", async () => {
    const prisma = makePrisma({
      equipmentItem: {
        // Only id 1 exists in stock — id 2 was deleted; kit still references it.
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 1, name: "노트북", quantity: 10, trackedIndividually: false }]),
      },
    });
    const notif = makeNotif();
    await provisionNewEmployeeAssets(prisma, notif, DISPATCH_ID);
    const calls = (prisma.assetRequest.create as jest.Mock).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].data.equipmentItemId).toBe(1);
  });

  it("no alert when quantity stock ≥ requested for every item", async () => {
    const prisma = makePrisma();
    const notif = makeNotif();
    await provisionNewEmployeeAssets(prisma, notif, DISPATCH_ID);
    await flush();
    expect(notif.createForAssetManager).not.toHaveBeenCalled();
  });

  it("fires PROVISIONING_LOW_STOCK when quantity-based stock is short", async () => {
    const prisma = makePrisma({
      equipmentItem: {
        findMany: jest.fn().mockResolvedValue([
          // 노트북 stock = 1, request = 2 → shortage.
          { id: 1, name: "노트북", quantity: 1, trackedIndividually: false },
          { id: 2, name: "사원증", quantity: 5, trackedIndividually: false },
        ]),
      },
    });
    const notif = makeNotif();
    await provisionNewEmployeeAssets(prisma, notif, DISPATCH_ID);
    await flush();
    expect(notif.createForAssetManager).toHaveBeenCalledTimes(1);
    const [type, msgFn, entityId] = (notif.createForAssetManager as jest.Mock).mock.calls[0];
    expect(type).toBe("PROVISIONING_LOW_STOCK");
    expect(entityId).toBe(DISPATCH_ID);
    const ko = msgFn("ko");
    expect(ko.body).toContain("노트북");
    expect(ko.body).toContain("홍길동");
  });

  it("treats trackedIndividually items via AVAILABLE unit count", async () => {
    const prisma = makePrisma({
      departmentDefaultAssetKit: {
        findUnique: jest.fn().mockResolvedValue({
          assetItems: [{ equipmentItemId: 3, quantity: 2 }],
          defaultExpenseCategoryId: CATEGORY_ID,
        }),
      },
      equipmentItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 3, name: "노트북(개별관리)", quantity: null, trackedIndividually: true },
        ]),
      },
      equipmentUnit: {
        // 1 AVAILABLE unit but request = 2 → shortage.
        groupBy: jest.fn().mockResolvedValue([{ equipmentItemId: 3, _count: { _all: 1 } }]),
      },
    });
    const notif = makeNotif();
    await provisionNewEmployeeAssets(prisma, notif, DISPATCH_ID);
    await flush();
    expect(notif.createForAssetManager).toHaveBeenCalledTimes(1);
    const msgFn = (notif.createForAssetManager as jest.Mock).mock.calls[0][1];
    expect(msgFn("ko").body).toContain("가용 1");
    expect(msgFn("ko").body).toContain("요청 2");
  });

  it("draft is still created when stock is short (재고 무시, grill Q1)", async () => {
    const prisma = makePrisma({
      equipmentItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, name: "노트북", quantity: 0, trackedIndividually: false },
          { id: 2, name: "사원증", quantity: 0, trackedIndividually: false },
        ]),
      },
    });
    const notif = makeNotif();
    await provisionNewEmployeeAssets(prisma, notif, DISPATCH_ID);
    // Draft still created (재고 무시 원칙) — both items become DRAFT.
    expect((prisma.assetRequest.create as jest.Mock).mock.calls).toHaveLength(2);
    await flush();
    // Shortage alert fires with both items listed.
    expect(notif.createForAssetManager).toHaveBeenCalledTimes(1);
    const msgFn = (notif.createForAssetManager as jest.Mock).mock.calls[0][1];
    expect(msgFn("ko").body).toMatch(/노트북/);
    expect(msgFn("ko").body).toMatch(/사원증/);
  });

  it("notif failure does not throw (fire-and-forget robustness)", async () => {
    const prisma = makePrisma({
      equipmentItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, name: "노트북", quantity: 0, trackedIndividually: false },
          { id: 2, name: "사원증", quantity: 0, trackedIndividually: false },
        ]),
      },
    });
    const notif = {
      createForAssetManager: jest.fn().mockRejectedValue(new Error("boom")),
    } as unknown as NotificationRepository;
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(provisionNewEmployeeAssets(prisma, notif, DISPATCH_ID)).resolves.toBeUndefined();
    await flush();
    // Rejection landed in the .catch so console.error was invoked.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("treats null quantity as 0 (unmanaged-quantity item is always short)", async () => {
    const prisma = makePrisma({
      departmentDefaultAssetKit: {
        findUnique: jest.fn().mockResolvedValue({
          assetItems: [{ equipmentItemId: 1, quantity: 1 }],
          defaultExpenseCategoryId: CATEGORY_ID,
        }),
      },
      equipmentItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 1, name: "unmanaged", quantity: null, trackedIndividually: false }]),
      },
    });
    const notif = makeNotif();
    await provisionNewEmployeeAssets(prisma, notif, DISPATCH_ID);
    // Draft created even for the unmanaged-quantity item.
    expect((prisma.assetRequest.create as jest.Mock).mock.calls).toHaveLength(1);
    await flush();
    expect(notif.createForAssetManager).toHaveBeenCalledTimes(1);
  });
});
