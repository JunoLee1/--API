import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { ProspectController } from "./prospect.controller";
import { ProspectService } from "./prospect.service";
import { ProspectRepository } from "./prospect.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new ProspectRepository(getPrisma());
const service = new ProspectService(repo);
const controller = new ProspectController(service);


router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.getById);
router.patch("/:id/status", auth, controller.updateStatus);
router.post("/:id/sign", auth, controller.sign);
router.patch("/:id", auth, controller.update);

export default router;
