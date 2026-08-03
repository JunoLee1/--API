import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { WebhookService } from "./webhook.service";
import { SaraminAdapter } from "./adapters/saramin.adapter";
import { GlassdoorAdapter } from "./adapters/glassdoor.adapter";
import { IndeedAdapter } from "./adapters/indeed.adapter";
import { FacebookAdapter } from "./adapters/facebook.adapter";
import type { WebhookAdapter } from "./adapters/types";
import type { ApplicationSource } from "../generated/enums";

const ADAPTERS: Record<string, { adapter: WebhookAdapter; source: ApplicationSource }> = {
  saramin:   { adapter: new SaraminAdapter(),   source: "SARAMIN" },
  glassdoor: { adapter: new GlassdoorAdapter(), source: "GLASSDOOR" },
  indeed:    { adapter: new IndeedAdapter(),     source: "INDEED" },
  facebook:  { adapter: new FacebookAdapter(),  source: "FACEBOOK" },
};

export class WebhookController {
  constructor(private service: WebhookService) {}

  handleApplication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = String(req.params.source ?? "").toLowerCase();
      const entry = ADAPTERS[key];
      if (!entry) throw new AppError(400, "INVALID_SOURCE");

      const payload = JSON.parse((req.body as Buffer).toString("utf-8")) as unknown;
      const normalized = entry.adapter.normalize(payload);
      const result = await this.service.handleInbound(normalized, entry.source);
      res.status(200).json({ received: true, id: result.id });
    } catch (err) {
      next(err);
    }
  };
}
