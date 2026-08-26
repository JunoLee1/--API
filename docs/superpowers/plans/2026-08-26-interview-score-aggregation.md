# Interview Score Aggregation (Fix #365) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Issue:** [#365](https://github.com/JunoLee1/--API/issues/365)

**Goal:** `InterviewerScore` (여러 면접관의 개별 점수) 를 `Interview.scoreSkill/Comm/Culture` 로 자동 aggregate (평균) 하는 API 추가. HR 수동 입력 부담 제거.

**Architecture:**
- Prisma `aggregate({ _avg: ..., _count: ... })` 로 평균 계산 (null 값 자동 제외)
- 신규 endpoint 2개:
  - `GET /recruitment/applications/:applicationId/interviews/:round/aggregate` — read-only 미리보기
  - `POST /recruitment/applications/:applicationId/interviews/:round/finalize-score` — Interview.score* 필드 자동 업데이트
- MVP: AVG 만 지원. MEDIAN 은 Prisma raw query 필요 — 별도 이슈로 후속
- 0 scores → 400 `NO_INTERVIEWER_SCORES_YET`

**Tech Stack:** TypeScript · Prisma · Jest · Express (`apps/api`)

**Dependency:** 없음 (독립 RFA). Main `f869fb54` 이후 base.

**Out of scope:**
- MEDIAN 방식 (Prisma raw query 필요)
- `ClubSettings.interviewScoreAggregation` (MEDIAN 도입 시 함께)
- `updateInterview` 확정 시 자동 finalize (별도 이슈)
- 면접관 assignment 검증 (별도 minor 이슈)

---

## File Structure

**Modify:**
- `apps/api/src/recruitment/recruitment.repo.ts` — `aggregateInterviewerScores` 신규 헬퍼
- `apps/api/src/recruitment/recruitment.service.ts` — `getInterviewerScoreAggregate` + `finalizeInterviewScore` 신규 메서드
- `apps/api/src/recruitment/recruitment.controller.ts` — 2개 handler
- `apps/api/src/recruitment/recruitment.routes.ts` — 2개 route
- `apps/api/src/recruitment/recruitment.service.test.ts` — 신규 테스트

**No changes:**
- Schema (Interview 필드 그대로, 필드 채우기만)
- FE (BE only, 별도 이슈)

---

## Task 1: Failing tests

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.service.test.ts`

- [ ] **Step 1: 신규 describe + 4 테스트 추가**

파일 끝에 추가:

```typescript
describe("RecruitmentService.getInterviewerScoreAggregate", () => {
  const interview = {
    id: 100,
    applicationId: 1,
    round: "ROUND_1",
    scoreSkill: null,
    scoreComm: null,
    scoreCulture: null,
  };

  const makeSvcWithAggCtx = (aggregateResult: any = null, findInterviewResult: any = interview) => {
    const repo = makeRepo({
      findInterview: jest.fn().mockResolvedValue(findInterviewResult),
      aggregateInterviewerScores: jest.fn().mockResolvedValue(aggregateResult),
      updateInterview: jest.fn().mockResolvedValue({}),
    });
    return { svc: new RecruitmentService(repo), repo };
  };

  it("3명 면접관 (5, 7, 9) 평균 → scoreSkill=7 (반올림), method=AVG, count=3", async () => {
    const { svc } = makeSvcWithAggCtx({
      _avg: { scoreSkill: 7.0, scoreComm: 6.5, scoreCulture: 8.0 },
      _count: 3,
    });
    const result = await svc.getInterviewerScoreAggregate(1, "ROUND_1");
    expect(result).toEqual({
      scoreSkill: 7,
      scoreComm: 7,      // 6.5 → 7 (round)
      scoreCulture: 8,
      method: "AVG",
      count: 3,
    });
  });

  it("0 scores → 400 NO_INTERVIEWER_SCORES_YET", async () => {
    const { svc } = makeSvcWithAggCtx({
      _avg: { scoreSkill: null, scoreComm: null, scoreCulture: null },
      _count: 0,
    });
    await expect(svc.getInterviewerScoreAggregate(1, "ROUND_1"))
      .rejects.toMatchObject({ statusCode: 400, message: "NO_INTERVIEWER_SCORES_YET" });
  });

  it("Interview 없으면 404 INTERVIEW_NOT_FOUND", async () => {
    const { svc } = makeSvcWithAggCtx(null, null);
    await expect(svc.getInterviewerScoreAggregate(1, "ROUND_1"))
      .rejects.toMatchObject({ statusCode: 404, message: "INTERVIEW_NOT_FOUND" });
  });

  it("일부 카테고리 null 이면 그 값만 null 반환 (다른 카테고리는 정상 평균)", async () => {
    const { svc } = makeSvcWithAggCtx({
      _avg: { scoreSkill: 7.0, scoreComm: null, scoreCulture: 8.0 },
      _count: 2,
    });
    const result = await svc.getInterviewerScoreAggregate(1, "ROUND_1");
    expect(result).toEqual({
      scoreSkill: 7,
      scoreComm: null,
      scoreCulture: 8,
      method: "AVG",
      count: 2,
    });
  });
});

