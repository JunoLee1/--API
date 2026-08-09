import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { SquadPlanRepository } from "./squad-plan.repo";
import { SquadPlanService } from "./squad-plan.service";
import { SquadPlanController } from "./squad-plan.controller";

const router = Router();
const repo = new SquadPlanRepository(getPrisma());
const service = new SquadPlanService(repo);
const controller = new SquadPlanController(service);

router.get("/", auth, controller.get);
router.put("/", auth, controller.save);

export default router;
