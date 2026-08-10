import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { PlayerService } from "./player.service";
import { PlayerListQuery } from "./dto/player.dto";
import { PlayerStatus, Position, PlayerLevel, TeamType } from "../generated/enums";
import { getPlayerRadarData } from "./radar.service";
import { SecondaryPositionRepository } from "./secondary-position.repo";
import { writeAuditLog } from "../lib/auditLog";

const WRITE_ROLES = ["ADMIN", "FRONT_OFFICE"] as const;
const SECONDARY_POS_WRITE_ROLES = ["ADMIN", "COACHING_STAFF"] as const;
const MARKET_VALUE_ROLES = ["GM", "TD", "ADMIN"] as const;

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED");
  return req.user;
}

export class PlayerController {
  constructor(private service: PlayerService, private spRepo?: SecondaryPositionRepository) {}

  getPlayers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query;
      const query: PlayerListQuery = {};
      if (q["status"]) query.status = q["status"] as PlayerStatus;
      if (q["position"]) query.position = q["position"] as Position;
      if (q["level"]) query.level = q["level"] as PlayerLevel;
      if (q["nationalityId"]) query.nationalityId = Number(q["nationalityId"]);
      if (q["excludeYouth"] === "true") query.excludeYouth = true;
      if (q["teamType"]) query.teamType = q["teamType"] as TeamType;
      res.status(200).json(await this.service.getPlayers(query));
    } catch (err) {
      next(err);
    }
  };

  getPlayerById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const includePrivate = isAdminLike(user.role) || user.role === "GM" || user.frontOfficeRole === "TD";
      const player = await this.service.getPlayerById(String(req.params["id"]), includePrivate);
      if (user.role === "PLAYER") {
        const { currentMarketValue: _mv, ...safePlayer } = player as typeof player & { currentMarketValue?: unknown };
        return res.status(200).json(safePlayer);
      }
      res.status(200).json(player);
    } catch (err) {
      next(err);
    }
  };

  createPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(WRITE_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      const player = await this.service.createPlayer(req.body, user.id);
      res.status(201).json(player);
    } catch (err) {
      next(err);
    }
  };

  updatePlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(WRITE_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      const player = await this.service.updatePlayer(String(req.params["id"]), req.body);
      res.status(200).json(player);
    } catch (err) {
      next(err);
    }
  };

  updatePlayerStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!isAdminLike(user.role)) throw new AppError(403, "FORBIDDEN");
      const result = await this.service.updatePlayerStatus(String(req.params["id"]), req.body, user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  deletePlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!isAdminLike(user.role)) throw new AppError(403, "FORBIDDEN");
      await this.service.deletePlayer(String(req.params["id"]), user.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  getMarketValueHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(MARKET_VALUE_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      void writeAuditLog({ actorId: user.id, action: "PLAYER_MARKET_VALUE_READ", targetId: String(req.params["id"]) }).catch(console.error);
      const history = await this.service.getMarketValueHistory(String(req.params["id"]));
      res.json(history);
    } catch (err) { next(err); }
  };

  updateMarketValue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(MARKET_VALUE_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      const result = await this.service.updateMarketValue(
        String(req.params["id"]),
        req.body,
        user.id,
      );
      res.json(result);
    } catch (err) { next(err); }
  };

  getMatchStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const seasonId = req.query["seasonId"] ? Number(req.query["seasonId"]) : undefined;
      res.json(await this.service.getMatchStats(String(req.params["id"]), seasonId));
    } catch (err) { next(err); }
  };

  getTrainingResults = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const { from, to } = req.query as Record<string, string | undefined>;
      res.json(await this.service.getTrainingResults(String(req.params["id"]), String(user.id), user.role, from, to));
    } catch (err) { next(err); }
  };

  getPositionDiversity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getPositionDiversity(String(req.params["id"])));
    } catch (err) { next(err); }
  };

  getRadar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerId = String(req.params["id"]);
      const player = await this.service.getPlayerById(playerId);
      const stats = await this.service.getMatchStats(playerId);
      const radar = await getPlayerRadarData(player.position, stats);
      if (!radar) return res.json({ scores: {}, strengths: [], weaknesses: [], message: "데이터 부족" });
      res.json(radar);
    } catch (err) { next(err); }
  };

  listSecondaryPositions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.spRepo) throw new AppError(500, "SECONDARY_POSITION_REPO_NOT_CONFIGURED");
      res.json(await this.spRepo.list(String(req.params["playerId"])));
    } catch (err) { next(err); }
  };

  upsertSecondaryPosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!this.spRepo) throw new AppError(500, "SECONDARY_POSITION_REPO_NOT_CONFIGURED");
      if (!(SECONDARY_POS_WRITE_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      const { position, fitnessTarget } = req.body as { position: Position; fitnessTarget: number };
      res.json(await this.spRepo.upsert(String(req.params["playerId"]), position, fitnessTarget));
    } catch (err) { next(err); }
  };

  deleteSecondaryPosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!this.spRepo) throw new AppError(500, "SECONDARY_POSITION_REPO_NOT_CONFIGURED");
      if (!(SECONDARY_POS_WRITE_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      await this.spRepo.delete(String(req.params["playerId"]), String(req.params["position"]) as Position);
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
