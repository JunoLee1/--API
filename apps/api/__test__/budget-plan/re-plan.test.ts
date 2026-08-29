import { BudgetPlanRequestService } from "../../src/budget-plan/plan-request.service";
import type { PrismaClient } from "../../src/generated/client";

const makePrisma = (planStatus: string = "FINALIZED") => {
  const reportUpdates: any[] = [];
  const requestUpdates: any[] = [];
  return {
    financialReport: {
      findUnique: jest.fn().mockResolvedValue({ id: 100, planStatus }),
      update: jest.fn().mockImplementation((args: any) => {
        reportUpdates.push(args);
        return Promise.resolve({ id: args.where.id, ...args.data });
      }),
    } as any,
    budgetPlanRequest: {
      updateMany: jest.fn().mockImplementation((args: any) => {
        requestUpdates.push(args);
        return Promise.resolve({ count: 0 });
      }),
    } as any,
    __reportUpdates: reportUpdates,
    __requestUpdates: requestUpdates,
  } as any;
};

const REVIEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

describe("BudgetPlanRequestService.rePlan (#408)", () => {
  test("FINALIZED → AWAITING_REVIEW 재개방 + reviewDeadline 14일 새로", async () => {
    const prisma = makePrisma("FINALIZED");
    const service = new BudgetPlanRequestService(prisma as PrismaClient);

    await service.rePlan(1, 777, "스폰서 신규 계약으로 totalOperatingBudget 상향");

    const update = prisma.__reportUpdates.at(-1);
    expect(update.data.planStatus).toBe("AWAITING_REVIEW");
    expect(update.data.reviewOpenedAt).toBeInstanceOf(Date);
    const deadlineDelta =
      update.data.reviewDeadline.getTime() - update.data.reviewOpenedAt.getTime();
    expect(deadlineDelta).toBe(REVIEW_WINDOW_MS);
    expect(update.data.planStatusChangedById).toBe(777);
    expect(update.data.note).toContain("스폰서");
  });

  test("planStatus !== FINALIZED → 409", async () => {
    const prisma = makePrisma("DRAFT");
    const service = new BudgetPlanRequestService(prisma as PrismaClient);
    await expect(service.rePlan(1, 777, "test")).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_PLAN_STATUS_TRANSITION",
    });
  });

  test("reason 누락 → 400", async () => {
    const prisma = makePrisma("FINALIZED");
    const service = new BudgetPlanRequestService(prisma as PrismaClient);
    await expect(service.rePlan(1, 777, "")).rejects.toMatchObject({
      statusCode: 400,
      code: "REASON_REQUIRED",
    });
  });

  test("기존 SUBMITTED 요청 → PROCESSED (archive) 로 이동", async () => {
    const prisma = makePrisma("FINALIZED");
    const service = new BudgetPlanRequestService(prisma as PrismaClient);

    await service.rePlan(1, 777, "예산 재조정 필요");

    const requestUpdate = prisma.__requestUpdates.at(-1);
    expect(requestUpdate.where).toMatchObject({ financialReportId: 100 });
    expect(requestUpdate.data.status).toBe("PROCESSED");
  });
});
