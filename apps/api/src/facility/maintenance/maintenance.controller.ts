import { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/appError";
import { isAdminLike } from "../../lib/permissions";
import { requireUser } from "../../lib/authMiddleware";
import type { MaintenanceService } from "./maintenance.service";
import type { CreateMaintenanceDto, UpdateMaintenanceDto, MaintenanceListQuery } from "./dto/maintenance.dto";

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["PENDING_APPROVAL", "REJECTED"],
  PENDING_APPROVAL: ["RESOLVED", "REJECTED", "IN_PROGRESS"],
  RESOLVED: [],
  REJECTED: [],
};

const isFacilityManager = (req: Request) => {
  const user = requireUser(req);
  return isAdminLike(user.role) ||
    user.role === "GM" ||
    (user.role === "FRONT_OFFICE" && user.frontOfficeRole === "FACILITY_MANAGER");
};

const isGM = (req: Request) => {
  const user = requireUser(req);
  return isAdminLike(user.role) || user.role === "GM";
};

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
      const result = await this.service.create(req.body as CreateMaintenanceDto, requireUser(req).id);
      res.status(201).json(result);
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req)) throw new AppError(403, "FORBIDDEN");
      const { id: updatedById } = requireUser(req);
      res.json(await this.service.update(Number(req.params.id), req.body as UpdateMaintenanceDto, updatedById));
    } catch (err) { next(err); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req)) throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params.id);
      const { status } = req.body as { status: string };
      const existing = await this.service.get(id);
      const allowed = VALID_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(status)) {
        throw new AppError(400, "INVALID_STATUS_TRANSITION");
      }
      res.json(await this.service.updateStatus(id, status));
    } catch (err) { next(err); }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.approve(Number(req.params.id), requireUser(req).id));
    } catch (err) { next(err); }
  };

  gmApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isGM(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.gmApprove(Number(req.params.id), requireUser(req).id));
    } catch (err) { next(err); }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req) && !isGM(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.reject(Number(req.params.id), req.body.reason));
    } catch (err) { next(err); }
  };
}
