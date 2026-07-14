import { Router } from "express";
import passport from "passport";
import { HospitalController } from "./hospital.controller";
import { HospitalService } from "./hospital.service";
import { HospitalRepository } from "./hospital.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new HospitalRepository(getPrisma());
const service = new HospitalService(repo);
const controller = new HospitalController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);

export default router;
