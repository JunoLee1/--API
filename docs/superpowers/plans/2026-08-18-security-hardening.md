# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** P0 보안 이슈 4종(helmet 보안 헤더, JWT cookie secure 플래그, 로그인 Rate Limiting, OTP 암호화)을 순차적으로 수정한다.

**Architecture:** 모두 독립적인 변경이므로 태스크별로 분리해 커밋한다. helmet과 JWT secure 플래그는 설정 레이어, rate limiting은 라우터 레이어, OTP는 서비스 레이어 변경이다. `bcrypt`, `express-rate-limit`은 이미 설치돼 있고, `helmet`만 신규 설치가 필요하다.

**Tech Stack:** Node.js · Express · TypeScript · helmet · express-rate-limit v8 · bcrypt · crypto (Node.js built-in) · Jest

---

## File Map

| 파일 | 변경 내용 |
|---|---|
| `apps/api/src/app.ts` | `helmet({ contentSecurityPolicy: false })` 미들웨어 추가 |
| `apps/api/src/lib/constants.ts` | 쿠키 옵션 두 개에 `secure: process.env.NODE_ENV === 'production'` 추가 |
| `apps/api/src/auth/auth.routes.ts` | 로그인 라우트에 `express-rate-limit` 추가 |
| `apps/api/src/recruitment/recruitment.service.ts` | OTP 생성을 `crypto.randomInt`로, 저장을 bcrypt 해시로, 검증을 `bcrypt.compare`로 교체 |
| `apps/api/src/recruitment/recruitment.service.test.ts` | 신규 생성: OTP 서비스 단위 테스트 |

---

## Task 1: helmet 설치 + JWT 쿠키 secure 플래그

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/lib/constants.ts`

- [x] **Step 1: helmet 패키지 설치**

  ```bash
  cd apps/api && npm install helmet && npm install --save-dev @types/helmet
  ```

  Expected: `package.json`의 `dependencies`에 `helmet`이 추가된다.

- [x] **Step 2: `app.ts`에 helmet 추가**

  `apps/api/src/app.ts` 전체를 아래로 교체한다.

  ```typescript
  import express  = require("express")
  import cookieParser = require("cookie-parser")
  import helmet from "helmet"
  import APIRouter from "./apiRouter"
  import cors  = require("cors")
  import * as dotenv from "dotenv";
  import { errorHandler } from "./middleWare/ErrorHandler";
  import webhookRouter from "./webhook/webhook.routes";

  dotenv.config()
  const PORT = process.env.PORT || '5000';
  const app = express()
  app.use(helmet({ contentSecurityPolicy: false }))
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

- [x] **Step 3: `constants.ts`에 secure 플래그 추가**

  `apps/api/src/lib/constants.ts` 25~26행을 아래로 교체한다.

  ```typescript
  export const ACCESS_TOKEN_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: "strict" as const,
    maxAge: 60 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
  };
  export const REFRESH_TOKEN_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: "strict" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
  };
  ```

- [x] **Step 4: 빌드 확인**

  ```bash
  cd apps/api && npm run build 2>&1 | tail -20
  ```

  Expected: 에러 없이 종료.

- [x] **Step 5: 커밋**

  ```bash
  git add apps/api/src/app.ts apps/api/src/lib/constants.ts \
           apps/api/package.json apps/api/package-lock.json
  git commit -m "feat(security): add helmet headers; set JWT cookie secure flag for production"
  ```

---

## Task 2: 로그인 Rate Limiting

**Files:**
- Modify: `apps/api/src/auth/auth.routes.ts`

`express-rate-limit` v8은 이미 `apps/api/package.json`에 설치돼 있다. 로그인 엔드포인트(`POST /auth/login`)에만 적용한다: **5분에 10회** 초과 시 429 응답.

