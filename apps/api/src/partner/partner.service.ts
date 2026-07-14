import { PartnerRepository } from "./partner.repo";
import { AppError } from "../lib/appError";
import { PartnerType } from "../generated/enums";
import { CreatePartnerDto, UpdatePartnerDto, CreatePartnerContractDto, UpdatePartnerContractDto } from "./dto/partner.dto";

export class PartnerService {
  constructor(private repo: PartnerRepository) {}

  list(type?: PartnerType) {
    return this.repo.findAll(type);
  }

  async getById(id: number) {
    const partner = await this.repo.findById(id);
    if (!partner) throw new AppError(404, "PARTNER_NOT_FOUND");
    return partner;
  }

  async create(dto: CreatePartnerDto) {
    if (!dto.name?.trim()) throw new AppError(400, "PARTNER_NAME_REQUIRED");
    return this.repo.create({ ...dto, name: dto.name.trim() });
  }

  async update(id: number, dto: UpdatePartnerDto) {
    await this.getById(id);
    return this.repo.update(id, dto);
  }

  async createContract(partnerId: number, dto: CreatePartnerContractDto) {
    await this.getById(partnerId);
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new AppError(400, "CONTRACT_END_BEFORE_START");
    }
    return this.repo.createContract(partnerId, dto);
  }

  async updateContract(partnerId: number, contractId: number, dto: UpdatePartnerContractDto) {
    await this.getById(partnerId);
    return this.repo.updateContract(contractId, dto);
  }
}
