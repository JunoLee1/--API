import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { ProspectController } from "./prospect.controller";
import { ProspectService } from "./prospect.service";
import { ProspectRepository } from "./prospect.repo";
import { VideoAnalysisController } from "./video-analysis.controller";
import { VideoAnalysisService } from "./video-analysis.service";
import { getPrisma } from "../lib/prisma";
import { Request, Response, NextFunction } from "express";


const router = Router();
const repo = new ProspectRepository(getPrisma());
const service = new ProspectService(repo);
const controller = new ProspectController(service);
const videoAnalysisService = new VideoAnalysisService(getPrisma());
const videoAnalysisController = new VideoAnalysisController(videoAnalysisService);

router.get("/check-duplicate", auth, controller.checkDuplicate);
router.get("/shortlist-capacity", auth, controller.getShortlistCapacity);
router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.getById);
router.patch("/:id/status", auth, controller.updateStatus);
router.post("/:id/sign", auth, controller.sign);
router.patch("/:id/medical", auth, controller.recordMedicalResult);
router.get("/:id/negotiation-logs", auth, controller.getNegotiationLogs);
router.post("/:id/negotiation-logs", auth, controller.addNegotiationLog);
router.get("/:id/video-evaluations", auth, controller.getVideoEvaluations);
router.post("/:id/video-evaluations", auth, controller.addVideoEvaluation);
router.patch("/:id/video-evaluations/:evalId", auth, controller.updateVideoEvaluation);
router.post("/:prospectId/video-analysis", auth, videoAnalysisController.createJob);
router.get("/:prospectId/video-analysis/:jobId", auth, videoAnalysisController.getJob);
router.get("/:id/evaluation-logs", auth, controller.getEvaluationLogs);
router.post("/:id/evaluation-logs", auth, controller.addEvaluationLog);
router.get("/:id/acquisition-gate-check", auth, controller.checkAcquisitionGate);
router.patch("/:id", auth, controller.update);

export default router;
