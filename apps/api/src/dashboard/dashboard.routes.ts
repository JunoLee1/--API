import { auth } from "../lib/authMiddleware";
import { isAdminLike } from "../lib/permissions";
import { Router } from "express";
import { getPrisma } from "../lib/prisma";
import { DashboardRepository } from "./dashboard.repo";
import { DashboardService } from "./dashboard.service";
import { DashboardController } from "./dashboard.controller";

const router = Router();
const repo = new DashboardRepository(getPrisma());
const service = new DashboardService(repo);
const controller = new DashboardController(service);


router.get("/stats", auth, controller.getStats);

router.get("/youth-development", auth, async (req, res, next) => {
  try {
    const user = req.user as any;
    if (!isAdminLike(user.role) && !(user.role === "FRONT_OFFICE" && user.frontOfficeRole === "TD")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(await service.getYouthDevelopmentStats());
  } catch (e) { next(e); }
});

router.get("/academy-finance", auth, async (req, res, next) => {
  try {
    const user = req.user as any;
    const foRole = user.frontOfficeRole;
    const allowedFoRoles = ["FINANCE_MANAGER", "TD"];
    if (!isAdminLike(user.role) && !(user.role === "FRONT_OFFICE" && allowedFoRoles.includes(foRole))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const now = new Date();
    const year = Number(req.query.year ?? now.getFullYear());
    const month = Number(req.query.month ?? now.getMonth() + 1);
    res.json(await service.getAcademyFinanceStats(year, month));
  } catch (e) { next(e); }
});

export default router;
