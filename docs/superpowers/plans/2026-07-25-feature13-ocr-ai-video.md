# Feature 13: OCR 경기 기록지 + AI 영상 요약 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 경기 기록지 이미지를 Claude Vision으로 OCR 분석해 Match에 저장하고, 훈련 영상에 Claude AI 요약을 생성해 저장한다.

**Architecture:** 기존 Match/Video 모듈에 각각 AI 엔드포인트 추가. 공통 `src/lib/claude.ts`에 Anthropic 싱글턴. multer는 이미 설치됨, tactical.routes.ts 패턴 그대로 재사용. 프론트는 기존 `api.postForm` 활용.

**Tech Stack:** Anthropic SDK (`@anthropic-ai/sdk`), multer (이미 설치됨), Prisma, Express, React

---

## 사전 지식

**프로젝트 경로:**
- API: `/Users/juno/work/football/apps/api/`
- FE: `/Users/juno/work/football/football/`

**기존 multer 패턴** (`src/tactical/tactical.routes.ts` 참고):
```typescript
const uploadDir = path.join(process.cwd(), "uploads", "SUBDIR");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  if (file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("이미지 파일만 업로드할 수 있습니다."));
}});
```

**TypeScript 빌드 체크 명령어** (pre-existing 에러 제외):
```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep -v "country.repo.ts" | grep -v "monthlyAttendanceCheck" | head -20
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo.ts" | grep -v "monthlyAttendanceCheck" | head -20
```

**마이그레이션 패턴** (shadow DB 우회):
```bash
cd /Users/juno/work/football/apps/api
npx prisma db execute --file ./prisma/migrations/20260725000003_feature13_ai/migration.sql --schema ./prisma/schema.prisma
npx prisma migrate resolve --applied 20260725000003_feature13_ai
npx prisma generate
```

**`api.postForm`** FE에서 multipart 파일 업로드에 사용:
```typescript
import { api } from '@/services/api'
const form = new FormData()
form.append('image', file)
const result = await api.postForm<{ statSheetRaw: StatSheetData }>(`/matches/${id}/stat-sheet`, form)
```

---

## Task 1: DB 마이그레이션

**Files:**
- Create: `apps/api/prisma/migrations/20260725000003_feature13_ai/migration.sql`
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: 마이그레이션 폴더 및 SQL 파일 생성**

`apps/api/prisma/migrations/20260725000003_feature13_ai/migration.sql`:
```sql
-- Match 테이블: OCR 결과 저장 필드 추가
ALTER TABLE "Match" ADD COLUMN "statSheetRaw" JSONB;
ALTER TABLE "Match" ADD COLUMN "statSheetImagePath" TEXT;

-- TrainingVideo 테이블: AI 요약 저장 필드 추가
ALTER TABLE "TrainingVideo" ADD COLUMN "aiSummary" TEXT;
```

- [x] **Step 2: schema.prisma 수정**

`apps/api/prisma/schema.prisma`의 `model Match` 블록에 마지막 관계 필드 전에 추가:
```prisma
  statSheetRaw       Json?
  statSheetImagePath String?
```

`model TrainingVideo` 블록에 `createdAt` 아래에 추가:
```prisma
  aiSummary    String?
```

- [x] **Step 3: 마이그레이션 실행**

```bash
cd /Users/juno/work/football/apps/api
npx prisma db execute --file ./prisma/migrations/20260725000003_feature13_ai/migration.sql --schema ./prisma/schema.prisma
npx prisma migrate resolve --applied 20260725000003_feature13_ai
npx prisma generate
```

Expected: `Environment variables loaded from .env` + `Generated Prisma Client` — 에러 없음.

- [x] **Step 4: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/prisma/
git commit -m "feat(db): Match.statSheetRaw + TrainingVideo.aiSummary 필드 추가"
```

---

## Task 2: Anthropic SDK 설치 + claude.ts 헬퍼

**Files:**
- Modify: `apps/api/package.json` (npm install)
- Create: `apps/api/src/lib/claude.ts`

- [x] **Step 1: SDK 설치**

```bash
cd /Users/juno/work/football/apps/api
npm install @anthropic-ai/sdk
```

Expected: `added 1 package` — 에러 없음.

- [x] **Step 2: `src/lib/claude.ts` 생성**

```typescript
import Anthropic from "@anthropic-ai/sdk";

