import { AppError } from "../lib/appError";
import { formatLedgerDescription } from "../lib/ledger-formatter";
import type { LedgerRepository } from "./ledger.repo";
import type { CreateLedgerEntryDto, LedgerListQuery } from "./dto/ledger.dto";

export const ALLOWED_MODULES = ["SalesRecord", "facility", "sponsorship", "equipment", "payroll", "AcademyFee"] as const;
const MAX_EXCHANGE_RATE = 10_000;

export class LedgerService {
  constructor(private repo: LedgerRepository) {}

  findAll(query: LedgerListQuery) { return this.repo.findAll(query); }
  findById(id: number) { return this.repo.findById(id); }

  private validateExchangeRate(provided: number | undefined): void {
    if (provided !== undefined && (provided <= 0 || provided > MAX_EXCHANGE_RATE)) {
      throw new AppError(400, "INVALID_EXCHANGE_RATE");
    }
  }

  private async assertPeriodNotLocked(): Promise<void> {
    const now = new Date();
    const locked = await this.repo.isPeriodLocked(now.getFullYear(), now.getMonth() + 1);
    if (locked) throw new AppError(409, "PERIOD_LOCKED");
  }

  async create(dto: CreateLedgerEntryDto, createdById: number) {
    if (dto.amount <= 0) throw new AppError(400, "INVALID_AMOUNT");
    this.validateExchangeRate(dto.exchangeRate);

    if (dto.relatedModule !== undefined && !ALLOWED_MODULES.includes(dto.relatedModule as any)) {
      throw new AppError(400, "INVALID_RELATED_MODULE");
    }
    if (dto.relatedId !== undefined && (!Number.isInteger(dto.relatedId) || dto.relatedId <= 0)) {
      throw new AppError(400, "INVALID_RELATED_ID");
    }

    await this.assertPeriodNotLocked();

    const rate = dto.exchangeRate ?? 1;
    const amountKrw = dto.amountKrw ?? dto.amount * rate;
    return this.repo.create({ ...dto, exchangeRate: rate, amountKrw, createdById });
  }

  async createRefund(originalId: number, createdById: number) {
    const original = await this.repo.findById(originalId);
    if (!original) throw new AppError(404, "LEDGER_ENTRY_NOT_FOUND");
    if (original.reversedById != null) throw new AppError(400, "ALREADY_REVERSED");

    await this.assertPeriodNotLocked();

    // JO4: link refund entry back to original via reversalOfId
    const refund = await this.repo.create({
      type: original.type as any,
      category: "REFUND",
      amount: -Number(original.amount),
      currency: original.currency as any,
      exchangeRate: Number(original.exchangeRate),
      amountKrw: -Number(original.amountKrw),
      isRefund: true,
      description: formatLedgerDescription("ledger", "refund", { entryId: original.id }),
      ...(original.relatedModule != null && { relatedModule: original.relatedModule }),
      ...(original.relatedId != null && { relatedId: original.relatedId }),
      reversalOfId: original.id,
      createdById,
    } as any);
    // JO4: mark original as reversed (reversedById already in schema)
    await this.repo.markReversed(originalId, refund.id);

    // BS2: mark the source SalesRecord as refunded
    if (original.relatedModule === "SalesRecord" && original.relatedId) {
      await this.repo.markSalesRecordRefunded(original.relatedId);
    }

    return refund;
  }

  async lockPeriod(year: number, month: number, actorId: number) {
    const already = await this.repo.isPeriodLocked(year, month);
    if (already) throw new AppError(409, "PERIOD_ALREADY_LOCKED");
    try {
      return await this.repo.lockPeriod(year, month, actorId);
    } catch (e: any) {
      if (e?.code === "P2002") throw new AppError(409, "PERIOD_ALREADY_LOCKED");
      throw e;
    }
  }

  // Auto-entry helper for internal trusted modules (payroll, contracts, etc.)
  // relatedModule/relatedId validation bypassed — callers are trusted internal modules
  async createAutoEntry(dto: CreateLedgerEntryDto, createdById: number) {
    this.validateExchangeRate(dto.exchangeRate);
    await this.assertPeriodNotLocked();
    const rate = dto.exchangeRate ?? 1;
    const amountKrw = dto.amountKrw ?? dto.amount * rate;
    return this.repo.create({ ...dto, exchangeRate: rate, amountKrw, createdById });
  }
}
