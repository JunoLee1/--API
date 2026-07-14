import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { MedicalExpenseService } from "./medical-expense.service";

function isMedical(req: Request) {
  return req.user?.role === "COACHING_STAFF" && req.user?.coachingRole === "MEDICAL";
}

function isMedicalDirector(req: Request) {
  return req.user?.role === "COACHING_STAFF" && req.user?.coachingRole === "MEDICAL_DIRECTOR";
}

function isAdmin(req: Request) {
  return req.user?.role === "ADMIN";
}

export class MedicalExpenseController {
  constructor(private service: MedicalExpenseService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(req.user!.id, req.user!.role, req.user!.coachingRole ?? null));
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expense = await this.service.get(Number(req.params["id"]));
      const canAccess =
        isAdmin(req) ||
        isMedicalDirector(req) ||
        expense.submittedById === req.user!.id;
      if (!canAccess) throw new AppError(403, "FORBIDDEN");
      res.json(expense);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isMedical(req)) throw new AppError(403, "FORBIDDEN");
      const { receiptDate, costCategory, totalAmount, payerType, injuryId, description } = req.body;
      const file = req.file;
      res.status(201).json(
        await this.service.create({
          submittedById: req.user!.id,
          receiptDate: new Date(receiptDate),
          costCategory,
          totalAmount: Number(totalAmount),
          payerType,
          ...(injuryId && { injuryId: Number(injuryId) }),
          ...(description && { description }),
          ...(file && { fileUrl: `/uploads/medical-expenses/${file.filename}`, fileName: file.originalname }),
        }),
      );
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { receiptDate, costCategory, totalAmount, payerType, injuryId, description } = req.body;
      const file = req.file;
      res.json(
        await this.service.update(Number(req.params["id"]), req.user!.id, {
          ...(receiptDate !== undefined && { receiptDate: new Date(receiptDate) }),
          ...(costCategory !== undefined && { costCategory }),
          ...(totalAmount !== undefined && { totalAmount: Number(totalAmount) }),
          ...(payerType !== undefined && { payerType }),
          ...(injuryId !== undefined && { injuryId: injuryId ? Number(injuryId) : null }),
          ...(description !== undefined && { description }),
          ...(file && { fileUrl: `/uploads/medical-expenses/${file.filename}`, fileName: file.originalname }),
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

  leaderApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isMedicalDirector(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.leaderApprove(Number(req.params["id"]), req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  leaderReject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isMedicalDirector(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.leaderReject(Number(req.params["id"]), req.user!.id, req.body.reason));
    } catch (err) {
      next(err);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isAdmin(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.approve(Number(req.params["id"]), req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isAdmin(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.reject(Number(req.params["id"]), req.user!.id, req.body.reason));
    } catch (err) {
      next(err);
    }
  };
}
