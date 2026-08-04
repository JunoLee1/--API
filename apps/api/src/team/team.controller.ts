import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { TeamService } from "./team.service";

const canManage = (role: string) =>
  role === "ADMIN" || role === "SUPER_ADMIN" || role === "GM";

export class TeamController {
  constructor(private service: TeamService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canManage(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getAll());
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canManage(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canManage(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canManage(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canManage(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.deactivate(Number(req.params["id"])));
    } catch (err) { next(err); }
  };
}
