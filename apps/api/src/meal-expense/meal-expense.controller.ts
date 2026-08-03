import { Request, Response, NextFunction } from "express";
import { MealExpenseType } from "../generated/client";
import { AppError } from "../lib/appError";
import { MealExpenseService } from "./meal-expense.service";

const canRead = (role: string, frontOfficeRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" &&
    (frontOfficeRole === "GM" || frontOfficeRole === "FINANCE_MANAGER" || frontOfficeRole === "FINANCE_STAFF"));

const canWrite = (role: string, frontOfficeRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" &&
    (frontOfficeRole === "GM" ||
      frontOfficeRole === "FINANCE_MANAGER" ||
      frontOfficeRole === "FINANCE_STAFF" ||
      frontOfficeRole === "EQUIPMENT_MANAGER"));

const canDelete = (role: string, frontOfficeRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" &&
    (frontOfficeRole === "GM" || frontOfficeRole === "FINANCE_MANAGER" || frontOfficeRole === "EQUIPMENT_MANAGER"));

export class MealExpenseController {
  constructor(private service: MealExpenseService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const { type, from, to } = req.query as Record<string, string | undefined>;
      const filters: { type?: MealExpenseType; from?: string; to?: string } = {};
      if (type) filters.type = type as MealExpenseType;
      if (from) filters.from = from;
      if (to) filters.to = to;
      res.json(await this.service.list(filters));
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.get(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body, id));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canDelete(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      await this.service.delete(Number(req.params["id"]));
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
