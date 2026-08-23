import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { ExpenseCategoryRepository } from "./expense-category.repo";
import { ExpenseCategoryService } from "./expense-category.service";
import { ExpenseCategoryController } from "./expense-category.controller";

// Shared singleton — other modules import { expenseCategoryService } for DI.
export const expenseCategoryRepo = new ExpenseCategoryRepository(getPrisma());
export const expenseCategoryService = new ExpenseCategoryService(expenseCategoryRepo);

const controller = new ExpenseCategoryController(expenseCategoryService);
const router = Router();

router.get("/", auth, controller.list);

export default router;
