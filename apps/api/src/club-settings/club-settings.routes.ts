import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { ClubSettingsRepository } from "./club-settings.repo";
import { ClubSettingsService } from "./club-settings.service";
import { ClubSettingsController } from "./club-settings.controller";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new ClubSettingsRepository(getPrisma());
const service = new ClubSettingsService(repo);
const controller = new ClubSettingsController(service);

router.get("/", auth, controller.get);
router.patch("/", auth, controller.update);

export default router;
