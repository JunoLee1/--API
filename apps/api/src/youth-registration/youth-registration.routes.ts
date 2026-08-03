import { auth } from "../lib/authMiddleware";
import crypto from "crypto";
import { Router } from "express";
import { YouthRegistrationController } from "./youth-registration.controller";
import { YouthRegistrationService } from "./youth-registration.service";
import { YouthRegistrationRepository } from "./youth-registration.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { AuthRepository } from "../auth/auth.repo";
import { AuthService } from "../auth/auth.service";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new YouthRegistrationRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const authRepo = new AuthRepository(prisma);
const authService = new AuthService(authRepo);

const inviteAdapter = {
  inviteUser: async (data: { email: string; role: string }) => {
    const tempPw = crypto.randomUUID();
    const baseNickname = data.email.split("@")[0];
    // Ensure unique nickname by appending random suffix
    const nickname = `${baseNickname}_${crypto.randomUUID().slice(0, 6)}`;
    const user = await authService.createUser({
      email: data.email,
      password: tempPw,
      confirmedPassword: tempPw,
      username: baseNickname ?? "guardian",
      nickname,
      role: data.role as any,
      coachingRole: null,
      frontOfficeRole: null,
      dateOfBirth: "2000-01-01T00:00:00.000Z",
      phoneNumber: "000-0000-0000",
      nationalityId: 1,
    });
    return { id: user.id };
  },
};

const service = new YouthRegistrationService(repo, notifRepo, inviteAdapter);
const controller = new YouthRegistrationController(service);


router.get("/", auth, controller.getAll);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id/reject", auth, controller.reject);
router.patch("/:id/contract", auth, controller.contract);
router.patch("/:id/guardian-approve", auth, controller.guardianApprove);

export default router;
