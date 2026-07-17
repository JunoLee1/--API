# MatchDetailPage Fotmob 리뉴얼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `football/src/pages/matches/MatchDetailPage.tsx` 단일 파일을 Fotmob B-스타일(그라디언트 헤더 + 비교 바 + 칩 그리드)로 교체한다.

**Architecture:** 기존 파일 내 `StatCard` 제거, `TeamStatsBar` 로컬 컴포넌트 추가. BE/API/타입/라우트 변경 없음. `TeamMatchStat`은 홈팀 1팀 데이터만 보유하므로 점유율만 분할 바(합=100), 나머지는 단일값 행으로 표현.

**Tech Stack:** React, Tailwind CSS, shadcn/ui (Button, Dialog, Input, Label, Skeleton), lucide-react

---

## File Map

- Modify: `football/src/pages/matches/MatchDetailPage.tsx` (280 lines → ~260 lines)
  - Remove: `StatCardProps`, `StatCard`, `Separator` import
  - Add: `TeamStatsBar` (local, file-inline)
  - Modify: score header, team stats section, auxiliary chips, player table

---

### Task 1: Score Header — 그라디언트 교체

**Files:**
- Modify: `football/src/pages/matches/MatchDetailPage.tsx:161-177`

- [ ] **Step 1: 기존 `bg-card` 헤더 블록을 그라디언트 헤더로 교체**

```tsx
{/* 스코어 헤더 */}
<div
  className="rounded-xl text-white px-5 py-6"
  style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)' }}
>
  <div className="flex items-center justify-center gap-2 mb-4">
    <span className="bg-white/15 text-blue-200 rounded px-2 py-0.5 text-[10px]">
      {COMPETITION_LABEL[match.competitionType]}
    </span>
    <span className="text-blue-300 text-[10px]">{formatDate(match.date)}</span>
  </div>
  <div className="flex items-center justify-between px-2">
    <div className="flex-1 text-right">
      <div className="text-base font-bold">{match.homeTeamName}</div>
      <div className="text-[10px] text-blue-200 mt-0.5">홈</div>
    </div>
    <div className="mx-5 text-center bg-white/10 rounded-xl px-5 py-2.5">
      <div className="text-[30px] font-extrabold tabular-nums leading-none tracking-wide">
        {match.homeScore != null && match.awayScore != null
          ? `${match.homeScore} : ${match.awayScore}`
          : 'vs'}
      </div>
      {match.homeScore != null && match.awayScore != null && (() => {
        const h = match.homeScore, a = match.awayScore
        const label = h > a ? '승' : h === a ? '무' : '패'
        const cls = h > a ? 'text-green-400' : h === a ? 'text-slate-300' : 'text-red-400'
        return <div className={`text-[10px] font-semibold mt-1 ${cls}`}>FT · {label}</div>
      })()}
    </div>
    <div className="flex-1 text-left">
      <div className="text-base font-bold">{match.awayTeamName}</div>
      <div className="text-[10px] text-blue-200 mt-0.5">원정</div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: `Separator` import 제거 (라인 10에서)**

`Separator` import 라인 삭제.

- [ ] **Step 3: 브라우저에서 스코어 헤더 확인**

npm dev 서버가 이미 실행 중이면 브라우저에서 경기 상세 페이지 열고 헤더 렌더링 확인.

---

### Task 2: TeamStatsBar 컴포넌트 + 팀 통계 섹션

**Files:**
- Modify: `football/src/pages/matches/MatchDetailPage.tsx` — `StatCard` 제거, `TeamStatsBar` 추가, 팀통계 섹션 교체

- [ ] **Step 1: `StatCardProps`·`StatCard` 삭제 (라인 36-54)**

두 인터페이스+함수 블록 전부 제거.

- [ ] **Step 2: `TeamStatsBar` 컴포넌트 추가 (StatCard 자리에)**

```tsx
interface StatRowProps {
  label: string
  homeVal: number
  awayVal: number | null
  homeMax?: number
  fmt?: (v: number) => string
  homeColor?: string
  awayColor?: string
  sub?: string
}

