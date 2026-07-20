import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { MatchSquadService } from "./match.squad.service";

const CONFIRM_ROLES = ["ADMIN", "COACHING_STAFF"] as const;
const MANAGE_ROLES = ["ADMIN", "COACHING_STAFF", "FRONT_OFFICE"] as const;

export class MatchSquadController {
  constructor(private service: MatchSquadService) {}

  getSquad = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = Number(req.params["id"]);
      const squad = await this.service.getSquad(matchId);
      res.json(squad);
    } catch (err) { next(err); }
  };

  addPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!MANAGE_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const matchId = Number(req.params["id"]);
      const { playerId } = req.body as { playerId: string };
      if (!playerId) throw new AppError(400, "PLAYER_ID_REQUIRED");
      const entry = await this.service.addPlayer(matchId, playerId);
      res.status(201).json(entry);
    } catch (err) { next(err); }
  };

  removePlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!MANAGE_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const matchId = Number(req.params["id"]);
      const { playerId } = req.body as { playerId: string };
      if (!playerId) throw new AppError(400, "PLAYER_ID_REQUIRED");
      await this.service.removePlayer(matchId, playerId);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  confirmSquad = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!CONFIRM_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const matchId = Number(req.params["id"]);
      const result = await this.service.confirmSquad(matchId, req.user!.id);
      res.json({ confirmed: result.count });
    } catch (err) { next(err); }
  };
}
