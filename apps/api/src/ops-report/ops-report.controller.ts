import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { requireUser } from "../lib/authMiddleware";
import { canReadFinance } from "../lib/permissions";
import { OpsReportService } from "./ops-report.service";

const canRead = (role: string, foRole: string | null | undefined) =>
  canReadFinance(role, foRole) ||
  (role === "FRONT_OFFICE" && foRole === "HR_MANAGER");

export class OpsReportController {
  constructor(private service: OpsReportService) {}

  getOpsKpi = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      const year = Number(req.query["year"]) || new Date().getFullYear();
      const month = Number(req.query["month"]) || new Date().getMonth();
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const data = await this.service.getOpsSnapshot(seasonId, year, month);
      res.json(data);
    } catch (err) { next(err); }
  };

  getAnnualOps = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const data = await this.service.getAnnualOpsReport(seasonId);
      res.json(data);
    } catch (err) { next(err); }
  };

  getBudgetKpi = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      const year = Number(req.query["year"]) || new Date().getFullYear();
      const month = Number(req.query["month"]) || new Date().getMonth();
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const data = await this.service.getBudgetSnapshot(seasonId, year, month);
      res.json(data);
    } catch (err) { next(err); }
  };

  getAnnualBudget = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const data = await this.service.getAnnualBudgetReport(seasonId);
      res.json(data);
    } catch (err) { next(err); }
  };

  getDrillNoticeUnread = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!(role === "FRONT_OFFICE" && frontOfficeRole === "HR_MANAGER")) throw new AppError(403, "FORBIDDEN");
      const year = Number(req.query["year"]) || new Date().getFullYear();
      const month = Number(req.query["month"]) || new Date().getMonth() + 1;
      const data = await this.service.drillNoticeUnread(year, month);
      res.json(data);
    } catch (err) { next(err); }
  };

  getDrillAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!(role === "FRONT_OFFICE" && frontOfficeRole === "HR_MANAGER")) throw new AppError(403, "FORBIDDEN");
      const year = Number(req.query["year"]) || new Date().getFullYear();
      const month = Number(req.query["month"]) || new Date().getMonth() + 1;
      const data = await this.service.drillAttendance(year, month);
      res.json(data);
    } catch (err) { next(err); }
  };

  drillAttendanceCorrections = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const year = Number(req.query["year"]) || new Date().getFullYear();
      const month = Number(req.query["month"]) || new Date().getMonth() + 1;
      const data = await this.service.getAttendanceCorrectionLog(year, month);
      res.json(data);
    } catch (err) { next(err); }
  };

  getDrillSalaryDistribution = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const data = await this.service.getSalaryDistributionDrilldown(seasonId);
      res.json(data);
    } catch (err) { next(err); }
  };

  getDrillUnregisteredAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      const year = Number(req.query["year"]) || new Date().getFullYear();
      const month = Number(req.query["month"]) || new Date().getMonth() + 1;
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const data = await this.service.getSessionsWithUnregisteredAttendance(seasonId, year, month);
      res.json(data);
    } catch (err) { next(err); }
  };

  getBudgetExecutionByCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      const year = Number(req.query["year"]) || new Date().getFullYear();
      const month = Number(req.query["month"]) || new Date().getMonth() + 1;
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const data = await this.service.getBudgetExecutionByCategory(seasonId, year, month);
      res.json(data);
    } catch (err) { next(err); }
  };

  getPartnerKpi = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const data = await this.service.getPartnerKpi(seasonId);
      res.json(data);
    } catch (err) { next(err); }
  };

  getSponsorshipVsBudget = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const data = await this.service.getSponsorshipVsBudget(seasonId);
      res.json(data);
    } catch (err) { next(err); }
  };
}
