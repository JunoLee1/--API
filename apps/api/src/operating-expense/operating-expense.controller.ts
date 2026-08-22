import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { canReadFinance, canWriteFinance } from "../lib/permissions";
import { requireUser } from "../lib/authMiddleware";
import { OperatingExpenseService } from "./operating-expense.service";
import { OperatingCategory } from "../generated/client";

const canRead = (role: string, foRole: string | null | undefined) =>
  canReadFinance(role, foRole) || (role === "FRONT_OFFICE" && foRole === "TD");

const canCreate = (role: string, foRole: string | null | undefined) =>
  canWriteFinance(role, foRole);

const canDelete = (role: string, foRole: string | null | undefined) =>
  canWriteFinance(role, foRole);

export class OperatingExpenseController {
  constructor(private service: OperatingExpenseService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const expenses = await this.service.list(seasonId);
      res.json(expenses);
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = requireUser(req);
      if (!canCreate(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const { seasonId, category, amount, date, note, budgetLineId } = req.body as {
        seasonId: number;
        category: OperatingCategory;
        amount: number;
        date: string;
        note?: string;
        budgetLineId: number;
      };
      if (!budgetLineId) throw new AppError(400, "BUDGET_LINE_ID_REQUIRED");
      const expense = await this.service.create({
        seasonId, category, amount, date,
        ...(note !== undefined && { note }),
        budgetLineId,
        createdById: userId,
      });
      res.status(201).json(expense);
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = requireUser(req);
      if (!canDelete(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params["id"]);
      const { reason } = req.body as { reason?: string };
      if (!reason?.trim()) throw new AppError(400, "DELETION_REASON_REQUIRED");
      await this.service.delete(id, userId, role, reason.trim());
      res.status(204).end();
    } catch (err) { next(err); }
  };
}
