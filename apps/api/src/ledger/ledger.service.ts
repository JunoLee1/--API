import { AppError } from "../lib/appError";
import type { LedgerRepository } from "./ledger.repo";
import type { CreateLedgerEntryDto, LedgerListQuery } from "./dto/ledger.dto";

export const ALLOWED_MODULES = ["SalesRecord", "facility", "sponsorship", "equipment", "payroll"] as const;
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

  async create(dto: CreateLedgerEntryDto, createdById: number) {
    if (dto.amount <= 0) throw new AppError(400, "INVALID_AMOUNT");
    this.validateExchangeRate(dto.exchangeRate);

    if (dto.relatedModule !== undefined && !ALLOWED_MODULES.includes(dto.relatedModule as any)) {
      throw new AppError(400, "INVALID_RELATED_MODULE");
    }
    if (dto.relatedId !== undefined && (!Number.isInteger(dto.relatedId) || dto.relatedId <= 0)) {
      throw new AppError(400, "INVALID_RELATED_ID");
    }

    const rate = dto.exchangeRate ?? 1;
    const amountKrw = dto.amountKrw ?? dto.amount * rate;
    return this.repo.create({ ...dto, exchangeRate: rate, amountKrw, createdById });
  }

  async createRefund(originalId: number, createdById: number) {
    const original = await this.repo.findById(originalId);
    if (!original) throw new AppError(404, "LEDGER_ENTRY_NOT_FOUND");
    if (original.reversedById != null) throw new AppError(400, "ALREADY_REVERSED");
    const refund = await this.repo.create({
      type: original.type as any,       // Prisma $Enums.LedgerType → DTO "INCOME"|"EXPENSE" string literal union
      category: "REFUND",
      amount: -Number(original.amount),
      currency: original.currency as any, // Prisma $Enums.Currency → DTO "KRW"|"USD"|... string literal union
      exchangeRate: Number(original.exchangeRate),
      amountKrw: -Number(original.amountKrw),
      isRefund: true,
      description: `Refund for #${original.id}`,
      ...(original.relatedModule != null && { relatedModule: original.relatedModule }),
      ...(original.relatedId != null && { relatedId: original.relatedId }),
      createdById,
    });
    await this.repo.markReversed(originalId, refund.id);
    return refund;
  }

  // Fire-and-forget helper for other modules
  async createAutoEntry(dto: CreateLedgerEntryDto, createdById: number) {
    this.validateExchangeRate(dto.exchangeRate);
    // relatedModule/relatedId validation intentionally skipped — callers are internal trusted modules
    const rate = dto.exchangeRate ?? 1;
    const amountKrw = dto.amountKrw ?? dto.amount * rate;
    return this.repo.create({ ...dto, exchangeRate: rate, amountKrw, createdById });
  }
}
