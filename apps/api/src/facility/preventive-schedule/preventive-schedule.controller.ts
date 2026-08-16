import { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/appError";
import { requireUser } from "../../lib/authMiddleware";
import { isAdminLike } from "../../lib/permissions";
import type { PreventiveScheduleService } from "./preventive-schedule.service";
import type { CreatePreventiveScheduleDto, UpdatePreventiveScheduleDto, PreventiveScheduleListQuery } from "./dto/preventive-schedule.dto";

const isFacilityManager = (req: Request) => {
  const user = requireUser(req);
  return isAdminLike(user.role) ||
    user.role === "GM" ||
    (user.role === "FRONT_OFFICE" && user.frontOfficeRole === "FACILITY_MANAGER");
};

export class PreventiveScheduleController {
  constructor(private service: PreventiveScheduleService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(req.query as PreventiveScheduleListQuery));
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.get(Number(req.params.id)));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body as CreatePreventiveScheduleDto));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params.id), req.body as UpdatePreventiveScheduleDto));
    } catch (err) { next(err); }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.deactivate(Number(req.params.id)));
    } catch (err) { next(err); }
  };
}
