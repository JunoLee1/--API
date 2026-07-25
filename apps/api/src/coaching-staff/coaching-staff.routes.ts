import { Router } from "express";
import passport from "passport";
import { CoachingStaffRepository } from "./coaching-staff.repo";
import { CoachingStaffService } from "./coaching-staff.service";
import { CoachingStaffController } from "./coaching-staff.controller";
import { getPrisma } from "../lib/prisma";

const repo = new CoachingStaffRepository(getPrisma());
const service = new CoachingStaffService(repo);
const controller = new CoachingStaffController(service);
const auth = passport.authenticate("accessToken", { session: false });

const router = Router();

router.get("/", auth, controller.list);

export default router;
