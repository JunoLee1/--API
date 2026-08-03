import { Request, Response, NextFunction } from "express";
import * as crypto from "crypto";
import { AppError } from "../lib/appError";

const SOURCE_CONFIG: Record<string, { envVar: string; header: string; prefix?: string }> = {
  saramin:   { envVar: "SARAMIN_WEBHOOK_SECRET",   header: "x-saramin-signature" },
  glassdoor: { envVar: "GLASSDOOR_WEBHOOK_SECRET", header: "x-glassdoor-signature" },
  indeed:    { envVar: "INDEED_WEBHOOK_SECRET",    header: "x-indeed-signature" },
  facebook:  { envVar: "FACEBOOK_WEBHOOK_SECRET",  header: "x-hub-signature-256", prefix: "sha256=" },
};

export function verifyWebhookSignature(req: Request, _res: Response, next: NextFunction) {
  const source = String(req.params.source ?? "").toLowerCase();
  const config = SOURCE_CONFIG[source];

  if (!config) return next(new AppError(400, "INVALID_SOURCE"));

  const secret = process.env[config.envVar];
  if (!secret) {
    console.error(`[webhook] Missing env var: ${config.envVar}`);
    return next(new AppError(500, "WEBHOOK_SECRET_NOT_CONFIGURED"));
  }

  const rawBody = req.body as Buffer;
  const header = req.headers[config.header] as string | undefined;
  if (!header) return next(new AppError(401, "INVALID_SIGNATURE"));

  const sigHex = config.prefix && header.startsWith(config.prefix)
    ? header.slice(config.prefix.length)
    : header;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const sigBuf = Buffer.from(sigHex, "hex");
    if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
      return next(new AppError(401, "INVALID_SIGNATURE"));
    }
  } catch {
    return next(new AppError(401, "INVALID_SIGNATURE"));
  }

  next();
}
