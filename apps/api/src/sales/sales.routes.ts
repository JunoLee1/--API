import { Router, Request, Response, NextFunction } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { SalesRepository } from "./sales.repo";
import { SalesService } from "./sales.service";
import { SalesController } from "./sales.controller";
import { FanController } from "./fan/fan.controller";
import { canReadFinance, canWriteFinance } from "../lib/permissions";
import { AppError } from "../lib/appError";

const router = Router();
const repo = new SalesRepository(getPrisma());
const service = new SalesService(repo, getPrisma());
const ctrl = new SalesController(service);
const fanCtrl = new FanController();

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
router.get("/ticket-summary",       auth, ctrl.ticketSummary);
router.get("/ticket-season-total",  auth, ctrl.seasonTicketTotal);
router.get("/search",               auth, checkReadFinance, ctrl.search);
router.get("/by-match/:matchId",    auth, checkReadFinance, ctrl.byMatch);
router.get("/",                     auth, checkReadFinance, ctrl.list);
router.post("/batch",               auth, checkWriteFinance, ctrl.createBatch);
router.post("/",                    auth, checkWriteFinance, ctrl.create);
router.delete("/:id",               auth, checkWriteFinance, ctrl.delete);

router.get("/fans/membership-stats", auth, fanCtrl.membershipStats);
router.get("/fans/:id",              auth, fanCtrl.getById);
router.get("/fans",                  auth, fanCtrl.list);
router.post("/fans",                 auth, fanCtrl.create);
router.post("/fans/:id/memberships", auth, fanCtrl.createMembership);
router.get("/seat-zones/:matchId",   auth, fanCtrl.getSeatZones);
router.post("/seat-zones",           auth, fanCtrl.createSeatZone);

export default router;
