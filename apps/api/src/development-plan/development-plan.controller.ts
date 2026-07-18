import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { DevelopmentPlanService } from "./development-plan.service";

export class DevelopmentPlanController {
  constructor(private service: DevelopmentPlanService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { playerId, seasonId } = req.query;
      const query: import("./dto/development-plan.dto").PlanListQuery = {};
      if (playerId) query.playerId = playerId as string;
      if (seasonId) query.seasonId = Number(seasonId);
      res.json(await this.service.getAll(query));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "COACHING_STAFF") throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      res.json(await this.service.update(Number(req.params["id"]), req.body, req.user!.id, role, coachingRole));
    } catch (err) { next(err); }
  };

  activate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      res.json(await this.service.activate(Number(req.params["id"]), req.user!.id, role, coachingRole));
    } catch (err) { next(err); }
  };

  review = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      res.json(await this.service.review(Number(req.params["id"]), req.user!.id, role, coachingRole));
    } catch (err) { next(err); }
  };
}
