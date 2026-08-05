import { AppError } from "../lib/appError";
import type { LedgerRepository } from "./ledger.repo";
import type { CreateLedgerEntryDto, LedgerListQuery } from "./dto/ledger.dto";

export class LedgerService {
  constructor(private repo: LedgerRepository) {}

  findAll(query: LedgerListQuery) { return this.repo.findAll(query); }
  findById(id: number) { return this.repo.findById(id); }

  async create(dto: CreateLedgerEntryDto, createdById: number) {
    if (dto.amount <= 0) throw new AppError(400, "INVALID_AMOUNT");
    const rate = dto.exchangeRate ?? 1;
    const amountKrw = dto.amountKrw ?? dto.amount * rate;
    return this.repo.create({ ...dto, exchangeRate: rate, amountKrw, createdById });
  }

  async createRefund(originalId: number, createdById: number) {
    const original = await this.repo.findById(originalId);
    if (!original) throw new AppError(404, "LEDGER_ENTRY_NOT_FOUND");
    return this.repo.create({
      type: original.type as any,
      category: "REFUND",
      amount: -Number(original.amount),
      currency: original.currency as any,
      exchangeRate: Number(original.exchangeRate),
      amountKrw: -Number(original.amountKrw),
      isRefund: true,
      description: `Refund for #${original.id}`,
      ...(original.relatedModule != null && { relatedModule: original.relatedModule }),
      ...(original.relatedId != null && { relatedId: original.relatedId }),
      createdById,
    });
  }

  // Fire-and-forget helper for other modules
  async createAutoEntry(dto: CreateLedgerEntryDto, createdById: number) {
    const rate = dto.exchangeRate ?? 1;
    const amountKrw = dto.amountKrw ?? dto.amount * rate;
    return this.repo.create({ ...dto, exchangeRate: rate, amountKrw, createdById });
  }
}
