import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { canWriteHR, canManageTD } from "../lib/permissions";
import { RecruitmentService } from "./recruitment.service";
import type { InterviewRound } from "../generated/enums";
import type {
  CreateJobPostingDto,
  UpdateJobPostingDto,
  JobPostingListQuery,
  CreateJobApplicationDto,
  UpdateJobApplicationDto,
  CreateInterviewDto,
  UpdateInterviewDto,
  CreateReferenceCheckDto,
  UpdateReferenceCheckDto,
  VerifyOtpDto,
} from "./dto/recruitment.dto";

const canRead = (role: string, foRole: string | null | undefined, coachRole: string | null | undefined) =>
  canWriteHR(role, foRole) ||
  canManageTD(role, foRole) ||
  (role === "COACHING_STAFF" && coachRole === "HEAD_COACH");

const canWrite = (role: string, foRole: string | null | undefined) =>
  canWriteHR(role, foRole);

const canApprove = (role: string, foRole: string | null | undefined) =>
  canWriteHR(role, foRole);

export class RecruitmentController {
  constructor(private service: RecruitmentService) {}

  // --- JobPosting ---

  listPostings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, coachingRole } = req.user!;
      if (!canRead(role, frontOfficeRole, coachingRole)) throw new AppError(403, "FORBIDDEN");
      const query = req.query as JobPostingListQuery;
      res.json(await this.service.listPostings(query));
    } catch (err) {
      next(err);
    }
  };

  createPosting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const dto = req.body as CreateJobPostingDto;
      res.status(201).json(await this.service.createPosting(dto, userId));
    } catch (err) {
      next(err);
    }
  };

  getPosting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, coachingRole } = req.user!;
      if (!canRead(role, frontOfficeRole, coachingRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getPosting(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };

  updatePosting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const dto = req.body as UpdateJobPostingDto;
      res.json(await this.service.updatePosting(Number(req.params["id"]), dto));
    } catch (err) {
      next(err);
    }
  };

  approvePosting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = req.user!;
      if (!canApprove(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.approvePosting(Number(req.params["id"]), userId));
    } catch (err) {
      next(err);
    }
  };

  closePosting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.closePosting(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };

  // --- JobApplication ---

  listApplications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, coachingRole } = req.user!;
      if (!canRead(role, frontOfficeRole, coachingRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.listApplications(Number(req.params["postingId"])));
    } catch (err) {
      next(err);
    }
  };

  apply = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.body as CreateJobApplicationDto;
      res.status(201).json(await this.service.apply(Number(req.params["postingId"]), dto));
    } catch (err) {
      next(err);
    }
  };

  getApplication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, coachingRole } = req.user!;
      if (!canRead(role, frontOfficeRole, coachingRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getApplication(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };

  updateApplication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const dto = req.body as UpdateJobApplicationDto;
      res.json(await this.service.updateApplication(Number(req.params["id"]), dto));
    } catch (err) {
      next(err);
    }
  };

  rejectApplication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.rejectApplication(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };

  offerApplication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = req.user!;
      if (!canApprove(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.offerApplication(Number(req.params["id"]), userId));
    } catch (err) {
      next(err);
    }
  };

  // --- Interview ---

  scheduleInterview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const dto = req.body as CreateInterviewDto;
      res.status(201).json(await this.service.scheduleInterview(Number(req.params["id"]), dto));
    } catch (err) {
      next(err);
    }
  };

  updateInterview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const round = req.params["round"] as InterviewRound;
      const dto = req.body as UpdateInterviewDto;
      res.json(await this.service.updateInterview(Number(req.params["id"]), round, dto));
    } catch (err) {
      next(err);
    }
  };

  // --- ReferenceCheck ---

  createReferenceCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const dto = req.body as CreateReferenceCheckDto;
      res.status(201).json(await this.service.createReferenceCheck(Number(req.params["id"]), dto));
    } catch (err) {
      next(err);
    }
  };

  updateReferenceCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const dto = req.body as UpdateReferenceCheckDto;
      res.json(await this.service.updateReferenceCheck(Number(req.params["id"]), dto));
    } catch (err) {
      next(err);
    }
  };

  // --- Onboarding ---

  startOnboarding = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const { userId } = req.body as { userId: number };
      res.status(201).json(await this.service.startOnboarding(Number(req.params["id"]), userId));
    } catch (err) {
      next(err);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { otp } = req.body as VerifyOtpDto;
      res.json(await this.service.verifyEmail(Number(req.params["id"]), otp));
    } catch (err) {
      next(err);
    }
  };

  completeMfa = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.completeMfa(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };
}
