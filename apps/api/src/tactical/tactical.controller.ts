import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { TacticalService } from "./tactical.service";

const TACTICAL_ROLES = ["ADMIN", "COACHING_STAFF"] as const;
type TacticalRole = (typeof TACTICAL_ROLES)[number];

export class TacticalController {
  constructor(private service: TacticalService) {}

  getByMatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getByMatch(Number(req.params["matchId"])));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!TACTICAL_ROLES.includes(req.user!.role as TacticalRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createAnalysis(req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  addLineup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!TACTICAL_ROLES.includes(req.user!.role as TacticalRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.addLineup(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  addMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!TACTICAL_ROLES.includes(req.user!.role as TacticalRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.addMedia(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };
}
