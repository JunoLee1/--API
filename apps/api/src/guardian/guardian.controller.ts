import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import type { GuardianService } from "./guardian.service";
import type { LinkBySearchDto, LinkByCodeDto, IssueInviteCodeDto } from "./dto/guardian.dto";

const INVITE_CODE_ROLES = ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE"] as const;

export class GuardianController {
  constructor(private service: GuardianService) {}

  linkBySearch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentCode, playerName, dateOfBirth } = req.body as LinkBySearchDto;
      if (!studentCode || !playerName || !dateOfBirth) throw new AppError(400, "MISSING_FIELDS");
      const result = await this.service.linkBySearch({ studentCode, playerName, dateOfBirth }, req.user!.id);
      res.status(200).json(result);
    } catch (e) { next(e); }
  };

  linkByCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code } = req.body as LinkByCodeDto;
      if (!code) throw new AppError(400, "MISSING_FIELDS");
      await this.service.linkByCode({ code }, req.user!.id);
      res.status(200).json({ ok: true });
    } catch (e) { next(e); }
  };

  issueInviteCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { playerId } = req.body as IssueInviteCodeDto;
      if (!playerId) throw new AppError(400, "MISSING_FIELDS");
      const role = req.user!.role;
      if (!(INVITE_CODE_ROLES as readonly string[]).includes(role)) throw new AppError(403, "FORBIDDEN");
      const result = await this.service.issueInviteCode({ playerId }, req.user!.id);
      res.status(200).json(result);
    } catch (e) { next(e); }
  };

  getChild = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getChild(req.user!.id);
      res.status(200).json(result);
    } catch (e) { next(e); }
  };

  getDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getDashboard(req.user!.id);
      res.status(200).json(result);
    } catch (e) { next(e); }
  };
}
