import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { OperatingExpenseController } from "./operating-expense.controller";
import { OperatingExpenseService } from "./operating-expense.service";
import { OperatingExpenseRepository } from "./operating-expense.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new OperatingExpenseRepository(getPrisma());
const service = new OperatingExpenseService(repo);
const controller = new OperatingExpenseController(service);

router.get("/",      auth, controller.list);
router.post("/",     auth, controller.create);
router.delete("/:id", auth, controller.delete);

export default router;
