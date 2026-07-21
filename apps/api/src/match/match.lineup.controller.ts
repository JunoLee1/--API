import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { MatchLineupService } from "./match.lineup.service";
import type { SaveLineupDto } from "./dto/lineup.dto";

const EDIT_ROLES = ["ADMIN", "COACHING_STAFF", "HEAD_COACH"] as const;
const CONFIRM_ROLES = ["ADMIN", "HEAD_COACH"] as const;

export class MatchLineupController {
  constructor(private service: MatchLineupService) {}

  getLineup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = Number(req.params["id"]);
      const lineup = await this.service.getLineup(matchId);
      res.json(lineup ?? null);
    } catch (err) { next(err); }
  };

  saveLineup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!EDIT_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const matchId = Number(req.params["id"]);
      const dto = req.body as SaveLineupDto;
      const result = await this.service.saveLineup(matchId, dto);
      res.json(result);
    } catch (err) { next(err); }
  };

  confirmLineup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!CONFIRM_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const matchId = Number(req.params["id"]);
      const result = await this.service.confirmLineup(matchId, req.user!.id);
      res.json(result);
    } catch (err) { next(err); }
  };
}
