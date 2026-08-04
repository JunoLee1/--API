import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { getPrisma } from "../lib/prisma";
import { LeagueRepository } from "./league.repo";
import { LeagueService } from "./league.service";
import { LeagueController } from "./league.controller";
import { ClubRepository } from "../club/club.repo";
import { ClubService } from "../club/club.service";

const router = Router();

const clubRepo = new ClubRepository(getPrisma());
const clubService = new ClubService(clubRepo);
const repo = new LeagueRepository(getPrisma());
const service = new LeagueService(repo, clubService);
const controller = new LeagueController(service);

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.get);
router.patch("/:id", auth, controller.update);
router.post("/:id/clubs", auth, controller.registerClub);
router.delete("/:id/clubs/:clubId", auth, controller.removeClub);

export default router;
