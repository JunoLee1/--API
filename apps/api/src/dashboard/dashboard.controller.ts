import { Request, Response, NextFunction } from "express";
import { CoachingRole, FrontOfficeRole, Role } from "../generated/enums";
import { DashboardService } from "./dashboard.service";

type UserCtx = {
  id: number;
  role: Role;
  coachingRole: CoachingRole | null | undefined;
  frontOfficeRole: FrontOfficeRole | null | undefined;
};

export class DashboardController {
  constructor(private service: DashboardService) {}

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getStats(req.user! as UserCtx));
    } catch (err) {
      next(err);
    }
  };
}
