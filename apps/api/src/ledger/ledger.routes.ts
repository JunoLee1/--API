import { Router, Request, Response, NextFunction } from "express";
import { auth } from "../lib/authMiddleware";
import { canReadFinance, canWriteFinance } from "../lib/permissions";
import { getPrisma } from "../lib/prisma";
import { LedgerRepository } from "./ledger.repo";
import { LedgerService } from "./ledger.service";
import { LedgerController } from "./ledger.controller";

const router = Router();
const repo = new LedgerRepository(getPrisma());
export const ledgerService = new LedgerService(repo);
const ctrl = new LedgerController(ledgerService);

const checkReadFinance = (req: Request, res: Response, next: NextFunction) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canReadFinance(role, frontOfficeRole)) return res.status(403).json({ code: "FORBIDDEN" });
  next();
};

const checkWriteFinance = (req: Request, res: Response, next: NextFunction) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canWriteFinance(role, frontOfficeRole)) return res.status(403).json({ code: "FORBIDDEN" });
  next();
};

router.get("/", auth, checkReadFinance, ctrl.list);
router.post("/", auth, checkWriteFinance, ctrl.create);
router.get("/:id", auth, checkReadFinance, ctrl.get);
router.post("/:id/refund", auth, checkWriteFinance, ctrl.refund);

export default router;
