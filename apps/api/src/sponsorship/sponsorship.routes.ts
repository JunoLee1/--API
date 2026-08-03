import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { getPrisma } from "../lib/prisma";
import { SponsorshipRepository } from "./sponsorship.repo";
import { SponsorshipService } from "./sponsorship.service";
import { SponsorshipController } from "./sponsorship.controller";

const router = Router();

const repo = new SponsorshipRepository(getPrisma());
const service = new SponsorshipService(repo);
const controller = new SponsorshipController(service);

router.get("/",    auth, controller.list);
router.post("/",   auth, controller.create);
router.get("/:id", auth, controller.get);
router.patch("/:id", auth, controller.update);
router.get("/:id/payments", auth, controller.getPayments);
router.patch("/:id/payments/:paymentId", auth, controller.markPaid);

export default router;
