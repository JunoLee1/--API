# Inbound Application Webhook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /webhooks/applications/:source` 엔드포인트 구현 — 사람인/Glassdoor/Indeed/Facebook 인바운드 지원서를 HMAC 검증 후 JobApplication으로 저장.

**Architecture:** webhook 전용 모듈(`src/webhook/`)을 분리하고, 소스별 어댑터가 payload를 정규화한 뒤 서비스가 upsert한다. `/webhooks` prefix는 `express.raw()`로 마운트해 raw body를 보존(HMAC 검증 필요).

**Tech Stack:** Express, Prisma (PostgreSQL), crypto (Node.js 내장), Jest + supertest

---

## File Map

| 경로 | 역할 |
|------|------|
| `apps/api/prisma/schema.prisma` | `JobPosting.externalJobId` + `ApplicationSource.FACEBOOK` 추가 |
| `apps/api/src/app.ts` | `/webhooks` 라우터 마운트, `express.json()` 범위 `/api`로 축소 |
| `apps/api/src/webhook/adapters/types.ts` | `NormalizedApplication`, `WebhookAdapter` 인터페이스 |
| `apps/api/src/webhook/adapters/saramin.adapter.ts` | 사람인 payload → NormalizedApplication |
| `apps/api/src/webhook/adapters/glassdoor.adapter.ts` | Glassdoor payload 정규화 |
| `apps/api/src/webhook/adapters/indeed.adapter.ts` | Indeed payload 정규화 |
| `apps/api/src/webhook/adapters/facebook.adapter.ts` | Facebook payload 정규화 |
| `apps/api/src/webhook/hmac.middleware.ts` | 소스별 HMAC-SHA256 서명 검증 |
| `apps/api/src/webhook/webhook.service.ts` | JobPosting lookup + JobApplication upsert |
| `apps/api/src/webhook/webhook.controller.ts` | HTTP 핸들러 |
| `apps/api/src/webhook/webhook.routes.ts` | Express 라우터 |
| `apps/api/__test__/webhook/adapters/saramin.adapter.test.ts` | 어댑터 유닛 테스트 |
| `apps/api/__test__/webhook/adapters/glassdoor.adapter.test.ts` | |
| `apps/api/__test__/webhook/adapters/indeed.adapter.test.ts` | |
| `apps/api/__test__/webhook/adapters/facebook.adapter.test.ts` | |
| `apps/api/__test__/webhook/hmac.middleware.test.ts` | HMAC 미들웨어 테스트 |
| `apps/api/__test__/webhook/webhook.service.test.ts` | 서비스 유닛 테스트 |

---

## Task 1: DB 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: schema.prisma 수정 — ApplicationSource에 FACEBOOK 추가**

`apps/api/prisma/schema.prisma`의 `ApplicationSource` enum 찾아서:

```prisma
enum ApplicationSource {
  SARAMIN
  GLASSDOOR
  INDEED
  FACEBOOK
  DIRECT
}
```

- [ ] **Step 2: schema.prisma 수정 — JobPosting에 externalJobId 추가**

`JobPosting` 모델(`model JobPosting {` 찾기, 현재 line ~2103)에서 `updatedAt` 다음 줄에 추가:

```prisma
model JobPosting {
  id            Int              @id @default(autoincrement())
  title         String
  departmentId  Int?
  headcount     Int              @default(1)
  description   String
  status        JobPostingStatus @default(DRAFT)
  externalJobId String?
  createdById   Int
  approvedById  Int?
  approvedAt    DateTime?
  closedAt      DateTime?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  department   Department?      @relation(fields: [departmentId], references: [id])
  createdBy    User             @relation("JobPostingCreator", fields: [createdById], references: [id])
  approvedBy   User?            @relation("JobPostingApprover", fields: [approvedById], references: [id])
  applications JobApplication[]
}
```

- [ ] **Step 3: 마이그레이션 실행**

