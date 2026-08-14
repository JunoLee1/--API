import { Request, Response, NextFunction } from "express";
import { requireUser } from "../lib/authMiddleware";
import { DashboardService } from "./dashboard.service";

export class DashboardController {
  constructor(private service: DashboardService) {}

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const teamType = req.query.teamType as "FIRST_TEAM" | "YOUTH" | undefined;
      const validTeamType = teamType === "FIRST_TEAM" || teamType === "YOUTH" ? teamType : undefined;
      res.status(200).json(await this.service.getStats(user, validTeamType));
    } catch (err) {
      next(err);
    }
  };
}
