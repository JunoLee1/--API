import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { canWriteFinance } from "../lib/permissions";
import { requireUser } from "../lib/authMiddleware";
import type { BudgetPlanRequestService, SubmitLineDto } from "./plan-request.service";

const canFinanceManage = (role: string, foRole: string | null | undefined) =>
  canWriteFinance(role, foRole);

export class BudgetPlanRequestController {
  constructor(private service: BudgetPlanRequestService) {}

  openReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = requireUser(req);
      if (!canFinanceManage(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      await this.service.openReview(seasonId, userId);
      res.status(204).end();
    } catch (err) { next(err); }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = requireUser(req);
      const seasonId = Number(req.params["seasonId"]);
      const body = req.body as { lines?: SubmitLineDto[] };
      if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
        throw new AppError(400, "LINES_REQUIRED");
      }
      for (const line of body.lines) {
        if (!Number.isInteger(line.categoryId)) throw new AppError(400, "INVALID_CATEGORY_ID");
        if (!Array.isArray(line.triggers)) throw new AppError(400, "INVALID_TRIGGERS");
        if (!Number.isInteger(line.standardDelta) || line.standardDelta < 0) {
          throw new AppError(400, "INVALID_STANDARD_DELTA");
        }
        if (!Number.isInteger(line.premiumDelta) || line.premiumDelta < 0) {
          throw new AppError(400, "INVALID_PREMIUM_DELTA");
        }
      }
      const request = await this.service.submit(seasonId, userId, body.lines);
      res.status(201).json(request);
    } catch (err) { next(err); }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canFinanceManage(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const requests = await this.service.list(seasonId);
      res.json(requests);
    } catch (err) { next(err); }
  };
}
