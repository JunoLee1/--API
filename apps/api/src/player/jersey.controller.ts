import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { JerseyService } from "./jersey.service";

const GM_ROLES = ["GM", "ADMIN"] as const;
const ASSIGN_ROLES = ["GM", "ADMIN", "FRONT_OFFICE"] as const;

export class JerseyController {
  constructor(private service: JerseyService) {}

  listByPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.listByPlayer(String(req.params["id"]));
      res.json(result);
    } catch (err) { next(err); }
  };

  listByTeam = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = Number(req.params["teamId"]);
      if (!teamId) throw new AppError(400, "TEAM_ID_REQUIRED");
      const result = await this.service.listByTeam(teamId);
      res.json(result);
    } catch (err) { next(err); }
  };

  assign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ASSIGN_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const teamId = Number(req.body.teamId);
      if (!teamId) throw new AppError(400, "TEAM_ID_REQUIRED");
      const result = await this.service.assignToPlayer(teamId, req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  };

  release = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ASSIGN_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const { teamId, number } = req.body;
      const result = await this.service.release(Number(teamId), Number(number));
      res.json(result);
    } catch (err) { next(err); }
  };

  retire = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!GM_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const { teamId, number } = req.body;
      const result = await this.service.retire(Number(teamId), Number(number));
      res.json(result);
    } catch (err) { next(err); }
  };

  reactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isAdminLike(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      const { teamId, number } = req.body;
      const result = await this.service.reactivate(Number(teamId), Number(number));
      res.json(result);
    } catch (err) { next(err); }
  };
}
