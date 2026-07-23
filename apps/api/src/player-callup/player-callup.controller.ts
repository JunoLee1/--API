import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { PlayerCallupService } from "./player-callup.service";

export class PlayerCallupController {
  constructor(private service: PlayerCallupService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query["status"] ? { status: req.query["status"] as string } : {};
      res.json(await this.service.getAll(q));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      if (role !== "COACHING_STAFF" || coachingRole !== "HEAD_COACH") {
        throw new AppError(403, "FORBIDDEN");
      }
      res.status(201).json(await this.service.create(req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (role !== "FRONT_OFFICE" || frontOfficeRole !== "GM") {
        throw new AppError(403, "FORBIDDEN");
      }
      res.json(await this.service.approve(Number(req.params["id"]), req.user!.id));
    } catch (err) { next(err); }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (role !== "FRONT_OFFICE" || frontOfficeRole !== "GM") {
        throw new AppError(403, "FORBIDDEN");
      }
      res.json(await this.service.reject(Number(req.params["id"]), req.user!.id, req.body));
    } catch (err) { next(err); }
  };

  complete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole, frontOfficeRole } = req.user!;
      const isHeadCoach = role === "COACHING_STAFF" && coachingRole === "HEAD_COACH";
      const isGM = role === "FRONT_OFFICE" && frontOfficeRole === "GM";
      if (!isHeadCoach && !isGM) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.complete(Number(req.params["id"]), req.user!.id));
    } catch (err) { next(err); }
  };

  confirmYouth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole, teamId } = req.user!;
      if (role !== "COACHING_STAFF" || coachingRole !== "HEAD_COACH") {
        throw new AppError(403, "FORBIDDEN");
      }
      res.json(await this.service.confirmYouth(Number(req.params["id"]), teamId ?? null));
    } catch (err) { next(err); }
  };

  confirmMedical = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      if (role !== "COACHING_STAFF" || coachingRole !== "MEDICAL") {
        throw new AppError(403, "FORBIDDEN");
      }
      res.json(await this.service.confirmMedical(Number(req.params["id"])));
    } catch (err) { next(err); }
  };
}
