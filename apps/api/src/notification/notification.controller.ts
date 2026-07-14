import { Request, Response, NextFunction } from "express";
import { NotificationService } from "./notification.service";

export class NotificationController {
  constructor(private service: NotificationService) {}

  getMy = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getMyNotifications(req.user!.id));
    } catch (err) { next(err); }
  };

  markRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.markRead(Number(req.params["id"]), req.user!.id));
    } catch (err) { next(err); }
  };

  getPartners = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getPartnerAlerts());
    } catch (err) { next(err); }
  };
}
