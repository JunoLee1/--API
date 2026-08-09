import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { TrainingLoadController } from "./training-load.controller";
import { TrainingLoadService } from "./training-load.service";
import { TrainingLoadRepository } from "./training-load.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new TrainingLoadRepository(getPrisma());
const notifRepo = new NotificationRepository(getPrisma());
const service = new TrainingLoadService(repo, notifRepo);
const controller = new TrainingLoadController(service);

router.get("/", auth, controller.getAll);
router.get("/weekly-summary", auth, controller.getWeeklySummary);
router.get("/anomalies", auth, controller.getAnomalies);
router.get("/injury-correlation/:playerId", auth, controller.getInjuryCorrelation);
router.get("/growth-trajectory/:playerId", auth, controller.getGrowthTrajectory);
router.get("/acute-chronic/:playerId", auth, controller.getAcuteChronicRatio);
router.post("/", auth, controller.upsert);

export default router;
