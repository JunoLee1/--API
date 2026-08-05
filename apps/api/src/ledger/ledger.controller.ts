import type { Request, Response, NextFunction } from "express";
import type { LedgerService } from "./ledger.service";

export class LedgerController {
  constructor(private service: LedgerService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await this.service.findAll(req.query as any)); } catch (e) { next(e); }
  };
  get = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await this.service.findById(Number(req.params.id))); } catch (e) { next(e); }
  };
  create = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await this.service.create(req.body, req.user!.id)); } catch (e) { next(e); }
  };
  refund = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await this.service.createRefund(Number(req.params.id), req.user!.id)); } catch (e) { next(e); }
  };
}
