import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { CoachService } from "./coach.service";
import { CoachStatus } from "../generated/enums";

const canRead = (role: string, frontOfficeRole: string | null | undefined) =>
  isAdminLike(role) || role === "GM" || (role === "FRONT_OFFICE" && frontOfficeRole === "TD");

const canWrite = (role: string, frontOfficeRole: string | null | undefined) =>
  role === "GM" || (role === "FRONT_OFFICE" && frontOfficeRole === "TD");

const canApprove = (role: string) =>
  role === "GM";

export class CoachController {
  constructor(private service: CoachService) {}

  // ── HiringRound ────────────────────────────────────────────────────────────

  listRounds = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getAllRounds());
    } catch (err) { next(err); }
  };

  createRound = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = req.user!;
      if (!canApprove(role)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createRound({ ...req.body, createdById: id }));
    } catch (err) { next(err); }
  };

  updateRoundStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canApprove(role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.updateRoundStatus(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  // ── Coach ──────────────────────────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const filter: { roundId?: number; status?: CoachStatus } = {};
      if (req.query["roundId"]) filter.roundId = Number(req.query["roundId"]);
      if (req.query["status"]) filter.status = req.query["status"] as CoachStatus;
      res.json(await this.service.getAll(filter));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (req.body.status === "CONTRACTED") {
        if (!canApprove(role)) throw new AppError(403, "FORBIDDEN");
      } else {
        if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      }
      res.json(await this.service.updateStatus(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  // ── Evaluation ─────────────────────────────────────────────────────────────

  upsertEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.upsertEvaluation(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  // ── TutorAssignment ────────────────────────────────────────────────────────

  listTutors = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getTutors(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  createTutor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createTutor(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  updateTutor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.updateTutor(Number(req.params["tutorId"]), req.body));
    } catch (err) { next(err); }
  };
}
