import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { SalesRepository } from "./sales.repo";
import { SalesService } from "./sales.service";
import { SalesController } from "./sales.controller";

const router = Router();
const repo = new SalesRepository(getPrisma());
const service = new SalesService(repo, getPrisma());
const ctrl = new SalesController(service);

router.get("/summary",              auth, ctrl.summary);
router.get("/ticket-summary",       auth, ctrl.ticketSummary);
router.get("/ticket-season-total",  auth, ctrl.seasonTicketTotal);
router.get("/by-match/:matchId",    auth, ctrl.byMatch);
router.get("/",                     auth, ctrl.list);
router.post("/",                    auth, ctrl.create);
router.delete("/:id",               auth, ctrl.delete);

export default router;
