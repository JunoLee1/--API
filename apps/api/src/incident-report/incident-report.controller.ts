import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import type { IncidentReportService } from "./incident-report.service";
import type { CreateIncidentReportDto, SignIncidentReportDto, IncidentReportListQuery } from "./dto/incident-report.dto";
import { IncidentReportStatus, IncidentType } from "../generated/enums";

const ALLOWED_ROLES = ["ADMIN", "COACHING_STAFF", "FRONT_OFFICE"] as const;

export class IncidentReportController {
  constructor(private service: IncidentReportService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query;
      const query: IncidentReportListQuery = {};
      if (q["teamId"]) query.teamId = Number(q["teamId"]);
      if (q["status"]) query.status = q["status"] as IncidentReportStatus;
      if (q["playerId"]) query.playerId = String(q["playerId"]);
      res.json(await this.service.getAll(query));
    } catch (e) { next(e); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params["id"])));
    } catch (e) { next(e); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ALLOWED_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const body = req.body as CreateIncidentReportDto;
      if (!body.playerId || body.teamId == null || !body.type || !body.description) {
        throw new AppError(400, "MISSING_FIELDS");
      }
      if (body.description.length < 10) throw new AppError(400, "DESCRIPTION_TOO_SHORT");
      if (!Object.values(IncidentType).includes(body.type)) throw new AppError(400, "INVALID_TYPE");
      res.status(201).json(await this.service.create(body, req.user!.id));
    } catch (e) { next(e); }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ALLOWED_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.submit(Number(req.params["id"])));
    } catch (e) { next(e); }
  };

  sign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ALLOWED_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const { role } = req.body as SignIncidentReportDto;
      if (role !== "SUPERVISOR" && role !== "MEDICAL") throw new AppError(400, "INVALID_ROLE");
      res.json(await this.service.sign(Number(req.params["id"]), role));
    } catch (e) { next(e); }
  };
}
