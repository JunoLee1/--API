import { describe, test, expect, jest } from "@jest/globals";
import { MandatoryMinimumService } from "../../src/mandatory-minimum/mandatory-minimum.service";
import type { PrismaClient } from "../../src/generated/client";

type MockOpts = {
  planId?: number | null;
  planMandatoryMinimum?: number;
  logStatus?: string | null;
  logCategoryPlanId?: number;
  logNewAmount?: number;
  seasonFinancialReportId?: number | null;
};

const makePrisma = (opts: MockOpts = {}) => {
  const created: any[] = [];
  const updated: any[] = [];
  const updatedPlan: any[] = [];
  const updatedMany: any[] = [];
  const created_ = jest.fn().mockImplementation((args: any) => {
    const rec = { id: 999, ...args.data };
    created.push({ args, result: rec });
    return Promise.resolve(rec);
  });
  const update_ = jest.fn().mockImplementation((args: any) => {
    const rec = { id: args.where.id, ...args.data };
    updated.push({ args, result: rec });
    return Promise.resolve(rec);
  });
  const updateMany_ = jest.fn().mockImplementation((args: any) => {
    updatedMany.push(args);
    return Promise.resolve({ count: 1 });
  });
  const findManyLogs = jest.fn().mockResolvedValue([]);
  const findUniqueLog = jest.fn().mockResolvedValue(
    opts.logStatus
      ? {
          id: 500,
          status: opts.logStatus,
          categoryPlanId: opts.logCategoryPlanId ?? 10,
          newAmount: opts.logNewAmount ?? 200_000,
        }
      : null,
  );

  const updatePlan = jest.fn().mockImplementation((args: any) => {
    const rec = { id: args.where.id, ...args.data };
    updatedPlan.push({ args, result: rec });
    return Promise.resolve(rec);
  });

  const prisma = {
    budgetCategoryPlan: {
      findUnique: jest.fn().mockResolvedValue(
        opts.planId === null
          ? null
          : { id: opts.planId ?? 10, mandatoryMinimum: opts.planMandatoryMinimum ?? 100_000 },
      ),
      update: updatePlan,
    } as any,
    mandatoryMinimumChangeLog: {
      findUnique: findUniqueLog,
      findMany: findManyLogs,
      create: created_,
      update: update_,
      updateMany: updateMany_,
    } as any,
    financialReport: {
      findUnique: jest.fn().mockResolvedValue(
        opts.seasonFinancialReportId === null
          ? null
          : { id: opts.seasonFinancialReportId ?? 100 },
      ),
    } as any,
    $transaction: jest.fn().mockImplementation(async (ops: any[]) => {
      return Promise.all(ops);
    }),
    __created: created,
    __updated: updated,
    __updatedMany: updatedMany,
    __updatedPlan: updatedPlan,
  };
  return prisma;
};

const validDto = () => ({
  newAmount: 200_000,
  evidenceType: "CONTRACT" as const,
  evidenceUrl: "https://example.com/contract.pdf",
  reason: "임대료 인상",
  effectiveDate: new Date("2026-09-01"),
});

