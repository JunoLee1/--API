import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike, canReadHR } from "../lib/permissions";
import { requireUser } from "../lib/authMiddleware";
import { DepartmentCategory, DeptRole } from "../generated/enums";
import { DepartmentService } from "./department.service";

const canManage = (role: string) =>
  isAdminLike(role) || role === "GM";

const canRead = (role: string) =>
  canManage(role) || role === "FRONT_OFFICE";

export class DepartmentController {
  constructor(private service: DepartmentService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!canRead(user.role)) throw new AppError(403, "FORBIDDEN");
      const scopedClubId = user.role === "ADMIN" ? user.clubId : null;
      res.json(await this.service.list(scopedClubId));
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!canRead(user.role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.get(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, id: userId, clubId } = requireUser(req);
      const { name, parentId, category } = req.body as { name: string; parentId?: number; category?: string };
      if (typeof name !== "string" || !name.trim()) throw new AppError(400, "NAME_REQUIRED");

      if (!canManage(role)) {
        if (parentId === undefined) throw new AppError(403, "FORBIDDEN");
        const parent = await this.service.get(parentId);
        if (parent.headId !== userId) throw new AppError(403, "FORBIDDEN");
      }

      const scopedClubId = role === "SUPER_ADMIN" ? null : (clubId ?? null);
      res.status(201).json(
        await this.service.create({
          name: name.trim(),
          clubId: scopedClubId,
          ...(parentId !== undefined && { parentId }),
          ...(category !== undefined && { category: category as DepartmentCategory }),
        })
      );
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, id: userId } = requireUser(req);
      const data = req.body as { name?: string; isActive?: boolean; parentId?: number | null; category?: import("../generated/enums").DepartmentCategory | null };

      if (!canManage(role)) {
        const dept = await this.service.get(Number(req.params["id"]));
        if (!dept.parentId || dept.parent?.headId !== userId) throw new AppError(403, "FORBIDDEN");
      }

      res.json(await this.service.update(Number(req.params["id"]), data, userId));
    } catch (err) {
      next(err);
    }
  };

  getHeadcount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadHR(role, frontOfficeRole ?? null)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getHeadcount(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, id: userId } = requireUser(req);

      if (!canManage(role)) {
        const dept = await this.service.get(Number(req.params["id"]));
        if (!dept.parentId || dept.parent?.headId !== userId) throw new AppError(403, "FORBIDDEN");
      }

      await this.service.delete(Number(req.params["id"]));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  // ── Member CRUD ────────────────────────────────────────────

  listMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: requesterId, role } = requireUser(req);
      const deptId = Number(req.params["deptId"]);
      res.json(await this.service.listMembers(deptId, requesterId, role));
    } catch (err) {
      next(err);
    }
  };

  addMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: requesterId, role } = requireUser(req);
      const deptId = Number(req.params["deptId"]);
      const { userId, role: memberRole } = req.body as { userId?: unknown; role?: unknown };
      if (typeof userId !== "number" || !Number.isInteger(userId)) throw new AppError(400, "INVALID_BODY");
      const resolvedRole: DeptRole = (typeof memberRole === "string" && memberRole in DeptRole)
        ? (memberRole as DeptRole)
        : DeptRole.MEMBER;
      res.status(201).json(await this.service.addMember(deptId, userId, resolvedRole, requesterId, role));
    } catch (err) {
      next(err);
    }
  };

  updateMemberRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: requesterId, role } = requireUser(req);
      const deptId = Number(req.params["deptId"]);
      const userId = Number(req.params["userId"]);
      const { role: newRole } = req.body as { role?: unknown };
      if (typeof newRole !== "string" || !(newRole in DeptRole)) throw new AppError(400, "INVALID_BODY");
      res.json(await this.service.updateMemberRole(deptId, userId, newRole as DeptRole, requesterId, role));
    } catch (err) {
      next(err);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: requesterId, role } = requireUser(req);
      const deptId = Number(req.params["deptId"]);
      const userId = Number(req.params["userId"]);
      await this.service.removeMember(deptId, userId, requesterId, role);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  transferMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: requesterId, role } = requireUser(req);
      const fromDeptId = Number(req.params["deptId"]);
      const userId = Number(req.params["userId"]);
      const { toDeptId, role: toRole } = req.body as { toDeptId?: unknown; role?: unknown };
      if (typeof toDeptId !== "number" || !Number.isInteger(toDeptId)) throw new AppError(400, "INVALID_BODY");
      const resolvedToRole: DeptRole = (typeof toRole === "string" && toRole in DeptRole)
        ? (toRole as DeptRole)
        : DeptRole.MEMBER;
      res.json(await this.service.transferMember(fromDeptId, toDeptId, userId, resolvedToRole, requesterId, role));
    } catch (err) {
      next(err);
    }
  };

  updateHead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: requesterId, role } = requireUser(req);
      const deptId = Number(req.params["deptId"]);
      const { newHeadId } = req.body as { newHeadId?: unknown };
      if (newHeadId !== null && (typeof newHeadId !== "number" || !Number.isInteger(newHeadId))) {
        throw new AppError(400, "INVALID_BODY");
      }
      res.json(await this.service.updateHead(deptId, newHeadId as number | null, requesterId, role));
    } catch (err) {
      next(err);
    }
  };
}
