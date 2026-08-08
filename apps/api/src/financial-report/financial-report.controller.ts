import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { canWriteFinance } from "../lib/permissions";
import { requireUser } from "../lib/authMiddleware";
import { FinancialReportService } from "./financial-report.service";
import { OperatingCategory } from "../generated/client";

const canWrite = (role: string, foRole: string | null | undefined) =>
  canWriteFinance(role, foRole);

const canRead = (role: string, foRole: string | null | undefined) =>
  canWriteFinance(role, foRole) || (role === "FRONT_OFFICE" && foRole === "TD");

export class FinancialReportController {
  constructor(private service: FinancialReportService) {}

  set = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const { totalRevenue, note } = req.body as { totalRevenue: number; note?: string };
      if (!Number.isInteger(totalRevenue)) throw new AppError(400, "INVALID_REVENUE");
      const report = await this.service.set(seasonId, totalRevenue, note);
      res.status(200).json(report);
    } catch (err) { next(err); }
  };

  setFromCSV = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      if (!req.file) throw new AppError(400, "FILE_REQUIRED");
      const csvContent = req.file.buffer.toString("utf-8");
      const note = (req.body as { note?: string }).note;
      const report = await this.service.setFromCSV(seasonId, csvContent, note);
      res.status(200).json(report);
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const report = await this.service.get(seasonId);
      res.status(200).json(report);
    } catch (err) { next(err); }
  };

  getBudgetPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const result = await this.service.getComparison(seasonId);
      res.status(200).json(result);
    } catch (err) { next(err); }
  };

  upsertBudgetPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const plan = await this.service.upsertBudgetPlan(seasonId, req.body);
      res.status(200).json(plan);
    } catch (err) { next(err); }
  };

  optimize = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const result = await this.service.optimize(seasonId);
      res.status(200).json(result);
    } catch (err) { next(err); }
  };

  addOverride = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const { category, amount, reason } = req.body as { category: OperatingCategory; amount: number; reason: string };
      const log = await this.service.addOverride(seasonId, category, amount, reason, userId);
      res.status(201).json(log);
    } catch (err) { next(err); }
  };

  getWithLedger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const data = await this.service.getReportWithLedger(seasonId);
      res.status(200).json(data);
    } catch (err) { next(err); }
  };
}
