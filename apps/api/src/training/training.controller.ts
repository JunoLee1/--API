import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { TrainingService } from "./training.service";
import { SessionListQuery } from "./dto/training.dto";

const STAFF_ROLES = ["ADMIN", "COACHING_STAFF"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

export class TrainingController {
  constructor(private service: TrainingService) {}

  getSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query: SessionListQuery = {};
      if (req.query["seasonId"]) query.seasonId = Number(req.query["seasonId"]);
      res.status(200).json(await this.service.getSessions(query));
    } catch (err) { next(err); }
  };

  getSessionById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getSessionById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  createSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!STAFF_ROLES.includes(req.user!.role as StaffRole)) throw new AppError(403, "FORBIDDEN");
      if (req.body.sessionType === "GOALKEEPER") {
        const isGK = req.user!.role === "ADMIN" || req.user!.coachingRole === "GOALKEEPER_COACH";
        if (!isGK) throw new AppError(403, "FORBIDDEN");
      }
      res.status(201).json(await this.service.createSession(req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  approveSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      const canApprove =
        role === "ADMIN" || (role === "COACHING_STAFF" && coachingRole === "HEAD_COACH");
      if (!canApprove) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.approveSession(Number(req.params["id"]), req.user!.id));
    } catch (err) { next(err); }
  };

  addContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!STAFF_ROLES.includes(req.user!.role as StaffRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.addContent(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  addParticipants = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!STAFF_ROLES.includes(req.user!.role as StaffRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.addParticipants(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  upsertResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!STAFF_ROLES.includes(req.user!.role as StaffRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.upsertResult(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  getResults = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>
      const filters: { from?: string; to?: string; sessionType?: string; playerId?: string } = {}
      if (q["from"]) filters.from = q["from"]
      if (q["to"]) filters.to = q["to"]
      if (q["sessionType"]) filters.sessionType = q["sessionType"]
      if (q["playerId"]) filters.playerId = q["playerId"]
      res.status(200).json(await this.service.getResults(filters))
    } catch (err) { next(err) }
  }
}
