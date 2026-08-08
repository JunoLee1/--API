import { AppError } from "../lib/appError";
import { FinancialReportRepository, UpsertBudgetPlanDto, RevenueBreakdownDto, sumBreakdown } from "./financial-report.repo";
import { KnapsackService } from "../budget/knapsack.service";
import { OperatingCategory } from "../generated/client";
import { getPrisma } from "../lib/prisma";

export class FinancialReportService {
  constructor(
    private repo: FinancialReportRepository,
    private knapsack: KnapsackService,
  ) {}

  async set(seasonId: number, totalRevenue: number, note?: string, breakdown?: RevenueBreakdownDto) {
    if (totalRevenue <= 0) throw new AppError(400, "INVALID_REVENUE");
    // When breakdown is provided, its sum must equal totalRevenue
    if (breakdown) {
      const breakdownSum = sumBreakdown(breakdown);
      if (breakdownSum !== totalRevenue) {
        throw new AppError(400, "REVENUE_BREAKDOWN_SUM_MISMATCH");
      }
    }
    return this.repo.upsert(seasonId, totalRevenue, note, breakdown);
  }

  async setBreakdown(seasonId: number, breakdown: RevenueBreakdownDto, note?: string) {
    const total = sumBreakdown(breakdown);
    if (total <= 0) throw new AppError(400, "INVALID_REVENUE");
    return this.repo.upsert(seasonId, total, note, breakdown);
  }

  async setFromCSV(seasonId: number, csvContent: string, note?: string) {
    const totalRevenue = this.parseCSV(csvContent);
    return this.repo.upsert(seasonId, totalRevenue, note);
  }

  async get(seasonId: number) {
    const report = await this.repo.findBySeasonId(seasonId);
    if (!report) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    return report;
  }

  async upsertBudgetPlan(seasonId: number, dto: UpsertBudgetPlanDto) {
    if (dto.totalOperatingBudget <= 0) throw new AppError(400, "INVALID_BUDGET");
    if (dto.contingencyReserve < 0) throw new AppError(400, "INVALID_CONTINGENCY");
    return this.repo.upsertBudgetPlan(seasonId, dto);
  }

  async getBudgetPlan(seasonId: number) {
    const plan = await this.repo.getBudgetPlan(seasonId);
    if (!plan) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    return plan;
  }

  async optimize(seasonId: number) {
    const plan = await this.repo.getBudgetPlan(seasonId);
    if (!plan) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    if (!plan.totalOperatingBudget) throw new AppError(400, "BUDGET_NOT_SET");

    const mandatoryTotal = plan.budgetCategoryPlans.reduce(
      (s, c) => s + c.mandatoryMinimum, 0
    );
    const capacity = plan.totalOperatingBudget - mandatoryTotal - (plan.contingencyReserve ?? 0);
    if (capacity <= 0) throw new AppError(400, "DISCRETIONARY_POOL_EMPTY");

    const groups = plan.budgetCategoryPlans
      .filter((c) => c.tiers.length > 0)
      .map((c) => ({
        categoryPlanId: c.id,
        category: c.category,
        tiers: c.tiers.map((t) => ({ tierId: t.id, cost: t.cost, value: t.value })),
      }));

    const result = this.knapsack.solve({ capacity, groups });
    await this.repo.saveOptimizeResult(plan.id, result.selectedTiers);

    return { ...result, capacity, mandatoryTotal };
  }

  async addOverride(
    seasonId: number,
    category: OperatingCategory,
    amount: number,
    reason: string,
    createdById: number
  ) {
    const plan = await this.repo.getBudgetPlan(seasonId);
    if (!plan) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    if (amount <= 0) throw new AppError(400, "INVALID_AMOUNT");
    if (!reason.trim()) throw new AppError(400, "REASON_REQUIRED");
    return this.repo.addOverrideLog(plan.id, category, amount, reason, createdById);
  }

  async getActuals(seasonId: number) {
    return this.repo.getActuals(seasonId);
  }

