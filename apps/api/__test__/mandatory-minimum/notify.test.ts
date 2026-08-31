import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { notifyMinimumViolation } from "../../src/mandatory-minimum/notify";
import type { ViolationDetection } from "../../src/mandatory-minimum/violation";

type FRSpec = { id: number; planStatus: string } | null;

const makeDeps = (opts: {
  financialReport?: FRSpec;
  categoryLabel?: string;
  categoryCode?: string;
  createForGMShouldThrow?: boolean;
}) => {
  const created: any[] = [];
  const createForGM = jest.fn().mockImplementation((type: any, getMsg: any, entityId: any) => {
    if (opts.createForGMShouldThrow) {
      return Promise.reject(new Error("boom"));
    }
    const msg = typeof getMsg === "function" ? (getMsg as any)("ko") : getMsg;
    created.push({ type, msg, entityId });
    return Promise.resolve();
  });

  const financialReportFindUnique = jest.fn().mockImplementation((_args: any) => {
    return Promise.resolve(opts.financialReport ?? null);
  });
  const budgetCategoryPlanFindUnique = jest.fn().mockImplementation((_args: any) => {
    return Promise.resolve({
      expenseCategory:
        opts.categoryLabel === null
          ? null
          : { label: opts.categoryLabel ?? "임대료", code: opts.categoryCode ?? "RENT" },
    });
  });

  return {
    prisma: {
      financialReport: { findUnique: financialReportFindUnique } as any,
      budgetCategoryPlan: { findUnique: budgetCategoryPlanFindUnique } as any,
    },
    notificationRepo: { createForGM } as any,
    __created: created,
    __createForGM: createForGM,
    __financialReportFindUnique: financialReportFindUnique,
  };
};

const violatedDetection: ViolationDetection = {
  violated: true,
  basicCost: 100_000,
  newMinimum: 250_000,
  violationDelta: 150_000,
};

const okDetection: ViolationDetection = {
  violated: false,
  basicCost: 500_000,
  newMinimum: 250_000,
  violationDelta: 0,
};

describe("notifyMinimumViolation", () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("planStatus === FINALIZED + violated=true → GM 알림 발송", async () => {
    const deps = makeDeps({
      financialReport: { id: 100, planStatus: "FINALIZED" },
      categoryLabel: "임대료",
    });
    await notifyMinimumViolation(1, 10, violatedDetection, deps as any);

    expect(deps.__createForGM).toHaveBeenCalledTimes(1);
    const [type, , entityId] = deps.__createForGM.mock.calls[0] as any;
    expect(type).toBe("MANDATORY_MINIMUM_VIOLATION_REQUIRES_REPLAN");
    expect(entityId).toBe(100);
    // 메시지 본문에 카테고리 label + 금액 정보가 포함되어야 함
    expect(deps.__created[0].msg.title).toContain("임대료");
    expect(deps.__created[0].msg.body).toContain("100,000");
    expect(deps.__created[0].msg.body).toContain("250,000");
    expect(deps.__created[0].msg.body).toContain("150,000");
  });

  test("planStatus === DRAFT + violated=true → 알림 X (편성 사이클 자연 정합)", async () => {
    const deps = makeDeps({
      financialReport: { id: 100, planStatus: "DRAFT" },
    });
    await notifyMinimumViolation(1, 10, violatedDetection, deps as any);

    expect(deps.__createForGM).not.toHaveBeenCalled();
  });

  test("planStatus === AWAITING_REVIEW + violated=true → 알림 X", async () => {
    const deps = makeDeps({
      financialReport: { id: 100, planStatus: "AWAITING_REVIEW" },
    });
    await notifyMinimumViolation(1, 10, violatedDetection, deps as any);

    expect(deps.__createForGM).not.toHaveBeenCalled();
  });

  test("planStatus === KNAPSACK_EXECUTED + violated=true → 알림 X", async () => {
    const deps = makeDeps({
      financialReport: { id: 100, planStatus: "KNAPSACK_EXECUTED" },
    });
    await notifyMinimumViolation(1, 10, violatedDetection, deps as any);

    expect(deps.__createForGM).not.toHaveBeenCalled();
  });

  test("violated=false → 알림 X (planStatus 조회조차 안 함)", async () => {
    const deps = makeDeps({
      financialReport: { id: 100, planStatus: "FINALIZED" },
    });
    await notifyMinimumViolation(1, 10, okDetection, deps as any);

    expect(deps.__createForGM).not.toHaveBeenCalled();
    // Early return; financialReport 도 조회 안 함
    expect(deps.__financialReportFindUnique).not.toHaveBeenCalled();
  });

  test("financialReport 없음 → 알림 X (throw 안 함)", async () => {
    const deps = makeDeps({ financialReport: null });
    await notifyMinimumViolation(1, 10, violatedDetection, deps as any);

    expect(deps.__createForGM).not.toHaveBeenCalled();
  });

  test("createForGM 실패 → console.error 만, throw 안 함", async () => {
    const deps = makeDeps({
      financialReport: { id: 100, planStatus: "FINALIZED" },
      createForGMShouldThrow: true,
    });

    await expect(
      notifyMinimumViolation(1, 10, violatedDetection, deps as any),
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[mm] notifyMinimumViolation failed",
      expect.any(Error),
    );
  });

  test("basicCost=null (Basic 티어 없음) 이지만 violated=true 인 case 는 없음 — 안전장치 검증", async () => {
    // violation.ts 상 basicCost=null → violated=false 로만 나오지만, 방어적으로 처리 확인.
    const detection: ViolationDetection = {
      violated: true,
      basicCost: null,
      newMinimum: 100,
      violationDelta: 100,
    };
    const deps = makeDeps({
      financialReport: { id: 100, planStatus: "FINALIZED" },
      categoryLabel: "테스트",
    });
    await notifyMinimumViolation(1, 10, detection, deps as any);
    expect(deps.__createForGM).toHaveBeenCalledTimes(1);
    expect(deps.__created[0].msg.body).toContain("미편성");
  });
});
