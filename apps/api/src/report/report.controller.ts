import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike, canReadHR, canReadFinance } from "../lib/permissions";
import { requireUser } from "../lib/authMiddleware";
import { ReportService } from "./report.service";

function isGM(req: Request): boolean {
  return req.user?.role === "GM";
}

function isHeadCoach(req: Request): boolean {
  return req.user?.role === "COACHING_STAFF" && req.user?.coachingRole === "HEAD_COACH";
}

function isAssetManager(req: Request): boolean {
  return req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "ASSET_MANAGER";
}

function isAssetStaff(req: Request): boolean {
  return req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "ASSET_STAFF";
}

const AUTHOR_ROLES = ["ADMIN", "COACHING_STAFF", "FRONT_OFFICE"] as const;

export class ReportController {
  constructor(private service: ReportService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, status } = req.query as { type?: string; status?: string };
      const filters: { type?: string; status?: string } = {};
      if (type !== undefined) filters.type = type;
      if (status !== undefined) filters.status = status;
      const { id: userId, departmentCategories = [] } = requireUser(req);
      res.json(await this.service.list(userId, isGM(req), isHeadCoach(req), filters, departmentCategories));
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await this.service.get(Number(req.params["id"]));
      const { role, frontOfficeRole: foRole, id: userId, departmentCategories = [] } = requireUser(req);
      const canView =
        isGM(req) ||
        isHeadCoach(req) ||
        report.authorId === userId ||
        (canReadHR(role, foRole, departmentCategories) && report.type === "HR") ||
        (canReadFinance(role, foRole, departmentCategories) && report.type === "FINANCIAL") ||
        (isAssetManager(req) && report.type === "ASSET") ||
        (isAssetStaff(req) && report.type === "ASSET") ||
        report.reviews.some((r) => r.reviewerDept && departmentCategories.includes(r.reviewerDept.category ?? ""));
      if (!canView) throw new AppError(403, "FORBIDDEN");
      res.json(report);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole: foRole, id: userId, departmentCategories = [] } = requireUser(req);
      if (!(AUTHOR_ROLES as readonly string[]).includes(role)) throw new AppError(403, "FORBIDDEN");
      const { type, title, content, departmentId } = req.body;
      if (type === "HR" && !canReadHR(role, foRole, departmentCategories)) throw new AppError(403, "FORBIDDEN");
      if (type === "FINANCIAL" && !canReadFinance(role, foRole, departmentCategories)) throw new AppError(403, "FORBIDDEN");
      if (type === "ASSET" && !(isAdminLike(role) || foRole === "ASSET_MANAGER" || foRole === "ASSET_STAFF")) throw new AppError(403, "FORBIDDEN");
      const file = req.file;
      res.status(201).json(
        await this.service.create({
          authorId: userId,
          type,
          title,
          content,
          ...(departmentId && { departmentId: Number(departmentId) }),
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
        await this.service.update(Number(req.params["id"]), requireUser(req).id, {
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
      res.json(await this.service.submit(Number(req.params["id"]), requireUser(req).id));
    } catch (err) {
      next(err);
    }
  };

  confirmReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = requireUser(req);
      const reportId = Number(req.params["id"]);
      const reviewerDeptId = Number(req.params["deptId"]);
      const { comment } = req.body;
      res.json(await this.service.confirmReview(reportId, reviewerDeptId, userId, comment));
    } catch (err) {
      next(err);
    }
  };

  rejectReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = requireUser(req);
      const reportId = Number(req.params["id"]);
      const reviewerDeptId = Number(req.params["deptId"]);
      const { reason } = req.body;
      res.json(await this.service.rejectReview(reportId, reviewerDeptId, userId, reason));
    } catch (err) {
      next(err);
    }
  };

  listRuleSets = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.listRuleSets());
    } catch (err) {
      next(err);
    }
  };

  createRuleSet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reportType, reviewerCategory } = req.body;
      res.status(201).json(await this.service.createRuleSet(reportType, reviewerCategory));
    } catch (err) {
      next(err);
    }
  };

  deleteRuleSet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.deleteRuleSet(Number(req.params["ruleId"]));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };
}
