import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { canWriteFinance } from "../lib/permissions";
import { requireUser } from "../lib/authMiddleware";
import type { BudgetOverrideService, OverrideRequestDto } from "./override.service";

export class BudgetOverrideController {
  constructor(private service: BudgetOverrideService) {}

  requestOverride = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = requireUser(req);
      const seasonId = Number(req.params["seasonId"]);
      const body = req.body as Partial<OverrideRequestDto>;
      if (!Number.isInteger(body.categoryId)) throw new AppError(400, "INVALID_CATEGORY_ID");
      if (!Number.isInteger(body.amount)) throw new AppError(400, "INVALID_AMOUNT");
      if (typeof body.reason !== "string") throw new AppError(400, "REASON_REQUIRED");
      const result = await this.service.requestOverride(seasonId, userId, {
        categoryId: body.categoryId!,
        amount: body.amount!,
        reason: body.reason,
      });
      res.status(201).json(result);
    } catch (err) { next(err); }
  };

  review = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = requireUser(req);
      if (!canWriteFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const logId = Number(req.params["id"]);
      const body = req.body as { decision?: "APPROVED" | "REJECTED"; note?: string };
      if (body.decision !== "APPROVED" && body.decision !== "REJECTED") {
        throw new AppError(400, "DECISION_MUST_BE_APPROVED_OR_REJECTED");
      }
      await this.service.reviewOverride(logId, userId, body.decision, body.note);
      res.status(204).end();
    } catch (err) { next(err); }
  };
}