```bash
cd /Users/juno/work/football/apps/api
npx prisma migrate dev --name add_webhook_externalJobId_and_facebook_source
```

Expected: `Your database is now in sync with your schema.` 출력.

- [ ] **Step 4: Prisma 클라이언트 재생성**

```bash
cd /Users/juno/work/football/apps/api
npm run generate
```

Expected: `Generated Prisma Client` 출력.

- [ ] **Step 5: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add JobPosting.externalJobId and ApplicationSource.FACEBOOK"
```

---

## Task 2: 어댑터 타입 + 소스별 어댑터 구현

**Files:**
- Create: `apps/api/src/webhook/adapters/types.ts`
- Create: `apps/api/src/webhook/adapters/saramin.adapter.ts`
- Create: `apps/api/src/webhook/adapters/glassdoor.adapter.ts`
- Create: `apps/api/src/webhook/adapters/indeed.adapter.ts`
- Create: `apps/api/src/webhook/adapters/facebook.adapter.ts`
- Test: `apps/api/__test__/webhook/adapters/saramin.adapter.test.ts`
- Test: `apps/api/__test__/webhook/adapters/glassdoor.adapter.test.ts`
- Test: `apps/api/__test__/webhook/adapters/indeed.adapter.test.ts`
- Test: `apps/api/__test__/webhook/adapters/facebook.adapter.test.ts`

- [ ] **Step 1: types.ts 작성**

`apps/api/src/webhook/adapters/types.ts`:

```ts
export interface NormalizedApplication {
  externalJobId: string;
  externalApplicantId: string;
  applicantName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
}

export interface WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication;
}
```

- [ ] **Step 2: 테스트 파일 4개 작성 (실패 확인용)**

`apps/api/__test__/webhook/adapters/saramin.adapter.test.ts`:

```ts
import { describe, test, expect } from "@jest/globals";
import { SaraminAdapter } from "../../../src/webhook/adapters/saramin.adapter";

const adapter = new SaraminAdapter();

describe("SaraminAdapter", () => {
  test("정상 payload를 정규화한다", () => {
    const payload = {
      job_id: "saramin-job-1",
      applicant_id: "saramin-app-1",
      name: "홍길동",
      email: "hong@example.com",
      phone: "010-1234-5678",
      resume_url: "https://saramin.co.kr/resume/1",
    };
    expect(adapter.normalize(payload)).toEqual({
      externalJobId: "saramin-job-1",
      externalApplicantId: "saramin-app-1",
      applicantName: "홍길동",
      email: "hong@example.com",
      phone: "010-1234-5678",
      resumeUrl: "https://saramin.co.kr/resume/1",
    });
  });

  test("필수 필드 누락 시 INVALID_PAYLOAD 에러를 던진다", () => {
    expect(() => adapter.normalize({ job_id: "x" })).toThrow("INVALID_PAYLOAD");
  });
});
```

`apps/api/__test__/webhook/adapters/glassdoor.adapter.test.ts`:

```ts
import { describe, test, expect } from "@jest/globals";
import { GlassdoorAdapter } from "../../../src/webhook/adapters/glassdoor.adapter";

const adapter = new GlassdoorAdapter();

describe("GlassdoorAdapter", () => {
  test("정상 payload를 정규화한다", () => {
    const payload = {
      jobId: "gd-job-1",
      applicantId: "gd-app-1",
      fullName: "Hong Gil Dong",
      email: "hong@example.com",
      phoneNumber: "010-1234-5678",
      resumeLink: "https://glassdoor.com/resume/1",
    };
    expect(adapter.normalize(payload)).toEqual({
      externalJobId: "gd-job-1",
      externalApplicantId: "gd-app-1",
      applicantName: "Hong Gil Dong",
      email: "hong@example.com",
      phone: "010-1234-5678",
      resumeUrl: "https://glassdoor.com/resume/1",
    });
  });

  test("필수 필드 누락 시 INVALID_PAYLOAD 에러를 던진다", () => {
    expect(() => adapter.normalize({ jobId: "x" })).toThrow("INVALID_PAYLOAD");
  });
});
```

`apps/api/__test__/webhook/adapters/indeed.adapter.test.ts`:

```ts
import { describe, test, expect } from "@jest/globals";
import { IndeedAdapter } from "../../../src/webhook/adapters/indeed.adapter";

