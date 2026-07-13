import { Router } from "express";
import passport from "passport";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { NotificationRepository } from "./notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new NotificationRepository(getPrisma());
const service = new NotificationService(repo);
const controller = new NotificationController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/my", auth, controller.getMy);
router.patch("/:id/read", auth, controller.markRead);

export default router;
