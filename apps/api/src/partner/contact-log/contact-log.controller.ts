import { Request, Response, NextFunction } from "express";
import { requireUser } from "../../lib/authMiddleware";
import type { ContactLogService } from "./contact-log.service";
import type { CreateContactLogDto } from "./dto/contact-log.dto";

export class ContactLogController {
  constructor(private service: ContactLogService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(Number(req.params["partnerId"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      res.status(201).json(
        await this.service.create(Number(req.params["partnerId"]), req.body as CreateContactLogDto, user.id),
      );
    } catch (err) { next(err); }
  };
}
