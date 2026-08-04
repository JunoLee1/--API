import { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/appError";
import { isAdminLike } from "../../lib/permissions";
import type { InspectionService } from "./inspection.service";
import type { CreateInspectionDto, UpdateInspectionDto, InspectionListQuery } from "./dto/inspection.dto";

const canWrite = (role: string) => isAdminLike(role) || role === "FRONT_OFFICE";

export class InspectionController {
  constructor(private service: InspectionService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(req.query as InspectionListQuery));
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.get(Number(req.params.id)));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, id: userId } = req.user!;
      if (!canWrite(role)) throw new AppError(403, "FORBIDDEN");
      const result = await this.service.create(req.body as CreateInspectionDto, userId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (!canWrite(role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params.id), req.body as UpdateInspectionDto));
    } catch (err) {
      next(err);
    }
  };
}
