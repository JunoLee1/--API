import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { AnalysisService } from "./analysis.service";
import { CompetitionType, Role } from "../generated/enums";
import { hasPermission, Permission } from "../lib/permissions";
import { requireUser } from "../lib/authMiddleware";

export class AnalysisController {
  constructor(private service: AnalysisService) {}

  getRankings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!hasPermission(user.role as Role, Permission.VIEW_TEAM_RANKING)) {
        throw new AppError(403, "FORBIDDEN");
      }

      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId || isNaN(seasonId)) throw new AppError(400, "SEASON_ID_REQUIRED");

      const competitionType = (req.query["competitionType"] as CompetitionType | undefined) ?? CompetitionType.LEAGUE;

      res.status(200).json(await this.service.getRankings(seasonId, competitionType));
    } catch (err) {
      next(err);
    }
  };
}
