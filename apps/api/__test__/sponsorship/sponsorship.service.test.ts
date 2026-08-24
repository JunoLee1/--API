import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { SponsorshipService, generatePaymentDates } from "../../src/sponsorship/sponsorship.service";
import { AppError } from "../../src/lib/appError";

// ── generatePaymentDates 순수 함수 테스트 ──────────────────────────

describe("generatePaymentDates", () => {
  test("MONTHLY: 3개월 계약 → 3개 납부일", () => {
    const start = new Date("2026-01-01");
    const end = new Date("2026-03-31");
    const dates = generatePaymentDates(start, end, "MONTHLY");
    expect(dates).toHaveLength(3);
    expect(dates[0]).toEqual(new Date("2026-01-01"));
    expect(dates[1]).toEqual(new Date("2026-02-01"));
    expect(dates[2]).toEqual(new Date("2026-03-01"));
  });

  test("QUARTERLY: 9개월 계약 → 3개 납부일", () => {
    const start = new Date("2026-01-01");
    const end = new Date("2026-09-30");
    const dates = generatePaymentDates(start, end, "QUARTERLY");
    expect(dates).toHaveLength(3);
    expect(dates[0]).toEqual(new Date("2026-01-01"));
    expect(dates[1]).toEqual(new Date("2026-04-01"));
    expect(dates[2]).toEqual(new Date("2026-07-01"));
  });

  test("ANNUAL: 2년 계약 → 2개 납부일", () => {
    const start = new Date("2026-01-01");
    const end = new Date("2027-12-31");
    const dates = generatePaymentDates(start, end, "ANNUAL");
    expect(dates).toHaveLength(2);
    expect(dates[0]).toEqual(new Date("2026-01-01"));
    expect(dates[1]).toEqual(new Date("2027-01-01"));
  });

  // Regression for Bug #326: naive Date.setMonth on the 31st rolled Jan 31 →
  // Mar 3 (Feb has no 31st), skipping February and drifting every iteration.
  test("MONTHLY on Jan 31 clamps to end-of-month and does not skip Feb", () => {
    const start = new Date("2026-01-31");
    const end = new Date("2026-06-30");
    const dates = generatePaymentDates(start, end, "MONTHLY");
    expect(dates).toHaveLength(6);
    expect(dates[0]).toEqual(new Date("2026-01-31"));
    expect(dates[1]).toEqual(new Date("2026-02-28"));
    expect(dates[2]).toEqual(new Date("2026-03-31"));
    expect(dates[3]).toEqual(new Date("2026-04-30"));
    expect(dates[4]).toEqual(new Date("2026-05-31"));
    expect(dates[5]).toEqual(new Date("2026-06-30"));
  });

  test("QUARTERLY starting Nov 30 preserves 30th where possible", () => {
    const start = new Date("2026-11-30");
    const end = new Date("2027-11-30");
    const dates = generatePaymentDates(start, end, "QUARTERLY");
    expect(dates).toHaveLength(5);
    expect(dates[0]).toEqual(new Date("2026-11-30"));
    expect(dates[1]).toEqual(new Date("2027-02-28")); // Feb has no 30
    expect(dates[2]).toEqual(new Date("2027-05-30"));
    expect(dates[3]).toEqual(new Date("2027-08-30"));
    expect(dates[4]).toEqual(new Date("2027-11-30"));
  });
});

// ── SponsorshipService 테스트 ──────────────────────────────────────

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySponsorName: jest.fn(),
  create: jest.fn(),
  createPayments: jest.fn(),
  update: jest.fn(),
  findPayments: jest.fn(),
  findPaymentById: jest.fn(),
  updatePayment: jest.fn(),
} as any;

const mockLedgerService = {
  createAutoEntry: jest.fn(),
} as any;

const service = new SponsorshipService(mockRepo, mockLedgerService);

beforeEach(() => jest.clearAllMocks());

