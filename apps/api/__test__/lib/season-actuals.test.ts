import { getSeasonRevenueActuals } from "../../src/lib/season-actuals";

const mockPrisma = {
  season: { findUnique: jest.fn() },
  salesRecord: { aggregate: jest.fn() },
  sponsorshipPayment: { aggregate: jest.fn() },
  ledgerEntry: { aggregate: jest.fn() },
};
jest.mock("../../src/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.season.findUnique.mockResolvedValue({
    startDate: new Date("2025-01-01"),
    endDate: new Date("2025-12-31"),
  });
});

describe("getSeasonRevenueActuals", () => {
  it("aggregates ticket/uniform/other/sponsor/academy and zeroes manual-only fields", async () => {
    // ticketAgg, uniformAgg, otherAgg (in that call order in Promise.all)
    mockPrisma.salesRecord.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 100_000 } })   // ticket
      .mockResolvedValueOnce({ _sum: { totalAmount: 50_000  } })   // uniform
      .mockResolvedValueOnce({ _sum: { totalAmount: 20_000  } });  // other
    mockPrisma.sponsorshipPayment.aggregate.mockResolvedValue({ _sum: { amount: 300_000 } });
    mockPrisma.ledgerEntry.aggregate.mockResolvedValue({ _sum: { amountKrw: 40_000 } });

    const out = await getSeasonRevenueActuals(1);

    expect(out.plannedRevenueTicket).toBe(100_000);
    expect(out.plannedRevenueMerchandise).toBe(50_000);
    expect(out.plannedRevenueOther).toBe(20_000);
    expect(out.plannedRevenueSponsorship).toBe(300_000);
    expect(out.plannedRevenueAcademyFee).toBe(40_000);
    expect(out.plannedRevenueBroadcast).toBe(0);
    expect(out.plannedRevenueSubsidy).toBe(0);
    expect(out.plannedRevenueParentCompany).toBe(0);
  });

  it("returns 0s when no rows exist", async () => {
    mockPrisma.salesRecord.aggregate.mockResolvedValue({ _sum: { totalAmount: null } });
    mockPrisma.sponsorshipPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.ledgerEntry.aggregate.mockResolvedValue({ _sum: { amountKrw: null } });

    const out = await getSeasonRevenueActuals(1);
    expect(out.plannedRevenueTicket).toBe(0);
    expect(out.plannedRevenueSponsorship).toBe(0);
    expect(out.plannedRevenueAcademyFee).toBe(0);
  });

  it("throws SEASON_NOT_FOUND when season missing", async () => {
    mockPrisma.season.findUnique.mockResolvedValue(null);
    await expect(getSeasonRevenueActuals(999)).rejects.toMatchObject({
      statusCode: 404, code: "SEASON_NOT_FOUND",
    });
  });
});
