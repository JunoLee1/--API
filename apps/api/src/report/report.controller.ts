import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { ReportService } from "./report.service";

function isGM(req: Request): boolean {
  return req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "GM";
}

function isHeadCoach(req: Request): boolean {
  return req.user?.role === "COACHING_STAFF" && req.user?.coachingRole === "HEAD_COACH";
}

function isHrManager(req: Request): boolean {
  return req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "HR_MANAGER";
}

function isFinanceManager(req: Request): boolean {
  return req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "FINANCE_MANAGER";
}

function isAssetManager(req: Request): boolean {
  return req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "ASSET_MANAGER";
}

function isHrStaff(req: Request): boolean {
  return req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "HR_STAFF";
}

function isAssetStaff(req: Request): boolean {
  return req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "ASSET_STAFF";
}

function isFinanceStaff(req: Request): boolean {
  return req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "FINANCE_STAFF";
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
      res.json(
        await this.service.list(
          req.user!.id,
          isGM(req),
          isHeadCoach(req),
          filters,
          isHrManager(req),
          isFinanceManager(req),
          isAssetManager(req),
          isHrStaff(req),
          isAssetStaff(req),
          isFinanceStaff(req),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await this.service.get(Number(req.params["id"]));
      const canView =
        isGM(req) ||
        isHeadCoach(req) ||
        report.authorId === req.user!.id ||
        (isHrManager(req) && report.type === "HR") ||
        (isHrStaff(req) && report.type === "HR") ||
        (isFinanceManager(req) && report.type === "FINANCIAL") ||
        (isFinanceStaff(req) && report.type === "FINANCIAL") ||
        (isAssetManager(req) && report.type === "ASSET") ||
        (isAssetStaff(req) && report.type === "ASSET");
      if (!canView) throw new AppError(403, "FORBIDDEN");
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
      const foRole = req.user!.frontOfficeRole;
      if (type === "HR" && !(isAdminLike(role) || foRole === "HR_MANAGER" || foRole === "HR_STAFF")) {
        throw new AppError(403, "FORBIDDEN");
      }
      if (type === "FINANCIAL" && !(isAdminLike(role) || foRole === "FINANCE_MANAGER" || foRole === "FINANCE_STAFF" || foRole === "GM")) {
        throw new AppError(403, "FORBIDDEN");
      }
      if (type === "ASSET" && !(isAdminLike(role) || foRole === "ASSET_MANAGER" || foRole === "ASSET_STAFF")) {
        throw new AppError(403, "FORBIDDEN");
      }
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
      const report = await this.service.get(Number(req.params["id"]));

      const canApprove = (() => {
        switch (report.type) {
          case "HR":
            if (report.status === "SUBMITTED") return isHrManager(req);
            if (report.status === "FIRST_APPROVED") return isAssetManager(req);
            if (report.status === "SECOND_APPROVED") return isGM(req);
            return false;
          case "ASSET":
            if (report.status === "SUBMITTED") return isAssetManager(req);
            if (report.status === "FIRST_APPROVED") return isGM(req);
            return false;
          case "FINANCIAL":
            if (report.status === "SUBMITTED") return isFinanceManager(req);
            if (report.status === "FIRST_APPROVED") return isGM(req);
            return false;
          case "TRAINING":
            return isHeadCoach(req) && report.status === "SUBMITTED";
          default:
            return isGM(req) && report.status === "SUBMITTED";
        }
      })();

      if (!canApprove) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.approve(Number(req.params["id"]), req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await this.service.get(Number(req.params["id"]));

      const canReject = (() => {
        switch (report.type) {
          case "HR":
            if (report.status === "SUBMITTED") return isHrManager(req);
            if (report.status === "FIRST_APPROVED") return isAssetManager(req);
            if (report.status === "SECOND_APPROVED") return isGM(req);
            return false;
          case "ASSET":
            if (report.status === "SUBMITTED") return isAssetManager(req);
            if (report.status === "FIRST_APPROVED") return isGM(req);
            return false;
          case "FINANCIAL":
            if (report.status === "SUBMITTED") return isFinanceManager(req);
            if (report.status === "FIRST_APPROVED") return isGM(req);
            return false;
          case "TRAINING":
            return isHeadCoach(req) && report.status === "SUBMITTED";
          default:
            return isGM(req) && report.status === "SUBMITTED";
        }
      })();

      if (!canReject) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.reject(Number(req.params["id"]), req.user!.id, req.body.reason));
    } catch (err) {
      next(err);
    }
  };
}
