import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { CoachingStaffService } from "./coaching-staff.service";

function getWeekBounds(refDate: Date): { start: Date; end: Date } {
  const day = refDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(refDate);
  start.setDate(refDate.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export class CoachingStaffController {
  constructor(private service: CoachingStaffService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      const canAccess =
        role === "ADMIN" ||
        (role === "COACHING_STAFF" && coachingRole === "HEAD_COACH");
      if (!canAccess) throw new AppError(403, "FORBIDDEN");

      const refDate = req.query["week"]
        ? new Date(req.query["week"] as string)
        : new Date();
      const { start, end } = getWeekBounds(refDate);

      res.json(await this.service.getAll(start, end));
    } catch (err) {
      next(err);
    }
  };
}
