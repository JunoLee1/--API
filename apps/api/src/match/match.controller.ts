import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { MatchService } from "./match.service";
import { MatchListQuery, VALID_COMPETITION_TYPES } from "./dto/match.dto";
import { CompetitionType } from "../generated/enums";

const WRITE_ROLES = ["ADMIN", "FRONT_OFFICE"] as const;
const FRIENDLY_WRITE_ROLES = ["FRONT_OFFICE", "COACHING_STAFF"] as const;
const STATS_ROLES = ["ADMIN", "COACHING_STAFF"] as const;

type WriteRole = (typeof WRITE_ROLES)[number];
type FriendlyWriteRole = (typeof FRIENDLY_WRITE_ROLES)[number];
type StatsRole = (typeof STATS_ROLES)[number];

export class MatchController {
  constructor(private service: MatchService) {}

  getMatches = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query: MatchListQuery = {};
      if (req.query["seasonId"]) query.seasonId = Number(req.query["seasonId"]);
      if (req.query["competitionType"]) {
        const ct = req.query["competitionType"] as string;
        if (!VALID_COMPETITION_TYPES.includes(ct as CompetitionType)) throw new AppError(400, "INVALID_COMPETITION_TYPE");
        query.competitionType = ct as CompetitionType;
      }
      res.status(200).json(await this.service.getMatches(query));
    } catch (err) {
      next(err);
    }
  };

  getMatchById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getMatchById(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };

  createMatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      const canWriteAny = WRITE_ROLES.includes(role as WriteRole);
      const canWriteFriendly = FRIENDLY_WRITE_ROLES.includes(role as FriendlyWriteRole);
      if (!canWriteAny && !canWriteFriendly) throw new AppError(403, "FORBIDDEN");
      if (!canWriteAny && req.body.competitionType !== "FRIENDLY") {
        throw new AppError(403, "FRIENDLY_ONLY");
      }
      res.status(201).json(await this.service.createMatch(req.body));
    } catch (err) {
      next(err);
    }
  };

  updateMatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!WRITE_ROLES.includes(req.user!.role as WriteRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.updateMatch(Number(req.params["id"]), req.body));
    } catch (err) {
      next(err);
    }
  };

  upsertPlayerStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!STATS_ROLES.includes(req.user!.role as StatsRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.upsertPlayerStats(Number(req.params["id"]), req.body));
    } catch (err) {
      next(err);
    }
  };

  upsertTeamStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!STATS_ROLES.includes(req.user!.role as StatsRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.upsertTeamStats(Number(req.params["id"]), req.body));
    } catch (err) {
      next(err);
    }
  };
}
