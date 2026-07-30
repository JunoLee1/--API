import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
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
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const { currency } = req.body;
      if (!currency) throw new AppError(400, "currency is required");
      res.json(await this.service.update(currency));
    } catch (err) {
      next(err);
    }
  };
}
