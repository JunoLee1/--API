import { PrismaClient } from "../generated/client";
import { CreateInjuryDto, UpdateInjuryStatusDto, UpsertInjuryReportDto } from "./dto/injury.dto";

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
  partnerId: true,
  customHospitalName: true,
  partner: { select: { id: true, name: true } },
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
        partnerId: dto.partnerId ?? null,
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

  private INJURY_REPORT_SELECT = {
    id: true,
    injuryId: true,
    diagnosisName: true,
    treatmentContent: true,
    rehabStage: true,
    trainingReturnDate: true,
    matchAvailable: true,
    reinjuryRisk: true,
    medicalOpinion: true,
    securityLevel: true,
    createdById: true,
    updatedById: true,
    createdAt: true,
    updatedAt: true,
    createdBy: { select: { id: true, nickname: true } },
    updatedBy: { select: { id: true, nickname: true } },
  } as const;

  findReport(injuryId: number) {
    return this.prisma.injuryReport.findUnique({
      where: { injuryId },
      select: this.INJURY_REPORT_SELECT,
    });
  }

  upsertReport(injuryId: number, dto: UpsertInjuryReportDto, userId: number) {
    const data = {
      diagnosisName: dto.diagnosisName ?? null,
      treatmentContent: dto.treatmentContent ?? null,
      rehabStage: dto.rehabStage ?? null,
      trainingReturnDate: dto.trainingReturnDate ? new Date(dto.trainingReturnDate) : null,
      matchAvailable: dto.matchAvailable ?? null,
      reinjuryRisk: dto.reinjuryRisk ?? null,
      medicalOpinion: dto.medicalOpinion ?? null,
      securityLevel: dto.securityLevel ?? ("INTERNAL" as const),
    };
    return this.prisma.injuryReport.upsert({
      where: { injuryId },
      create: { ...data, injuryId, createdById: userId },
      update: { ...data, updatedById: userId },
      select: this.INJURY_REPORT_SELECT,
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
