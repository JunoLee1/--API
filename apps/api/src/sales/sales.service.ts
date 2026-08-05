import { AppError } from "../lib/appError";
import type { SalesRepository } from "./sales.repo";
import type { CreateSalesRecordDto } from "./dto/sales.dto";

export class SalesService {
  constructor(private repo: SalesRepository) {}

  findAll() { return this.repo.findAll(); }

  async create(dto: CreateSalesRecordDto, createdById: number) {
    if (dto.quantity <= 0) throw new AppError(400, "NEGATIVE_SALES_VALUE");
    if (dto.unitPrice <= 0) throw new AppError(400, "NEGATIVE_SALES_VALUE");
    const totalAmount = dto.quantity * dto.unitPrice;
    return this.repo.create({ ...dto, totalAmount, createdById });
  }

  async getSummary() {
    return this.repo.groupByType();
  }
}
