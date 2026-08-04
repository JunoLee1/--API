import { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/appError";
import { isAdminLike } from "../../lib/permissions";
import type { MaintenanceService } from "./maintenance.service";
import type { CreateMaintenanceDto, UpdateMaintenanceDto, MaintenanceListQuery } from "./dto/maintenance.dto";

const isFacilityManager = (req: Request) =>
  isAdminLike(req.user!.role) ||
  req.user!.role === "GM" ||
  (req.user!.role === "FRONT_OFFICE" && req.user!.frontOfficeRole === "FACILITY_MANAGER");

const isGM = (req: Request) =>
  isAdminLike(req.user!.role) || req.user!.role === "GM";

export class MaintenanceController {
  constructor(private service: MaintenanceService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(req.query as MaintenanceListQuery));
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
      const result = await this.service.create(req.body as CreateMaintenanceDto, req.user!.id);
      res.status(201).json(result);
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params.id), req.body as UpdateMaintenanceDto));
    } catch (err) { next(err); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.updateStatus(Number(req.params.id), req.body.status));
    } catch (err) { next(err); }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.approve(Number(req.params.id), req.user!.id));
    } catch (err) { next(err); }
  };

  gmApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isGM(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.gmApprove(Number(req.params.id), req.user!.id));
    } catch (err) { next(err); }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req) && !isGM(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.reject(Number(req.params.id), req.body.reason));
    } catch (err) { next(err); }
  };
}
