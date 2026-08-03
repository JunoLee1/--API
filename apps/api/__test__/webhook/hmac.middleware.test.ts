import { describe, test, expect, beforeAll } from "@jest/globals";
import * as request from "supertest";
import express from "express";
import { verifyWebhookSignature } from "../../src/webhook/hmac.middleware";
import { errorHandler } from "../../src/middleWare/ErrorHandler";
import * as crypto from "crypto";

function buildApp() {
  const app = express();
  app.post(
    "/webhooks/applications/:source",
    express.raw({ type: "application/json" }),
    verifyWebhookSignature,
    (_req, res) => res.json({ ok: true }),
  );
  app.use(errorHandler);
  return app;
}

function sign(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

beforeAll(() => {
  process.env.SARAMIN_WEBHOOK_SECRET = "saramin-secret";
  process.env.GLASSDOOR_WEBHOOK_SECRET = "glassdoor-secret";
  process.env.INDEED_WEBHOOK_SECRET = "indeed-secret";
  process.env.FACEBOOK_WEBHOOK_SECRET = "facebook-secret";
});

describe("verifyWebhookSignature", () => {
  const app = buildApp();
  const body = JSON.stringify({ job_id: "1", applicant_id: "2", name: "홍", email: "a@b.com" });

  test("유효한 사람인 서명 → 200", async () => {
    const sig = sign("saramin-secret", body);
    const res = await (request as any).default(app)
      .post("/webhooks/applications/saramin")
      .set("Content-Type", "application/json")
      .set("X-Saramin-Signature", sig)
      .send(body);
    expect(res.status).toBe(200);
  });

  test("잘못된 서명 → 401", async () => {
    const res = await (request as any).default(app)
      .post("/webhooks/applications/saramin")
      .set("Content-Type", "application/json")
      .set("X-Saramin-Signature", "wrong")
      .send(body);
    expect(res.status).toBe(401);
  });

  test("서명 헤더 없음 → 401", async () => {
    const res = await (request as any).default(app)
      .post("/webhooks/applications/saramin")
      .set("Content-Type", "application/json")
      .send(body);
    expect(res.status).toBe(401);
  });

  test("유효하지 않은 source → 400", async () => {
    const res = await (request as any).default(app)
      .post("/webhooks/applications/unknown")
      .set("Content-Type", "application/json")
      .send(body);
    expect(res.status).toBe(400);
  });

  test("Facebook X-Hub-Signature-256 sha256= 접두사 → 200", async () => {
    const sig = "sha256=" + sign("facebook-secret", body);
    const res = await (request as any).default(app)
      .post("/webhooks/applications/facebook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", sig)
      .send(body);
    expect(res.status).toBe(200);
  });
});