  async setFromPrevSeasonActuals(prevSeasonId: number, newSeasonId: number) {
    const prisma = getPrisma();

    // 전년도 시즌 날짜 범위 조회
    const prevSeason = await prisma.season.findUnique({
      where: { id: prevSeasonId },
      select: { startDate: true, endDate: true },
    });
    if (!prevSeason) throw new AppError(404, "PREV_SEASON_NOT_FOUND");

    // 1. 티켓 실수입 (TICKET + VIP_TICKET, 해당 시즌 경기 연결)
    const ticketResult = await prisma.salesRecord.aggregate({
      where: {
        type: { in: ["TICKET", "VIP_TICKET"] as any[] },
        match: { seasonId: prevSeasonId },
        deletedAt: null,
      } as any,
      _sum: { totalAmount: true },
    });
    const revenueTicket = Number((ticketResult._sum as any).totalAmount ?? 0);

    // 2. 유니폼/MD 실수입 (SalesRecord type=UNIFORM, saleDate 범위)
    const uniformResult = await prisma.salesRecord.aggregate({
      where: {
        type: "UNIFORM",
        saleDate: { gte: prevSeason.startDate, lte: prevSeason.endDate },
        deletedAt: null,
      } as any,
      _sum: { totalAmount: true },
    });
    const revenueMerchandise = Number((uniformResult._sum as any).totalAmount ?? 0);

    // 3-extra. 기타 판매 실수입 (SalesRecord type=OTHER, saleDate 범위)
    const otherSalesResult = await prisma.salesRecord.aggregate({
      where: {
        type: "OTHER",
        saleDate: { gte: prevSeason.startDate, lte: prevSeason.endDate },
        deletedAt: null,
      } as any,
      _sum: { totalAmount: true },
    });
    const revenueOther = Number((otherSalesResult._sum as any).totalAmount ?? 0);

    // 4. 스폰서십 실수입 (SponsorshipPayment status=PAID, paidAt 범위)
    const sponsorResult = await prisma.sponsorshipPayment.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: prevSeason.startDate, lte: prevSeason.endDate },
      },
      _sum: { amount: true },
    });
    const revenueSponsorship = Number(sponsorResult._sum.amount ?? 0);

    // 5. 아카데미 회비 실수입 (LedgerEntry category=ACADEMY_FEE, 전년도 시즌 기간)
    const academyFeeResult = await prisma.ledgerEntry.aggregate({
      where: {
        category: "ACADEMY_FEE",
        type: "INCOME",
        createdAt: { gte: prevSeason.startDate, lte: prevSeason.endDate },
      },
      _sum: { amountKrw: true },
    });
    const revenueAcademyFee = Number(academyFeeResult._sum.amountKrw ?? 0);

    const breakdown: RevenueBreakdownDto = {
      revenueTicket,
      revenueSponsorship,
      revenueMerchandise,
      revenueAcademyFee,
      revenueBroadcast: 0,     // 중계권 — 시스템 외부 데이터, 수동 입력
      revenueSubsidy: 0,       // 지자체/정부 보조금 — 시스템 외부 데이터, 수동 입력
      revenueParentCompany: 0, // 모기업 지원금 — 수동 입력
      revenueOther,
    };

    const total = sumBreakdown(breakdown);
    const note = `전년도(시즌 ${prevSeasonId}) 실적 기반 자동 생성`;
    // total이 0일 수 있음 (집계 데이터 없는 경우) — repo.upsert 직접 호출로 0 허용
    return this.repo.upsert(newSeasonId, total, note, breakdown);
  }

  async getReportWithLedger(seasonId: number) {
    const report = await this.repo.findBySeasonId(seasonId);
    if (!report) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    const prisma = getPrisma();
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { relatedModule: "FINANCIAL_REPORT", relatedId: report.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { ...report, ledgerEntries };
  }

  async getComparison(seasonId: number) {
    const [plan, actuals] = await Promise.all([
      this.getBudgetPlan(seasonId),
      this.repo.getActuals(seasonId),
    ]);
    const comparison = plan.budgetCategoryPlans.map((c) => ({
      category: c.category,
      mandatoryMinimum: c.mandatoryMinimum,
      knapsackAllocated: c.knapsackAllocated,
      actual: actuals?.[c.category] ?? 0,
      variance: (c.knapsackAllocated ?? c.mandatoryMinimum) - (actuals?.[c.category] ?? 0),
    }));
    return { ...plan, actuals, comparison };
  }

  private parseCSV(content: string): number {
    const lines = content.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let total = 0;
    for (const line of lines) {
      const cols = line.split(",");
      const lastCol = cols[cols.length - 1];
      if (!lastCol) continue;
      const raw = lastCol.trim().replace(/[^0-9.]/g, "");
      const amount = parseFloat(raw);
      if (!isNaN(amount) && amount > 0) total += Math.round(amount);
    }
    if (total === 0) throw new AppError(400, "CSV_NO_VALID_AMOUNTS");
    return total;
  }
}
