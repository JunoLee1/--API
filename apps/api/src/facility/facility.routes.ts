import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";
import { NotificationService } from "../notification/notification.service";
import { ledgerService } from "../ledger/ledger.routes";
import { InspectionRepository } from "./inspection/inspection.repo";
import { InspectionService } from "./inspection/inspection.service";
import { InspectionController } from "./inspection/inspection.controller";
import { MaintenanceRepository } from "./maintenance/maintenance.repo";
import { MaintenanceService } from "./maintenance/maintenance.service";
import { MaintenanceController } from "./maintenance/maintenance.controller";

const router = Router();

const notificationService = new NotificationService(new NotificationRepository(getPrisma()));
const maintenanceRepo = new MaintenanceRepository(getPrisma());
const maintenanceService = new MaintenanceService(maintenanceRepo, notificationService, ledgerService);
const maintenanceController = new MaintenanceController(maintenanceService);

const inspectionRepo = new InspectionRepository(getPrisma());
const inspectionService = new InspectionService(inspectionRepo, maintenanceService);
const inspectionController = new InspectionController(inspectionService);

router.get("/inspections", auth, inspectionController.list);
router.post("/inspections", auth, inspectionController.create);
router.get("/inspections/:id", auth, inspectionController.get);
router.patch("/inspections/:id", auth, inspectionController.update);

router.get("/maintenance", auth, maintenanceController.list);
router.post("/maintenance", auth, maintenanceController.create);
router.get("/maintenance/:id", auth, maintenanceController.get);
router.patch("/maintenance/:id", auth, maintenanceController.update);
router.patch("/maintenance/:id/status", auth, maintenanceController.updateStatus);
router.post("/maintenance/:id/approve", auth, maintenanceController.approve);
router.post("/maintenance/:id/gm-approve", auth, maintenanceController.gmApprove);
router.post("/maintenance/:id/reject", auth, maintenanceController.reject);
router.post("/maintenance/:id/lock", auth, async (req, res, next) => {
  try {
    res.json(await maintenanceService.lock(Number(req.params.id)));
  } catch (e) { next(e); }
});
router.post("/maintenance/:id/submit-finance", auth, async (req, res, next) => {
  try {
    res.json(await maintenanceService.submitToFinance(Number(req.params.id), req.user!.id));
  } catch (e) { next(e); }
});

export default router;
