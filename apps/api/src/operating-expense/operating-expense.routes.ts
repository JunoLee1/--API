import { auth } from "../lib/authMiddleware";
import { Router, Request, Response, NextFunction } from "express";
import { OperatingExpenseController } from "./operating-expense.controller";
import { OperatingExpenseService } from "./operating-expense.service";
import { OperatingExpenseRepository } from "./operating-expense.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";
import { canWriteFinance } from "../lib/permissions";
import { AppError } from "../lib/appError";

const router = Router();
const repo = new OperatingExpenseRepository(getPrisma());
const notifRepo = new NotificationRepository(getPrisma());
const service = new OperatingExpenseService(repo, notifRepo);
const controller = new OperatingExpenseController(service);

const checkWriteFinance = (req: Request, res: Response, next: NextFunction) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canWriteFinance(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
};

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);

router.patch("/:id/first-approve", auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params["id"]);
    const { role, frontOfficeRole, id: userId } = req.user!;
    const result = await service.firstApprove(id, userId, role, frontOfficeRole);
    res.json(result);
  } catch (err) { next(err); }
});

router.patch("/:id/approve", auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params["id"]);
    const { role, frontOfficeRole, id: userId } = req.user!;
    const result = await service.approve(id, userId, role, frontOfficeRole);
    res.json(result);
  } catch (err) { next(err); }
});

router.patch("/:id/reject", auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params["id"]);
    const { role, frontOfficeRole, id: userId } = req.user!;
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) throw new AppError(400, "REASON_REQUIRED");
    const result = await service.reject(id, userId, reason.trim(), role, frontOfficeRole);
    res.json(result);
  } catch (err) { next(err); }
});

router.patch("/:id/cancel", auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params["id"]);
    const { role, frontOfficeRole, id: userId } = req.user!;
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) throw new AppError(400, "REASON_REQUIRED");
    const result = await service.cancel(id, userId, reason.trim(), role, frontOfficeRole);
    res.json(result);
  } catch (err) { next(err); }
});

router.patch("/:id/pay", auth, checkWriteFinance, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params["id"]);
    const result = await service.markPaid(id, req.user!.id);
    res.json(result);
  } catch (err) { next(err); }
});
router.patch("/:id", auth, controller.update);
router.delete("/:id", auth, checkWriteFinance, controller.delete);

export default router;
