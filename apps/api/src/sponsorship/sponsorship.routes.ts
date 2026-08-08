import { auth } from "../lib/authMiddleware";
import { Router, Request, Response, NextFunction } from "express";
import { getPrisma } from "../lib/prisma";
import { SponsorshipRepository } from "./sponsorship.repo";
import { SponsorshipService } from "./sponsorship.service";
import { SponsorshipController } from "./sponsorship.controller";
import { ledgerService } from "../ledger/ledger.routes";
import { canReadFinance, canWriteFinance } from "../lib/permissions";
import { AppError } from "../lib/appError";

const router = Router();

const repo = new SponsorshipRepository(getPrisma());
const service = new SponsorshipService(repo, ledgerService);
const controller = new SponsorshipController(service);

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

router.get("/",    auth, checkReadFinance, controller.list);
router.post("/",   auth, checkWriteFinance, controller.create);
router.get("/:id", auth, checkReadFinance, controller.get);
router.patch("/:id", auth, checkWriteFinance, controller.update);
router.get("/:id/payments", auth, checkReadFinance, controller.getPayments);
router.patch("/:id/payments/:paymentId", auth, checkWriteFinance, controller.markPaid);

export default router;
