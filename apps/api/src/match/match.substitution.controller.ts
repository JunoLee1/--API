import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { requireUser } from "../lib/authMiddleware";
import { MatchSubstitutionService } from "./match.substitution.service";
import { CreateSubstitutionDto } from "./dto/match.dto";

const ALLOWED_ROLES = ["ADMIN", "COACHING_STAFF"] as const;

export class MatchSubstitutionController {
  constructor(private service: MatchSubstitutionService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireUser(req);
      res.json(await this.service.list(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(ALLOWED_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      const dto = req.body as CreateSubstitutionDto;
      res.status(201).json(await this.service.create(Number(req.params["id"]), dto));
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(ALLOWED_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      await this.service.delete(Number(req.params["id"]), Number(req.params["subId"]));
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