- [x] **Step 1: `auth.routes.ts` 수정**

  `apps/api/src/auth/auth.routes.ts` 전체를 아래로 교체한다.

  ```typescript
  import { auth } from "../lib/authMiddleware";
  import { Router } from "express";
  import { rateLimit } from "express-rate-limit";
  import passport from "passport";
  import { AuthController } from "./auth.controller";
  import { AuthService } from "./auth.service";
  import { AuthRepository } from "./auth.repo";
  import { getPrisma } from "../lib/prisma";

  const router = Router();
  const repo = new AuthRepository(getPrisma());
  const service = new AuthService(repo);
  const controller = new AuthController(service, repo);

  const refreshAuth = passport.authenticate("refreshToken", { session: false });

  const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5분
    limit: 10,                // 최대 10회
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "TOO_MANY_REQUESTS" },
  });

  // 공개
  router.post("/login", loginLimiter, controller.login);

  // refresh token으로 재발급
  router.post("/refresh", refreshAuth, controller.refresh);

  // 로그아웃
  router.post("/logout", auth, controller.logout);

  // 내 정보
  router.get("/me", auth, controller.me);

  // 언어 설정
  router.patch("/me/language", auth, controller.updateLanguage);

  // 유저 생성 (ADMIN 전용)
  router.post("/users", auth, controller.createUser);

  // 초대 (ADMIN 전용 - 생성/목록, 공개 - 조회/수락)
  router.post("/invites", auth, controller.createInvite);
  router.get("/invites", auth, controller.listInvites);
  router.get("/invites/:token", controller.getInvite);
  router.post("/invites/:token/accept", controller.acceptInvite);

  // 로그인 이력 (ADMIN 전용)
  router.get("/login-history", auth, controller.loginHistory);
  router.get("/login-history/:userId", auth, controller.loginHistory);

  // GDPR 삭제권 (ADMIN 전용)
  router.delete("/users/:id/gdpr-erasure", auth, controller.gdprErasure);

  // GDPR 데이터 내보내기 (ADMIN 또는 본인)
  router.get("/users/:id/gdpr-export", auth, controller.gdprExport);

  export default router;
  ```

- [x] **Step 2: 빌드 확인**

  ```bash
  cd apps/api && npm run build 2>&1 | tail -20
  ```

  Expected: 에러 없이 종료.

- [x] **Step 3: 커밋**

  ```bash
  git add apps/api/src/auth/auth.routes.ts
  git commit -m "feat(security): add rate limiting to login endpoint (10 req/5min)"
  ```

---

