import { Request, Response, NextFunction } from "express";
import { AgencyService } from "./agency.service";
import { hasPermission, Permission } from "../lib/permissions";
import { Role } from "../generated/enums";
import { AppError } from "../lib/appError";

const requireAdmin = (req: Request) => {
  if (!hasPermission(req.user!.role as Role, Permission.SYSTEM_MANAGE)) {
    throw new AppError(403, "FORBIDDEN");
  }
};

export class AgencyController {
  constructor(private service: AgencyService) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list());
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.get(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      res.status(201).json(await this.service.create(req.body));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      res.json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      await this.service.delete(Number(req.params["id"]));
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
