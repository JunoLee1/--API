import { Request, Response, NextFunction } from "express";
import { HrReportService } from "./hr-report.service";
import { AppError } from "../lib/appError";

export class HrReportController {
  constructor(private service: HrReportService) {}

  getMonthly = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const year = Number(req.query.year ?? now.getFullYear());
      const month = Number(req.query.month ?? now.getMonth() + 1);
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        throw new AppError(400, "INVALID_PERIOD");
      }
      res.json(await this.service.getMonthly(year, month));
    } catch (err) {
      next(err);
    }
  };

  getAnnual = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = Number(req.query.year ?? new Date().getFullYear());
      if (isNaN(year) || year < 2000 || year > 2100) {
        throw new AppError(400, "INVALID_YEAR");
      }
      res.json(await this.service.getAnnual(year));
    } catch (err) {
      next(err);
    }
  };
}
