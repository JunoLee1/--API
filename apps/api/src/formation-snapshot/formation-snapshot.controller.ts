import { Request, Response, NextFunction } from "express";
import { requireUser } from "../lib/authMiddleware";
import { isAdminLike } from "../lib/permissions";
import { AppError } from "../lib/appError";
import { FormationSnapshotService } from "./formation-snapshot.service";

export class FormationSnapshotController {
  constructor(private service: FormationSnapshotService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!isAdminLike(user.role) && user.role !== "COACHING_STAFF") throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body, user.id));
    } catch (err) { next(err); }
  };

  findByMatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireUser(req);
      res.status(200).json(await this.service.findByMatch(Number(req.params["matchId"])));
    } catch (err) { next(err); }
  };
}