describe("RecruitmentService.finalizeInterviewScore", () => {
  const interview = {
    id: 100,
    applicationId: 1,
    round: "ROUND_1",
    scoreSkill: null,
    scoreComm: null,
    scoreCulture: null,
  };

  const makeSvc = (aggregateResult: any = null, findInterviewResult: any = interview, updateResult: any = {}) => {
    const repo = makeRepo({
      findInterview: jest.fn().mockResolvedValue(findInterviewResult),
      aggregateInterviewerScores: jest.fn().mockResolvedValue(aggregateResult),
      updateInterview: jest.fn().mockResolvedValue(updateResult),
    });
    return { svc: new RecruitmentService(repo), repo };
  };

  it("aggregate 결과로 Interview.score* 업데이트", async () => {
    const { svc, repo } = makeSvc({
      _avg: { scoreSkill: 7.0, scoreComm: 6.5, scoreCulture: 8.0 },
      _count: 3,
    }, interview, { id: 100, scoreSkill: 7, scoreComm: 7, scoreCulture: 8 });

    const result = await svc.finalizeInterviewScore(1, "ROUND_1");

    expect(repo.updateInterview).toHaveBeenCalledWith(1, "ROUND_1", {
      scoreSkill: 7,
      scoreComm: 7,
      scoreCulture: 8,
    });
    expect(result.scoreSkill).toBe(7);
  });

  it("0 scores → 400 NO_INTERVIEWER_SCORES_YET (Interview 업데이트 안 함)", async () => {
    const { svc, repo } = makeSvc({
      _avg: { scoreSkill: null, scoreComm: null, scoreCulture: null },
      _count: 0,
    });
    await expect(svc.finalizeInterviewScore(1, "ROUND_1"))
      .rejects.toMatchObject({ statusCode: 400, message: "NO_INTERVIEWER_SCORES_YET" });
    expect(repo.updateInterview).not.toHaveBeenCalled();
  });

  it("Interview 없으면 404 INTERVIEW_NOT_FOUND", async () => {
    const { svc, repo } = makeSvc(null, null);
    await expect(svc.finalizeInterviewScore(1, "ROUND_1"))
      .rejects.toMatchObject({ statusCode: 404, message: "INTERVIEW_NOT_FOUND" });
    expect(repo.updateInterview).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실행 (FAIL 예상)**

```bash
cd apps/api && pnpm test -- src/recruitment/recruitment.service.test.ts -t "Aggregate\|finalizeInterview" 2>&1 | tail -20
```

Expected: FAIL — method 없음.

---

## Task 2: Repo helper + Service methods

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.repo.ts`
- Modify: `apps/api/src/recruitment/recruitment.service.ts`

- [ ] **Step 1: Repo aggregate helper 추가**

`apps/api/src/recruitment/recruitment.repo.ts` — 기존 `getInterviewerScores` (line ~357) 뒤에 추가:

```typescript
  aggregateInterviewerScores(interviewId: number) {
    return this.prisma.interviewerScore.aggregate({
      where: { interviewId },
      _avg: { scoreSkill: true, scoreComm: true, scoreCulture: true },
      _count: true,
    })
  }
```

- [ ] **Step 2: Service methods 추가**

`apps/api/src/recruitment/recruitment.service.ts` — 기존 `getInterviewerScores` (line ~285) 뒤에 추가:

```typescript
  async getInterviewerScoreAggregate(applicationId: number, round: InterviewRound) {
    const interview = await this.repo.findInterview(applicationId, round);
    if (!interview) throw new AppError(404, "INTERVIEW_NOT_FOUND");

    const agg = await this.repo.aggregateInterviewerScores(interview.id);
    if (!agg || agg._count === 0) {
      throw new AppError(400, "NO_INTERVIEWER_SCORES_YET");
    }

    const round1 = (v: number | null | undefined) => (v == null ? null : Math.round(v));
    return {
      scoreSkill: round1(agg._avg.scoreSkill),
      scoreComm: round1(agg._avg.scoreComm),
      scoreCulture: round1(agg._avg.scoreCulture),
      method: "AVG" as const,
      count: agg._count,
    };
  }

  async finalizeInterviewScore(applicationId: number, round: InterviewRound) {
    const aggregate = await this.getInterviewerScoreAggregate(applicationId, round);
    return this.repo.updateInterview(applicationId, round, {
      scoreSkill: aggregate.scoreSkill,
      scoreComm: aggregate.scoreComm,
      scoreCulture: aggregate.scoreCulture,
    });
  }
```

**주의**: `InterviewRound` 이미 import 되어 있음 (line 21). `updateInterview` 는 기존 메서드 (line ~175) — 그대로 재사용.

- [ ] **Step 3: 테스트 통과 확인**

```bash
cd apps/api && pnpm test -- src/recruitment/recruitment.service.test.ts -t "Aggregate\|finalizeInterview" 2>&1 | tail -20
```

Expected: 7개 신규 테스트 PASS.

- [ ] **Step 4: TypeScript check**

```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | tail -10
```

Expected: 신규 에러 없음.

---

## Task 3: Controller + Routes

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.controller.ts` — 2개 handler
- Modify: `apps/api/src/recruitment/recruitment.routes.ts` — 2개 route

- [ ] **Step 1: Controller handlers 추가**

`apps/api/src/recruitment/recruitment.controller.ts` — 기존 `getInterviewerScores` handler (line ~306) 뒤에 추가:

```typescript
  getInterviewerScoreAggregate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = Number(req.params["id"])
      const round = req.params["round"] as InterviewRound
      res.json(await this.service.getInterviewerScoreAggregate(applicationId, round))
    } catch (e) { next(e) }
  }

  finalizeInterviewScore = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = Number(req.params["id"])
      const round = req.params["round"] as InterviewRound
      res.json(await this.service.finalizeInterviewScore(applicationId, round))
    } catch (e) { next(e) }
  }
```

**주의**: `InterviewRound` import 필요:
```typescript
import type { InterviewRound } from '../generated/enums'
```

파일 상단 import 확인 후 없으면 추가.

- [ ] **Step 2: Routes 등록**

`apps/api/src/recruitment/recruitment.routes.ts` — Interview scores 관련 route (`router.get("/interviews/:id/scores", ...)` 근처) 에 추가:

```typescript
router.get("/applications/:id/interviews/:round/aggregate", auth, controller.getInterviewerScoreAggregate)
router.post("/applications/:id/interviews/:round/finalize-score", auth, controller.finalizeInterviewScore)
```

- [ ] **Step 3: TypeScript check + 전체 테스트**

```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | tail -10
cd apps/api && pnpm test -- src/recruitment/ __test__/plan-report/ 2>&1 | tail -10
```

Expected: 컴파일 에러 없음. 모든 테스트 통과.

---

## Task 4: Verify + commit

- [ ] **Step 1: 전체 스코프 테스트**

```bash
cd apps/api && pnpm test -- src/recruitment/ __test__/plan-report/ __test__/recruitment/ 2>&1 | tail -10
```

Expected: 모두 PASS (신규 7개 + 기존).

- [ ] **Step 2: FE TypeScript (회귀 없음)**

```bash
cd football && pnpm tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git status --short
git add apps/api/src/recruitment/recruitment.repo.ts \
        apps/api/src/recruitment/recruitment.service.ts \
        apps/api/src/recruitment/recruitment.controller.ts \
        apps/api/src/recruitment/recruitment.routes.ts \
        apps/api/src/recruitment/recruitment.service.test.ts \
        docs/superpowers/plans/2026-08-26-interview-score-aggregation.md

git commit -m "$(cat <<'EOF'
feat(recruitment): interview score aggregation API (fix #365)

- service: getInterviewerScoreAggregate + finalizeInterviewScore 신규
  * Prisma aggregate({_avg}) 로 평균 계산 (null 자동 제외)
  * 0 scores → 400 NO_INTERVIEWER_SCORES_YET
  * 반올림 (Math.round) 로 Int 저장
- repo: aggregateInterviewerScores 헬퍼
- API:
  * GET /recruitment/applications/:id/interviews/:round/aggregate — 미리보기
  * POST /recruitment/applications/:id/interviews/:round/finalize-score — Interview.score* 업데이트
- tests: 7개 신규 (aggregate 3 + finalize 3 + 미리보기 계산 정확도)

HR 수동 입력 부담 제거. 여러 면접관 개별 점수 → Interview 최종 점수 자동. MVP AVG 만; MEDIAN 은 별도 이슈 후속.

Closes #365

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log -1 --stat
```

---

## Self-Review

**1. Spec coverage** (#365 acceptance):
- [x] `getInterviewerScoreAggregate` 반환 shape — Task 2
- [x] `finalizeInterviewScore` Interview.score* update — Task 2
- [x] 평균 (AVG default) — Task 2 (`Math.round`)
- [x] 0 scores → 400 → Task 2
- [x] partial null 처리 (null 만 반환) — Task 2 (Prisma _avg null 자동 처리)
- [ ] MEDIAN 옵션 — **Out of scope** (raw query 필요)

**2. Placeholder scan:** 없음.

**3. Type consistency:**
- `AVG` 리터럴, `NO_INTERVIEWER_SCORES_YET` code 일관
- `InterviewRound` type 사용

## 실행 후 확인 사항

- [ ] 신규 7 테스트 pass
- [ ] BE tsc 신규 에러 없음
- [ ] FE tsc 통과
- [ ] 실제 aggregate API 호출 시 correct rounding
