import { Router } from "express";
import passport from "passport";
import { PartnerController } from "./partner.controller";
import { PartnerService } from "./partner.service";
import { PartnerRepository } from "./partner.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new PartnerRepository(getPrisma());
const service = new PartnerService(repo);
const controller = new PartnerController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.getById);
router.patch("/:id", auth, controller.update);
router.post("/:id/contracts", auth, controller.createContract);
router.patch("/:id/contracts/:contractId", auth, controller.updateContract);

export default router;
