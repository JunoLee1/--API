import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import type { GrowthReportService } from "./growth-report.service";
import type { CreateGrowthEvaluationDto, AwardBadgeDto } from "./dto/growth-report.dto";
import { BadgeType } from "../generated/enums";

const COACH_ROLES = ["ADMIN", "COACHING_STAFF"] as const;

export class GrowthReportController {
  constructor(private service: GrowthReportService) {}

  getEvaluationsByPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getEvaluationsByPlayer(String(req.params["playerId"])));
    } catch (e) { next(e); }
  };

  getEvaluationById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getEvaluationById(Number(req.params["id"])));
    } catch (e) { next(e); }
  };

  createEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!COACH_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const body = req.body as CreateGrowthEvaluationDto;
      if (
        !body.playerId || !body.year || !body.month ||
        body.attitudeScore == null || !body.attitudeComment ||
        body.fundamentalsScore == null || !body.fundamentalsComment ||
        body.spatialScore == null || !body.spatialComment ||
        body.physicalScore == null || !body.physicalComment
      ) {
        throw new AppError(400, "MISSING_FIELDS");
      }
      res.status(201).json(await this.service.createEvaluation(body, req.user!.id));
    } catch (e) { next(e); }
  };

  updateEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!COACH_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.updateEvaluation(Number(req.params["id"]), req.body, req.user!.id));
    } catch (e) { next(e); }
  };

  publishEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!COACH_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.publishEvaluation(Number(req.params["id"])));
    } catch (e) { next(e); }
  };

  getBadgesByPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getBadgesByPlayer(String(req.params["playerId"])));
    } catch (e) { next(e); }
  };

  awardBadge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!COACH_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const body = req.body as AwardBadgeDto;
      if (!body.playerId || !body.badgeType) throw new AppError(400, "MISSING_FIELDS");
      if (!Object.values(BadgeType).includes(body.badgeType)) throw new AppError(400, "INVALID_BADGE_TYPE");
      res.status(201).json(await this.service.awardBadge(body, req.user!.id));
    } catch (e) { next(e); }
  };
}
