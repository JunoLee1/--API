import type { PrismaClient } from "../generated/client";
import type { CreateSponsorshipDto, UpdateSponsorshipDto, SponsorshipListQuery } from "./dto/sponsorship.dto";

const INCLUDE = {
  createdBy: { select: { id: true, username: true } },
} as const;

export class SponsorshipRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(query: SponsorshipListQuery, page = 1, pageSize = 10) {
    const where = { deletedAt: null, ...(query.type ? { type: query.type } : {}) } as any;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.sponsorship.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.sponsorship.count({ where }),
    ]);
    return { data, total, page, totalPages: Math.ceil(total / pageSize) };
  }

  async findBySponsorName(sponsorName: string, excludeId?: number): Promise<{ id: number } | null> {
    const normalized = sponsorName.replace(/\s+/g, '').toLowerCase()
    type Row = { id: number }
    const rows = excludeId !== undefined
      ? await this.prisma.$queryRaw<Row[]>`
          SELECT id FROM "Sponsorship"
          WHERE LOWER(REGEXP_REPLACE("sponsorName", '\\s+', '', 'g')) = ${normalized}
            AND id != ${excludeId}
            AND "deletedAt" IS NULL
          LIMIT 1`
      : await this.prisma.$queryRaw<Row[]>`
          SELECT id FROM "Sponsorship"
          WHERE LOWER(REGEXP_REPLACE("sponsorName", '\\s+', '', 'g')) = ${normalized}
            AND "deletedAt" IS NULL
          LIMIT 1`
    return rows[0] ?? null
  }

  findById(id: number) {
    return this.prisma.sponsorship.findFirst({
      where: { id, deletedAt: null } as any,
      include: {
        ...INCLUDE,
        payments: { orderBy: { dueDate: "asc" } },
      },
    });
  }

  create(data: CreateSponsorshipDto & { createdById: number }) {
    return this.prisma.sponsorship.create({
      data: {
        sponsorName: data.sponsorName,
        type: data.type,
        totalFee: data.totalFee,
        contractStart: new Date(data.contractStart),
        contractEnd: new Date(data.contractEnd),
        paymentSchedule: data.paymentSchedule,
        createdById: data.createdById,
        ...(data.attachedContractId && { attachedContractId: data.attachedContractId }),
        ...(data.domesticBankName && { domesticBankName: data.domesticBankName }),
        ...(data.domesticAccountNumber && { domesticAccountNumber: data.domesticAccountNumber }),
        ...(data.domesticAccountHolder && { domesticAccountHolder: data.domesticAccountHolder }),
        ...(data.ukBankName && { ukBankName: data.ukBankName }),
        ...(data.ukSortCode && { ukSortCode: data.ukSortCode }),
        ...(data.ukAccountNumber && { ukAccountNumber: data.ukAccountNumber }),
        ...(data.ukSwiftBic && { ukSwiftBic: data.ukSwiftBic }),
      },
    });
  }

  createPayments(data: { sponsorshipId: number; dueDate: Date; amount: number }[]) {
    return this.prisma.sponsorshipPayment.createMany({ data });
  }

  update(id: number, data: UpdateSponsorshipDto) {
    return this.prisma.sponsorship.update({
      where: { id },
      data: {
        ...data,
        ...(data.contractStart && { contractStart: new Date(data.contractStart) }),
        ...(data.contractEnd && { contractEnd: new Date(data.contractEnd) }),
      },
    });
  }

  findPayments(sponsorshipId: number) {
    return this.prisma.sponsorshipPayment.findMany({
      where: { sponsorshipId },
      orderBy: { dueDate: "asc" },
    });
  }

  findPaymentById(id: number) {
    return this.prisma.sponsorshipPayment.findUnique({ where: { id } });
  }

  updatePayment(id: number, data: { status: "PAID"; paidAt: Date }) {
    return this.prisma.sponsorshipPayment.update({
      where: { id },
      data,
    });
  }

  findExpiring(from: Date, to: Date) {
    return this.prisma.sponsorship.findMany({
      where: { contractEnd: { gte: from, lte: to }, deletedAt: null } as any,
      select: { id: true, sponsorName: true, contractEnd: true },
    });
  }

  // PA1: delete all pending payments so they can be regenerated
  deletePayments(sponsorshipId: number) {
    return this.prisma.sponsorshipPayment.deleteMany({
      where: { sponsorshipId, status: "PENDING" } as any,
    });
  }

  // PB6: soft-delete a sponsorship contract
  softDelete(id: number) {
    return this.prisma.sponsorship.update({
      where: { id },
      data: { deletedAt: new Date() } as any,
    });
  }
}
