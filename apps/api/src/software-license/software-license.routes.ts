import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { SoftwareLicenseRepository } from "./software-license.repo";
import { SoftwareLicenseService } from "./software-license.service";
import { SoftwareLicenseController } from "./software-license.controller";

const router = Router();
const repo = new SoftwareLicenseRepository(getPrisma());
const service = new SoftwareLicenseService(repo);
const ctrl = new SoftwareLicenseController(service);

router.get("/", auth, ctrl.list);
router.post("/", auth, ctrl.create);
router.get("/:id", auth, ctrl.get);
router.patch("/:id", auth, ctrl.update);
router.post("/:id/assign", auth, ctrl.assign);
router.delete("/:id/assign/:userId", auth, ctrl.revoke);

export default router;
