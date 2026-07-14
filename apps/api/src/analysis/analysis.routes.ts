import { Router } from "express";
import passport from "passport";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";
import { AnalysisRepository } from "./analysis.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new AnalysisRepository(getPrisma());
const service = new AnalysisService(repo);
const controller = new AnalysisController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/rankings", auth, controller.getRankings);

export default router;