if (!process.env["ANTHROPIC_API_KEY"]) {
  console.warn("[claude] ANTHROPIC_API_KEY not set — AI endpoints will return 503");
}

export const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"] ?? "missing",
});
```

- [x] **Step 3: TypeScript 빌드 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo.ts" | grep -v "monthlyAttendanceCheck" | head -20
```

Expected: 출력 없음 (에러 없음).

- [x] **Step 4: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/lib/claude.ts apps/api/package.json apps/api/package-lock.json
git commit -m "feat(ai): Anthropic SDK 설치 + claude.ts 헬퍼"
```

---

## Task 3: 백엔드 OCR 엔드포인트 (Match 모듈)

**Files:**
- Modify: `apps/api/src/match/match.repo.ts`
- Modify: `apps/api/src/match/match.service.ts`
- Modify: `apps/api/src/match/match.controller.ts`
- Modify: `apps/api/src/match/match.routes.ts`

### match.repo.ts

- [x] **Step 1: `updateStatSheet` 메서드 추가**

`apps/api/src/match/match.repo.ts`의 `MatchRepository` 클래스 마지막에 추가:
```typescript
  updateStatSheet(id: number, statSheetRaw: unknown, statSheetImagePath: string) {
    return this.prisma.match.update({
      where: { id },
      data: { statSheetRaw, statSheetImagePath },
      select: { id: true, statSheetRaw: true, statSheetImagePath: true },
    });
  }
```

그리고 `findById` 메서드의 `select` 블록에 `statSheetRaw: true, statSheetImagePath: true` 추가:
```typescript
  // findById의 select 맨 앞에:
  select: {
    ...MATCH_SELECT,
    statSheetRaw: true,
    statSheetImagePath: true,
    playerMatchStats: { ... },
    teamMatchStats: true,
  },
```

### match.service.ts

- [x] **Step 2: `uploadStatSheet` 메서드 추가**

`apps/api/src/match/match.service.ts` 상단 imports에 추가:
```typescript
import fs from "fs";
import path from "path";
import { anthropic } from "../lib/claude";
import { AppError } from "../lib/appError";
```

`MatchService` 클래스 마지막에 추가:
```typescript
  async uploadStatSheet(matchId: number, filePath: string, originalName: string) {
    const match = await this.repo.findById(matchId);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");

    if (!process.env["ANTHROPIC_API_KEY"]) {
      throw new AppError(503, "AI_SERVICE_UNAVAILABLE");
    }

    const imageData = fs.readFileSync(filePath);
    const base64 = imageData.toString("base64");
    const ext = path.extname(originalName).toLowerCase();
    const mediaType = ext === ".png" ? "image/png" : "image/jpeg";

    let statSheetRaw: unknown;
    try {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: `이 경기 기록지 이미지에서 스탯을 추출하여 아래 JSON 형식으로 반환하세요. 확인할 수 없는 값은 null로 설정하세요.
{
  "possession": { "home": <number|null>, "away": <number|null> },
  "shots": { "home": <number|null>, "away": <number|null> },
  "shotsOnTarget": { "home": <number|null>, "away": <number|null> },
  "goals": { "home": <number|null>, "away": <number|null> },
  "corners": { "home": <number|null>, "away": <number|null> },
  "fouls": { "home": <number|null>, "away": <number|null> },
  "yellowCards": { "home": <number|null>, "away": <number|null> },
  "redCards": { "home": <number|null>, "away": <number|null> },
  "scorers": [{ "name": <string>, "team": "home"|"away", "minute": <number|null> }]
}
JSON만 반환하고 다른 텍스트는 포함하지 마세요.`,
              },
            ],
          },
        ],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
      const jsonText = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      statSheetRaw = JSON.parse(jsonText);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new AppError(422, "STAT_EXTRACTION_FAILED");
      }
      throw new AppError(503, "AI_SERVICE_UNAVAILABLE");
    }

    const relativePath = path.relative(process.cwd(), filePath);
    return this.repo.updateStatSheet(matchId, statSheetRaw, relativePath);
  }
