import { PrismaClient, Prisma } from "../generated/client";
import { ProspectStatus, VideoEvalResult, EvaluationLogType } from "../generated/enums";
import { AppError } from "../lib/appError";
import { encrypt } from "../lib/crypto";
import { CreateProspectDto, UpdateProspectDto, SignProspectDto, ProspectMedicalResultDto, CreateProspectNegotiationLogDto } from "./dto/prospect.dto";
import { CreateProspectVideoEvaluationDto, CreateProspectEvaluationLogDto } from "./dto/video-evaluation.dto";

const PROSPECT_SELECT = {
  id: true,
  name: true,
  nationality: true,
  position: true,
  currentTeam: true,
  notes: true,
  status: true,
  playStyle: true,
  convertedPlayerId: true,
  createdAt: true,
  createdBy: { select: { nickname: true } },
  visaRequired: true,
  visaEligibility: true,
  currentMarketValue: true,
} as const;

const VALID_TRANSITIONS: Record<ProspectStatus, ProspectStatus[]> = {
  LONGLIST:         ["SHORTLIST", "ARCHIVED"],
  SHORTLIST:        ["ACTIVE", "ARCHIVED"],
  ACTIVE:           ["MEDICAL_TEST", "ARCHIVED"],
  MEDICAL_TEST:     ["CONTRACT_PENDING", "ARCHIVED"],
  CONTRACT_PENDING: ["ARCHIVED"],
  SIGNED:           [],
  ARCHIVED:         [],
};

export class ProspectRepository {
  constructor(private prisma: PrismaClient) {}

  async checkDuplicate(name: string, currentTeam?: string) {
    const [prospects, squadPlayers] = await Promise.all([
      this.prisma.prospect.findMany({
        where: {
          name: { equals: name, mode: "insensitive" },
          ...(currentTeam ? { currentTeam: { equals: currentTeam, mode: "insensitive" } } : {}),
          status: { notIn: ["SIGNED", "ARCHIVED"] },
        },
        select: { id: true, name: true, currentTeam: true, position: true, status: true },
      }),
      this.prisma.player.findMany({
        where: {
          playerName: { equals: name, mode: "insensitive" },
          status: { notIn: ["RETIRED", "RELEASED"] },
        },
        select: { id: true, playerName: true, position: true, status: true },
      }),
    ]);
    return { prospects, squadPlayers };
  }

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
        status: dto.status ?? "LONGLIST",
        playStyle: (dto.playStyle as any) ?? null,
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
        ...(dto.currentMarketValue !== undefined && { currentMarketValue: dto.currentMarketValue }),
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
      select: { id: true, status: true, name: true, position: true, playStyle: true },
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
          ...(prospect.playStyle && { playStyle: prospect.playStyle }),
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

  addVideoEvaluation(
    prospectId: number,
    dto: CreateProspectVideoEvaluationDto,
    evaluatedById: number,
    result: VideoEvalResult,
  ) {
    return this.prisma.prospectVideoEvaluation.create({
      data: {
        prospectId,
        qualityPassed: dto.qualityPassed,
        identifiable: dto.identifiable,
        continuity: dto.continuity,
        totalScore: dto.totalScore ?? null,
        scoreData: dto.scoreData ?? Prisma.DbNull,
        result,
        notes: dto.notes ?? null,
        evaluatedById,
      },
      include: { evaluatedBy: { select: { nickname: true } } },
    });
  }

  getVideoEvaluations(prospectId: number) {
    return this.prisma.prospectVideoEvaluation.findMany({
      where: { prospectId },
      orderBy: { evaluatedAt: 'desc' },
      include: { evaluatedBy: { select: { nickname: true } } },
    });
  }

  getLatestVideoEvaluation(prospectId: number) {
    return this.prisma.prospectVideoEvaluation.findFirst({
      where: { prospectId },
      orderBy: { evaluatedAt: 'desc' },
      select: { result: true },
    });
  }

  addEvaluationLog(
    prospectId: number,
    dto: CreateProspectEvaluationLogDto,
    evaluatedById: number,
  ) {
    return this.prisma.prospectEvaluationLog.create({
      data: {
        prospectId,
        type: dto.type as EvaluationLogType,
        note: dto.note,
        evaluatedById,
        ...(dto.evaluatedAt && { evaluatedAt: new Date(dto.evaluatedAt) }),
      },
      include: { evaluatedBy: { select: { nickname: true } } },
    });
  }

  getEvaluationLogs(prospectId: number) {
    return this.prisma.prospectEvaluationLog.findMany({
      where: { prospectId },
      orderBy: { evaluatedAt: 'desc' },
      include: { evaluatedBy: { select: { nickname: true } } },
    });
  }

  async checkAcquisitionGate(prospectId: number) {
    const prospect = await this.prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { position: true, currentMarketValue: true },
    });
    if (!prospect) throw new AppError(404, 'PROSPECT_NOT_FOUND');

    if (!prospect.position) {
      return { positionMatched: false, budgetWarning: false, matchedSurveys: [] };
    }

    const items = await this.prisma.playerAcquisitionSurveyResponseItem.findMany({
      where: {
        position: prospect.position,
        response: { survey: { status: 'OPEN' } },
      },
      select: {
        position: true,
        budgetMin: true,
        budgetMax: true,
        response: { select: { surveyId: true } },
      },
    });

    const positionMatched = items.length > 0;
    let budgetWarning = false;
    if (positionMatched && prospect.currentMarketValue != null) {
      budgetWarning = items.every(
        (item) => item.budgetMax != null && prospect.currentMarketValue! > item.budgetMax,
      );
    }

    return {
      positionMatched,
      budgetWarning,
      matchedSurveys: items.map((item) => ({
        id: item.response.surveyId,
        position: item.position,
        budgetMin: item.budgetMin,
        budgetMax: item.budgetMax,
      })),
    };
  }
}
