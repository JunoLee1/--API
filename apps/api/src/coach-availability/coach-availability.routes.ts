import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { CoachAvailabilityController } from "./coach-availability.controller";
import { CoachAvailabilityService } from "./coach-availability.service";
import { CoachAvailabilityRepository } from "./coach-availability.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new CoachAvailabilityRepository(getPrisma());
const service = new CoachAvailabilityService(repo);
const controller = new CoachAvailabilityController(service);

router.get("/", auth, controller.getAll);
router.get("/conflicts", auth, controller.getConflicts);
router.post("/", auth, controller.create);
router.delete("/:id", auth, controller.delete);

export default router;
