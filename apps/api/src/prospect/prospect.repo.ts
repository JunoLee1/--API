import { PrismaClient } from "../generated/client";
import { ProspectStatus } from "../generated/enums";
import { AppError } from "../lib/appError";
import { encrypt } from "../lib/crypto";
import { CreateProspectDto, UpdateProspectDto, SignProspectDto, ProspectMedicalResultDto, CreateProspectNegotiationLogDto } from "./dto/prospect.dto";

const PROSPECT_SELECT = {
  id: true,
  name: true,
  nationality: true,
  position: true,
  currentTeam: true,
  notes: true,
  status: true,
  convertedPlayerId: true,
  createdAt: true,
  createdBy: { select: { nickname: true } },
  visaRequired: true,
  visaEligibility: true,
} as const;

const VALID_TRANSITIONS: Record<ProspectStatus, ProspectStatus[]> = {
  ACTIVE:           ["MEDICAL_TEST", "ARCHIVED"],
  MEDICAL_TEST:     ["CONTRACT_PENDING", "ARCHIVED"],
  CONTRACT_PENDING: ["ARCHIVED"],
  SIGNED:           [],
  ARCHIVED:         [],
};

export class ProspectRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(status?: ProspectStatus) {
    return this.prisma.prospect.findMany({
      ...(status !== undefined && { where: { status } }),
      select: PROSPECT_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.prospect.findUnique({ where: { id }, select: PROSPECT_SELECT });
  }

  create(dto: CreateProspectDto) {
    return this.prisma.prospect.create({
      data: {
        name: dto.name,
        nationality: dto.nationality ?? null,
        position: dto.position ?? null,
        currentTeam: dto.currentTeam ?? null,
        notes: dto.notes ?? null,
        createdById: dto.createdById ?? null,
      },
      select: PROSPECT_SELECT,
    });
  }

  update(id: number, dto: UpdateProspectDto) {
    return this.prisma.prospect.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nationality !== undefined && { nationality: dto.nationality }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.currentTeam !== undefined && { currentTeam: dto.currentTeam }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.visaRequired !== undefined && { visaRequired: dto.visaRequired }),
        ...(dto.visaEligibility !== undefined && { visaEligibility: dto.visaEligibility }),
      },
      select: PROSPECT_SELECT,
    });
  }

  async updateStatus(id: number, status: ProspectStatus) {
    const prospect = await this.prisma.prospect.findUnique({ where: { id }, select: { status: true } });
    if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
    const allowed = VALID_TRANSITIONS[prospect.status];
    if (!allowed.includes(status)) throw new AppError(409, "INVALID_STATUS_TRANSITION");
    return this.prisma.prospect.update({ where: { id }, data: { status }, select: PROSPECT_SELECT });
  }

  async sign(prospectId: number, dto: SignProspectDto) {
    const prospect = await this.prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { id: true, status: true, name: true, position: true },
    });
    if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
    if (prospect.status !== "CONTRACT_PENDING") throw new AppError(409, "INVALID_STATUS_TRANSITION");

    return this.prisma.$transaction(async (tx) => {
      const encDob = encrypt(new Date(dto.dateOfBirth).toISOString());
      const player = await tx.player.create({
        data: {
          playerName: prospect.name,
          dateOfBirthEncrypted: encDob.encrypted,
          dateOfBirthIv: encDob.iv,
          preferredFoot: dto.preferredFoot ?? "RIGHT",
          height: dto.height,
          weight: dto.weight,
          position: dto.position ?? prospect.position ?? "STRIKER",
          level: "ROOKIE",
          status: "ACTIVE",
          nationalityId: dto.nationalityId,
          workPermitStatus: dto.workPermitStatus ?? "NOT_REQUIRED",
          workPermitExpiry: dto.workPermitExpiry ? new Date(dto.workPermitExpiry) : null,
          prospectId: prospectId,
        },
        select: { id: true },
      });

      await tx.contract.create({
        data: {
          playerId: player.id,
          startDate: new Date(dto.contractStartDate),
          endDate: new Date(dto.contractEndDate),
          salary: dto.salary,
          ...(dto.signingBonus !== undefined && { signingBonus: dto.signingBonus }),
          status: "ACTIVE",
          managedById: dto.managedById ?? null,
        },
      });

      return tx.prospect.update({
        where: { id: prospectId },
        data: { status: "SIGNED", convertedPlayerId: player.id },
        select: PROSPECT_SELECT,
      });
    });
  }

  async recordMedicalResult(id: number, dto: ProspectMedicalResultDto) {
    const newStatus = dto.result === "pass" ? "CONTRACT_PENDING" : "ARCHIVED";
    return this.prisma.prospect.update({
      where: { id },
      data: {
        status: newStatus,
        ...(dto.medicalNotes !== undefined && { medicalNotes: dto.medicalNotes }),
      },
      select: PROSPECT_SELECT,
    });
  }

  addNegotiationLog(id: number, dto: CreateProspectNegotiationLogDto, createdById: number) {
    return (this.prisma as any).prospectNegotiationLog.create({
      data: {
        prospectId: id,
        type: dto.type,
        note: dto.note,
        ...(dto.amount !== undefined && { amount: dto.amount }),
        createdById,
      },
    });
  }

  getNegotiationLogs(id: number) {
    return (this.prisma as any).prospectNegotiationLog.findMany({
      where: { prospectId: id },
      orderBy: { createdAt: "asc" },
      include: { createdBy: { select: { id: true, username: true } } },
    });
  }
}
