import { Router } from "express";
import passport from "passport";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminRepository } from "./admin.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new AdminRepository(getPrisma());
const service = new AdminService(repo);
const controller = new AdminController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/users", auth, controller.listUsers);
router.get("/users/:id", auth, controller.getUser);
router.patch("/users/:id/role", auth, controller.updateRole);
router.patch("/users/:id/deactivate", auth, controller.deactivateUser);
router.patch("/users/:id/reactivate", auth, controller.reactivateUser);
router.delete("/users/:id", auth, controller.deleteUser);

export default router;
