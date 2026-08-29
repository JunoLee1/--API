import { BudgetPlanRequestService } from "../../src/budget-plan/plan-request.service";
import type { PrismaClient } from "../../src/generated/client";

const makePrisma = (opts: {
  planStatus?: string;
  fmSelfRequest?: boolean;
}) => {
  const reportUpdates: any[] = [];
  return {
    financialReport: {
      findUnique: jest.fn().mockResolvedValue({
        id: 100,
        planStatus: opts.planStatus ?? "KNAPSACK_EXECUTED",
      }),
      update: jest.fn().mockImplementation((args: any) => {
        reportUpdates.push(args);
        return Promise.resolve({ id: args.where.id, ...args.data });
      }),
    } as any,
    budgetPlanRequest: {
      findFirst: jest.fn().mockResolvedValue(
        opts.fmSelfRequest ? { id: 500, requestedById: 999 } : null,
      ),
    } as any,
    __reportUpdates: reportUpdates,
  } as any;
};

describe("BudgetPlanRequestService.finalize (#406)", () => {
  test("FM 자체 신청 없음 → FINALIZED 직접 전이", async () => {
    const prisma = makePrisma({ fmSelfRequest: false });
    const service = new BudgetPlanRequestService(prisma as PrismaClient);

    await service.finalize(1, 999);

    const update = prisma.__reportUpdates.at(-1);
    expect(update.data.planStatus).toBe("FINALIZED");
    expect(update.data.finalizedAt).toBeInstanceOf(Date);
    expect(update.data.planStatusChangedById).toBe(999);
  });

  test("FM 자체 신청 있음 → AWAITING_GM_APPROVAL 로 escalate", async () => {
    const prisma = makePrisma({ fmSelfRequest: true });
    const service = new BudgetPlanRequestService(prisma as PrismaClient);

    await service.finalize(1, 999);

    const update = prisma.__reportUpdates.at(-1);
    expect(update.data.planStatus).toBe("AWAITING_GM_APPROVAL");
    expect(update.data.finalizedAt).toBeUndefined();
  });

  test("planStatus !== KNAPSACK_EXECUTED → 409", async () => {
    const prisma = makePrisma({ planStatus: "DRAFT" });
    const service = new BudgetPlanRequestService(prisma as PrismaClient);

    await expect(service.finalize(1, 999)).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_PLAN_STATUS_TRANSITION",
    });
  });
});

describe("BudgetPlanRequestService.gmApprove (#406)", () => {
  test("AWAITING_GM_APPROVAL → FINALIZED", async () => {
    const prisma = makePrisma({ planStatus: "AWAITING_GM_APPROVAL" });
    const service = new BudgetPlanRequestService(prisma as PrismaClient);

    await service.gmApprove(1, 777);

    const update = prisma.__reportUpdates.at(-1);
    expect(update.data.planStatus).toBe("FINALIZED");
    expect(update.data.finalizedAt).toBeInstanceOf(Date);
    expect(update.data.planStatusChangedById).toBe(777);
  });

  test("planStatus !== AWAITING_GM_APPROVAL → 409", async () => {
    const prisma = makePrisma({ planStatus: "KNAPSACK_EXECUTED" });
    const service = new BudgetPlanRequestService(prisma as PrismaClient);

    await expect(service.gmApprove(1, 777)).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_PLAN_STATUS_TRANSITION",
    });
  });
});
