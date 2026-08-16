import { Request, Response, NextFunction } from "express";
import { requireUser } from "../../lib/authMiddleware";
import { isAdminLike } from "../../lib/permissions";
import type { AccessLogService } from "./access-log.service";
import type { LogAccessDto, AccessLogListQuery } from "./dto/access-log.dto";

export class AccessLogController {
  constructor(private service: AccessLogService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!isAdminLike(user.role) && user.role !== "GM" && user.role !== "FRONT_OFFICE") {
        return res.status(403).json({ error: "FORBIDDEN" });
      }
      res.json(await this.service.list(req.query as AccessLogListQuery));
    } catch (err) { next(err); }
  };

  logAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      await this.service.logAccess(user.id, user.role, req.body as LogAccessDto);
      res.status(201).json({ ok: true });
    } catch (err) { next(err); }
  };
}