const adapter = new IndeedAdapter();

describe("IndeedAdapter", () => {
  test("정상 payload를 정규화한다", () => {
    const payload = {
      jobKey: "indeed-job-1",
      candidateId: "indeed-cand-1",
      candidate: {
        fullName: "Hong Gil Dong",
        emailAddress: "hong@example.com",
        phoneNumber: "010-1234-5678",
      },
      resumeUrl: "https://indeed.com/resume/1",
    };
    expect(adapter.normalize(payload)).toEqual({
      externalJobId: "indeed-job-1",
      externalApplicantId: "indeed-cand-1",
      applicantName: "Hong Gil Dong",
      email: "hong@example.com",
      phone: "010-1234-5678",
      resumeUrl: "https://indeed.com/resume/1",
    });
  });

  test("필수 필드 누락 시 INVALID_PAYLOAD 에러를 던진다", () => {
    expect(() => adapter.normalize({ jobKey: "x" })).toThrow("INVALID_PAYLOAD");
  });
});
```

`apps/api/__test__/webhook/adapters/facebook.adapter.test.ts`:

```ts
import { describe, test, expect } from "@jest/globals";
import { FacebookAdapter } from "../../../src/webhook/adapters/facebook.adapter";

const adapter = new FacebookAdapter();

describe("FacebookAdapter", () => {
  test("정상 payload를 정규화한다", () => {
    const payload = {
      job_opening_id: "fb-job-1",
      applicant_id: "fb-app-1",
      full_name: "Hong Gil Dong",
      email: "hong@example.com",
      phone_number: "010-1234-5678",
      resume_url: "https://facebook.com/resume/1",
    };
    expect(adapter.normalize(payload)).toEqual({
      externalJobId: "fb-job-1",
      externalApplicantId: "fb-app-1",
      applicantName: "Hong Gil Dong",
      email: "hong@example.com",
      phone: "010-1234-5678",
      resumeUrl: "https://facebook.com/resume/1",
    });
  });

  test("필수 필드 누락 시 INVALID_PAYLOAD 에러를 던진다", () => {
    expect(() => adapter.normalize({ job_opening_id: "x" })).toThrow("INVALID_PAYLOAD");
  });
});
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/webhook/adapters --no-coverage
```

Expected: 4개 파일 모두 FAIL (파일 없음)

- [ ] **Step 4: saramin.adapter.ts 구현**

`apps/api/src/webhook/adapters/saramin.adapter.ts`:

```ts
import { AppError } from "../../lib/appError";
import type { NormalizedApplication, WebhookAdapter } from "./types";

export class SaraminAdapter implements WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication {
    const p = payload as Record<string, unknown>;
    if (!p.job_id || !p.applicant_id || !p.name || !p.email) {
      throw new AppError(400, "INVALID_PAYLOAD");
    }
    return {
      externalJobId: String(p.job_id),
      externalApplicantId: String(p.applicant_id),
      applicantName: String(p.name),
      email: String(p.email),
      ...(p.phone && { phone: String(p.phone) }),
      ...(p.resume_url && { resumeUrl: String(p.resume_url) }),
    };
  }
}
```

- [ ] **Step 5: glassdoor.adapter.ts 구현**

`apps/api/src/webhook/adapters/glassdoor.adapter.ts`:

```ts
import { AppError } from "../../lib/appError";
import type { NormalizedApplication, WebhookAdapter } from "./types";

