import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { EquipmentController } from "./equipment.controller";
import { EquipmentService } from "./equipment.service";
import { EquipmentRepository } from "./equipment.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";
import { ledgerService } from "../ledger/ledger.routes";

const router = Router();
const equipmentRepo = new EquipmentRepository(getPrisma());
const notificationRepo = new NotificationRepository(getPrisma());
const service = new EquipmentService(equipmentRepo, notificationRepo, ledgerService);
const controller = new EquipmentController(service);


// Loan routes (static paths first)
router.get("/loans", auth, controller.listLoans);
router.get("/loans/my", auth, controller.listMyLoans);
router.post("/loans", auth, controller.requestLoan);
router.post("/loans/:loanId/approve", auth, controller.approveLoan);
router.post("/loans/:loanId/reject", auth, controller.rejectLoan);
router.post("/loans/:loanId/issue", auth, controller.issueLoan);
router.post("/loans/:loanId/return", auth, controller.returnLoan);

// static paths first to avoid shadowing by /:id
router.post("/assignments", auth, controller.createAssignment);
router.patch("/assignments/:assignmentId/return", auth, controller.returnAssignment);
router.get("/assignments/player/:playerId", auth, controller.getUnreturnedByPlayer);
router.patch("/units/:unitId/status", auth, controller.transitionUnit);

router.get("/", auth, controller.listItems);
router.post("/", auth, controller.createItem);
router.get("/:id", auth, controller.getItem);
router.patch("/:id/quantity", auth, controller.adjustQuantity);
router.post("/:id/units", auth, controller.addUnit);

export default router;