```

### match.controller.ts

- [x] **Step 3: `uploadStatSheet` 핸들러 추가**

`apps/api/src/match/match.controller.ts`의 `MatchController` 클래스 마지막에 추가:
```typescript
  uploadStatSheet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ALLOWED = ["ADMIN", "COACHING_STAFF"] as const;
      if (!(ALLOWED as readonly string[]).includes(req.user!.role))
        throw new AppError(403, "FORBIDDEN");
      const file = req.file;
      if (!file) throw new AppError(400, "IMAGE_REQUIRED");
      const result = await this.service.uploadStatSheet(
        Number(req.params["id"]),
        file.path,
        file.originalname,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
```

### match.routes.ts

- [x] **Step 4: multer + 라우트 추가**

`apps/api/src/match/match.routes.ts` 맨 위 imports에 추가:
```typescript
import multer from "multer";
import path from "path";
import fs from "fs";
```

`const auth = ...` 줄 아래에 추가:
```typescript
const statSheetUploadDir = path.join(process.cwd(), "uploads", "stat-sheets");
if (!fs.existsSync(statSheetUploadDir)) fs.mkdirSync(statSheetUploadDir, { recursive: true });
const statSheetStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, statSheetUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const uploadStatSheet = multer({
  storage: statSheetStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("이미지 파일만 업로드할 수 있습니다."));
  },
});
```

기존 `router.patch("/:id", ...)` 줄 아래에 추가:
```typescript
// 스탯 시트 OCR 업로드 (ADMIN, COACHING_STAFF)
router.post("/:id/stat-sheet", auth, uploadStatSheet.single("image"), controller.uploadStatSheet);
```

- [x] **Step 5: TypeScript 빌드 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo.ts" | grep -v "monthlyAttendanceCheck" | head -20
```

Expected: 출력 없음.

- [x] **Step 6: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/match/
git commit -m "feat(match): OCR 스탯 시트 업로드 엔드포인트 추가"
```

---

## Task 4: 백엔드 AI 요약 엔드포인트 (Video 모듈)

**Files:**
- Modify: `apps/api/src/video/video.repo.ts`
- Modify: `apps/api/src/video/video.service.ts`
- Modify: `apps/api/src/video/video.controller.ts`
- Modify: `apps/api/src/video/video.routes.ts`

### video.repo.ts

- [x] **Step 1: `updateAiSummary` 메서드 추가**

`apps/api/src/video/video.repo.ts`의 `VideoRepository` 클래스 마지막에 추가:
```typescript
  updateAiSummary(id: number, aiSummary: string) {
    return this.prisma.trainingVideo.update({
      where: { id },
      data: { aiSummary },
      select: { id: true, aiSummary: true },
    });
  }
```

### video.service.ts

- [x] **Step 2: `generateAiSummary` 메서드 추가**

`apps/api/src/video/video.service.ts` 상단 imports에 추가:
```typescript
import { anthropic } from "../lib/claude";
import { AppError } from "../lib/appError";
```

(AppError가 이미 있으면 import 라인만 추가, 중복 금지)

`VideoService` 클래스 마지막에 추가:
```typescript
  async generateAiSummary(id: number) {
    const video = await this.repo.findVideoById(id);
    if (!video) throw new AppError(404, "VIDEO_NOT_FOUND");

    if (!process.env["ANTHROPIC_API_KEY"]) {
      throw new AppError(503, "AI_SERVICE_UNAVAILABLE");
    }

    const sessionTypeLabel: Record<string, string> = {
      INDIVIDUAL_SKILL: "개인 기술",
      TACTICAL_DEFENSIVE: "수비 전술",
      TACTICAL_ATTACKING: "공격 전술",
      TACTICAL_FULL_TEAM: "팀 전술",
      PHYSICAL: "피지컬",
      PSYCHOLOGICAL_SOCIAL: "심리·사회",
      SET_PIECE: "세트피스",
    };

    const sessionTypeKr = video.sessionType ? (sessionTypeLabel[video.sessionType] ?? video.sessionType) : "미분류";

    let aiSummary: string;
    try {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `다음 훈련 영상 정보를 바탕으로 코치와 선수가 참고할 수 있는 2-3문장 요약을 한국어로 작성하세요. 영상 내용을 직접 분석하는 것이 아니라 제공된 메타데이터를 기반으로 영상의 목적과 활용 방법을 설명하세요.

제목: ${video.title}
세션 유형: ${sessionTypeKr}
태그: ${video.tags.length > 0 ? video.tags.join(", ") : "없음"}
URL: ${video.url}

요약만 반환하고 다른 설명은 포함하지 마세요.`,
          },
        ],
      });

      aiSummary = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
      if (!aiSummary) throw new Error("empty response");
    } catch {
      throw new AppError(503, "AI_SERVICE_UNAVAILABLE");
    }

    return this.repo.updateAiSummary(id, aiSummary);
  }
