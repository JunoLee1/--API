import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { AdminService } from "./admin.service";
import { ListUsersQuery } from "./dto/admin.dto";
import { Role, CoachingRole, FrontOfficeRole } from "../generated/enums";
import { hasPermission, Permission } from "../lib/permissions";
import { writeAuditLog } from "../lib/auditLog";

const requireAdmin = (req: Request): void => {
  if (!hasPermission(req.user!.role as Role, Permission.SYSTEM_MANAGE)) {
    throw new AppError(403, "FORBIDDEN");
  }
};

export class AdminController {
  constructor(private service: AdminService) {}

  listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      const filters: ListUsersQuery = {
        ...(req.query["username"] && { username: req.query["username"] as string }),
        ...(req.query["role"] && { role: req.query["role"] as Role }),
        ...(req.query["coachingRole"] && { coachingRole: req.query["coachingRole"] as CoachingRole }),
        ...(req.query["frontOfficeRole"] && { frontOfficeRole: req.query["frontOfficeRole"] as FrontOfficeRole }),
        ...(req.query["isDeleted"] !== undefined && { isDeleted: req.query["isDeleted"] === "true" }),
      };
      res.status(200).json(await this.service.listUsers(filters));
    } catch (err) {
      next(err);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      res.status(200).json(await this.service.getUserById(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };

  updateRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      const targetId = Number(req.params["id"]);
      const result = await this.service.updateUserRole(targetId, req.body, req.user!.id);
      await writeAuditLog({
        actorId: req.user!.id,
        action: "ROLE_UPDATE",
        targetId,
        detail: { newRole: req.body.role },
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  deactivateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      const targetId = Number(req.params["id"]);
      const result = await this.service.deactivateUser(targetId, req.user!.id);
      await writeAuditLog({
        actorId: req.user!.id,
        action: "USER_DEACTIVATE",
        targetId,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  reactivateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      const targetId = Number(req.params["id"]);
      const result = await this.service.reactivateUser(targetId);
      await writeAuditLog({
        actorId: req.user!.id,
        action: "USER_REACTIVATE",
        targetId,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      await this.service.deleteUser(Number(req.params["id"]), req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  listPlayersWithoutAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      const nameFilter = req.query["name"] as string | undefined;
      res.status(200).json(await this.service.getPlayersWithoutAccounts(nameFilter));
    } catch (err) {
      next(err);
    }
  };
}
