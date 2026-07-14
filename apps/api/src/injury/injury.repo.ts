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
  hospitalType: true,
  hospitalId: true,
  customHospitalName: true,
  hospital: { select: { id: true, name: true } },
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
        hospitalType: dto.hospitalType ?? null,
        hospitalId: dto.hospitalId ?? null,
        customHospitalName: dto.customHospitalName ?? null,
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

  async getStats() {
    const [byBodyPart, byCause, withDates, activeCount] = await Promise.all([
      this.prisma.injury.groupBy({ by: ["bodyPart"], _count: { id: true } }),
      this.prisma.injury.groupBy({ by: ["cause"], _count: { id: true } }),
      this.prisma.injury.findMany({
        where: { expectedReturnDate: { not: null } },
        select: { occurredAt: true, expectedReturnDate: true },
      }),
      this.prisma.injury.count({ where: { status: { not: "RETURNED" } } }),
    ]);

    const avgRecoveryDays =
      withDates.length > 0
        ? Math.round(
            withDates.reduce(
              (sum, i) =>
                sum + (i.expectedReturnDate!.getTime() - i.occurredAt.getTime()) / 86_400_000,
              0,
            ) / withDates.length,
          )
        : null;

    return {
      activeCount,
      byBodyPart: Object.fromEntries(byBodyPart.map((b) => [b.bodyPart, b._count.id])),
      byCause: Object.fromEntries(byCause.map((b) => [b.cause, b._count.id])),
      avgRecoveryDays,
    };
  }
}
