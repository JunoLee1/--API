import { Router } from "express";
import passport from "passport";
import { getPrisma } from "../lib/prisma";
import { HiringAutomationRepository } from "./hiring-automation.repo";
import { HiringAutomationService } from "./hiring-automation.service";
import { HiringAutomationController } from "./hiring-automation.controller";
import { AppError } from "../lib/appError";

const router = Router();
const auth = passport.authenticate("accessToken", { session: false });
const repo = new HiringAutomationRepository(getPrisma());
const service = new HiringAutomationService(repo);
const controller = new HiringAutomationController(service);

const requireAdmin = (req: any, _res: any, next: any) => {
  if (req.user?.role === "ADMIN") return next();
  next(new AppError(403, "FORBIDDEN"));
};

const requireHRorGMorAdmin = (req: any, _res: any, next: any) => {
  const { role, frontOfficeRole } = req.user ?? {};
  if (role === "ADMIN") return next();
  if (role === "FRONT_OFFICE" && (frontOfficeRole === "GM" || frontOfficeRole === "HR_MANAGER"))
    return next();
  next(new AppError(403, "FORBIDDEN"));
};

const requireHRManager = (req: any, _res: any, next: any) => {
  const { role, frontOfficeRole } = req.user ?? {};
  if (role === "ADMIN") return next();
  if (role === "FRONT_OFFICE" && frontOfficeRole === "HR_MANAGER") return next();
  next(new AppError(403, "FORBIDDEN"));
};

router.get("/league-weights", auth, requireHRorGMorAdmin, controller.listLeagueWeights);
router.put("/league-weights/:leagueLevel/:category", auth, requireAdmin, controller.upsertLeagueWeight);

router.get("/ibi-configs", auth, requireHRorGMorAdmin, controller.listIbiConfigs);
router.post("/ibi-configs", auth, requireHRManager, controller.createIbiConfig);
router.patch("/ibi-configs/:id", auth, requireHRManager, controller.updateIbiConfig);
router.delete("/ibi-configs/:id", auth, requireHRManager, controller.deleteIbiConfig);

router.get("/compliance-checks/:seasonId", auth, requireHRorGMorAdmin, controller.getComplianceCheck);
router.put("/compliance-checks/:seasonId", auth, requireHRManager, controller.upsertComplianceCheck);

router.get("/compliance-deadlines", auth, requireHRorGMorAdmin, controller.listComplianceDeadlines);
router.post("/compliance-deadlines", auth, requireAdmin, controller.createComplianceDeadline);
router.patch("/compliance-deadlines/:id", auth, requireAdmin, controller.updateComplianceDeadline);
router.delete("/compliance-deadlines/:id", auth, requireAdmin, controller.deleteComplianceDeadline);

export default router;
