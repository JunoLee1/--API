import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { DepartmentService } from "./department.service";

const canManage = (role: string) =>
  isAdminLike(role) || role === "GM";

const canRead = (role: string) =>
  canManage(role) || role === "FRONT_OFFICE";

export class DepartmentController {
  constructor(private service: DepartmentService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canRead(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.list());
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canRead(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.get(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, id: userId } = req.user!;
      const { name, parentId, category } = req.body as { name: string; parentId?: number; category?: string };
      if (typeof name !== "string" || !name.trim()) throw new AppError(400, "NAME_REQUIRED");

      if (!canManage(role)) {
        // 부서장만 자신 부서의 팀(하위 노드) 생성 가능
        if (parentId === undefined) throw new AppError(403, "FORBIDDEN");
        const parent = await this.service.get(parentId);
        if (parent.headId !== userId) throw new AppError(403, "FORBIDDEN");
      }

      res.status(201).json(
        await this.service.create({
          name: name.trim(),
          ...(parentId !== undefined && { parentId }),
          ...(category !== undefined && { category: category as any }),
        })
      );
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, id: userId } = req.user!;
      const data = req.body as { name?: string; isActive?: boolean; parentId?: number | null; category?: import("../generated/enums").DepartmentCategory | null };

      if (!canManage(role)) {
        const dept = await this.service.get(Number(req.params["id"]));
        if (!dept.parentId || dept.parent?.headId !== userId) throw new AppError(403, "FORBIDDEN");
      }

      res.json(await this.service.update(Number(req.params["id"]), data));
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, id: userId } = req.user!;

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
}
