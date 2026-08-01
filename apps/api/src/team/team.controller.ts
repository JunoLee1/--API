import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { TeamService } from "./team.service";

const canManage = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" || (role === "FRONT_OFFICE" && foRole === "GM");

export class TeamController {
  constructor(private service: TeamService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canManage(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getAll());
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canManage(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canManage(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canManage(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canManage(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.deactivate(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  setLiteMode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user as any;
      if (!canManage(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const result = await this.service.setLiteMode(Number(req.params["id"]), req.body.isLite, role);
      res.json(result);
    } catch (err) { next(err); }
  };
}
