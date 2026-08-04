import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { ClubController } from "./club.controller";
import { ClubService } from "./club.service";
import { ClubRepository } from "./club.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new ClubRepository(getPrisma());
const service = new ClubService(repo);
const controller = new ClubController(service);

router.get("/", auth, controller.getAll);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id", auth, controller.update);

export default router;
