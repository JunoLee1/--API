import { PrismaClient } from "../generated/client";
import { PartnerType } from "../generated/enums";
import { CreatePartnerDto, UpdatePartnerDto, CreatePartnerContractDto, UpdatePartnerContractDto } from "./dto/partner.dto";

const PARTNER_SELECT = {
  id: true, type: true, name: true, country: true,
  website: true, address: true, phone: true, createdAt: true,
} as const;

const CONTRACT_SELECT = {
  id: true, partnerId: true, status: true, startDate: true,
  endDate: true, sponsorshipFee: true, discountRate: true, notes: true, createdAt: true,
} as const;

export class PartnerRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(type?: PartnerType) {
    return this.prisma.partner.findMany({
      ...(type && { where: { type } }),
      select: { ...PARTNER_SELECT, contracts: { select: CONTRACT_SELECT, orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { name: "asc" },
    });
  }

  findById(id: number) {
    return this.prisma.partner.findUnique({
      where: { id },
      select: { ...PARTNER_SELECT, contracts: { select: CONTRACT_SELECT, orderBy: { createdAt: "desc" } } },
    });
  }

  create(dto: CreatePartnerDto) {
    return this.prisma.partner.create({
      data: {
        type: dto.type,
        name: dto.name,
        ...(dto.country && { country: dto.country }),
        ...(dto.website && { website: dto.website }),
        ...(dto.address && { address: dto.address }),
        ...(dto.phone && { phone: dto.phone }),
      },
      select: PARTNER_SELECT,
    });
  }

  update(id: number, dto: UpdatePartnerDto) {
    return this.prisma.partner.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      },
      select: PARTNER_SELECT,
    });
  }

  createContract(partnerId: number, dto: CreatePartnerContractDto) {
    return this.prisma.partnerContract.create({
      data: {
        partnerId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        ...(dto.sponsorshipFee !== undefined && { sponsorshipFee: dto.sponsorshipFee }),
        ...(dto.discountRate !== undefined && { discountRate: dto.discountRate }),
        ...(dto.notes && { notes: dto.notes }),
      },
      select: CONTRACT_SELECT,
    });
  }

  updateContract(id: number, dto: UpdatePartnerContractDto) {
    return this.prisma.partnerContract.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.sponsorshipFee !== undefined && { sponsorshipFee: dto.sponsorshipFee }),
        ...(dto.discountRate !== undefined && { discountRate: dto.discountRate }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      select: CONTRACT_SELECT,
    });
  }

  findExpiringContracts(withinDays: number) {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + withinDays);
    return this.prisma.partnerContract.findMany({
      where: { status: "ACTIVE", endDate: { gte: now, lte: threshold } },
      select: {
        id: true, endDate: true, sponsorshipFee: true, discountRate: true,
        partner: { select: { id: true, name: true, type: true } },
      },
      orderBy: { endDate: "asc" },
    });
  }
}
