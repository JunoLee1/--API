import { auth } from "../lib/authMiddleware";
import { Router, Request, Response, NextFunction } from "express";
import { ProspectController } from "./prospect.controller";
import { ProspectService } from "./prospect.service";
import { ProspectRepository } from "./prospect.repo";
import { getPrisma } from "../lib/prisma";
import { AppError } from "../lib/appError";

const router = Router();
const repo = new ProspectRepository(getPrisma());
const service = new ProspectService(repo);
const controller = new ProspectController(service);

const canSignProspect = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user!;
  const allowed =
    user.role === 'ADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'GM' ||
    (user.role === 'FRONT_OFFICE' &&
      (user.frontOfficeRole === 'TD' || user.frontOfficeRole === 'CONTRACT_MANAGER'));
  if (!allowed) return next(new AppError(403, 'FORBIDDEN'));
  next();
};

router.get("/check-duplicate", auth, controller.checkDuplicate);
router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.getById);
router.patch("/:id/status", auth, controller.updateStatus);
router.post("/:id/sign", auth, canSignProspect, controller.sign);
router.patch("/:id/medical", auth, controller.recordMedicalResult);
router.get("/:id/negotiation-logs", auth, controller.getNegotiationLogs);
router.post("/:id/negotiation-logs", auth, controller.addNegotiationLog);
router.get("/:id/video-evaluations", auth, controller.getVideoEvaluations);
router.post("/:id/video-evaluations", auth, controller.addVideoEvaluation);
router.get("/:id/evaluation-logs", auth, controller.getEvaluationLogs);
router.post("/:id/evaluation-logs", auth, controller.addEvaluationLog);
router.get("/:id/acquisition-gate-check", auth, controller.checkAcquisitionGate);
router.patch("/:id", auth, controller.update);

export default router;
