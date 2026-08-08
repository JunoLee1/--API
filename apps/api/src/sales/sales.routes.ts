import { Router, Request, Response, NextFunction } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { SalesRepository } from "./sales.repo";
import { SalesService } from "./sales.service";
import { SalesController } from "./sales.controller";
import { canReadFinance, canWriteFinance } from "../lib/permissions";
import { AppError } from "../lib/appError";

const router = Router();
const repo = new SalesRepository(getPrisma());
const service = new SalesService(repo, getPrisma());
const ctrl = new SalesController(service);

const checkReadFinance = (req: Request, res: Response, next: NextFunction) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canReadFinance(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
};

const checkWriteFinance = (req: Request, res: Response, next: NextFunction) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canWriteFinance(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
};

router.get("/summary",              auth, checkReadFinance, ctrl.summary);
router.get("/ticket-summary",       auth, checkReadFinance, ctrl.ticketSummary);
router.get("/ticket-season-total",  auth, checkReadFinance, ctrl.seasonTicketTotal);
router.get("/by-match/:matchId",    auth, checkReadFinance, ctrl.byMatch);
router.get("/",                     auth, checkReadFinance, ctrl.list);
router.post("/",                    auth, checkWriteFinance, ctrl.create);
router.delete("/:id",               auth, checkWriteFinance, ctrl.delete);

export default router;
