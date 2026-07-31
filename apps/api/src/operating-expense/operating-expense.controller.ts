import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { OperatingExpenseService } from "./operating-expense.service";
import { OperatingCategory } from "../generated/client";

const canWrite = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" && (foRole === "GM" || foRole === "FINANCE_MANAGER"));

const canRead = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" && (foRole === "GM" || foRole === "TD" || foRole === "FINANCE_MANAGER"));

export class OperatingExpenseController {
  constructor(private service: OperatingExpenseService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const expenses = await this.service.list(seasonId);
      res.json(expenses);
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const { seasonId, category, amount, date, note } = req.body as {
        seasonId: number;
        category: OperatingCategory;
        amount: number;
        date: string;
        note?: string;
      };
      const expense = await this.service.create({ seasonId, category, amount, date, ...(note !== undefined && { note }), createdById: userId });
      res.status(201).json(expense);
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params["id"]);
      await this.service.delete(id, userId, role);
      res.status(204).end();
    } catch (err) { next(err); }
  };
}
