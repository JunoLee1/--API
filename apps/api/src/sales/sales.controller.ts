import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { requireUser } from "../lib/authMiddleware";
import { canReadFinance, canWriteFinance } from "../lib/permissions";
import type { SalesService } from "./sales.service";

export class SalesController {
  constructor(private service: SalesService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.findAll());
    } catch (e) { next(e); }
  };

  byMatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const matchId = Number(req.params["matchId"]);
      if (!matchId) throw new AppError(400, "MATCH_ID_REQUIRED");
      res.json(await this.service.findByMatch(matchId));
    } catch (e) { next(e); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body, id));
    } catch (e) { next(e); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = requireUser(req);
      if (!canWriteFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params["id"]);
      if (!id) throw new AppError(400, "ID_REQUIRED");
      await this.service.delete(id, userId);
      res.status(204).end();
    } catch (e) { next(e); }
  };

  summary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getSummary());
    } catch (e) { next(e); }
  };

  ticketSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      res.json(await this.service.ticketSummaryByMatch(seasonId));
    } catch (e) { next(e); }
  };

  seasonTicketTotal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const total = await this.service.seasonTicketTotal(seasonId);
      res.json({ total });
    } catch (e) { next(e); }
  };

  search = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const { type, matchId, fromDate, toDate, minAmount, maxAmount } = req.query as Record<string, string>;
      res.json(await this.service.searchSales({
        type,
        matchId: matchId ? Number(matchId) : undefined,
        fromDate,
        toDate,
        minAmount: minAmount ? Number(minAmount) : undefined,
        maxAmount: maxAmount ? Number(maxAmount) : undefined,
      }));
    } catch (e) { next(e); }
  };
}
