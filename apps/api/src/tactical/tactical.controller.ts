import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { requireUser } from "../lib/authMiddleware";
import { TacticalService } from "./tactical.service";

const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN", "COACHING_STAFF"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

export class TacticalController {
  constructor(private service: TacticalService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (user.role === "PLAYER") {
        return res.status(200).json(await this.service.listForPlayer(user.id));
      }
      const filters = {
        ...(req.query["matchId"] && { matchId: Number(req.query["matchId"]) }),
        ...(req.query["phase"] && { phase: req.query["phase"] as string }),
      };
      res.status(200).json(await this.service.list(filters));
    } catch (err) { next(err); }
  };

  getByMatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getByMatch(Number(req.params["matchId"])));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const id = Number(req.params["id"]);
      if (user.role === "PLAYER") {
        return res.status(200).json(await this.service.getByIdForPlayer(id, user.id));
      }
      res.status(200).json(await this.service.getById(id));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, coachingRole } = requireUser(req);
      const canCreate =
        isAdminLike(role) ||
        (role === "COACHING_STAFF" && coachingRole !== "HEAD_COACH") ||
        (role === "FRONT_OFFICE" && frontOfficeRole === "TACTICAL_ANALYST");
      if (!canCreate) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createAnalysis(req.body, requireUser(req).id));
    } catch (err) { next(err); }
  };

  addLineup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!STAFF_ROLES.includes(user.role as StaffRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.addLineup(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  addMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!STAFF_ROLES.includes(user.role as StaffRole)) throw new AppError(403, "FORBIDDEN");
      const analysisId = Number(req.params["id"]);
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) throw new AppError(400, "NO_FILES");
      const results = await Promise.all(
        files.map((file) =>
          this.service.addMedia(analysisId, {
            url: `/uploads/tactical-media/${file.filename}`,
            type: file.mimetype.startsWith("video/") ? "video" : "image",
          })
        )
      );
      res.status(201).json(results);
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, coachingRole } = requireUser(req);
      const canUpdate =
        isAdminLike(role) ||
        (role === "COACHING_STAFF" && coachingRole !== "HEAD_COACH") ||
        (role === "FRONT_OFFICE" && frontOfficeRole === "TACTICAL_ANALYST");
      if (!canUpdate) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(
        await this.service.updateAnalysis(Number(req.params["id"]), req.body)
      );
    } catch (err) { next(err); }
  };

  confirm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = requireUser(req);
      const canConfirm =
        isAdminLike(role) || (role === "COACHING_STAFF" && coachingRole === "HEAD_COACH");
      if (!canConfirm) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.confirmAnalysis(Number(req.params["id"])));
    } catch (err) { next(err); }
  };
}
