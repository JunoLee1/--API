import { Router, Request, Response, NextFunction } from "express";
import { DepartmentPlanController } from "./department-plan.controller";
import { DepartmentPlanService } from "./department-plan.service";
import { DepartmentPlanRepository } from "./department-plan.repo";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { isAdminLike, canReadFinance } from "../lib/permissions";
import { AppError } from "../lib/appError";

const router = Router();
const prisma = getPrisma();
const repo = new DepartmentPlanRepository(prisma);
const service = new DepartmentPlanService(repo);
const controller = new DepartmentPlanController(service);

const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!isAdminLike(req.user!.role)) return next(new AppError(403, "FORBIDDEN"));
  next();
};

const requireFinanceRead = (req: Request, _res: Response, next: NextFunction) => {
  if (!canReadFinance(req.user!.role, req.user!.frontOfficeRole)) {
    return next(new AppError(403, "FORBIDDEN"));
  }
  next();
};

// budget-summary는 /department-plans/:id 보다 앞에 선언해야 함
router.get("/budget-summary", auth, requireFinanceRead, controller.budgetSummary);

router.get("/", auth, controller.list);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.put("/:id", auth, controller.update);
router.post("/:id/submit", auth, controller.submit);
router.post("/:id/approve", auth, requireAdmin, controller.approve);
router.post("/:id/reject", auth, requireAdmin, controller.reject);

export default router;