describe("MandatoryMinimumService.propose", () => {
  test("정상 케이스: PENDING 생성 + previousAmount 스냅샷 + updateMany PENDING→CANCELED", async () => {
    const prisma = makePrisma({ planId: 10, planMandatoryMinimum: 100_000 });
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);

    const created = await svc.propose(10, validDto(), 42);

    expect(prisma.__updatedMany[0]).toEqual({
      where: { categoryPlanId: 10, status: "PENDING" },
      data: expect.objectContaining({ status: "CANCELED" }),
    });
    expect(prisma.__updatedMany[0].data.reviewedAt).toBeInstanceOf(Date);

    expect(prisma.__created[0].args.data).toMatchObject({
      categoryPlanId: 10,
      previousAmount: 100_000,
      newAmount: 200_000,
      evidenceType: "CONTRACT",
      evidenceUrl: "https://example.com/contract.pdf",
      status: "PENDING",
      proposedById: 42,
    });

    // Transaction 은 [updateMany, create] 순으로 호출 → create 결과가 두 번째
    expect(created).toBeDefined();
  });

  test("categoryPlan 없음 → 404 CATEGORY_PLAN_NOT_FOUND", async () => {
    const prisma = makePrisma({ planId: null });
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(svc.propose(999, validDto(), 42)).rejects.toMatchObject({
      statusCode: 404,
      code: "CATEGORY_PLAN_NOT_FOUND",
    });
  });

  test("reason 빈 문자열 → 400 REASON_REQUIRED", async () => {
    const prisma = makePrisma();
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(
      svc.propose(10, { ...validDto(), reason: "   " }, 42),
    ).rejects.toMatchObject({ statusCode: 400, code: "REASON_REQUIRED" });
  });

  test("newAmount < 0 → 400 AMOUNT_MUST_BE_NON_NEGATIVE", async () => {
    const prisma = makePrisma();
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(
      svc.propose(10, { ...validDto(), newAmount: -1 }, 42),
    ).rejects.toMatchObject({ statusCode: 400, code: "AMOUNT_MUST_BE_NON_NEGATIVE" });
  });

  test("newAmount 0 은 허용", async () => {
    const prisma = makePrisma({ planId: 10 });
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await svc.propose(10, { ...validDto(), newAmount: 0 }, 42);
    expect(prisma.__created[0].args.data.newAmount).toBe(0);
  });

  test("evidenceType CONTRACT 이지만 evidenceUrl 없음 → 400 EVIDENCE_URL_REQUIRED", async () => {
    const prisma = makePrisma();
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(
      svc.propose(10, { ...validDto(), evidenceType: "CONTRACT", evidenceUrl: null }, 42),
    ).rejects.toMatchObject({ statusCode: 400, code: "EVIDENCE_URL_REQUIRED" });
  });

  test("evidenceType LEGAL 이지만 evidenceUrl 없음 → 400 EVIDENCE_URL_REQUIRED", async () => {
    const prisma = makePrisma();
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(
      svc.propose(10, { ...validDto(), evidenceType: "LEGAL", evidenceUrl: "  " }, 42),
    ).rejects.toMatchObject({ statusCode: 400, code: "EVIDENCE_URL_REQUIRED" });
  });

  test("evidenceType FIXED_COST 는 evidenceUrl 없어도 OK", async () => {
    const prisma = makePrisma({ planId: 10 });
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await svc.propose(
      10,
      { ...validDto(), evidenceType: "FIXED_COST", evidenceUrl: null },
      42,
    );
    expect(prisma.__created[0].args.data.evidenceType).toBe("FIXED_COST");
    expect(prisma.__created[0].args.data.evidenceUrl).toBeNull();
  });

  test("evidenceType 잘못됨 → 400 INVALID_EVIDENCE_TYPE", async () => {
    const prisma = makePrisma();
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(
      svc.propose(10, { ...validDto(), evidenceType: "OTHER" as any }, 42),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_EVIDENCE_TYPE" });
  });

  test("effectiveDate 유효하지 않음 → 400 INVALID_EFFECTIVE_DATE", async () => {
    const prisma = makePrisma();
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(
      svc.propose(10, { ...validDto(), effectiveDate: new Date("invalid") }, 42),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_EFFECTIVE_DATE" });
  });
});

describe("MandatoryMinimumService.review", () => {
  test("REJECTED without note → 400 REVIEW_NOTE_REQUIRED_FOR_REJECT", async () => {
    const prisma = makePrisma({ logStatus: "PENDING" });
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(svc.review(500, "REJECTED", undefined, 999)).rejects.toMatchObject({
      statusCode: 400,
      code: "REVIEW_NOTE_REQUIRED_FOR_REJECT",
    });
  });

  test("decision 잘못됨 → 400 DECISION_MUST_BE_APPROVED_OR_REJECTED", async () => {
    const prisma = makePrisma({ logStatus: "PENDING" });
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(svc.review(500, "MAYBE" as any, "n", 999)).rejects.toMatchObject({
      statusCode: 400,
      code: "DECISION_MUST_BE_APPROVED_OR_REJECTED",
    });
  });

  test("log 없음 → 404 LOG_NOT_FOUND", async () => {
    const prisma = makePrisma({ logStatus: null });
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(svc.review(500, "APPROVED", undefined, 999)).rejects.toMatchObject({
      statusCode: 404,
      code: "LOG_NOT_FOUND",
    });
  });

  test("log.status !== PENDING → 409 ALREADY_REVIEWED", async () => {
    const prisma = makePrisma({ logStatus: "APPROVED" });
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(svc.review(500, "APPROVED", undefined, 999)).rejects.toMatchObject({
      statusCode: 409,
      code: "ALREADY_REVIEWED",
    });
  });

  test("APPROVED → categoryPlan.mandatoryMinimum = log.newAmount 반영 (grill Q9)", async () => {
    const prisma = makePrisma({
      logStatus: "PENDING",
      logCategoryPlanId: 10,
      logNewAmount: 250_000,
    });
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);

    await svc.review(500, "APPROVED", "OK", 999);

    // log update
    const logUpdate = prisma.__updated[0].args;
    expect(logUpdate.where.id).toBe(500);
    expect(logUpdate.data.status).toBe("APPROVED");
    expect(logUpdate.data.reviewedById).toBe(999);
    expect(logUpdate.data.reviewNote).toBe("OK");

    // plan update — mandatoryMinimum = 250_000
    const planUpdate = prisma.__updatedPlan[0].args;
    expect(planUpdate.where.id).toBe(10);
    expect(planUpdate.data.mandatoryMinimum).toBe(250_000);
  });

  test("REJECTED with note → plan.mandatoryMinimum 변경 없음", async () => {
    const prisma = makePrisma({
      logStatus: "PENDING",
      logCategoryPlanId: 10,
      logNewAmount: 250_000,
    });
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);

    await svc.review(500, "REJECTED", "근거 부족", 999);

    const logUpdate = prisma.__updated[0].args;
    expect(logUpdate.data.status).toBe("REJECTED");
    expect(prisma.__updatedPlan).toHaveLength(0);
  });
});

