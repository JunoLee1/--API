import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { DepartmentRepository } from "./department.repo";
import { DepartmentService } from "./department.service";
import { DepartmentController } from "./department.controller";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new DepartmentRepository(getPrisma());
const service = new DepartmentService(repo);
const controller = new DepartmentController(service);

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.get);
router.patch("/:id", auth, controller.update);
router.delete("/:id", auth, controller.delete);

export default router;
