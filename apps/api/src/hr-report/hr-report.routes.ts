import { Router } from "express";
import passport from "passport";
import { getPrisma } from "../lib/prisma";
import { HrReportRepository } from "./hr-report.repo";
import { HrReportService } from "./hr-report.service";
import { HrReportController } from "./hr-report.controller";

const router = Router();
const repo = new HrReportRepository(getPrisma());
const service = new HrReportService(repo);
const controller = new HrReportController(service);

const auth = passport.authenticate("accessToken", { session: false });

const requireHR = (req: any, res: any, next: any) => {
  const { role } = req.user as any;
  if (role === "ADMIN" || role === "FRONT_OFFICE") return next();
  res.status(403).json({ message: "Forbidden" });
};

router.get("/monthly", auth, requireHR, controller.getMonthly);
router.get("/annual", auth, requireHR, controller.getAnnual);

export default router;
