import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { CoachingStaffRepository } from "./coaching-staff.repo";
import { CoachingStaffService } from "./coaching-staff.service";
import { CoachingStaffController } from "./coaching-staff.controller";
import { CoachingStaffEvalRepository } from "./coaching-staff-eval.repo";
import { getPrisma } from "../lib/prisma";

const repo = new CoachingStaffRepository(getPrisma());
const service = new CoachingStaffService(repo);
const evalRepo = new CoachingStaffEvalRepository(getPrisma());
const controller = new CoachingStaffController(service, evalRepo);

const router = Router();

router.get("/", auth, controller.list);
router.get("/:staffUserId/evaluations", auth, controller.listEvaluations);
router.post("/:staffUserId/evaluations", auth, controller.createEvaluation);

export default router;
