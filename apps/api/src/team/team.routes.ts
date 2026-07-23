import { Router } from "express";
import passport from "passport";
import { TeamController } from "./team.controller";
import { TeamService } from "./team.service";
import { TeamRepository } from "./team.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new TeamRepository(getPrisma());
const service = new TeamService(repo);
const controller = new TeamController(service);
const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.getAll);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id/deactivate", auth, controller.deactivate);
router.patch("/:id/lite", auth, controller.setLiteMode);
router.patch("/:id", auth, controller.update);

export default router;