export class GlassdoorAdapter implements WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication {
    const p = payload as Record<string, unknown>;
    if (!p.jobId || !p.applicantId || !p.fullName || !p.email) {
      throw new AppError(400, "INVALID_PAYLOAD");
    }
    return {
      externalJobId: String(p.jobId),
      externalApplicantId: String(p.applicantId),
      applicantName: String(p.fullName),
      email: String(p.email),
      ...(p.phoneNumber && { phone: String(p.phoneNumber) }),
      ...(p.resumeLink && { resumeUrl: String(p.resumeLink) }),
    };
  }
}
```

- [ ] **Step 6: indeed.adapter.ts 구현**

`apps/api/src/webhook/adapters/indeed.adapter.ts`:

```ts
import { AppError } from "../../lib/appError";
import type { NormalizedApplication, WebhookAdapter } from "./types";

export class IndeedAdapter implements WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication {
    const p = payload as Record<string, unknown>;
    const candidate = p.candidate as Record<string, unknown> | undefined;
    if (!p.jobKey || !p.candidateId || !candidate?.fullName || !candidate?.emailAddress) {
      throw new AppError(400, "INVALID_PAYLOAD");
    }
    return {
      externalJobId: String(p.jobKey),
      externalApplicantId: String(p.candidateId),
      applicantName: String(candidate.fullName),
      email: String(candidate.emailAddress),
      ...(candidate.phoneNumber && { phone: String(candidate.phoneNumber) }),
      ...(p.resumeUrl && { resumeUrl: String(p.resumeUrl) }),
    };
  }
}
```

- [ ] **Step 7: facebook.adapter.ts 구현**

`apps/api/src/webhook/adapters/facebook.adapter.ts`:

```ts
import { AppError } from "../../lib/appError";
import type { NormalizedApplication, WebhookAdapter } from "./types";

export class FacebookAdapter implements WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication {
    const p = payload as Record<string, unknown>;
    if (!p.job_opening_id || !p.applicant_id || !p.full_name || !p.email) {
      throw new AppError(400, "INVALID_PAYLOAD");
    }
    return {
      externalJobId: String(p.job_opening_id),
      externalApplicantId: String(p.applicant_id),
      applicantName: String(p.full_name),
      email: String(p.email),
      ...(p.phone_number && { phone: String(p.phone_number) }),
      ...(p.resume_url && { resumeUrl: String(p.resume_url) }),
    };
  }
}
```

- [ ] **Step 8: 테스트 실행 — 통과 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/webhook/adapters --no-coverage
```

Expected: 8개 테스트 모두 PASS

