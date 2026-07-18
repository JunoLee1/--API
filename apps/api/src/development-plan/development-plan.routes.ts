import { Router } from "express";
import passport from "passport";
import { DevelopmentPlanController } from "./development-plan.controller";
import { DevelopmentPlanService } from "./development-plan.service";
import { DevelopmentPlanRepository } from "./development-plan.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new DevelopmentPlanRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const service = new DevelopmentPlanService(repo, notifRepo);
const controller = new DevelopmentPlanController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.getAll);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.put("/:id", auth, controller.update);
router.patch("/:id/activate", auth, controller.activate);
router.patch("/:id/review", auth, controller.review);

export default router;
