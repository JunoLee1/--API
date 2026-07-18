import { Router } from "express";
import passport from "passport";
import { VideoController } from "./video.controller";
import { VideoService } from "./video.service";
import { VideoRepository } from "./video.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new VideoRepository(getPrisma());
const notifRepo = new NotificationRepository(getPrisma());
const service = new VideoService(repo, notifRepo);
const controller = new VideoController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.getVideos);
router.get("/my-assignments", auth, controller.getMyAssignments);
router.get("/:id", auth, controller.getVideoById);
router.post("/", auth, controller.createVideo);
router.delete("/:id", auth, controller.deleteVideo);
router.post("/:id/assignments", auth, controller.createAssignment);
router.patch("/:id/assignments/:playerId/progress", auth, controller.updateProgress);

export default router;
