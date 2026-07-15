import { Router } from "express";
import passport from "passport";
import { InjuryController } from "./injury.controller";
import { InjuryService } from "./injury.service";
import { InjuryRepository } from "./injury.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new InjuryRepository(getPrisma());
const service = new InjuryService(repo);
const controller = new InjuryController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/stats", auth, controller.getStats);
router.get("/player/:playerId", auth, controller.getByPlayer);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id/status", auth, controller.updateStatus);
router.get("/:id/report", auth, controller.getReport);
router.put("/:id/report", auth, controller.saveReport);

export default router;
