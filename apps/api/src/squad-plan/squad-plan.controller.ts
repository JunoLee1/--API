import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { requireUser } from "../lib/authMiddleware";
import { SquadPlanService } from "./squad-plan.service";

export class SquadPlanController {
  constructor(private service: SquadPlanService) {}

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = requireUser(req);
      const canRead = isAdminLike(role) || role === "COACHING_STAFF";
      if (!canRead) throw new AppError(403, "FORBIDDEN");

      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId || isNaN(seasonId)) throw new AppError(400, "INVALID_SEASON_ID");

      const plan = await this.service.get(seasonId);
      res.status(200).json(plan ?? null);
    } catch (err) {
      next(err);
    }
  };

  save = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole, id: userId } = requireUser(req);
      const canSave =
        isAdminLike(role) ||
        (role === "COACHING_STAFF" && coachingRole === "HEAD_COACH");
      if (!canSave) throw new AppError(403, "FORBIDDEN");

      res.status(200).json(await this.service.save(req.body, userId));
    } catch (err) {
      next(err);
    }
  };
}
