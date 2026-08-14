import type { Request, Response, NextFunction } from "express";
import { getPrisma } from "../lib/prisma";

export function requireGuardian(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "GUARDIAN") {
    return res.status(403).json({ code: "FORBIDDEN" });
  }
  next();
}

export async function requireGuardianChild(req: Request, res: Response, next: NextFunction) {
  try {
    const guardianId = req.user?.id;
    if (!guardianId) return res.status(401).json({ code: "UNAUTHORIZED" });

    const playerId = req.params['playerId'] as string;
    if (!playerId) return res.status(400).json({ code: "INVALID_PLAYER_ID" });

    const player = await getPrisma().player.findFirst({
      where: { id: playerId, guardianId },
      select: { id: true },
    });

    if (!player) return res.status(403).json({ code: "FORBIDDEN" });

    req.childPlayerId = playerId;
    next();
  } catch (e) {
    next(e);
  }
}