describe("MandatoryMinimumService.listHistory", () => {
  test("FM 읽기 허용", async () => {
    const prisma = makePrisma();
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await svc.listHistory(10, "FRONT_OFFICE", "FINANCE_MANAGER");
    expect(prisma.mandatoryMinimumChangeLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { categoryPlanId: 10 },
        orderBy: { proposedAt: "desc" },
      }),
    );
  });

  test("GM 읽기 허용", async () => {
    const prisma = makePrisma();
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await svc.listHistory(10, "GM", null);
    expect(prisma.mandatoryMinimumChangeLog.findMany).toHaveBeenCalled();
  });

  test("SUPER_ADMIN 읽기 허용", async () => {
    const prisma = makePrisma();
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await svc.listHistory(10, "SUPER_ADMIN", null);
    expect(prisma.mandatoryMinimumChangeLog.findMany).toHaveBeenCalled();
  });

  test("일반 FRONT_OFFICE (HR_MANAGER) → 403", async () => {
    const prisma = makePrisma();
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(svc.listHistory(10, "FRONT_OFFICE", "HR_MANAGER")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });

  test("COACHING_STAFF → 403", async () => {
    const prisma = makePrisma();
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(svc.listHistory(10, "COACHING_STAFF", null)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });
});

describe("MandatoryMinimumService.listPending", () => {
  test("FM PENDING 목록 조회", async () => {
    const prisma = makePrisma({ seasonFinancialReportId: 100 });
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await svc.listPending(1, "FRONT_OFFICE", "FINANCE_MANAGER");
    expect(prisma.mandatoryMinimumChangeLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING",
          categoryPlan: { financialReportId: 100 },
        }),
      }),
    );
  });

  test("financialReport 없음 → 빈 배열", async () => {
    const prisma = makePrisma({ seasonFinancialReportId: null });
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    const result = await svc.listPending(1, "GM", null);
    expect(result).toEqual([]);
    expect(prisma.mandatoryMinimumChangeLog.findMany).not.toHaveBeenCalled();
  });

  test("SUPER_ADMIN → 403 (pending 은 FM/GM only)", async () => {
    const prisma = makePrisma();
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(svc.listPending(1, "SUPER_ADMIN", null)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });

  test("일반 FRONT_OFFICE → 403", async () => {
    const prisma = makePrisma();
    const svc = new MandatoryMinimumService(prisma as unknown as PrismaClient);
    await expect(svc.listPending(1, "FRONT_OFFICE", "HR_MANAGER")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });
});
