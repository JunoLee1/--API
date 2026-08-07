import { Router } from "express";
import { TransferRequestController } from "./transfer-request.controller";
import { TransferRequestService } from "./transfer-request.service";
import { TransferRequestRepository } from "./transfer-request.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new TransferRequestRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const service = new TransferRequestService(repo, notifRepo);
const controller = new TransferRequestController(service);

router.get("/", auth, controller.list);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id", auth, controller.update);
router.patch("/:id/submit", auth, controller.submit);
router.patch("/:id/review", auth, controller.review);
router.patch("/:id/confirm", auth, controller.confirm);
router.delete("/:id", auth, controller.remove);

export default router;
