# Interview Threshold Policy + HOLD/WAITLIST (Fix #366) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Issue:** [#366](https://github.com/JunoLee1/--API/issues/366)

**Goal:** Interview 최종 result 확정 시 점수 threshold 정책 강제 + `HOLD` (재검토) + `WAITLIST` (offer 대기, 우선순위 점수 기반 자동 promote) 라이프사이클 추가.

**Architecture:**
- `ClubSettings.interviewPassThreshold Int @default(3)` — 각 카테고리 최소 threshold
- `InterviewResult` enum 확장: `PENDING | PASS | FAIL | HOLD | WAITLIST`
- `updateInterview` 에서 PASS 결정 시 세 카테고리 모두 threshold 이상 검증. 미달 시 `overrideThreshold=true + overrideReason` 요구
- `WAITLIST` (Interview.result 레벨) 우선순위 = `scoreSkill + scoreComm + scoreCulture` desc
- 자동 promote hook: `rejectApplication` 이 OFFERED → REJECTED 로 전환 시, 같은 posting waitlist top 자동 offer
- 시즌 마감 hook: `closeSeason` 종료 시 남은 WAITLIST 자동 FAIL + 이메일 통보
- 신규 endpoint: `GET /recruitment/postings/:id/waitlist`, `POST /recruitment/applications/:id/promote-from-waitlist`
- Email template 확장 (`sendApplicationStatusEmail` 에 `WAITLIST` case)

**Tech Stack:** TypeScript · Prisma · Jest · Express (`apps/api`)

