import passport from "passport";
import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { getPrisma } from "./prisma";
import { AppError } from "./appError";
import { writeAuditLog } from "./auditLog";
import { Role } from "../generated/enums";

export function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED");
  return req.user;
}

export const requireRole = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }
  if (!roles.includes(req.user.role as Role)) {
    return res.status(403).json({ code: "FORBIDDEN" });
  }
  return next();
};

export const teamSwitchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => String((req.user as Express.User | undefined)?.id ?? req.ip),
  message: { code: "TOO_MANY_REQUESTS" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const auth = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(
    "accessToken",
    { session: false },
    async (err: unknown, user: Express.User | false) => {
      if (err || !user) {
        return res.status(401).json({ code: "UNAUTHORIZED" });
      }

      const record = await getPrisma().user.findUnique({
        where: { id: user.id },
        select: { isDeleted: true },
      });
      if (!record || record.isDeleted) {
        return res.status(401).json({ code: "UNAUTHORIZED" });
      }

      req.user = user;
      if (user.role === "SUPER_ADMIN") {
        const hdr = req.headers["x-team-id"];
        if (hdr) {
          const newTeamId = Number(hdr);
          if (isNaN(newTeamId) || newTeamId <= 0) {
            return res.status(400).json({ code: "INVALID_TEAM_ID" });
          }
          const team = await getPrisma().team.findUnique({ where: { id: newTeamId }, select: { id: true } });
          if (!team) {
            return res.status(400).json({ code: "INVALID_TEAM_ID" });
          }
          if (user.teamId !== newTeamId) {
            await writeAuditLog({
              actorId: user.id,
              action: "SUPER_ADMIN_TEAM_SWITCH",
              targetId: newTeamId,
              detail: { from: user.teamId, to: newTeamId },
            });
          }
          req.user.teamId = newTeamId;
        }
      }
      next();
    }
  )(req, res, next);
};
