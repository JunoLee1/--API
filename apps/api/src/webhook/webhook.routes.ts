import { Router } from "express";
import { WebhookController } from "./webhook.controller";
import { WebhookService } from "./webhook.service";
import { verifyWebhookSignature } from "./hmac.middleware";
import { getPrisma } from "../lib/prisma";

const router = Router();
const service = new WebhookService(getPrisma());
const controller = new WebhookController(service);

router.post("/applications/:source", verifyWebhookSignature, controller.handleApplication);

export default router;
