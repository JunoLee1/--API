import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { hiringDocumentService } from "../hiring-document/hiring-document.routes";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";
import { HiringDispatchController } from "./hiring-dispatch.controller";
import { HiringDispatchRepository } from "./hiring-dispatch.repo";
import { HiringDispatchService } from "./hiring-dispatch.service";

const router = Router();
const prisma = getPrisma();
const repo = new HiringDispatchRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
// hiringDocumentService is the shared singleton (see hiring-document.routes.ts);
// injected here so EXECUTION `dispatch()` can call the required-docs gate.
const service = new HiringDispatchService(repo, notifRepo, prisma, hiringDocumentService);
const controller = new HiringDispatchController(service);

router.get("/", auth, controller.list);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id/budget-reverify", auth, controller.budgetReverify);
router.patch("/:id/budget-reject", auth, controller.budgetReject);
router.patch("/:id/dispatch-approve", auth, controller.dispatchApprove);
router.patch("/:id/dispatch-reject", auth, controller.dispatchReject);
router.patch("/:id/dispatch", auth, controller.dispatch);
router.patch("/:id/cancel", auth, controller.cancel);
router.patch("/:id/complete", auth, controller.complete);

export default router;
