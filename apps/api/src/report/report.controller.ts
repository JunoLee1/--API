import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { ReportService } from "./report.service";

function isGM(req: Request): boolean {
  return req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "GM";
}

const AUTHOR_ROLES = ["ADMIN", "COACHING_STAFF", "FRONT_OFFICE"] as const;

export class ReportController {
  constructor(private service: ReportService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(req.user!.id, isGM(req)));
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await this.service.get(Number(req.params["id"]));
      if (!isGM(req) && report.authorId !== req.user!.id) throw new AppError(403, "FORBIDDEN");
      res.json(report);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role;
      if (!AUTHOR_ROLES.includes(role as any)) throw new AppError(403, "FORBIDDEN");
      const { type, title, content } = req.body;
      const file = req.file;
      res.status(201).json(
        await this.service.create({
          authorId: req.user!.id,
          type,
          title,
          content,
          ...(file && { fileUrl: `/uploads/reports/${file.filename}`, fileName: file.originalname }),
        }),
      );
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, content } = req.body;
      const file = req.file;
      res.json(
        await this.service.update(Number(req.params["id"]), req.user!.id, {
          ...(title !== undefined && { title }),
          ...(content !== undefined && { content }),
          ...(file && { fileUrl: `/uploads/reports/${file.filename}`, fileName: file.originalname }),
        }),
      );
    } catch (err) {
      next(err);
    }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.submit(Number(req.params["id"]), req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isGM(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.approve(Number(req.params["id"]), req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isGM(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.reject(Number(req.params["id"]), req.user!.id, req.body.reason));
    } catch (err) {
      next(err);
    }
  };
}
