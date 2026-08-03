import { Router } from "express";
import passport from "passport";
import { getPrisma } from "../lib/prisma";
import { HrReportRepository } from "./hr-report.repo";
import { HrReportService } from "./hr-report.service";
import { HrReportController } from "./hr-report.controller";
import { AppError } from "../lib/appError";

const router = Router();
const repo = new HrReportRepository(getPrisma());
const service = new HrReportService(repo);
const controller = new HrReportController(service);

const auth = passport.authenticate("accessToken", { session: false });

const requireHR = (req: any, res: any, next: any) => {
  const { role, frontOfficeRole } = req.user as any;
  if (role === "ADMIN") return next();
  if (
    role === "FRONT_OFFICE" &&
    (frontOfficeRole === "GM" || frontOfficeRole === "TD" || frontOfficeRole === "HR_MANAGER")
  )
    return next();
  next(new AppError(403, "FORBIDDEN"));
};

router.get("/monthly", auth, requireHR, controller.getMonthly);
router.get("/annual", auth, requireHR, controller.getAnnual);
router.get("/hiring-priority", auth, requireHR, controller.getHiringPriorityQueue);

export default router;
