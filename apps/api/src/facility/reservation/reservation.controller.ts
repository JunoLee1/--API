import { Request, Response, NextFunction } from "express";
import { ReservationRepository } from "./reservation.repo";
import { requireUser } from "../../lib/authMiddleware";
import { AppError } from "../../lib/appError";
import { getPrisma } from "../../lib/prisma";

export class ReservationController {
  private repo = new ReservationRepository(getPrisma());

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireUser(req);
      const { facilityZone } = req.query as { facilityZone?: string };
      res.json(await this.repo.findAll(facilityZone));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const { facilityZone, title, startTime, endTime, notes } = req.body as {
        facilityZone: string; title: string; startTime: string; endTime: string; notes?: string;
      };
      if (!facilityZone || !title || !startTime || !endTime) throw new AppError(400, "MISSING_REQUIRED_FIELDS");
      if (new Date(startTime) >= new Date(endTime)) throw new AppError(400, "INVALID_TIME_RANGE");
      res.status(201).json(await this.repo.create({
        facilityZone,
        title,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        ...(notes !== undefined ? { notes } : {}),
        reservedById: user.id,
      }));
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireUser(req);
      await this.repo.delete(Number(req.params["id"]));
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
