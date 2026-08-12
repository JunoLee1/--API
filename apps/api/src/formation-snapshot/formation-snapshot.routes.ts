import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { FormationSnapshotRepository } from "./formation-snapshot.repo";
import { FormationSnapshotService } from "./formation-snapshot.service";
import { FormationSnapshotController } from "./formation-snapshot.controller";

const router = Router();
const prisma = getPrisma();
const repo = new FormationSnapshotRepository(prisma);
const service = new FormationSnapshotService(repo);
const controller = new FormationSnapshotController(service);

router.post("/", auth, controller.create);
router.get("/match/:matchId", auth, controller.findByMatch);

export default router;
