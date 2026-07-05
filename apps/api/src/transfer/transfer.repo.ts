import { PrismaClient } from "../generated/client";
import { CreateTransferDto, CreateRecallDto } from "./dto/transfer.dto";
import { RecallStatus } from "../generated/enums";

const n = <T>(v: T | undefined): T | null => v ?? null;

export class TransferRepository {
  constructor(private prisma: PrismaClient) {}

  findByPlayer(playerId: string) {
    return this.prisma.transfer.findMany({
      where: { playerId },
      select: {
        id: true,
        type: true,
        date: true,
        startDate: true,
        endDate: true,
        fee: true,
        fromClub: true,
        toClub: true,
        recall: { select: { id: true, status: true } },
      },
      orderBy: { date: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.transfer.findUnique({
      where: { id },
      include: { recall: true },
    });
  }

  createTransfer(dto: CreateTransferDto) {
    return this.prisma.transfer.create({
      data: {
        playerId: dto.playerId,
        type: dto.type,
        date: new Date(dto.date),
        startDate: n(dto.startDate ? new Date(dto.startDate) : undefined),
        endDate: n(dto.endDate ? new Date(dto.endDate) : undefined),
        fee: n(dto.fee),
        fromClub: n(dto.fromClub),
        toClub: n(dto.toClub),
      },
    });
  }

  findRecallById(id: number) {
    return this.prisma.recall.findUnique({ where: { id } });
  }

  createRecall(dto: CreateRecallDto, requestedById: number) {
    return this.prisma.recall.create({
      data: { transferId: dto.transferId, requestedById },
    });
  }

  updateRecallStatus(id: number, status: RecallStatus, approvedById: number) {
    return this.prisma.recall.update({
      where: { id },
      data: {
        status,
        ...(status === RecallStatus.APPROVED && {
          approvedById,
          approvedAt: new Date(),
        }),
      },
    });
  }

  findRecallsByStatus(status?: RecallStatus) {
    return this.prisma.recall.findMany({
      where: { ...(status && { status }) },
      include: {
        transfer: { select: { playerId: true, type: true, fromClub: true, toClub: true } },
        requestedBy: { select: { username: true } },
      },
      orderBy: { requestedAt: "desc" },
    });
  }
}
