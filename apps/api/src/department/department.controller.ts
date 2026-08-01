import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { DepartmentService } from "./department.service";

const canWrite = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" && (foRole === "GM" || foRole === "ASSET_MANAGER"));

const canRead = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" &&
    (foRole === "GM" || foRole === "ASSET_MANAGER" || foRole === "FINANCE_MANAGER"));

export class DepartmentController {
  constructor(private service: DepartmentService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.list());
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.get(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const { name, parentId } = req.body as { name: string; parentId?: number };
      if (!name?.trim()) throw new AppError(400, "NAME_REQUIRED");
      res.status(201).json(
        await this.service.create({
          name: name.trim(),
          ...(parentId !== undefined && { parentId }),
        })
      );
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const data = req.body as { name?: string; isActive?: boolean; parentId?: number | null };
      res.json(await this.service.update(Number(req.params["id"]), data));
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      await this.service.delete(Number(req.params["id"]));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
