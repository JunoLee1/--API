import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { MealExpenseRepository } from "./meal-expense.repo";
import { MealExpenseService } from "./meal-expense.service";
import { MealExpenseController } from "./meal-expense.controller";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new MealExpenseRepository(getPrisma());
const service = new MealExpenseService(repo);
const controller = new MealExpenseController(service);

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.get);
router.patch("/:id", auth, controller.update);
router.delete("/:id", auth, controller.delete);

export default router;
