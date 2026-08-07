import { PrismaClient, Prisma } from "../generated/client";
import { TransferRequestStatus, TransferType } from "../generated/enums";
import { CreateTransferRequestDto, UpdateTransferRequestDto, ListTransferRequestQuery } from "./dto/transfer-request.dto";

const n = <T>(v: T | undefined | null): T | null => v ?? null;

const DETAIL_SELECT = {
  id: true,
  status: true,
  type: true,
  fromClub: true,
  toClub: true,
  fee: true,
  startDate: true,
  endDate: true,
  rejectReason: true,
  createdAt: true,
  reviewedAt: true,
  confirmedAt: true,
  rejectedAt: true,
  player: { select: { id: true, playerName: true, position: true } },
  agency: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, username: true } },
  reviewedBy: { select: { id: true, username: true } },
  confirmedBy: { select: { id: true, username: true } },
  rejectedBy: { select: { id: true, username: true } },
} satisfies Prisma.TransferRequestSelect;

export class TransferRequestRepository {
  constructor(private prisma: PrismaClient) {}

  findById(id: number) {
    return this.prisma.transferRequest.findUnique({
      where: { id },
      select: DETAIL_SELECT,
    });
  }

  findAll(query: ListTransferRequestQuery) {
    return this.prisma.transferRequest.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.playerId && { playerId: query.playerId }),
      },
      select: DETAIL_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  hasInProgress(playerId: string) {
    return this.prisma.transferRequest.findFirst({
      where: {
        playerId,
        status: { in: [TransferRequestStatus.DRAFT, TransferRequestStatus.PENDING_APPROVAL, TransferRequestStatus.APPROVED] },
      },
      select: { id: true },
    });
  }

  create(dto: CreateTransferRequestDto, requestedById: number) {
    return this.prisma.transferRequest.create({
      data: {
        playerId: dto.playerId,
        agencyId: dto.agencyId,
        type: dto.type,
        fromClub: n(dto.fromClub),
        toClub: n(dto.toClub),
        fee: n(dto.fee),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        requestedById,
      },
      select: DETAIL_SELECT,
    });
  }

  update(id: number, dto: UpdateTransferRequestDto) {
    return this.prisma.transferRequest.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.fromClub !== undefined && { fromClub: dto.fromClub }),
        ...(dto.toClub !== undefined && { toClub: dto.toClub }),
        ...(dto.fee !== undefined && { fee: dto.fee }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
      },
      select: DETAIL_SELECT,
    });
  }

  submit(id: number) {
    return this.prisma.transferRequest.update({
      where: { id },
      data: { status: TransferRequestStatus.PENDING_APPROVAL },
      select: DETAIL_SELECT,
    });
  }

  review(id: number, action: "approve" | "reject", reviewedById: number, rejectReason?: string) {
    const isApprove = action === "approve";
    return this.prisma.transferRequest.update({
      where: { id },
      data: {
        status: isApprove ? TransferRequestStatus.APPROVED : TransferRequestStatus.REJECTED,
        reviewedById,
        reviewedAt: new Date(),
        ...(!isApprove && {
          rejectedById: reviewedById,
          rejectedAt: new Date(),
          ...(rejectReason !== undefined && { rejectReason }),
        }),
      },
      select: DETAIL_SELECT,
    });
  }

  async confirm(
    id: number,
    action: "confirm" | "reject",
    confirmedById: number,
    rejectReason?: string,
  ) {
    if (action === "reject") {
      return this.prisma.transferRequest.update({
        where: { id },
        data: {
          status: TransferRequestStatus.REJECTED,
          rejectedById: confirmedById,
          rejectedAt: new Date(),
          ...(rejectReason !== undefined && { rejectReason }),
        },
        select: DETAIL_SELECT,
      });
    }

    const req = await this.prisma.transferRequest.findUniqueOrThrow({ where: { id } });
    const OUT_TYPES: TransferType[] = [TransferType.PERMANENT_OUT, TransferType.RELEASE, TransferType.FREE];
    const isOut = OUT_TYPES.includes(req.type);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.transferRequest.update({
        where: { id },
        data: {
          status: TransferRequestStatus.CONFIRMED,
          confirmedById,
          confirmedAt: new Date(),
        },
        select: DETAIL_SELECT,
      });

      await tx.transfer.create({
        data: {
          playerId: req.playerId,
          type: req.type,
          date: new Date(),
          startDate: req.startDate,
          endDate: req.endDate,
          fee: req.fee,
          fromClub: req.fromClub,
          toClub: req.toClub,
        },
      });

      if (isOut) {
        await tx.contract.updateMany({
          where: { playerId: req.playerId, status: "ACTIVE" },
          data: { status: "TERMINATED" },
        });
      }

      await tx.player.update({
        where: { id: req.playerId },
        data: { agencyId: isOut ? null : req.agencyId },
      });

      return updated;
    });
  }

  delete(id: number) {
    return this.prisma.transferRequest.delete({ where: { id } });
  }
}
