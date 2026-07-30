import { Router } from "express";
import passport from "passport";
import { StaffRecordRepository } from "./staff-record.repo";
import { StaffRecordService } from "./staff-record.service";
import { StaffRecordController } from "./staff-record.controller";
import { getPrisma } from "../lib/prisma";

const router = Router();
const auth = passport.authenticate("accessToken", { session: false });
const repo = new StaffRecordRepository(getPrisma());
const service = new StaffRecordService(repo);
const controller = new StaffRecordController(service);

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.get);
router.patch("/:id", auth, controller.update);
router.delete("/:id", auth, controller.delete);

export default router;
