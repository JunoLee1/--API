import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { StaffRecordService } from "./staff-record.service";

const canWrite = (role: string) =>
  role === "GM";

const canRead = (role: string) =>
  isAdminLike(role) || role === "GM";

export class StaffRecordController {
  constructor(private service: StaffRecordService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (!canRead(role)) throw new AppError(403, "FORBIDDEN");
      const includeInactive = req.query["includeInactive"] === "true";
      res.json(await this.service.list(includeInactive));
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (!canRead(role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.get(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, id } = req.user!;
      if (!canWrite(role)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body, id));
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (!canWrite(role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (!canWrite(role)) throw new AppError(403, "FORBIDDEN");
      await this.service.delete(Number(req.params["id"]));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
