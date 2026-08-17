import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { PartnerController } from "./partner.controller";
import { PartnerService } from "./partner.service";
import { PartnerRepository } from "./partner.repo";
import { getPrisma } from "../lib/prisma";
import { ContactLogRepository } from "./contact-log/contact-log.repo";
import { ContactLogService } from "./contact-log/contact-log.service";
import { ContactLogController } from "./contact-log/contact-log.controller";

const router = Router();
const repo = new PartnerRepository(getPrisma());
const service = new PartnerService(repo);
const controller = new PartnerController(service);

const contactLogRepo = new ContactLogRepository(getPrisma());
const contactLogService = new ContactLogService(contactLogRepo, repo);
const contactLogController = new ContactLogController(contactLogService);

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.getById);
router.patch("/:id", auth, controller.update);
router.post("/:id/contracts", auth, controller.createContract);
router.patch("/:id/contracts/:contractId", auth, controller.updateContract);

router.get("/:partnerId/contacts", auth, contactLogController.list);
router.post("/:partnerId/contacts", auth, contactLogController.create);

export default router;
