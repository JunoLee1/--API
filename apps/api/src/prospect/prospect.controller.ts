import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { ProspectService } from "./prospect.service";
import { ProspectStatus } from "../generated/enums";

const canWrite = (role: string, frontOfficeRole: string | null | undefined): boolean =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" && (frontOfficeRole === "SCOUT" || frontOfficeRole === "GM"));

const canRead = (role: string, coachingRole: string | null | undefined): boolean =>
  role === "ADMIN" ||
  role === "FRONT_OFFICE" ||
  (role === "COACHING_STAFF" && coachingRole === "HEAD_COACH");

export class ProspectController {
  constructor(private service: ProspectService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      if (!canRead(role, coachingRole)) throw new AppError(403, "FORBIDDEN");
      const status = req.query["status"] as ProspectStatus | undefined;
      res.status(200).json(await this.service.getAll(status));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      if (!canRead(role, coachingRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create({ ...req.body, createdById: id }));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.updateStatus(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };
}