function StatRow({ label, homeVal, awayVal, homeMax, fmt, homeColor = '#2563eb', awayColor = '#dc2626', sub }: StatRowProps) {
  const total = awayVal != null ? homeVal + awayVal : (homeMax ?? homeVal)
  const homePct = total > 0 ? Math.round((homeVal / total) * 100) : 50
  const awayPct = 100 - homePct
  const display = fmt ?? ((v: number) => String(v))
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[11px] font-bold" style={{ color: homeColor }}>{display(homeVal)}</span>
        <span className="text-[10px] text-slate-500">{label}{sub ? ` (${sub})` : ''}</span>
        {awayVal != null
          ? <span className="text-[11px] font-bold" style={{ color: awayColor }}>{display(awayVal)}</span>
          : <span className="text-[11px] text-slate-300">—</span>}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: '#e2e8f0' }}>
        <div style={{ width: `${homePct}%`, background: homeColor }} />
        {awayVal != null && <div style={{ width: `${awayPct}%`, background: awayColor }} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 팀 통계 섹션 블록 교체 (라인 180-209)**

```tsx
{ts && (
  <div className="rounded-xl border bg-white p-4">
    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center mb-3">팀 통계</div>
    {/* 점유율: 합=100이므로 유일한 진짜 비교 바 */}
    <StatRow
      label="점유율"
      homeVal={ts.possession}
      awayVal={100 - ts.possession}
      fmt={(v) => `${v}%`}
    />
    {/* 슈팅: 홈 단일값 */}
    <StatRow
      label="슈팅"
      homeVal={ts.shots}
      awayVal={null}
      homeMax={ts.shots}
      sub={`유효 ${ts.shotsOnTarget}회`}
    />
    {/* 패스 성공률: 홈 단일값 */}
    <StatRow
      label="패스 성공률"
      homeVal={ts.passAccuracy}
      awayVal={null}
      homeMax={100}
      fmt={(v) => `${v}%`}
    />
    {/* xG: 홈 단일값, 초록 바 */}
    <StatRow
      label="xG"
      homeVal={ts.xG}
      awayVal={null}
      homeMax={Math.max(ts.xG, 3)}
      fmt={(v) => v.toFixed(2)}
      homeColor="#10b981"
    />
  </div>
)}
```

---

### Task 3: 보조 통계 칩 (3열: 코너킥 / 경고 / 파울)

**Files:**
- Modify: `football/src/pages/matches/MatchDetailPage.tsx` — 기존 6열 보조 통계 그리드를 3칩 그리드로 교체

- [ ] **Step 1: 팀 통계 섹션 바로 아래에 3-칩 그리드 추가**

```tsx
{ts && (
  <div className="grid grid-cols-3 gap-2">
    {[
      { label: '코너킥', value: ts.corners, accent: false },
      { label: '경고', value: ts.yellowCards, accent: true },
      { label: '파울', value: ts.fouls, accent: false },
    ].map(({ label, value, accent }) => (
      <div key={label} className="rounded-lg border bg-white p-3 text-center">
        <div className={`text-sm font-bold tabular-nums ${accent ? 'text-amber-500' : 'text-slate-900'}`}>
          {value}
        </div>
        <div className="text-[9px] text-slate-400 mt-0.5">{label}</div>
      </div>
    ))}
  </div>
)}
```

---

### Task 4: 선수 기록 테이블 스타일 + 정리

**Files:**
- Modify: `football/src/pages/matches/MatchDetailPage.tsx:211-271`

- [ ] **Step 1: 선수 테이블 헤더·데이터 스타일 교체**

```tsx
{match.playerMatchStats.length > 0 && (
  <div className="rounded-xl border bg-white p-4">
    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-3">선수 기록</div>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left pb-2 text-[9px] font-semibold text-slate-400 uppercase tracking-wide">선수</th>
            <th className="pb-2 text-[9px] font-semibold text-slate-400 uppercase tracking-wide text-center w-10">득점</th>
            <th className="pb-2 text-[9px] font-semibold text-slate-400 uppercase tracking-wide text-center w-10">도움</th>
            <th className="pb-2 text-[9px] font-semibold text-slate-400 uppercase tracking-wide text-center w-12">xG</th>
            <th className="pb-2 text-[9px] font-semibold text-slate-400 uppercase tracking-wide text-center w-14">출전</th>
          </tr>
        </thead>
        <tbody>
          {match.playerMatchStats.map((s) => {
            const pos = s.player.position as Position
            const zone = POSITION_ZONE[pos]
            return (
              <tr key={s.id} className="border-b border-slate-50 last:border-0">
                <td className="py-1.5 flex items-center gap-1.5">
                  <span className={`inline-flex rounded border px-1 py-0.5 text-[10px] font-mono font-semibold shrink-0 ${ZONE_STYLE[zone]}`}>
                    {POSITION_ABBR[pos]}
                  </span>
                  <span className={cn('text-[11px]', (s.goals ?? 0) > 0 ? 'font-semibold text-slate-900' : 'text-slate-700')}>
                    {s.player.playerName}
                  </span>
                </td>
                <td className={cn('text-center tabular-nums text-[11px]', (s.goals ?? 0) > 0 ? 'font-bold text-slate-900' : 'text-slate-400')}>
                  {s.goals ?? '—'}
                </td>
                <td className={cn('text-center tabular-nums text-[11px]', (s.assists ?? 0) > 0 ? 'font-bold text-slate-900' : 'text-slate-400')}>
                  {s.assists ?? '—'}
                </td>
                <td className={cn('text-center tabular-nums text-[11px]',
                  s.xG != null && s.xG >= 1.5 ? 'text-emerald-600 font-semibold' : 'text-slate-400')}>
                  {s.xG != null ? s.xG.toFixed(2) : '—'}
                </td>
                <td className="text-center tabular-nums text-[11px] text-slate-400">
                  {s.minutesPlayed != null ? `${s.minutesPlayed}'` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  </div>
)}
```

---

### Task 5: TypeScript 체크 + 커밋

**Files:**
- Verify: `football/src/pages/matches/MatchDetailPage.tsx`

- [ ] **Step 1: TS 타입 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -30
```

Expected: 에러 없음 (혹은 기존 무관한 에러만)

- [ ] **Step 2: 커밋**

```bash
git add football/src/pages/matches/MatchDetailPage.tsx
git commit -m "feat(match): Fotmob B-style score header, stat bars, player table"
```