- [ ] **Step 9: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/webhook/adapters/ apps/api/__test__/webhook/adapters/
git commit -m "feat: add webhook source adapters (saramin, glassdoor, indeed, facebook)"
```

---

## Task 3: HMAC 미들웨어

**Files:**
- Create: `apps/api/src/webhook/hmac.middleware.ts`
- Test: `apps/api/__test__/webhook/hmac.middleware.test.ts`

- [ ] **Step 1: 테스트 작성**

`apps/api/__test__/webhook/hmac.middleware.test.ts`:

```ts
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
    const res = await (request as any)(app)
      .post("/webhooks/applications/saramin")
      .set("Content-Type", "application/json")
      .set("X-Saramin-Signature", sig)
      .send(body);
    expect(res.status).toBe(200);
  });

  test("잘못된 서명 → 401", async () => {
    const res = await (request as any)(app)
      .post("/webhooks/applications/saramin")
      .set("Content-Type", "application/json")
      .set("X-Saramin-Signature", "wrong")
      .send(body);
    expect(res.status).toBe(401);
  });

  test("서명 헤더 없음 → 401", async () => {
    const res = await (request as any)(app)
      .post("/webhooks/applications/saramin")
      .set("Content-Type", "application/json")
      .send(body);
    expect(res.status).toBe(401);
  });

  test("유효하지 않은 source → 400", async () => {
    const res = await (request as any)(app)
      .post("/webhooks/applications/unknown")
      .set("Content-Type", "application/json")
      .send(body);
    expect(res.status).toBe(400);
  });

  test("Facebook X-Hub-Signature-256 sha256= 접두사 → 200", async () => {
    const sig = "sha256=" + sign("facebook-secret", body);
    const res = await (request as any)(app)
      .post("/webhooks/applications/facebook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", sig)
      .send(body);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/webhook/hmac.middleware --no-coverage
```

Expected: FAIL (파일 없음)

- [ ] **Step 3: hmac.middleware.ts 구현**

`apps/api/src/webhook/hmac.middleware.ts`:

```ts
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
  const source = (req.params.source ?? "").toLowerCase();
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
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/webhook/hmac.middleware --no-coverage
```

Expected: 5개 테스트 모두 PASS

- [ ] **Step 5: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/webhook/hmac.middleware.ts apps/api/__test__/webhook/hmac.middleware.test.ts
git commit -m "feat: add HMAC signature verification middleware for webhooks"
```

---

## Task 4: WebhookService

**Files:**
- Create: `apps/api/src/webhook/webhook.service.ts`
- Test: `apps/api/__test__/webhook/webhook.service.test.ts`

- [ ] **Step 1: 테스트 작성**

`apps/api/__test__/webhook/webhook.service.test.ts`:

```ts
import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { WebhookService } from "../../src/webhook/webhook.service";
import { AppError } from "../../src/lib/appError";
import type { NormalizedApplication } from "../../src/webhook/adapters/types";
import type { ApplicationSource } from "../../src/generated/enums";

const mockPrisma = {
  jobPosting: {
    findFirst: jest.fn(),
  },
  jobApplication: {
    upsert: jest.fn(),
  },
} as any;

const service = new WebhookService(mockPrisma);

const normalized: NormalizedApplication = {
  externalJobId: "saramin-job-1",
  externalApplicantId: "saramin-app-1",
  applicantName: "홍길동",
  email: "hong@example.com",
  phone: "010-1234-5678",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("WebhookService.handleInbound", () => {
  test("JobPosting을 찾지 못하면 404를 던진다", async () => {
    (mockPrisma.jobPosting.findFirst as any).mockResolvedValue(null);
    await expect(
      service.handleInbound(normalized, "SARAMIN" as ApplicationSource),
    ).rejects.toThrow(new AppError(404, "JOB_POSTING_NOT_FOUND") as any);
  });

  test("JobPosting을 찾으면 upsert를 호출한다", async () => {
    (mockPrisma.jobPosting.findFirst as any).mockResolvedValue({ id: 5 });
    (mockPrisma.jobApplication.upsert as any).mockResolvedValue({ id: 1 });

    await service.handleInbound(normalized, "SARAMIN" as ApplicationSource);

    expect(mockPrisma.jobApplication.upsert).toHaveBeenCalledWith({
      where: {
        postingId_externalApplicantId: {
          postingId: 5,
          externalApplicantId: "saramin-app-1",
        },
      },
      create: {
        postingId: 5,
        externalApplicantId: "saramin-app-1",
        applicantName: "홍길동",
        email: "hong@example.com",
        phone: "010-1234-5678",
        resumeUrl: undefined,
        source: "SARAMIN",
        status: "APPLIED",
      },
      update: {},
    });
  });

  test("upsert 결과를 반환한다", async () => {
    (mockPrisma.jobPosting.findFirst as any).mockResolvedValue({ id: 5 });
    const mockApp = { id: 99 };
    (mockPrisma.jobApplication.upsert as any).mockResolvedValue(mockApp);

    const result = await service.handleInbound(normalized, "SARAMIN" as ApplicationSource);
    expect(result).toBe(mockApp);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/webhook/webhook.service --no-coverage
```

Expected: FAIL (파일 없음)

- [ ] **Step 3: webhook.service.ts 구현**

`apps/api/src/webhook/webhook.service.ts`:

```ts
import type { PrismaClient } from "../generated/client";
import { AppError } from "../lib/appError";
import type { NormalizedApplication } from "./adapters/types";
import type { ApplicationSource } from "../generated/enums";

export class WebhookService {
  constructor(private prisma: PrismaClient) {}

  async handleInbound(data: NormalizedApplication, source: ApplicationSource) {
    const posting = await this.prisma.jobPosting.findFirst({
      where: { externalJobId: data.externalJobId },
      select: { id: true },
    });
    if (!posting) throw new AppError(404, "JOB_POSTING_NOT_FOUND");

    return this.prisma.jobApplication.upsert({
      where: {
        postingId_externalApplicantId: {
          postingId: posting.id,
          externalApplicantId: data.externalApplicantId,
        },
      },
      create: {
        postingId: posting.id,
        externalApplicantId: data.externalApplicantId,
        applicantName: data.applicantName,
        email: data.email,
        phone: data.phone,
        resumeUrl: data.resumeUrl,
        source,
        status: "APPLIED",
      },
      update: {},
    });
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/webhook/webhook.service --no-coverage
```

Expected: 3개 테스트 모두 PASS

- [ ] **Step 5: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/webhook/webhook.service.ts apps/api/__test__/webhook/webhook.service.test.ts
git commit -m "feat: add WebhookService for inbound application upsert"
```

---

## Task 5: 컨트롤러 + 라우터 + app.ts 마운트

**Files:**
- Create: `apps/api/src/webhook/webhook.controller.ts`
- Create: `apps/api/src/webhook/webhook.routes.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: webhook.controller.ts 작성**

`apps/api/src/webhook/webhook.controller.ts`:

```ts
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
      const key = (req.params.source ?? "").toLowerCase();
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
```

- [ ] **Step 2: webhook.routes.ts 작성**

`apps/api/src/webhook/webhook.routes.ts`:

```ts
import { Router } from "express";
import { WebhookController } from "./webhook.controller";
import { WebhookService } from "./webhook.service";
import { verifyWebhookSignature } from "./hmac.middleware";
import { getPrisma } from "../lib/prisma";

const router = Router();
const service = new WebhookService(getPrisma());
const controller = new WebhookController(service);

router.post("/applications/:source", verifyWebhookSignature, controller.handleApplication);

export default router;
```

- [ ] **Step 3: app.ts 수정**

`apps/api/src/app.ts`를 다음과 같이 변경 — `/webhooks`를 `express.json()` 이전에 마운트하고, `express.json()`을 `/api`로 범위 축소:

```ts
import express  = require("express")
import cookieParser = require("cookie-parser")
import APIRouter from "./apiRouter"
import cors  = require("cors")
import * as dotenv from "dotenv";
import { errorHandler } from "./middleWare/ErrorHandler";
import webhookRouter from "./webhook/webhook.routes";

dotenv.config()
const PORT = process.env.PORT || '5000';
const app = express()
app.use(cookieParser())
app.use(
    cors({
        origin: PORT ?? "http://localhost:5175",
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        credentials: true
    })
)
app.use("/webhooks", express.raw({ type: "application/json" }), webhookRouter)
app.use("/api", express.json(), APIRouter)
app.use(errorHandler);

export default app
```

- [ ] **Step 4: TypeScript 빌드 확인**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 5: 전체 테스트 실행**

```bash
cd /Users/juno/work/football/apps/api
npx jest --no-coverage
```

Expected: 기존 테스트 포함 모두 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/webhook/ apps/api/src/app.ts
git commit -m "feat: wire up webhook router for inbound application endpoint"
```

---

## 완료 체크리스트

- [ ] `GET /api` 기존 테스트 통과 확인 (app.ts 변경 영향 없음)
- [ ] `POST /webhooks/applications/saramin` — 유효한 서명 + payload → `{ received: true, id: N }` 반환
- [ ] `POST /webhooks/applications/unknown` → 400
- [ ] 서명 오류 → 401
- [ ] 존재하지 않는 `externalJobId` → 404
- [ ] 동일 `externalApplicantId` 재전송 → 200 (중복 생성 없음)