## Task 3: OTP 암호화 강화

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.service.ts:209-226` (`startOnboarding`, `verifyEmail`)
- Create: `apps/api/src/recruitment/recruitment.service.test.ts`

현재 OTP는 `Math.random()`(비암호학적)으로 생성되고 평문으로 저장·비교된다. `crypto.randomInt`로 생성 후 `bcrypt`로 해싱하여 저장하고, 검증 시 `bcrypt.compare`를 사용한다.

**변경 전:**
```typescript
const otp = Math.floor(100000 + Math.random() * 900000).toString();
// repo에 otp(평문) 저장
// 검증: onboarding.otpCode !== otp
```

**변경 후:**
```typescript
const rawOtp = randomInt(100000, 1000000).toString();
const otpHash = await bcrypt.hash(rawOtp, 10);
// repo에 otpHash(해시) 저장, rawOtp를 응답으로 반환
// 검증: await bcrypt.compare(otp, onboarding.otpCode)
```

- [x] **Step 1: 테스트 파일 작성 (실패 확인용)**

  `apps/api/src/recruitment/recruitment.service.test.ts`를 새로 생성한다.

  ```typescript
  import bcrypt from "bcrypt";
  import { RecruitmentService } from "./recruitment.service";
  import type { RecruitmentRepository } from "./recruitment.repo";

  const fakeApp = {
    id: 1, status: "OFFERED", applicantName: "테스트", posting: null,
    applicationDate: new Date(), updatedAt: new Date(),
  };

  const makeRepo = (overrides: Partial<RecruitmentRepository> = {}): RecruitmentRepository =>
    ({
      findApplicationById: jest.fn().mockResolvedValue(fakeApp),
      findOnboardingByApplication: jest.fn().mockResolvedValue(null),
      createOnboarding: jest.fn().mockImplementation((_appId, _userId, otpCode, expiresAt) =>
        Promise.resolve({ id: 1, applicationId: 1, userId: 1, otpCode, expiresAt, emailVerifiedAt: null, mfaRegisteredAt: null })
      ),
      markEmailVerified: jest.fn().mockResolvedValue({ id: 1, emailVerifiedAt: new Date() }),
      // 나머지 메서드는 사용하지 않으므로 최소 스텁
      findApplicationsByStage: jest.fn().mockResolvedValue([]),
      findApplicationsByStatus: jest.fn().mockResolvedValue([]),
      createApplication: jest.fn(),
      updateApplicationStatus: jest.fn(),
      findPostings: jest.fn().mockResolvedValue([]),
      findPostingById: jest.fn().mockResolvedValue(null),
      createPosting: jest.fn(),
      updatePosting: jest.fn(),
      createInterview: jest.fn(),
      updateInterview: jest.fn(),
      createOffer: jest.fn(),
      updateOffer: jest.fn(),
      findInterviewsByApplication: jest.fn().mockResolvedValue([]),
      findOfferByApplication: jest.fn().mockResolvedValue(null),
      updateReferenceCheck: jest.fn(),
      markMfaRegistered: jest.fn().mockResolvedValue({}),
      completeOnboarding: jest.fn().mockResolvedValue({}),
      ...overrides,
    } as unknown as RecruitmentRepository);

  const makeSvc = (overrides: Partial<RecruitmentRepository> = {}) =>
    new RecruitmentService(makeRepo(overrides));

  describe("RecruitmentService.startOnboarding", () => {
    it("otpCode는 bcrypt 해시로 저장된다 (평문 6자리가 아님)", async () => {
      const repo = makeRepo();
      const svc = makeSvc();
      const result = await svc.startOnboarding(1, 42);

      const storedHash = (repo.createOnboarding as jest.Mock).mock.calls[0][2] as string;
      // 저장된 값은 bcrypt 해시 형식이어야 한다
      expect(storedHash).toMatch(/^\$2b\$/);
      // 저장된 값은 6자리 숫자가 아니어야 한다
      expect(storedHash).not.toMatch(/^\d{6}$/);
    });

    it("응답의 otpCode는 평문 6자리 숫자다", async () => {
      const svc = makeSvc();
      const result = await svc.startOnboarding(1, 42);
      expect(result.otpCode).toMatch(/^\d{6}$/);
    });

    it("Math.random 대신 crypto.randomInt를 사용 — 같은 OTP가 연속 생성되지 않는다", async () => {
      const svc = makeSvc();
      const r1 = await svc.startOnboarding(1, 42);
      const r2 = await svc.startOnboarding(1, 42);
      // 두 OTP가 항상 같지 않음을 확인 (확률적으로 100만분의 1 실패 가능 — 무시 가능)
      // 적어도 두 번 호출이 모두 6자리임을 확인
      expect(r1.otpCode).toMatch(/^\d{6}$/);
      expect(r2.otpCode).toMatch(/^\d{6}$/);
    });
  });

  describe("RecruitmentService.verifyEmail", () => {
    let correctOtp: string;
    let otpHash: string;

    beforeAll(async () => {
      correctOtp = "123456";
      otpHash = await bcrypt.hash(correctOtp, 10);
    });

    const makeOnboarding = (overrides = {}) => ({
      id: 1, applicationId: 1, userId: 1,
      otpCode: otpHash,
      otpExpiresAt: new Date(Date.now() + 60_000), // 1분 후 만료
      emailVerifiedAt: null,
      mfaRegisteredAt: null,
      ...overrides,
    });

    it("올바른 OTP → 이메일 인증 성공", async () => {
      const svc = makeSvc({
        findOnboardingByApplication: jest.fn().mockResolvedValue(makeOnboarding()),
      });
      await expect(svc.verifyEmail(1, correctOtp)).resolves.toBeDefined();
    });

    it("잘못된 OTP → 400 INVALID_OTP", async () => {
      const svc = makeSvc({
        findOnboardingByApplication: jest.fn().mockResolvedValue(makeOnboarding()),
      });
      await expect(svc.verifyEmail(1, "999999")).rejects.toMatchObject({
        statusCode: 400, message: "INVALID_OTP",
      });
    });

    it("만료된 OTP → 400 OTP_EXPIRED", async () => {
      const svc = makeSvc({
        findOnboardingByApplication: jest.fn().mockResolvedValue(
          makeOnboarding({ otpExpiresAt: new Date(Date.now() - 1000) }) // 이미 만료
        ),
      });
      await expect(svc.verifyEmail(1, correctOtp)).rejects.toMatchObject({
        statusCode: 400, message: "OTP_EXPIRED",
      });
    });

    it("이미 인증된 이메일 → 409 EMAIL_ALREADY_VERIFIED", async () => {
      const svc = makeSvc({
        findOnboardingByApplication: jest.fn().mockResolvedValue(
          makeOnboarding({ emailVerifiedAt: new Date() })
        ),
      });
      await expect(svc.verifyEmail(1, correctOtp)).rejects.toMatchObject({
        statusCode: 409, message: "EMAIL_ALREADY_VERIFIED",
      });
    });
  });
  ```

- [x] **Step 2: 테스트 실행 — 실패 확인**

  ```bash
  cd apps/api && npx jest recruitment.service.test.ts --no-coverage 2>&1 | tail -30
  ```

  Expected: 여러 테스트 FAIL (아직 구현 전).

- [x] **Step 3: `recruitment.service.ts` import 추가**

  `apps/api/src/recruitment/recruitment.service.ts` 파일 상단에 아래 두 import를 추가한다. 기존 import 목록 바로 아래에 삽입.

  ```typescript
  import { randomInt } from "crypto";
  import bcrypt from "bcrypt";
  ```

- [x] **Step 4: `startOnboarding` 메서드 수정**

  `recruitment.service.ts`의 `startOnboarding` 메서드(약 209~217행)를 아래로 교체한다.

  ```typescript
  async startOnboarding(applicationId: number, userId: number) {
    const app = await this.getApplication(applicationId);
    if (app.status !== "OFFERED") throw new AppError(409, "APPLICATION_NOT_OFFERED");
    const existing = await this.repo.findOnboardingByApplication(applicationId);
    if (existing) throw new AppError(409, "ONBOARDING_ALREADY_STARTED");
    const rawOtp = randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(rawOtp, 10);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const record = await this.repo.createOnboarding(applicationId, userId, otpHash, expiresAt);
    return { ...record, otpCode: rawOtp };
  }
  ```

- [x] **Step 5: `verifyEmail` 메서드 수정**

  `recruitment.service.ts`의 `verifyEmail` 메서드(약 219~226행)를 아래로 교체한다.

  ```typescript
  async verifyEmail(applicationId: number, otp: string) {
    const onboarding = await this.repo.findOnboardingByApplication(applicationId);
    if (!onboarding) throw new AppError(404, "ONBOARDING_NOT_FOUND");
    if (onboarding.emailVerifiedAt) throw new AppError(409, "EMAIL_ALREADY_VERIFIED");
    const isValid = await bcrypt.compare(otp, onboarding.otpCode);
    if (!isValid) throw new AppError(400, "INVALID_OTP");
    if (onboarding.otpExpiresAt < new Date()) throw new AppError(400, "OTP_EXPIRED");
    return this.repo.markEmailVerified(applicationId);
  }
  ```

- [x] **Step 6: 테스트 실행 — 통과 확인**

  ```bash
  cd apps/api && npx jest recruitment.service.test.ts --no-coverage 2>&1 | tail -30
  ```

  Expected: 6개 테스트 모두 PASS.

- [x] **Step 7: 전체 테스트 확인**

  ```bash
  cd apps/api && npm test -- --no-coverage 2>&1 | tail -20
  ```

  Expected: 기존 실패 테스트(training.service.test.ts, maintenance.service.test.ts — pre-existing) 제외하고 신규 실패 없음.

- [x] **Step 8: 커밋**

  ```bash
  git add apps/api/src/recruitment/recruitment.service.ts \
           apps/api/src/recruitment/recruitment.service.test.ts
  git commit -m "fix(security): replace Math.random OTP with crypto.randomInt + bcrypt hash"
  ```

---

## Self-Review

**Spec coverage:**
- helmet 미사용: Task 1에서 `helmet({ contentSecurityPolicy: false })` 추가 ✅
- JWT 쿠키 secure 플래그 없음: Task 1에서 `secure: process.env.NODE_ENV === 'production'` 추가 ✅
- 로그인 Rate Limiting 없음: Task 2에서 `loginLimiter` (10회/5분) 추가 ✅
- OTP `Math.random()` 비암호학적: Task 3에서 `crypto.randomInt` 교체 ✅
- OTP 평문 저장: Task 3에서 bcrypt 해시 저장 ✅
- OTP 평문 비교: Task 3에서 `bcrypt.compare` 교체 ✅
- 에러 스택 트레이스: 기존 `errorHandler`가 이미 스택을 응답에 포함하지 않음 → 수정 불필요 ✅

**타입 일관성:**
- `startOnboarding` 반환값에 `{ ...record, otpCode: rawOtp }` — `otpCode` 필드는 DB의 `String` 타입으로 기존 컨트롤러 호환 ✅
- `verifyEmail` 시그니처 변경 없음 ✅