describe("SponsorshipService.create", () => {
  test("MONTHLY 3개월 계약 시 3개 payment 생성, 균등 금액", async () => {
    mockRepo.create.mockResolvedValue({ id: 1 });
    mockRepo.findById.mockResolvedValue({ id: 1, payments: [] });

    await service.create(
      {
        sponsorName: "나이키",
        type: "KIT",
        totalFee: 300,
        contractStart: "2026-01-01",
        contractEnd: "2026-03-31",
        paymentSchedule: "MONTHLY",
      },
      10,
    );

    expect(mockRepo.createPayments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ amount: 100, dueDate: new Date("2026-01-01") }),
        expect.objectContaining({ amount: 100, dueDate: new Date("2026-02-01") }),
        expect.objectContaining({ amount: 100, dueDate: new Date("2026-03-01") }),
      ]),
    );
  });

  test("나눌 수 없는 금액 — 마지막 회차에 반올림 차액 보정", async () => {
    mockRepo.create.mockResolvedValue({ id: 2 });
    mockRepo.findById.mockResolvedValue({ id: 2, payments: [] });

    await service.create(
      {
        sponsorName: "아디다스",
        type: "KIT",
        totalFee: 100,
        contractStart: "2026-01-01",
        contractEnd: "2026-03-31",
        paymentSchedule: "MONTHLY",
      },
      10,
    );

    const [[payments]] = (mockRepo.createPayments as any).mock.calls;
    const total = payments.reduce((s: number, p: any) => s + p.amount, 0);
    expect(total).toBeCloseTo(100, 5);
  });
});

describe("SponsorshipService.get", () => {
  test("존재하지 않으면 404를 던진다", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.get(999)).rejects.toMatchObject({
      statusCode: 404,
      code: "SPONSORSHIP_NOT_FOUND",
    });
  });

  test("dueDate가 지난 PENDING payment는 OVERDUE로 반환", async () => {
    const pastDate = new Date("2020-01-01");
    mockRepo.findById.mockResolvedValue({
      id: 1,
      payments: [{ id: 10, status: "PENDING", dueDate: pastDate, paidAt: null }],
    });

    const result = await service.get(1);
    expect(result.payments[0].status).toBe("OVERDUE");
  });

  test("dueDate가 미래인 PENDING payment는 PENDING 유지", async () => {
    const futureDate = new Date("2099-01-01");
    mockRepo.findById.mockResolvedValue({
      id: 1,
      payments: [{ id: 11, status: "PENDING", dueDate: futureDate, paidAt: null }],
    });

    const result = await service.get(1);
    expect(result.payments[0].status).toBe("PENDING");
  });
});

describe("SponsorshipService.markPaid", () => {
  test("payment 없으면 404를 던진다", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, payments: [] });
    mockRepo.findPaymentById.mockResolvedValue(null);

    await expect(service.markPaid(1, 99)).rejects.toMatchObject({
      statusCode: 404,
      code: "SPONSORSHIP_PAYMENT_NOT_FOUND",
    });
  });

  test("다른 sponsorship의 payment면 404를 던진다", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, payments: [] });
    mockRepo.findPaymentById.mockResolvedValue({ id: 50, sponsorshipId: 99, status: "PENDING" });

    await expect(service.markPaid(1, 50)).rejects.toMatchObject({
      statusCode: 404,
      code: "SPONSORSHIP_PAYMENT_NOT_FOUND",
    });
  });

  test("이미 PAID면 409를 던진다", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, payments: [] });
    mockRepo.findPaymentById.mockResolvedValue({ id: 5, sponsorshipId: 1, status: "PAID" });

    await expect(service.markPaid(1, 5)).rejects.toMatchObject({
      statusCode: 409,
      code: "ALREADY_PAID",
    });
  });

  test("성공 시 updatePayment에 paidAt을 설정한다", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, payments: [] });
    mockRepo.findPaymentById.mockResolvedValue({ id: 5, sponsorshipId: 1, status: "PENDING" });
    mockRepo.updatePayment.mockResolvedValue({});

    await service.markPaid(1, 5);

    expect(mockRepo.updatePayment).toHaveBeenCalledWith(5, {
      status: "PAID",
      paidAt: expect.any(Date),
    });
  });
});
