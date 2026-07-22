import { Router } from "express";
import passport from "passport";
import { getPrisma } from "../lib/prisma";
import { DashboardRepository } from "./dashboard.repo";
import { DashboardService } from "./dashboard.service";
import { DashboardController } from "./dashboard.controller";

const router = Router();
const repo = new DashboardRepository(getPrisma());
const service = new DashboardService(repo);
const controller = new DashboardController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/stats", auth, controller.getStats);

router.get("/youth-development", auth, async (req, res, next) => {
  try {
    const user = req.user as any;
    if (user.role !== "ADMIN" && !(user.role === "FRONT_OFFICE" && user.frontOfficeRole === "TD")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(await service.getYouthDevelopmentStats());
  } catch (e) { next(e); }
});

export default router;
