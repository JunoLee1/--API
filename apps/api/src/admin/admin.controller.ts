import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { AdminService } from "./admin.service";
import { ListUsersQuery } from "./dto/admin.dto";
import { Role, CoachingRole, FrontOfficeRole } from "../generated/enums";

const requireAdmin = (req: Request): void => {
  if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
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
      res.status(200).json(
        await this.service.updateUserRole(Number(req.params["id"]), req.body, req.user!.id),
      );
    } catch (err) {
      next(err);
    }
  };

  deactivateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      res.status(200).json(await this.service.deactivateUser(Number(req.params["id"]), req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  reactivateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      res.status(200).json(await this.service.reactivateUser(Number(req.params["id"])));
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
}
