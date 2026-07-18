import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { TrainingReferenceService } from "./training-reference.service";
import { SessionType } from "../generated/enums";

const READ_ROLES = ["ADMIN", "COACHING_STAFF", "FRONT_OFFICE"] as const;
const WRITE_ROLES = ["ADMIN", "COACHING_STAFF"] as const;

export class TrainingReferenceController {
  constructor(private service: TrainingReferenceService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(READ_ROLES as readonly string[]).includes(req.user!.role))
        throw new AppError(403, "FORBIDDEN");
      const q = req.query as Record<string, string | undefined>;
      res.status(200).json(
        await this.service.list({
          sessionType: q["sessionType"] as SessionType | undefined,
          tag: q["tag"],
        }),
      );
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(WRITE_ROLES as readonly string[]).includes(req.user!.role))
        throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(WRITE_ROLES as readonly string[]).includes(req.user!.role))
        throw new AppError(403, "FORBIDDEN");
      await this.service.delete(
        Number(req.params["id"]),
        req.user!.id,
        req.user!.role === "ADMIN",
      );
      res.status(204).send();
    } catch (err) { next(err); }
  };

  getRecommendations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(READ_ROLES as readonly string[]).includes(req.user!.role))
        throw new AppError(403, "FORBIDDEN");
      const q = req.query as Record<string, string | undefined>;
      if (!q["sessionType"]) throw new AppError(400, "SESSION_TYPE_REQUIRED");
      res.status(200).json(
        await this.service.getRecommendations(q["sessionType"] as SessionType),
      );
    } catch (err) { next(err); }
  };
}
