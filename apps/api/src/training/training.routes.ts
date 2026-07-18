import { Router } from "express";
import passport from "passport";
import { TrainingController } from "./training.controller";
import { TrainingService } from "./training.service";
import { TrainingRepository } from "./training.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new TrainingRepository(getPrisma());
const notifRepo = new NotificationRepository(getPrisma());
const service = new TrainingService(repo, notifRepo);
const controller = new TrainingController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.getSessions);
router.get("/:id", auth, controller.getSessionById);
router.post("/", auth, controller.createSession);
router.patch("/:id/approve", auth, controller.approveSession);
router.post("/:id/contents", auth, controller.addContent);
router.post("/:id/participants", auth, controller.addParticipants);
router.put("/:id/results", auth, controller.upsertResult);

export default router;
