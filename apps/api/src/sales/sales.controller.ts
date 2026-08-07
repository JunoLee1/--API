import type { Request, Response, NextFunction } from "express";
import { requireUser } from "../lib/authMiddleware";
import type { SalesService } from "./sales.service";

export class SalesController {
  constructor(private service: SalesService) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json(await this.service.findAll()); } catch (e) { next(e); }
  };
  create = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await this.service.create(req.body, requireUser(req).id)); } catch (e) { next(e); }
  };
  summary = async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json(await this.service.getSummary()); } catch (e) { next(e); }
  };
}
