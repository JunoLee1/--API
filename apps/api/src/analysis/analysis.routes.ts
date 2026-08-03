import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";
import { AnalysisRepository } from "./analysis.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new AnalysisRepository(getPrisma());
const service = new AnalysisService(repo);
const controller = new AnalysisController(service);


router.get("/rankings", auth, controller.getRankings);

export default router;
