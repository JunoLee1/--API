import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { LedgerRepository } from "./ledger.repo";
import { LedgerService } from "./ledger.service";
import { LedgerController } from "./ledger.controller";

const router = Router();
const repo = new LedgerRepository(getPrisma());
export const ledgerService = new LedgerService(repo);
const ctrl = new LedgerController(ledgerService);

router.get("/", auth, ctrl.list);
router.post("/", auth, ctrl.create);
router.get("/:id", auth, ctrl.get);
router.post("/:id/refund", auth, ctrl.refund);

export default router;