**Dependency:** 없음. Main `2caf659d` (post-#364) base.

**⚠️ Flowchart 확장 사항 (PR 본문 명시)**:
- 원 flowchart 는 happy path (H → I → J → K...). HOLD/WAITLIST 는 edge case (헤드카운트 초과 지원자 대기, 심사 유보) 확장

**Out of scope:**
- FE 상태 badge (별도 이슈)
- posting-level threshold (option c — ClubSettings 만)
- 평균 threshold (option a2 — 각 카테고리 min 만)
- HOLD 만료 정책

---

## File Structure

**Modify:**
- `apps/api/prisma/schema.prisma` — `InterviewResult` enum + `ClubSettings.interviewPassThreshold` 필드
- `apps/api/src/recruitment/dto/recruitment.dto.ts` — `UpdateInterviewDto` 확장 (`overrideThreshold`, `overrideReason`)
- `apps/api/src/recruitment/recruitment.service.ts` — `updateInterview` threshold 검증 + `promoteFromWaitlist` + `getWaitlistForPosting` + `expirePostingWaitlist` 신규 + `rejectApplication` 확장 (waitlist auto-promote hook)
- `apps/api/src/recruitment/recruitment.repo.ts` — `findWaitlistedInterviews`, `getClubSettings` 관련 헬퍼
- `apps/api/src/recruitment/recruitment.controller.ts` — 2 신규 handler
- `apps/api/src/recruitment/recruitment.routes.ts` — 2 신규 route
- `apps/api/src/season/season.service.ts:50-69` — `closeSeason` 에 `expireWaitlistOnSeasonClose` hook 추가
- `apps/api/src/lib/email.ts` — `sendApplicationStatusEmail` 에 `WAITLIST` case
- `apps/api/src/recruitment/recruitment.service.test.ts` — 신규 테스트 (~12개)
- `apps/api/__test__/season/season.service.test.ts` (or 신규 파일) — closeSeason hook 테스트

**Create:**
- `apps/api/prisma/migrations/{timestamp}_interview_threshold_waitlist/migration.sql`

**No changes:**
- FE — 별도 이슈

---

## Task 1: Schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration folder

- [ ] **Step 1: `InterviewResult` enum 확장**

`apps/api/prisma/schema.prisma:2849-2853`:

```prisma
// 변경 전
enum InterviewResult {
  PENDING
  PASS
  FAIL
}

// 변경 후
enum InterviewResult {
  PENDING
  PASS
  FAIL
  HOLD
  WAITLIST
}
```

- [ ] **Step 2: `ClubSettings` 에 `interviewPassThreshold` 필드 추가**

`apps/api/prisma/schema.prisma` (ClubSettings 모델, ~line 2493-2502):

```prisma
model ClubSettings {
  id                       Int    @id @default(1)
  currency                 String @default("KRW")
  ibiBeta                  Float  @default(1.0)
  planApprovalLimit        Int    @default(10000000)
  maintenanceCostLimit     Int    @default(1000000)
  complimentaryTicketLimit Int    @default(10)
  reviewerDeptMap          Json?
  autoSurveyTopN           Int?   @default(3)
  interviewPassThreshold   Int    @default(3)   // ← 신규 (각 카테고리 최소 점수)
}
```

- [ ] **Step 3: Schema 형식 확인 + validate**

```bash
cd apps/api && pnpm prisma format && pnpm prisma validate
```

Expected: "The schema is valid."

- [ ] **Step 4: Migration 생성**

```bash
cd apps/api && pnpm prisma migrate dev --name interview_threshold_waitlist --create-only
```

Expected content:
```sql
-- AlterEnum
ALTER TYPE "InterviewResult" ADD VALUE 'HOLD';
ALTER TYPE "InterviewResult" ADD VALUE 'WAITLIST';

-- AlterTable
ALTER TABLE "ClubSettings" ADD COLUMN "interviewPassThreshold" INTEGER NOT NULL DEFAULT 3;
```

만약 예상 외 변경 포함 시 **중단**.

- [ ] **Step 5: Migration 적용**

```bash
cd apps/api && pnpm prisma migrate deploy
```

Dev DB drift 시 수동 처리 (`db execute` + `migrate resolve --applied`).

---

## Task 2: Failing tests

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.service.test.ts`

- [ ] **Step 1: `updateInterview` threshold 검증 테스트 추가 (기존 describe 확장)**

`describe("RecruitmentService.updateInterview", ...)` (기존 존재) 에 추가:

```typescript
  const makeInterviewWithSettings = (interviewOverride: any = {}, settings: any = { interviewPassThreshold: 3 }) => {
    const repo = makeRepo({
      findInterview: jest.fn().mockResolvedValue({
        id: 100, applicationId: 1, round: "ROUND_1",
        scoreSkill: null, scoreComm: null, scoreCulture: null,
        result: "PENDING",
        ...interviewOverride,
      }),
      getClubSettings: jest.fn().mockResolvedValue(settings),
      updateInterview: jest.fn().mockResolvedValue({}),
    });
    return { svc: new RecruitmentService(repo), repo };
  };

  it("PASS 결정 시 세 점수 모두 threshold >= 3 이면 성공", async () => {
    const { svc, repo } = makeInterviewWithSettings();
    await svc.updateInterview(1, "ROUND_1" as any, { result: "PASS", scoreSkill: 3, scoreComm: 4, scoreCulture: 5 });
    expect(repo.updateInterview).toHaveBeenCalled();
  });

  it("PASS 결정 시 threshold 미달 (score < 3) → 400 INTERVIEW_SCORE_BELOW_THRESHOLD", async () => {
    const { svc } = makeInterviewWithSettings();
    await expect(
      svc.updateInterview(1, "ROUND_1" as any, { result: "PASS", scoreSkill: 2, scoreComm: 4, scoreCulture: 5 })
    ).rejects.toMatchObject({ statusCode: 400, message: "INTERVIEW_SCORE_BELOW_THRESHOLD" });
  });

  it("PASS + threshold 미달 + overrideThreshold=true + overrideReason → 성공 + audit log", async () => {
    const { svc, repo } = makeInterviewWithSettings();
    await svc.updateInterview(1, "ROUND_1" as any, {
      result: "PASS", scoreSkill: 2, scoreComm: 4, scoreCulture: 5,
      overrideThreshold: true, overrideReason: "특별 상황",
    } as any);
    expect(repo.updateInterview).toHaveBeenCalled();
    // audit log 는 별도 mock 필요 - 여기서는 호출 여부만 확인 (내부 audit call 됐다면 no error)
  });

  it("PASS + threshold 미달 + overrideThreshold=true + overrideReason 없음 → 400 OVERRIDE_REASON_REQUIRED", async () => {
    const { svc } = makeInterviewWithSettings();
    await expect(
      svc.updateInterview(1, "ROUND_1" as any, {
        result: "PASS", scoreSkill: 2, scoreComm: 4, scoreCulture: 5,
        overrideThreshold: true,
      } as any)
    ).rejects.toMatchObject({ statusCode: 400, message: "OVERRIDE_REASON_REQUIRED" });
  });

  it("HOLD 결정은 threshold 검증 skip (자유롭게 세팅)", async () => {
    const { svc, repo } = makeInterviewWithSettings();
    await svc.updateInterview(1, "ROUND_1" as any, { result: "HOLD", scoreSkill: 2, scoreComm: 2, scoreCulture: 2 });
    expect(repo.updateInterview).toHaveBeenCalled();
  });

  it("WAITLIST 결정도 threshold 검증 skip", async () => {
    const { svc, repo } = makeInterviewWithSettings();
    await svc.updateInterview(1, "ROUND_1" as any, { result: "WAITLIST", scoreSkill: 3, scoreComm: 3, scoreCulture: 3 });
    expect(repo.updateInterview).toHaveBeenCalled();
  });

  it("FAIL 은 항상 threshold 검증 skip", async () => {
    const { svc, repo } = makeInterviewWithSettings();
    await svc.updateInterview(1, "ROUND_1" as any, { result: "FAIL", scoreSkill: 1, scoreComm: 1, scoreCulture: 1 });
    expect(repo.updateInterview).toHaveBeenCalled();
  });
```

- [ ] **Step 2: `getWaitlistForPosting` + `promoteFromWaitlist` + auto-promote hook 테스트 신규 describe**

```typescript
describe("RecruitmentService.getWaitlistForPosting", () => {
  it("WAITLIST result 인 Interview 들을 score 총합 desc 로 정렬", async () => {
    const repo = makeRepo({
      findWaitlistedInterviews: jest.fn().mockResolvedValue([
        { id: 1, applicationId: 10, scoreSkill: 4, scoreComm: 4, scoreCulture: 4, application: { id: 10, applicantName: "A" } }, // 12
        { id: 2, applicationId: 20, scoreSkill: 5, scoreComm: 5, scoreCulture: 5, application: { id: 20, applicantName: "B" } }, // 15
      ]),
    });
    const svc = new RecruitmentService(repo);
    const result = await svc.getWaitlistForPosting(100);
    // sort desc by sum
    expect(result[0].applicationId).toBe(20); // 15 first
    expect(result[1].applicationId).toBe(10); // 12 second
  });
});

describe("RecruitmentService.promoteFromWaitlist", () => {
  it("WAITLIST top candidate 을 offer 로 promote", async () => {
    const repo = makeRepo({
      findWaitlistedInterviews: jest.fn().mockResolvedValue([
        { id: 1, applicationId: 10, scoreSkill: 5, scoreComm: 5, scoreCulture: 5, application: { id: 10, applicantName: "A", status: "INTERVIEW_2" } },
      ]),
      offerApplication: jest.fn().mockResolvedValue({ id: 10, status: "OFFERED" }),
      findApplicationById: jest.fn().mockResolvedValue({ id: 10, applicantName: "A", email: "a@test.com", posting: { id: 100 } }),
    });
    const svc = new RecruitmentService(repo);
    const result = await svc.promoteFromWaitlist(10, 42);
    expect(repo.offerApplication).toHaveBeenCalledWith(10, 42, 42);
    expect(result.status).toBe("OFFERED");
  });

  it("Application 이 waitlist Interview 없으면 400 NOT_WAITLISTED", async () => {
    const repo = makeRepo({
      findApplicationById: jest.fn().mockResolvedValue({ id: 10, applicantName: "A", posting: { id: 100 } }),
      findWaitlistedInterviewByApplication: jest.fn().mockResolvedValue(null),
    });
    const svc = new RecruitmentService(repo);
    await expect(svc.promoteFromWaitlist(10, 42))
      .rejects.toMatchObject({ statusCode: 400, message: "NOT_WAITLISTED" });
  });
});

describe("RecruitmentService.rejectApplication (auto-promote hook)", () => {
  it("OFFERED 상태 application 이 REJECTED 로 전환 시 같은 posting waitlist top 자동 offer", async () => {
    const rejectingApp = { id: 1, status: "OFFERED", email: "r@test.com", applicantName: "R", posting: { id: 100 } };
    const waitlistTop = { id: 2, applicationId: 20, scoreSkill: 5, scoreComm: 5, scoreCulture: 5, application: { id: 20, applicantName: "T", email: "t@test.com", posting: { id: 100 } } };
    const offerApp = jest.fn().mockResolvedValue({ id: 20, status: "OFFERED" });
    const repo = makeRepo({
      findApplicationById: jest.fn()
        .mockResolvedValueOnce(rejectingApp) // getApplication in rejectApplication
        .mockResolvedValueOnce(rejectingApp) // raw fetch for email
        .mockResolvedValueOnce({ id: 20, ...waitlistTop.application }), // for promote
      rejectApplication: jest.fn().mockResolvedValue({ id: 1, status: "REJECTED" }),
      findTopWaitlistForPosting: jest.fn().mockResolvedValue(waitlistTop),
      offerApplication: offerApp,
    });
    const svc = new RecruitmentService(repo);
    await svc.rejectApplication(1, 42);
    expect(offerApp).toHaveBeenCalledWith(20, expect.any(Number), expect.any(Number));
  });

  it("OFFERED 가 아닌 상태 (SCREENING) 는 waitlist auto-promote 없음", async () => {
    const rejectingApp = { id: 1, status: "SCREENING", email: "r@test.com", applicantName: "R", posting: { id: 100 } };
    const offerApp = jest.fn();
    const repo = makeRepo({
      findApplicationById: jest.fn().mockResolvedValue(rejectingApp),
      rejectApplication: jest.fn().mockResolvedValue({ id: 1, status: "REJECTED" }),
      findTopWaitlistForPosting: jest.fn(),
      offerApplication: offerApp,
    });
    const svc = new RecruitmentService(repo);
    await svc.rejectApplication(1, 42);
    expect(offerApp).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 테스트 실행 (FAIL 예상)**

```bash
cd apps/api && pnpm test -- src/recruitment/recruitment.service.test.ts 2>&1 | tail -20
```

Expected: 신규 테스트들 대부분 FAIL — service methods/logic 없음.

---

## Task 3: Threshold validation + Waitlist service methods

**Files:**
- Modify: `apps/api/src/recruitment/dto/recruitment.dto.ts`
- Modify: `apps/api/src/recruitment/recruitment.repo.ts`
- Modify: `apps/api/src/recruitment/recruitment.service.ts`

- [ ] **Step 1: DTO 확장**

`apps/api/src/recruitment/dto/recruitment.dto.ts` — `UpdateInterviewDto` 확장:

```typescript
export interface UpdateInterviewDto {
  scoreSkill?: number
  scoreComm?: number
  scoreCulture?: number
  comment?: string
  result?: 'PENDING' | 'PASS' | 'FAIL' | 'HOLD' | 'WAITLIST'
  overrideThreshold?: boolean
  overrideReason?: string
}
```

- [ ] **Step 2: Repo helpers 추가**

`apps/api/src/recruitment/recruitment.repo.ts` 에 추가:

```typescript
  getClubSettings() {
    return this.prisma.clubSettings.findFirst()
  }

  findWaitlistedInterviews(postingId: number) {
    return this.prisma.interview.findMany({
      where: {
        result: 'WAITLIST',
        application: { postingId },
      },
      include: {
        application: {
          select: { id: true, applicantName: true, email: true, status: true, postingId: true },
        },
      },
    })
  }

  findWaitlistedInterviewByApplication(applicationId: number) {
    return this.prisma.interview.findFirst({
      where: {
        applicationId,
        result: 'WAITLIST',
      },
    })
  }

  findTopWaitlistForPosting(postingId: number) {
    return this.prisma.interview.findMany({
      where: {
        result: 'WAITLIST',
        application: { postingId, status: { not: 'REJECTED' } },
      },
      include: {
        application: {
          select: { id: true, applicantName: true, email: true, status: true, postingId: true },
        },
      },
    }).then((rows) => {
      // Sort by score sum desc in JS (Prisma doesn't support computed ORDER BY easily)
      const sorted = rows.sort((a, b) => {
        const sumA = (a.scoreSkill ?? 0) + (a.scoreComm ?? 0) + (a.scoreCulture ?? 0)
        const sumB = (b.scoreSkill ?? 0) + (b.scoreComm ?? 0) + (b.scoreCulture ?? 0)
        return sumB - sumA
      })
      return sorted[0] ?? null
    })
  }
```

- [ ] **Step 3: Service `updateInterview` threshold 검증 확장**

`apps/api/src/recruitment/recruitment.service.ts` — 기존 `updateInterview` (line ~175) 확장:

```typescript
async updateInterview(applicationId: number, round: InterviewRound, dto: UpdateInterviewDto) {
  const existing = await this.repo.findInterview(applicationId, round);
  if (!existing) throw new AppError(404, "INTERVIEW_NOT_FOUND");

  // SJ3: if confirming a final result, all three scores must be present
  if (dto.result && dto.result !== "PENDING") {
    const scoreSkill = dto.scoreSkill ?? existing.scoreSkill;
    const scoreComm = dto.scoreComm ?? existing.scoreComm;
    const scoreCulture = dto.scoreCulture ?? existing.scoreCulture;
    if (scoreSkill == null || scoreComm == null || scoreCulture == null) {
      throw new AppError(400, "INTERVIEW_SCORES_REQUIRED");
    }

    // Threshold 검증 (PASS 만)
    if (dto.result === "PASS") {
      const settings = await this.repo.getClubSettings();
      const threshold = settings?.interviewPassThreshold ?? 3;
      const belowThreshold = scoreSkill < threshold || scoreComm < threshold || scoreCulture < threshold;

      if (belowThreshold) {
        if (!dto.overrideThreshold) {
          throw new AppError(400, "INTERVIEW_SCORE_BELOW_THRESHOLD");
        }
        if (!dto.overrideReason?.trim()) {
          throw new AppError(400, "OVERRIDE_REASON_REQUIRED");
        }
        // Audit log for override
        void writeAuditLog({
          actorId: 0, // system audit — actual actor 는 controller 에서 넘겨받는 방식으로 확장 가능
          action: "INTERVIEW_THRESHOLD_OVERRIDE",
          targetId: existing.id,
          detail: { reason: dto.overrideReason, scores: { scoreSkill, scoreComm, scoreCulture }, threshold },
        }).catch(console.error);
      }
    }
  }

  return this.repo.updateInterview(applicationId, round, dto);
}
```

**주의**: `writeAuditLog` import 필요 (`import { writeAuditLog } from '../lib/auditLog'`). ActorId 문제 — 이상적으로는 controller 에서 넘겨줘야 하지만, 기존 signature 변경은 breaking. 여기서는 0 (system) 로 두고 후속 이슈에서 개선.

- [ ] **Step 4: Waitlist service methods 추가**

`apps/api/src/recruitment/recruitment.service.ts` 에 추가:

```typescript
  async getWaitlistForPosting(postingId: number) {
    const waitlisted = await this.repo.findWaitlistedInterviews(postingId);
    return waitlisted
      .map((iv) => ({
        interviewId: iv.id,
        applicationId: iv.applicationId,
        scoreSum: (iv.scoreSkill ?? 0) + (iv.scoreComm ?? 0) + (iv.scoreCulture ?? 0),
        application: iv.application,
      }))
      .sort((a, b) => b.scoreSum - a.scoreSum);
  }

  async promoteFromWaitlist(applicationId: number, actorId: number) {
    const app = await this.getApplication(applicationId);
    const waitlistedInterview = await this.repo.findWaitlistedInterviewByApplication(applicationId);
    if (!waitlistedInterview) throw new AppError(400, "NOT_WAITLISTED");

    // Offer 는 기존 offerApplication 재사용 (알림 발송 포함)
    const result = await this.repo.offerApplication(applicationId, actorId, actorId);
    void writeAuditLog({
      actorId,
      action: "APPLICATION_PROMOTED_FROM_WAITLIST",
      targetId: applicationId,
    }).catch(console.error);
    return result;
  }
```

- [ ] **Step 5: `rejectApplication` auto-promote hook**

`apps/api/src/recruitment/recruitment.service.ts` — 기존 `rejectApplication` (line ~110) 확장:

```typescript
async rejectApplication(id: number, actorId?: number) {
  const app = await this.getApplication(id);
  if (app.status === "REJECTED") throw new AppError(409, "APPLICATION_ALREADY_REJECTED");
  const wasOffered = app.status === "OFFERED";
  const postingId = (app as any).posting?.id ?? (app as any).postingId;

  const result = await this.repo.rejectApplication(id, actorId as number);

  // SJ6: email applicant on rejection
  const rawApp = await this.repo.findApplicationById(id);
  if (rawApp?.email) {
    void sendApplicationStatusEmail(rawApp.email, rawApp.applicantName, "REJECTED").catch(console.error);
  }

  // Auto-promote from waitlist: OFFERED → REJECTED 전환 시만
  if (wasOffered && postingId && this.repo.findTopWaitlistForPosting) {
    const top = await this.repo.findTopWaitlistForPosting(postingId);
    if (top) {
      try {
        await this.repo.offerApplication(top.applicationId, actorId as number, actorId as number);
        // Notify auto-promoted candidate via existing offer email
        const promotedApp = await this.repo.findApplicationById(top.applicationId);
        if (promotedApp?.email) {
          void sendApplicationStatusEmail(promotedApp.email, promotedApp.applicantName, "OFFERED").catch(console.error);
        }
        void writeAuditLog({
          actorId: actorId ?? 0,
          action: "APPLICATION_AUTO_PROMOTED_FROM_WAITLIST",
          targetId: top.applicationId,
          detail: { triggeredByRejectionOf: id },
        }).catch(console.error);
      } catch (err) {
        console.warn(`[auto-promote-waitlist] failed for posting=${postingId}:`, err);
      }
    }
  }

  return result;
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
cd apps/api && pnpm test -- src/recruitment/recruitment.service.test.ts 2>&1 | tail -25
```

Expected: 신규 테스트들 PASS. 기존 테스트도 유지.

---

## Task 4: closeSeason hook (waitlist expire)

**Files:**
- Modify: `apps/api/src/season/season.service.ts:50-69` (closeSeason)
- Optional: 신규 helper `apps/api/src/recruitment/recruitment.service.ts` 안 `expireWaitlistOnSeasonClose`

- [ ] **Step 1: RecruitmentService 에 expire 헬퍼 추가**

`apps/api/src/recruitment/recruitment.service.ts` 에 추가:

```typescript
  async expireAllWaitlists() {
    // 모든 posting 의 WAITLIST result 를 FAIL 로 전환 + 이메일 발송
    const allWaitlisted = await this.repo.findAllWaitlistedInterviews(); // 신규 repo helper
    for (const iv of allWaitlisted) {
      await this.repo.updateInterviewResult(iv.id, "FAIL");
      const app = await this.repo.findApplicationById(iv.applicationId);
      if (app?.email) {
        void sendApplicationStatusEmail(app.email, app.applicantName, "WAITLIST_EXPIRED").catch(console.error);
      }
    }
  }
```

Repo helper 추가:

```typescript
  findAllWaitlistedInterviews() {
    return this.prisma.interview.findMany({ where: { result: 'WAITLIST' } })
  }

  updateInterviewResult(id: number, result: 'FAIL' | 'PASS' | 'HOLD' | 'WAITLIST' | 'PENDING') {
    return this.prisma.interview.update({ where: { id }, data: { result } })
  }
```

- [ ] **Step 2: closeSeason 에 hook 추가**

`apps/api/src/season/season.service.ts:50-69`:

```typescript
async closeSeason(id: number) {
  const season = await this.repo.findById(id);
  if (!season) throw new AppError(404, "SEASON_NOT_FOUND");
  if (season.status !== SeasonStatus.ACTIVE) {
    throw new AppError(400, "SEASON_NOT_ACTIVE");
  }

  const closed = await this.repo.updateStatus(id, SeasonStatus.CLOSED);

  // Best-effort auto-carryover ...
  try {
    await applyCarryOverToNextSeason(getPrisma(), id);
  } catch (err) {
    console.warn(`[closeSeason] carryover 자동 적용 실패 (seasonId=${id})`, err);
  }

  // Best-effort waitlist expire (신규)
  if (this.recruitmentService) {
    try {
      await this.recruitmentService.expireAllWaitlists();
    } catch (err) {
      console.warn(`[closeSeason] waitlist expire 자동 처리 실패`, err);
    }
  }

  return closed;
}
```

**주의**: `SeasonService` constructor 에 `recruitmentService?: RecruitmentService` 추가 필요:

```typescript
export class SeasonService {
  constructor(
    private repo: SeasonRepository,
    private recruitmentService?: RecruitmentService,
  ) {}
  ...
}
```

Season routes 에서 wiring 추가 (RecruitmentService 주입).

- [ ] **Step 3: closeSeason 테스트 추가**

`apps/api/src/season/` 아래 (기존 test 파일 or 신규):

```typescript
describe('SeasonService.closeSeason (waitlist expire hook)', () => {
  test('closeSeason 성공 시 recruitmentService.expireAllWaitlists 호출', async () => {
    const seasonRepo = {
      findById: jest.fn().mockResolvedValue({ id: 1, status: 'ACTIVE' }),
      updateStatus: jest.fn().mockResolvedValue({ id: 1, status: 'CLOSED' }),
    } as any
    const recruitment = { expireAllWaitlists: jest.fn().mockResolvedValue(undefined) } as any
    const svc = new SeasonService(seasonRepo, recruitment)
    await svc.closeSeason(1)
    expect(recruitment.expireAllWaitlists).toHaveBeenCalled()
  })

  test('expire 실패해도 closeSeason 자체는 성공 (best-effort)', async () => {
    const seasonRepo = {
      findById: jest.fn().mockResolvedValue({ id: 1, status: 'ACTIVE' }),
      updateStatus: jest.fn().mockResolvedValue({ id: 1, status: 'CLOSED' }),
    } as any
    const recruitment = { expireAllWaitlists: jest.fn().mockRejectedValue(new Error('boom')) } as any
    const svc = new SeasonService(seasonRepo, recruitment)
    const result = await svc.closeSeason(1)
    expect(result.status).toBe('CLOSED')
  })
})
```

---

## Task 5: Controller + Routes + Email

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.controller.ts` — 2 신규 handler
- Modify: `apps/api/src/recruitment/recruitment.routes.ts` — 2 신규 route
- Modify: `apps/api/src/lib/email.ts` — WAITLIST/WAITLIST_EXPIRED case

- [ ] **Step 1: Controller handlers**

```typescript
  getPostingWaitlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const postingId = Number(req.params["id"])
      const result = await this.service.getWaitlistForPosting(postingId)
      res.json(result)
    } catch (e) { next(e) }
  }

  promoteFromWaitlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = Number(req.params["id"])
      const actorId = (req.user as any)?.id
      const result = await this.service.promoteFromWaitlist(applicationId, actorId)
      res.json(result)
    } catch (e) { next(e) }
  }
```

- [ ] **Step 2: Routes**

`apps/api/src/recruitment/recruitment.routes.ts`:

```typescript
router.get("/postings/:id/waitlist", auth, canWriteHR-style middleware, controller.getPostingWaitlist)
router.post("/applications/:id/promote-from-waitlist", auth, canWriteHR-style middleware, controller.promoteFromWaitlist)
```

**주의**: 기존 recruitment routes 의 HR-only 패턴 확인 후 동일 적용.

- [ ] **Step 3: Email template 확장**

`apps/api/src/lib/email.ts` — `sendApplicationStatusEmail` 함수 확장:

```typescript
// 기존 status 케이스에 추가
case "WAITLIST":
  subject = "채용 waitlist 등록 안내"
  body = `${applicantName} 님, 서류/면접 결과가 우수하여 채용 대기(waitlist) 명단에 등록되었습니다. 자리가 나면 즉시 연락드리겠습니다.`
  break
case "WAITLIST_EXPIRED":
  subject = "채용 waitlist 만료 안내"
  body = `${applicantName} 님, 아쉽게도 시즌 마감으로 인해 waitlist 가 종료되었습니다. 향후 다른 기회에 지원 부탁드립니다.`
  break
```

**주의**: 정확한 email template 구조는 파일 확인 후 pattern 따라 확장.

---

## Task 6: Verify + commit

- [ ] **Step 1: 전체 스코프 테스트**

```bash
cd apps/api && pnpm test -- src/recruitment/ __test__/plan-report/ src/season/ __test__/season/ 2>&1 | tail -15
```

Expected: 모두 PASS (신규 ~12개 + 기존).

- [ ] **Step 2: TypeScript check**

```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | tail -10
cd football && pnpm tsc --noEmit 2>&1 | tail -5
```

Expected: 신규 에러 없음.

- [ ] **Step 3: git status + commit**

```bash
git status --short
git add apps/api/prisma/schema.prisma \
        apps/api/prisma/migrations \
        apps/api/src/recruitment \
        apps/api/src/season/season.service.ts \
        apps/api/src/lib/email.ts \
        apps/api/src/season \
        docs/superpowers/plans/2026-08-26-interview-threshold-waitlist.md

git commit -m "$(cat <<'EOF'
feat(recruitment): interview threshold policy + HOLD/WAITLIST lifecycle (fix #366)

- schema: InterviewResult += HOLD, WAITLIST + ClubSettings.interviewPassThreshold @default(3)
- migration: enum ADD VALUE + ADD COLUMN (safe)
- service.updateInterview: PASS 결정 시 각 카테고리 threshold 검증. 미달 시 400 INTERVIEW_SCORE_BELOW_THRESHOLD. overrideThreshold + reason 으로 우회 가능 (audit log 남김)
- service.getWaitlistForPosting: WAITLIST Interview 를 score 총합 desc 로 정렬
- service.promoteFromWaitlist: waitlist candidate → offer (기존 offerApplication 재사용, audit log)
- rejectApplication hook: OFFERED → REJECTED 전환 시 같은 posting waitlist top 자동 offer + 이메일 통보
- season.closeSeason hook: 시즌 마감 시 남은 WAITLIST 자동 FAIL + 이메일 통보 (best-effort)
- email: sendApplicationStatusEmail 에 WAITLIST/WAITLIST_EXPIRED 케이스
- API: GET /recruitment/postings/:id/waitlist, POST /recruitment/applications/:id/promote-from-waitlist
- tests: ~12 신규 (threshold 검증 · override · HOLD/WAITLIST skip · waitlist 정렬/promote · auto-promote hook · closeSeason hook)

Flowchart 확장 사항 (happy path 밖 edge case):
- HOLD: 심사자 결정 유보 (재검토)
- WAITLIST: PASS-급 후보자 offer 대기, 자리 opening 시 자동 promote
- 시즌 마감 시 waitlist 자동 정리

Closes #366

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log -1 --stat
```

---

## Self-Review

**1. Spec coverage** (grill decisions):
- [x] Q1 ClubSettings threshold → Task 1
- [x] Q2 카테고리 min 검증 → Task 3
- [x] Q3 override + reason 필수 + audit → Task 3
- [x] Q4 HOLD + WAITLIST → Task 1
- [x] Q5 score 총합 desc / Interview.result / 자동 promote / 조회 API / 시즌 close 만료 / 이메일 통보 → Task 3+4+5
- [x] Q6 auto-promote trigger (rejectApplication) / closeSeason hook / 이메일 재사용 → Task 3+4+5

**2. Placeholder scan:** `{timestamp}` Prisma auto-gen. Middleware 이름 `canWriteHR-style` 은 파일 확인 대체.

**3. Type consistency:** `InterviewResult` 값 (HOLD/WAITLIST), method names 일관.

## 실행 후 확인 사항

- [ ] Migration SQL: 2 ADD VALUE + 1 ADD COLUMN 만
- [ ] 신규 ~12 테스트 pass
- [ ] BE/FE tsc 신규 에러 없음
- [ ] closeSeason 시 waitlist 자동 정리 로그 확인
