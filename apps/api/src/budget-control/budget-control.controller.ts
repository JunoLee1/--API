import type { Request, Response, NextFunction } from "express";
import type { BudgetControlService } from "./budget-control.service";

export class BudgetControlController {
  constructor(private service: BudgetControlService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.service.create(req.body, req.user!.id));
    } catch (e) { next(e); }
  };

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const seasonId = req.query.seasonId ? Number(req.query.seasonId) : undefined;
      res.json(await this.service.getAll(seasonId));
    } catch (e) { next(e); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params.id)));
    } catch (e) { next(e); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.update(Number(req.params.id), req.body));
    } catch (e) { next(e); }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.submit(Number(req.params.id), req.user!.id));
    } catch (e) { next(e); }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.approve(Number(req.params.id), req.user!.id));
    } catch (e) { next(e); }
  };

  getAvailableBudget = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getAvailableBudget(Number(req.params.id)));
    } catch (e) { next(e); }
  };

  addLine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.service.addLine(Number(req.params.id), req.body));
    } catch (e) { next(e); }
  };

  updateLine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.updateLine(Number(req.params.id), Number(req.params.lineId), req.body));
    } catch (e) { next(e); }
  };

  deleteLine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.deleteLine(Number(req.params.id), Number(req.params.lineId));
      res.status(204).send();
    } catch (e) { next(e); }
  };

  requestAdjustment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.service.requestAdjustment(Number(req.params.id), req.body, req.user!.id));
    } catch (e) { next(e); }
  };

  approveAdjustment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.approveAdjustment(Number(req.params.id), Number(req.params.adjId), req.user!.id));
    } catch (e) { next(e); }
  };

  rejectAdjustment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.rejectAdjustment(Number(req.params.id), Number(req.params.adjId), req.user!.id));
    } catch (e) { next(e); }
  };
}
