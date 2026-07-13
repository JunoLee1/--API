import { Router } from "express";
import passport from "passport";
import { EquipmentController } from "./equipment.controller";
import { EquipmentService } from "./equipment.service";
import { EquipmentRepository } from "./equipment.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const equipmentRepo = new EquipmentRepository(getPrisma());
const notificationRepo = new NotificationRepository(getPrisma());
const service = new EquipmentService(equipmentRepo, notificationRepo);
const controller = new EquipmentController(service);

const auth = passport.authenticate("accessToken", { session: false });

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
