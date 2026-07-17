import { Router } from "express";
import passport from "passport";
import { InjuryController } from "./injury.controller";
import { InjuryService } from "./injury.service";
import { InjuryRepository } from "./injury.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new InjuryRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const service = new InjuryService(repo, notifRepo);
const controller = new InjuryController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/stats", auth, controller.getStats);
router.get("/player/:playerId", auth, controller.getByPlayer);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id/status", auth, controller.updateStatus);
router.get("/:id/report", auth, controller.getReport);
router.put("/:id/report", auth, controller.saveReport);
router.post("/:id/report/sign", auth, controller.signReport);
router.delete("/:id/report/sign", auth, controller.unsignReport);

// Assessment
router.get("/:id/assessment", auth, controller.getAssessment);
router.put("/:id/assessment", auth, controller.processAssessment);

// External Reports
router.get("/:id/external-reports", auth, controller.getExternalReports);
router.patch("/:id/external-reports/:reportId/status", auth, controller.updateExternalReportStatus);

export default router;
