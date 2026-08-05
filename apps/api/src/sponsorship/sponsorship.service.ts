import { AppError } from "../lib/appError";
import type { SponsorshipRepository } from "./sponsorship.repo";
import type { CreateSponsorshipDto, UpdateSponsorshipDto, SponsorshipListQuery } from "./dto/sponsorship.dto";
import type { PaymentSchedule } from "../generated/enums";
import type { LedgerService } from "../ledger/ledger.service";

export function generatePaymentDates(start: Date, end: Date, schedule: PaymentSchedule): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    if (schedule === "MONTHLY") current.setMonth(current.getMonth() + 1);
    else if (schedule === "QUARTERLY") current.setMonth(current.getMonth() + 3);
    else current.setFullYear(current.getFullYear() + 1);
  }
  return dates;
}

export class SponsorshipService {
  constructor(
    private repo: SponsorshipRepository,
    private ledgerService: LedgerService,
  ) {}

  list(query: SponsorshipListQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    return this.repo.findAll(query, page);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "SPONSORSHIP_NOT_FOUND");
    return { ...record, payments: this.applyOverdue(record.payments) };
  }

  async create(dto: CreateSponsorshipDto, createdById: number) {
    if (await this.repo.findBySponsorName(dto.sponsorName)) throw new AppError(409, "SPONSORSHIP_NAME_DUPLICATE");
    const sponsorship = await this.repo.create({ ...dto, createdById });
    const dates = generatePaymentDates(
      new Date(dto.contractStart),
      new Date(dto.contractEnd),
      dto.paymentSchedule,
    );
    if (dates.length > 0) {
      const count = dates.length;
      const baseAmount = Math.floor((dto.totalFee * 100) / count) / 100;
      const lastAmount = parseFloat((dto.totalFee - baseAmount * (count - 1)).toFixed(2));
      await this.repo.createPayments(
        dates.map((dueDate, i) => ({
          sponsorshipId: sponsorship.id,
          dueDate,
          amount: i === count - 1 ? lastAmount : baseAmount,
        })),
      );
    }
    return this.get(sponsorship.id);
  }

  async update(id: number, dto: UpdateSponsorshipDto) {
    await this.get(id);
    if (dto.sponsorName && await this.repo.findBySponsorName(dto.sponsorName, id)) {
      throw new AppError(409, "SPONSORSHIP_NAME_DUPLICATE");
    }
    return this.repo.update(id, dto);
  }

  async getPayments(id: number) {
    await this.get(id);
    const payments = await this.repo.findPayments(id);
    return this.applyOverdue(payments);
  }

  async markPaid(sponsorshipId: number, paymentId: number, userId: number) {
    const sponsorship = await this.get(sponsorshipId);
    const payment = await this.repo.findPaymentById(paymentId);
    if (!payment || payment.sponsorshipId !== sponsorshipId) {
      throw new AppError(404, "SPONSORSHIP_PAYMENT_NOT_FOUND");
    }
    if (payment.status === "PAID") throw new AppError(409, "ALREADY_PAID");
    const updated = await this.repo.updatePayment(paymentId, { status: "PAID", paidAt: new Date() });
    void this.ledgerService.createAutoEntry({
      type: "INCOME",
      category: "SPONSORSHIP",
      amount: Number(payment.amount),
      currency: "KRW",
      exchangeRate: 1,
      amountKrw: Number(payment.amount),
      description: `스폰서십 수입 - ${sponsorship.sponsorName} payment #${paymentId}`,
      relatedModule: "sponsorship",
      relatedId: sponsorshipId,
    }, userId).catch(err => console.error("[LedgerAutoEntry:sponsorship]", err));
    return updated;
  }

  private applyOverdue(payments: any[]) {
    const now = new Date();
    return payments.map((p) => ({
      ...p,
      status: p.status === "PENDING" && p.dueDate < now ? "OVERDUE" : p.status,
    }));
  }
}
