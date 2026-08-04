import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { TeamService } from "./team.service";

const isSuperAdmin = (role: string) => role === "SUPER_ADMIN";
const isAdminOrGM = (role: string) => role === "ADMIN" || role === "GM";

export class TeamController {
  constructor(private service: TeamService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (!isSuperAdmin(role) && !isAdminOrGM(role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getAll());
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (!isSuperAdmin(role) && !isAdminOrGM(role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, clubId } = req.user!;
      if (isSuperAdmin(role)) {
        res.status(201).json(await this.service.create(req.body));
        return;
      }
      if (isAdminOrGM(role)) {
        const type = req.body?.type as string | undefined;
        if (type !== "YOUTH") throw new AppError(403, "YOUTH_TEAM_ONLY");
        res.status(201).json(await this.service.create({ ...req.body, clubId: clubId ?? undefined }));
        return;
      }
      throw new AppError(403, "FORBIDDEN");
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, clubId } = req.user!;
      const id = Number(req.params["id"]);
      if (isSuperAdmin(role)) {
        res.json(await this.service.update(id, req.body));
        return;
      }
      if (isAdminOrGM(role)) {
        const team = await this.service.getById(id);
        if (team.type !== "YOUTH") throw new AppError(403, "YOUTH_TEAM_ONLY");
        if (team.clubId !== clubId) throw new AppError(403, "FORBIDDEN");
        res.json(await this.service.update(id, req.body));
        return;
      }
      throw new AppError(403, "FORBIDDEN");
    } catch (err) { next(err); }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, clubId } = req.user!;
      const id = Number(req.params["id"]);
      if (isSuperAdmin(role)) {
        res.json(await this.service.deactivate(id));
        return;
      }
      if (isAdminOrGM(role)) {
        const team = await this.service.getById(id);
        if (team.type !== "YOUTH") throw new AppError(403, "YOUTH_TEAM_ONLY");
        if (team.clubId !== clubId) throw new AppError(403, "FORBIDDEN");
        res.json(await this.service.deactivate(id));
        return;
      }
      throw new AppError(403, "FORBIDDEN");
    } catch (err) { next(err); }
  };
}
