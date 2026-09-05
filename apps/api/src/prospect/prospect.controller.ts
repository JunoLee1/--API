import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { requireUser } from "../lib/authMiddleware";
import { ProspectService } from "./prospect.service";
import { ProspectStatus } from "../generated/enums";
import { TransitionProspectStatusDto, SignProspectDto, ProspectMedicalResultDto, CreateProspectNegotiationLogDto } from "./dto/prospect.dto";
import { CreateProspectVideoEvaluationDto, CreateProspectEvaluationLogDto } from "./dto/video-evaluation.dto";

const canWrite = (role: string, frontOfficeRole: string | null | undefined): boolean =>
  isAdminLike(role) ||
  role === "GM" ||
  (role === "FRONT_OFFICE" && frontOfficeRole === "SCOUT");

const canRead = (role: string, coachingRole: string | null | undefined): boolean =>
  isAdminLike(role) ||
  role === "FRONT_OFFICE" ||
  (role === "COACHING_STAFF" && coachingRole === "HEAD_COACH");

const canSign = (role: string, frontOfficeRole: string | null | undefined): boolean =>
  isAdminLike(role) ||
  role === "GM" ||
  (role === "FRONT_OFFICE" && frontOfficeRole === "CONTRACT_MANAGER");

export class ProspectController {
  constructor(private service: ProspectService) {}

  checkDuplicate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = requireUser(req);
      if (!canRead(role, coachingRole)) throw new AppError(403, "FORBIDDEN");
      const name = req.query["name"] as string;
      const currentTeam = req.query["currentTeam"] as string | undefined;
      if (!name) throw new AppError(400, "NAME_REQUIRED");
      const result = await this.service.checkDuplicate(name, currentTeam);
      res.status(200).json(result);
    } catch (err) { next(err); }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = requireUser(req);
      if (!canRead(role, coachingRole)) throw new AppError(403, "FORBIDDEN");
      const status = req.query["status"] as ProspectStatus | undefined;
      res.status(200).json(await this.service.getAll(status));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = requireUser(req);
      if (!canRead(role, coachingRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create({ ...req.body, createdById: id }));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(
        await this.service.updateStatus(Number(req.params["id"]), req.body as TransitionProspectStatusDto)
      );
    } catch (err) { next(err); }
  };

  sign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canSign(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(
        await this.service.sign(Number(req.params["id"]), req.body as SignProspectDto)
      );
    } catch (err) { next(err); }
  };

  recordMedicalResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(
        await this.service.recordMedicalResult(Number(req.params["id"]), req.body as ProspectMedicalResultDto)
      );
    } catch (err) { next(err); }
  };

  addNegotiationLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(
        await this.service.addNegotiationLog(Number(req.params["id"]), req.body as CreateProspectNegotiationLogDto, id)
      );
    } catch (err) { next(err); }
  };

  getNegotiationLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = requireUser(req);
      if (!canRead(role, coachingRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.getNegotiationLogs(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  addVideoEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(
        await this.service.addVideoEvaluation(
          Number(req.params["id"]),
          req.body as CreateProspectVideoEvaluationDto,
          id,
        ),
      );
    } catch (err) { next(err); }
  };

  getVideoEvaluations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = requireUser(req);
      if (!canRead(role, coachingRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.getVideoEvaluations(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  addEvaluationLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(
        await this.service.addEvaluationLog(
          Number(req.params["id"]),
          req.body as CreateProspectEvaluationLogDto,
          id,
        ),
      );
    } catch (err) { next(err); }
  };

  getEvaluationLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = requireUser(req);
      if (!canRead(role, coachingRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.getEvaluationLogs(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  checkAcquisitionGate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = requireUser(req);
      if (!canRead(role, coachingRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.checkAcquisitionGate(Number(req.params["id"])));
    } catch (err) { next(err); }
  };
}
