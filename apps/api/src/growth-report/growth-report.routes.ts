import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { GrowthReportController } from "./growth-report.controller";
import { GrowthReportService } from "./growth-report.service";
import { GrowthReportRepository } from "./growth-report.repo";
import { DevelopmentPlanRepository } from "../development-plan/development-plan.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new GrowthReportRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const planRepo = new DevelopmentPlanRepository(prisma);
const service = new GrowthReportService(repo, notifRepo, planRepo);
const controller = new GrowthReportController(service);


router.get("/player/:playerId", auth, controller.getEvaluationsByPlayer);
router.get("/:id", auth, controller.getEvaluationById);
router.post("/", auth, controller.createEvaluation);
router.patch("/:id", auth, controller.updateEvaluation);
router.patch("/:id/publish", auth, controller.publishEvaluation);

router.get("/badges/player/:playerId", auth, controller.getBadgesByPlayer);
router.post("/badges", auth, controller.awardBadge);

export default router;
