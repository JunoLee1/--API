import passport from "passport";
import { Request, Response, NextFunction } from "express";
import { getPrisma } from "./prisma";

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
        if (hdr) req.user.teamId = Number(hdr);
      }
      next();
    }
  )(req, res, next);
};
