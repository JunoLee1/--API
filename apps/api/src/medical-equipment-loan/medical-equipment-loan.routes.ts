import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import * as controller from "./medical-equipment-loan.controller";

const router = Router();

router.get("/", auth, controller.listLoans);
router.post("/request", auth, controller.requestNormal);
router.post("/emergency", auth, controller.requestEmergency);
router.get("/:id", auth, controller.getById);
router.post("/:id/approve", auth, controller.approve);
router.post("/:id/reject", auth, controller.reject);

export default router;