```

### video.controller.ts

- [x] **Step 3: `generateAiSummary` 핸들러 추가**

`apps/api/src/video/video.controller.ts`의 `VideoController` 클래스 마지막에 추가:
```typescript
  generateAiSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!CAN_WRITE.includes(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(
        await this.service.generateAiSummary(Number(req.params["id"])),
      );
    } catch (err) {
      next(err);
    }
  };
```

### video.routes.ts

- [x] **Step 4: 라우트 추가**

`apps/api/src/video/video.routes.ts`에서 `router.delete("/:id", ...)` 줄 아래에 추가:
```typescript
router.post("/:id/ai-summary", auth, controller.generateAiSummary);
```

- [x] **Step 5: TypeScript 빌드 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo.ts" | grep -v "monthlyAttendanceCheck" | head -20
```

Expected: 출력 없음.

- [x] **Step 6: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/video/
git commit -m "feat(video): AI 요약 생성 엔드포인트 추가"
```

---

## Task 5: FE 타입 + 서비스 업데이트

**Files:**
- Modify: `football/src/types/match.ts`
- Modify: `football/src/services/match.service.ts`
- Modify: `football/src/types/video.ts`
- Modify: `football/src/services/video.service.ts`

### types/match.ts

- [x] **Step 1: `StatSheetData` 인터페이스 + `MatchDetail` 필드 추가**

`football/src/types/match.ts`에 `export interface ShotEvent {` 줄 **위에** 추가:
```typescript
export interface StatSheetTeamStat {
  home: number | null
  away: number | null
}

export interface StatSheetScorer {
  name: string
  team: 'home' | 'away'
  minute: number | null
}

export interface StatSheetData {
  possession: StatSheetTeamStat
  shots: StatSheetTeamStat
  shotsOnTarget: StatSheetTeamStat
  goals: StatSheetTeamStat
  corners: StatSheetTeamStat
  fouls: StatSheetTeamStat
  yellowCards: StatSheetTeamStat
  redCards: StatSheetTeamStat
  scorers: StatSheetScorer[]
}
```

`export interface MatchDetail extends Match {` 블록에 필드 추가:
```typescript
export interface MatchDetail extends Match {
  hasSquad: boolean
  playerMatchStats: PlayerMatchStat[]
  teamMatchStats: TeamMatchStat | null
  statSheetRaw: StatSheetData | null
  statSheetImagePath: string | null
}
```

### services/match.service.ts

- [x] **Step 2: import + `uploadStatSheet` 추가**

`football/src/services/match.service.ts` 상단에 import 추가:
```typescript
import type { StatSheetData } from '@/types/match'
```

`matchApi` 객체 마지막에 추가:
```typescript
  uploadStatSheet: (matchId: number, file: File) => {
    const form = new FormData()
    form.append('image', file)
    return api.postForm<{ statSheetRaw: StatSheetData; statSheetImagePath: string }>(
      `/matches/${matchId}/stat-sheet`,
      form,
    )
  },
```

### types/video.ts

- [x] **Step 3: `TrainingVideo`에 `aiSummary` 추가**

`football/src/types/video.ts`의 `TrainingVideo` 인터페이스에 `createdAt` 아래 추가:
```typescript
  aiSummary?: string | null
```

### services/video.service.ts

- [x] **Step 4: `generateAiSummary` 추가**

`football/src/services/video.service.ts`의 `videoApi` 객체 마지막에 추가:
```typescript
  generateAiSummary: (id: number) =>
    api.post<{ id: number; aiSummary: string }>(`/videos/${id}/ai-summary`),
```

- [x] **Step 5: TypeScript 빌드 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep -v "country.repo.ts" | grep -v "monthlyAttendanceCheck" | head -20
```

Expected: 출력 없음.

- [x] **Step 6: 커밋**

```bash
cd /Users/juno/work/football
git add football/src/types/ football/src/services/
git commit -m "feat(fe): match/video AI 관련 타입 + 서비스 추가"
```

---

## Task 6: FE MatchDetailPage — OCR 업로드 + 스탯 표시

**Files:**
- Modify: `football/src/pages/matches/MatchDetailPage.tsx`

MatchDetailPage는 1010줄짜리 파일. 주요 구조:
- `export function MatchDetailPage()` — line 633
- 메인 리턴의 `<div className="flex-1 overflow-auto p-6">` 안에 `<div className="max-w-4xl mx-auto space-y-4">` — line 742
- 이 div 내부 마지막 닫는 `</div>` (line ~989) **전에** 스탯 시트 섹션 추가

- [x] **Step 1: import 추가**

`MatchDetailPage.tsx` 상단 imports에 추가:
```typescript
import { useRef } from 'react'
import { ScanLine, Sparkles } from 'lucide-react'
import type { StatSheetData } from '@/types/match'
```

(기존 `import { useEffect, useState } from 'react'` 줄을 `import { useEffect, useState, useRef } from 'react'`로 수정)

- [x] **Step 2: `MatchDetailPage` 컴포넌트 상태 + 핸들러 추가**

`const [deletingShot, setDeletingShot] = useState<number | null>(null)` 줄 아래에 추가:
```typescript
  const [statUploading, setStatUploading] = useState(false)
  const statFileRef = useRef<HTMLInputElement>(null)
```

`useEffect(() => { fetchMatch(); fetchShots() }, [id])` 줄 아래에 추가:
```typescript
  const handleStatSheetUpload = async (file: File) => {
    if (!id) return
    setStatUploading(true)
    try {
      const result = await matchApi.uploadStatSheet(Number(id), file)
      setMatch(prev => prev ? { ...prev, statSheetRaw: result.statSheetRaw, statSheetImagePath: result.statSheetImagePath } : prev)
      toast.success('스탯 시트 분석 완료')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '스탯 추출에 실패했습니다.')
    } finally {
      setStatUploading(false)
      if (statFileRef.current) statFileRef.current.value = ''
    }
  }
```

- [x] **Step 3: 스탯 시트 섹션 추가**

`MatchDetailPage` 리턴의 `<div className="max-w-4xl mx-auto space-y-4">` 블록 내부,
마지막 `</div>` (line ~989) **직전**에 아래 JSX 추가:

```tsx
          {/* 스탯 시트 OCR */}
          {canInputStats && (
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">스탯 시트 (OCR)</div>
                <div className="flex items-center gap-2">
                  {statUploading && <span className="text-xs text-muted-foreground">분석 중...</span>}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => statFileRef.current?.click()}
                    disabled={statUploading}
                  >
                    <ScanLine className="h-3.5 w-3.5" />
                    {match.statSheetRaw ? '다시 스캔' : '스캔 업로드'}
                  </Button>
                  <input
                    ref={statFileRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleStatSheetUpload(file)
                    }}
                  />
                </div>
              </div>
              {match.statSheetRaw ? (
                <StatSheetDisplay sheet={match.statSheetRaw} homeTeam={match.homeTeamName} awayTeam={match.awayTeamName} />
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  경기 기록지 이미지를 업로드하면 AI가 스탯을 자동 추출합니다.
                </p>
              )}
            </div>
          )}
```

- [x] **Step 4: `StatSheetDisplay` 컴포넌트 추가**

`export function MatchDetailPage()` 줄 **바로 위**(line ~632)에 추가:
```tsx
function StatSheetDisplay({
  sheet,
  homeTeam,
  awayTeam,
}: {
  sheet: StatSheetData
  homeTeam: string
  awayTeam: string
}) {
  const rows: { label: string; key: keyof Omit<StatSheetData, 'scorers'> }[] = [
    { label: '점유율 (%)', key: 'possession' },
    { label: '슈팅', key: 'shots' },
    { label: '유효 슈팅', key: 'shotsOnTarget' },
    { label: '득점', key: 'goals' },
    { label: '코너킥', key: 'corners' },
    { label: '파울', key: 'fouls' },
    { label: '경고', key: 'yellowCards' },
    { label: '퇴장', key: 'redCards' },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 text-[10px] font-semibold text-slate-500 border-b pb-1">
        <div>{homeTeam}</div>
        <div className="text-center">항목</div>
        <div className="text-right">{awayTeam}</div>
      </div>
      {rows.map(({ label, key }) => (
        <div key={key} className="grid grid-cols-3 text-xs">
          <div className="font-semibold tabular-nums">{sheet[key]?.home ?? '—'}</div>
          <div className="text-center text-muted-foreground">{label}</div>
          <div className="text-right font-semibold tabular-nums">{sheet[key]?.away ?? '—'}</div>
        </div>
      ))}
      {sheet.scorers.length > 0 && (
        <div className="border-t pt-2 space-y-1">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">득점자</div>
          {sheet.scorers.map((s, i) => (
            <div key={i} className="text-xs flex gap-2">
              <span className={s.team === 'home' ? 'text-blue-600 font-medium' : 'text-slate-500 font-medium'}>
                {s.team === 'home' ? homeTeam : awayTeam}
              </span>
              <span>{s.name}{s.minute != null ? ` (${s.minute}')` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [x] **Step 5: TypeScript 빌드 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep -v "country.repo.ts" | grep -v "monthlyAttendanceCheck" | head -20
```

Expected: 출력 없음.

- [x] **Step 6: 커밋**

```bash
cd /Users/juno/work/football
git add football/src/pages/matches/MatchDetailPage.tsx
git commit -m "feat(fe): MatchDetailPage OCR 스탯 시트 업로드 + 표시"
```

---

## Task 7: FE TrainingVideoPage — AI 요약 버튼 + 표시

**Files:**
- Modify: `football/src/pages/training/TrainingVideoPage.tsx`

TrainingVideoPage는 테이블 레이아웃. 각 row는 `<TableRow key={v.id}>`. 영상 제목 아래에 요약이 있으면 italic muted 텍스트로 표시, 없으면 COACHING_STAFF/ADMIN에게 "AI 요약" 버튼 표시.

- [x] **Step 1: import 추가**

`TrainingVideoPage.tsx` 상단 imports에 추가:
```typescript
import { videoApi } from '@/services/video.service'
```
(이미 있으면 skip)

Lucide import에 `Sparkles` 추가:
```typescript
import { Plus, ExternalLink, Trash2, Sparkles } from 'lucide-react'
```

- [x] **Step 2: 상태 추가**

`const [filterTag, setFilterTag] = useState('')` 줄 아래에 추가:
```typescript
  const [generatingSummaryId, setGeneratingSummaryId] = useState<number | null>(null)
```

- [x] **Step 3: `handleGenerateSummary` 핸들러 추가**

`const handleDelete = async ...` 함수 아래에 추가:
```typescript
  const handleGenerateSummary = async (id: number) => {
    setGeneratingSummaryId(id)
    try {
      const result = await videoApi.generateAiSummary(id)
      setVideos(prev => prev.map(v => v.id === id ? { ...v, aiSummary: result.aiSummary } : v))
      toast.success('AI 요약이 생성됐습니다.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI 요약 생성에 실패했습니다.')
    } finally {
      setGeneratingSummaryId(null)
    }
  }
```

- [x] **Step 4: 테이블 행에 AI 요약 표시 + 버튼 추가**

기존 테이블의 제목 셀 (`<TableCell className="font-medium">`) 내용을 아래로 교체:
```tsx
                  <TableCell className="font-medium">
                    <div>
                      <a href={v.url} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1 hover:underline">
                        {v.title}
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                      {v.aiSummary ? (
                        <p className="text-xs text-muted-foreground italic mt-1 leading-relaxed">{v.aiSummary}</p>
                      ) : canWrite ? (
                        <button
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1 disabled:opacity-50"
                          onClick={() => handleGenerateSummary(v.id)}
                          disabled={generatingSummaryId === v.id}
                        >
                          <Sparkles className="h-3 w-3" />
                          {generatingSummaryId === v.id ? 'AI 요약 생성 중...' : 'AI 요약 생성'}
                        </button>
                      ) : null}
                    </div>
                  </TableCell>
```

- [x] **Step 5: TypeScript 빌드 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep -v "country.repo.ts" | grep -v "monthlyAttendanceCheck" | head -20
```

Expected: 출력 없음.

- [x] **Step 6: 커밋**

```bash
cd /Users/juno/work/football
git add football/src/pages/training/TrainingVideoPage.tsx
git commit -m "feat(fe): TrainingVideoPage AI 요약 생성 버튼 + 표시"
```

---

## 최종 확인

- [x] **전체 빌드 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo.ts" | grep -v "monthlyAttendanceCheck" | head -20
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep -v "country.repo.ts" | grep -v "monthlyAttendanceCheck" | head -20
```

Expected: 두 명령 모두 출력 없음.
