import { Request, Response, NextFunction } from "express";
import { DashboardService } from "./dashboard.service";

export class DashboardController {
  constructor(private service: DashboardService) {}

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getStats(req.user!));
    } catch (err) {
      next(err);
    }
  };
}
