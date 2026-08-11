import { Request, Response, NextFunction } from "express";
import path from "path";
import { PlanReportService } from "./plan-report.service";
import { requireUser } from "../lib/authMiddleware";
import { ListPlanReportQuery } from "./dto/plan-report.dto";

export class PlanReportController {
  constructor(private service: PlanReportService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await this.service.list(req.query as ListPlanReportQuery);
      res.json(plans);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await this.service.getById(Number(req.params["id"]));
      res.json(plan);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const plan = await this.service.create(req.body, user.id);
      res.status(201).json(plan);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await this.service.update(Number(req.params["id"]), req.body);
      res.json(plan);
    } catch (err) {
      next(err);
    }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const plan = await this.service.submit(Number(req.params["id"]), user.id);
      res.json(plan);
    } catch (err) {
      next(err);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const plan = await this.service.approve(Number(req.params["id"]), user.id, user.role);
      res.json(plan);
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const plan = await this.service.reject(
        Number(req.params["id"]),
        user.id,
        user.role,
        req.body.reason,
      );
      res.json(plan);
    } catch (err) {
      next(err);
    }
  };

  submitResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const plan = await this.service.submitResult(
        Number(req.params["id"]),
        user.id,
        req.body.resultContent,
      );
      res.json(plan);
    } catch (err) {
      next(err);
    }
  };

  uploadAttachment = (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ error: "NO_FILE_UPLOADED" });
      const relativePath = `/uploads/plan-reports/${path.basename(req.file.path)}`;
      res.json({ url: relativePath });
    } catch (e) { next(e); }
  };
}
