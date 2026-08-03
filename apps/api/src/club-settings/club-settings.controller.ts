import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { ClubSettingsService } from "./club-settings.service";

export class ClubSettingsController {
  constructor(private service: ClubSettingsService) {}

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.get());
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isAdminLike(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      const body = req.body as { currency?: string; ibiBeta?: number };
      const data: { currency?: string; ibiBeta?: number } = {};
      if (body.currency !== undefined) data.currency = body.currency;
      if (body.ibiBeta !== undefined) data.ibiBeta = body.ibiBeta;
      res.json(await this.service.update(data));
    } catch (err) {
      next(err);
    }
  };
}
