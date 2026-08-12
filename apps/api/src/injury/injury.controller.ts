import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { requireUser } from "../lib/authMiddleware";
import { InjuryService } from "./injury.service";
import { writeAuditLog } from "../lib/auditLog";

const MEDICAL_ROLES = ["ADMIN", "COACHING_STAFF"] as const;
type MedicalRole = (typeof MEDICAL_ROLES)[number];

export class InjuryController {
  constructor(private service: InjuryService) {}

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = requireUser(req);
      const isMedicalDirector =
        role === "COACHING_STAFF" && coachingRole === "MEDICAL_DIRECTOR";
      if (!isAdminLike(role) && !isMedicalDirector) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.getStats());
    } catch (err) { next(err); }
  };

  getActive = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      void writeAuditLog({ actorId: user.id, action: "MEDICAL_DATA_READ" }).catch(console.error);
      res.status(200).json(await this.service.getActive());
    } catch (err) { next(err); }
  };

  getByPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      void writeAuditLog({ actorId: user.id, action: "MEDICAL_DATA_READ", targetId: String(req.params["playerId"]) }).catch(console.error);
      res.status(200).json(await this.service.getByPlayer(String(req.params["playerId"])));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      void writeAuditLog({ actorId: user.id, action: "MEDICAL_DATA_READ", targetId: String(req.params["id"]) }).catch(console.error);
      res.status(200).json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(MEDICAL_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createInjury({ ...req.body, medicalStaffId: user.id }));
    } catch (err) { next(err); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(MEDICAL_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.updateStatus(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  getReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      void writeAuditLog({ actorId: user.id, action: "MEDICAL_DATA_READ", targetId: String(req.params["id"]) }).catch(console.error);
      const report = await this.service.getReport(
        Number(req.params["id"]),
        { role: user.role, coachingRole: user.coachingRole ?? null },
      );
      res.status(200).json(report ?? null);
    } catch (err) { next(err); }
  };

  saveReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(MEDICAL_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(
        await this.service.saveReport(
          Number(req.params["id"]),
          req.body,
          user.id,
          { role: user.role, coachingRole: user.coachingRole ?? null },
        )
      );
    } catch (err) { next(err); }
  };

  private getSignRole(user: Express.User): 'COACH' | 'TRAINER' | 'MEDICAL' | null {
    if (user.role === 'ADMIN') return 'MEDICAL';
    if (user.role === 'COACHING_STAFF') {
      if (user.coachingRole === 'HEAD_COACH') return 'COACH';
      if (user.coachingRole === 'PHYSICAL_COACH') return 'TRAINER';
      if (user.coachingRole === 'MEDICAL' || user.coachingRole === 'MEDICAL_DIRECTOR') return 'MEDICAL';
    }
    return null;
  }

  signReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const role = this.getSignRole(user);
      if (!role) throw new AppError(403, "FORBIDDEN");
      // SH20: SUPER_ADMIN은 모든 팀 접근 가능, 그 외는 자신의 팀 부상 선수만 서명 가능
      const signerTeamId = user.role === "SUPER_ADMIN" ? undefined : user.teamId;
      res.status(200).json(
        await this.service.signReport(Number(req.params["id"]), role, user.id, signerTeamId)
      );
    } catch (err) { next(err); }
  };

  unsignReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const role = this.getSignRole(user);
      if (!role) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(
        await this.service.unsignReport(Number(req.params["id"]), role)
      );
    } catch (err) { next(err); }
  };

  getAssessment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      void writeAuditLog({ actorId: user.id, action: "MEDICAL_DATA_READ", targetId: String(req.params["id"]) }).catch(console.error);
      const data = await this.service.getAssessment(Number(req.params["id"]));
      res.status(200).json(data);
    } catch (err) { next(err); }
  };

  processAssessment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(MEDICAL_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      const result = await this.service.processAssessment(
        Number(req.params["id"]),
        req.body,
        user.id
      );
      res.status(200).json(result);
    } catch (err) { next(err); }
  };

  getExternalReports = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      void writeAuditLog({ actorId: user.id, action: "MEDICAL_DATA_READ", targetId: String(req.params["id"]) }).catch(console.error);
      const data = await this.service.getExternalReports(Number(req.params["id"]));
      res.status(200).json(data);
    } catch (err) { next(err); }
  };

  updateExternalReportStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(MEDICAL_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      const { status, note } = req.body;
      const result = await this.service.updateExternalReportStatus(
        Number(req.params["reportId"]),
        status,
        note,
      );
      res.status(200).json(result);
    } catch (err) { next(err); }
  };
}
