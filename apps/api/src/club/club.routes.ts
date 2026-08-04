import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { ClubController } from "./club.controller";
import { ClubService } from "./club.service";
import { ClubRepository } from "./club.repo";
import CountryRepository from "../country/country.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new ClubRepository(prisma);
const countryRepo = new CountryRepository(prisma);
const service = new ClubService(repo, countryRepo);
const controller = new ClubController(service);

router.get("/", auth, controller.getAll);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id", auth, controller.update);

export default router;
