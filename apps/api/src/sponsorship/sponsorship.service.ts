import { AppError } from "../lib/appError";
import { writeAuditLog } from "../lib/auditLog";
import { divideEvenly } from "../lib/money";
import { formatLedgerDescription } from "../lib/ledger-formatter";
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
      const { baseAmount, lastAmount } = divideEvenly(dto.totalFee, count);
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

  async update(id: number, dto: UpdateSponsorshipDto, updatedById: number) {
    const current = await this.get(id);
    if (dto.sponsorName && await this.repo.findBySponsorName(dto.sponsorName, id)) {
      throw new AppError(409, "SPONSORSHIP_NAME_DUPLICATE");
    }
    const result = await this.repo.update(id, dto);
    void writeAuditLog({
      actorId: updatedById,
      action: "SPONSORSHIP_UPDATED",
      targetId: id,
      detail: { fields: Object.keys(dto) },
    }).catch(console.error);

    // PA1: recalculate payment schedule if contract terms changed
    const paymentTermsChanged = dto.contractStart || dto.contractEnd || dto.paymentSchedule || dto.totalFee !== undefined;
    if (paymentTermsChanged) {
      const contractStart = new Date(dto.contractStart ?? current.contractStart);
      const contractEnd = new Date(dto.contractEnd ?? current.contractEnd);
      const paymentSchedule = (dto.paymentSchedule ?? current.paymentSchedule) as PaymentSchedule;
      const totalFee = dto.totalFee ?? Number(current.totalFee);

      await this.repo.deletePayments(id);
      const dates = generatePaymentDates(contractStart, contractEnd, paymentSchedule);
      if (dates.length > 0) {
        const count = dates.length;
        const { baseAmount, lastAmount } = divideEvenly(totalFee, count);
        await this.repo.createPayments(
          dates.map((dueDate, i) => ({
            sponsorshipId: id,
            dueDate,
            amount: i === count - 1 ? lastAmount : baseAmount,
          })),
        );
      }
      void writeAuditLog({
        actorId: updatedById,
        action: "SPONSORSHIP_PAYMENT_SCHEDULE_RECALCULATED",
        targetId: id,
        detail: { contractStart: contractStart.toISOString(), contractEnd: contractEnd.toISOString(), paymentSchedule, totalFee },
      }).catch(console.error);
    }

    return result;
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
    if (Number(payment.amount) <= 0) throw new AppError(400, "INVALID_PAYMENT_AMOUNT");
    const updated = await this.repo.updatePayment(paymentId, { status: "PAID", paidAt: new Date() });
    await this.ledgerService.createAutoEntry({
      type: "INCOME",
      category: "SPONSORSHIP",
      amount: Number(payment.amount),
      currency: "KRW",
      exchangeRate: 1,
      amountKrw: Number(payment.amount),
      description: formatLedgerDescription("sponsorship", "payment_received", { sponsorName: sponsorship.sponsorName, paymentId }),
      relatedModule: "sponsorship",
      relatedId: sponsorshipId,
    }, userId);
    return updated;
  }

  async findExpiringContracts(daysAhead: number = 30) {
    const now = new Date();
    const threshold = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    return this.repo.findExpiring(now, threshold);
  }

  // PB6: soft-delete a sponsorship contract
  async delete(id: number, deletedById: number) {
    await this.get(id);
    await this.repo.softDelete(id);
    void writeAuditLog({
      actorId: deletedById,
      action: "SPONSORSHIP_DELETED",
      targetId: id,
    }).catch(console.error);
  }

  private applyOverdue(payments: any[]) {
    const now = new Date();
    return payments.map((p) => ({
      ...p,
      status: p.status === "PENDING" && p.dueDate < now ? "OVERDUE" : p.status,
    }));
  }
}
