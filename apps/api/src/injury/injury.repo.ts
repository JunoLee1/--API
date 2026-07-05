import { PrismaClient } from "../generated/client";
import { CreateInjuryDto, UpdateInjuryStatusDto } from "./dto/injury.dto";

const n = <T>(v: T | undefined): T | null => v ?? null;

const INJURY_SELECT = {
  id: true,
  bodyPart: true,
  cause: true,
  status: true,
  occurredAt: true,
  expectedReturnDate: true,
  playerId: true,
  medicalStaffId: true,
} as const;

export class InjuryRepository {
  constructor(private prisma: PrismaClient) {}

  findByPlayer(playerId: string) {
    return this.prisma.injury.findMany({
      where: { playerId },
      select: INJURY_SELECT,
      orderBy: { occurredAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.injury.findUnique({
      where: { id },
      select: {
        ...INJURY_SELECT,
        player: { select: { playerName: true } },
        medicalStaff: { select: { username: true } },
      },
    });
  }

  create(dto: CreateInjuryDto) {
    return this.prisma.injury.create({
      data: {
        playerId: dto.playerId,
        bodyPart: dto.bodyPart,
        cause: dto.cause,
        medicalStaffId: dto.medicalStaffId,
        expectedReturnDate: n(dto.expectedReturnDate ? new Date(dto.expectedReturnDate) : undefined),
      },
      select: INJURY_SELECT,
    });
  }

  updateStatus(id: number, dto: UpdateInjuryStatusDto) {
    return this.prisma.injury.update({
      where: { id },
      data: {
        status: dto.status,
        expectedReturnDate: n(dto.expectedReturnDate ? new Date(dto.expectedReturnDate) : undefined),
      },
      select: INJURY_SELECT,
    });
  }
}
