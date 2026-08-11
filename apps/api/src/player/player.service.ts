import { PlayerRepository } from "./player.repo";
import { AppError } from "../lib/appError";
import { writeAuditLog } from "../lib/auditLog";
import { CreatePlayerDto, UpdatePlayerDto, UpdatePlayerStatusDto, PlayerListQuery } from "./dto/player.dto";
import { MarketValueRepository } from "./market-value.repo";
import { UpdateMarketValueDto } from "./dto/market-value.dto";
import { getPrisma } from "../lib/prisma";
import { decrypt } from "../lib/crypto";

export class PlayerService {
  constructor(private repo: PlayerRepository, private mvRepo?: MarketValueRepository) {}

  getPlayers(query: PlayerListQuery) {
    return this.repo.findAll(query);
  }

  async getPlayerById(id: string, includePrivate = false) {
    const raw = await this.repo.findById(id, includePrivate);
    if (!raw) throw new AppError(404, "PLAYER_NOT_FOUND");

    const {
      dateOfBirthEncrypted, dateOfBirthIv,
      emergencyContactNameEncrypted, emergencyContactNameIv,
      emergencyContactPhoneEncrypted, emergencyContactPhoneIv,
      emergencyContactRelationEncrypted, emergencyContactRelationIv,
      ...rest
    } = raw as typeof raw & {
      dateOfBirthEncrypted?: string | null;
      dateOfBirthIv?: string | null;
      emergencyContactNameEncrypted?: string | null;
      emergencyContactNameIv?: string | null;
      emergencyContactPhoneEncrypted?: string | null;
      emergencyContactPhoneIv?: string | null;
      emergencyContactRelationEncrypted?: string | null;
      emergencyContactRelationIv?: string | null;
    };

    return {
      ...rest,
      dateOfBirth: dateOfBirthEncrypted && dateOfBirthIv
        ? decrypt(dateOfBirthEncrypted, dateOfBirthIv)
        : null,
      ...(includePrivate && {
        emergencyContactName: emergencyContactNameEncrypted && emergencyContactNameIv
          ? decrypt(emergencyContactNameEncrypted, emergencyContactNameIv)
          : null,
        emergencyContactPhone: emergencyContactPhoneEncrypted && emergencyContactPhoneIv
          ? decrypt(emergencyContactPhoneEncrypted, emergencyContactPhoneIv)
          : null,
        emergencyContactRelation: emergencyContactRelationEncrypted && emergencyContactRelationIv
          ? decrypt(emergencyContactRelationEncrypted, emergencyContactRelationIv)
          : null,
      }),
    };
  }

  async createPlayer(dto: CreatePlayerDto, actorId: number) {
    const player = await this.repo.create(dto);
    await writeAuditLog({ actorId, action: "PLAYER_CREATED", targetId: player.id });
    return player;
  }

  async updatePlayer(id: string, dto: UpdatePlayerDto) {
    const player = await this.repo.findById(id);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    return this.repo.update(id, dto);
  }

  async updatePlayerStatus(id: string, { status }: UpdatePlayerStatusDto, actorId: number) {
    const player = await this.repo.findById(id);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    const result = await this.repo.updateStatus(id, status);

    if (status === "RELEASED") {
      const prisma = getPrisma();
      const activeContracts = await prisma.contract.findMany({
        where: { playerId: id, status: "ACTIVE" },
        select: { id: true },
      });
      if (activeContracts.length > 0) {
        await prisma.contract.updateMany({
          where: { playerId: id, status: "ACTIVE" },
          data: { status: "TERMINATED" },
        });
        void writeAuditLog({
          actorId,
          action: "CONTRACTS_TERMINATED_ON_RELEASE",
          targetId: id,
          detail: { playerId: id, contractIds: activeContracts.map((c) => c.id) },
        }).catch(console.error);
      }
    }

    return result;
  }

  async deletePlayer(id: string, actorId: number) {
    const player = await this.repo.findById(id);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    await this.repo.delete(id);
    await writeAuditLog({ actorId, action: "PLAYER_DELETED", targetId: id, detail: { playerName: player.playerName } });
  }

  async getMarketValueHistory(playerId: string) {
    const player = await this.repo.findById(playerId);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    if (!this.mvRepo) throw new AppError(500, "MARKET_VALUE_REPO_NOT_CONFIGURED");
    return this.mvRepo.getHistory(playerId);
  }

  async updateMarketValue(playerId: string, dto: UpdateMarketValueDto, recordedById: number) {
    const player = await this.repo.findById(playerId);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    if (!this.mvRepo) throw new AppError(500, "MARKET_VALUE_REPO_NOT_CONFIGURED");
    await this.mvRepo.updateCurrentValue(playerId, dto.value, recordedById);
    return { playerId, currentMarketValue: dto.value };
  }

  async getMatchStats(playerId: string, seasonId?: number) {
    const player = await this.repo.findById(playerId);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    return this.repo.getMatchStats(playerId, seasonId);
  }

  async getTrainingResults(playerId: string, requesterId: string, requesterRole: string, from?: string, to?: string) {
    const player = await this.repo.findById(playerId);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    if (requesterRole === "PLAYER" && String(player.userId) !== requesterId) {
      throw new AppError(403, "FORBIDDEN");
    }
    return this.repo.getTrainingResults(playerId, from, to);
  }

  async getPositionDiversity(playerId: string) {
    const player = await this.repo.findById(playerId);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    if (player.team?.type !== "YOUTH") return [];
    const rows = await this.repo.getPositionDiversity(playerId);
    const totalMinutes = rows.reduce((sum, r) => sum + r.totalMinutes, 0);
    if (totalMinutes === 0) return [];
    return rows.map((r) => ({
      position: r.position,
      minutes: r.totalMinutes,
      percentage: Math.round((r.totalMinutes / totalMinutes) * 100),
    }));
  }
}
