import { auth } from "../lib/authMiddleware";
import { Router, Request, Response, NextFunction } from "express";
import { OperatingExpenseController } from "./operating-expense.controller";
import { OperatingExpenseService } from "./operating-expense.service";
import { OperatingExpenseRepository } from "./operating-expense.repo";
import { getPrisma } from "../lib/prisma";
import { canWriteFinance } from "../lib/permissions";
import { AppError } from "../lib/appError";

const router = Router();
const repo = new OperatingExpenseRepository(getPrisma());
const service = new OperatingExpenseService(repo);
const controller = new OperatingExpenseController(service);

const checkWriteFinance = (req: Request, res: Response, next: NextFunction) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canWriteFinance(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
};

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.delete("/:id", auth, checkWriteFinance, controller.delete);

export default router;
