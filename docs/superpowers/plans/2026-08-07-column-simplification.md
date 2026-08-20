# Plan: 테이블 컬럼 단순화 — PlayerDetailPage 계약 섹션 접근 제한

## Goal
PlayerDetailPage의 계약 섹션(급여, 시작/종료일, 계약 상태)을 COACHING_STAFF 유저에게 숨긴다.  
`canSeeContract` 플래그를 추가하고 해당 div를 조건부 렌더링으로 감싼다.  
ADMIN, GM, FRONT_OFFICE(TD)만 계약 섹션을 볼 수 있다.

## Architecture
- 변경 범위: 프론트엔드 단일 파일
- 백엔드 변경 없음 — API는 이미 역할에 관계없이 계약 데이터를 반환하지만, 화면에서만 제어
- 기존 `canSeeMarketValue` 패턴과 동일한 구조로 추가

## Tech Stack
- React + TypeScript (football/src/)
- `useCurrentUser()` 훅으로 `user.role`, `user.frontOfficeRole` 접근

---

## File Change Map

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `football/src/pages/players/PlayerDetailPage.tsx` | 수정 | `canSeeContract` 플래그 추가, 계약 섹션 wrap |

---

## Task 1 — `canSeeContract` 플래그 추가

**File:** `football/src/pages/players/PlayerDetailPage.tsx`

**현재 코드 (lines 119-122):**
```typescript
const canSeeMarketValue =
  user?.role === 'ADMIN' ||
  user?.role === 'GM' ||
  (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'TD')
const canUpdateMarketValue = canSeeMarketValue
```

**변경 후:**
```typescript
const canSeeMarketValue =
  user?.role === 'ADMIN' ||
  user?.role === 'GM' ||
  (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'TD')
const canUpdateMarketValue = canSeeMarketValue
const canSeeContract =
  user?.role === 'ADMIN' ||
  user?.role === 'GM' ||
  (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'TD')
```

**Edit target (old_string):**
```typescript
  const canUpdateMarketValue = canSeeMarketValue
  const isYouthPlayer = player?.team?.type === 'YOUTH'
```

**Edit target (new_string):**
```typescript
  const canUpdateMarketValue = canSeeMarketValue
  const canSeeContract =
    user?.role === 'ADMIN' ||
    user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'TD')
  const isYouthPlayer = player?.team?.type === 'YOUTH'
```

**Steps:**
1. `Edit` 도구로 위 변경 적용

---

## Task 2 — 계약 섹션 조건부 렌더링 wrap

**File:** `football/src/pages/players/PlayerDetailPage.tsx`

**현재 코드 (lines 339-358):**
```tsx
                {/* 최근 계약 */}
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-1">{t('detailPage.contractTitle')}</h3>
                  <Separator className="mb-1" />
                  {latestContract ? (
                    <>
                      <StatRow label={t('detailPage.contractStart')} value={formatDate(latestContract.startDate)} />
                      <Separator />
                      <StatRow label={t('detailPage.contractEnd')} value={formatDate(latestContract.endDate)} />
                      <Separator />
                      <StatRow label={t('detailPage.salary')} value={formatSalary(latestContract.salary)} />
                      <Separator />
                      <StatRow label={t('detailPage.contractStatus')} value={latestContract.status} />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {t('detailPage.noContract')}
                    </p>
                  )}
                </div>
```

**변경 후:**
```tsx
                {/* 최근 계약 */}
                {canSeeContract && (
                  <div className="rounded-lg border bg-card p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-1">{t('detailPage.contractTitle')}</h3>
                    <Separator className="mb-1" />
                    {latestContract ? (
                      <>
                        <StatRow label={t('detailPage.contractStart')} value={formatDate(latestContract.startDate)} />
                        <Separator />
                        <StatRow label={t('detailPage.contractEnd')} value={formatDate(latestContract.endDate)} />
                        <Separator />
                        <StatRow label={t('detailPage.salary')} value={formatSalary(latestContract.salary)} />
                        <Separator />
                        <StatRow label={t('detailPage.contractStatus')} value={latestContract.status} />
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        {t('detailPage.noContract')}
                      </p>
                    )}
                  </div>
                )}
```

**Edit target (old_string):**
```tsx
                {/* 최근 계약 */}
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-1">{t('detailPage.contractTitle')}</h3>
                  <Separator className="mb-1" />
                  {latestContract ? (
                    <>
                      <StatRow label={t('detailPage.contractStart')} value={formatDate(latestContract.startDate)} />
                      <Separator />
                      <StatRow label={t('detailPage.contractEnd')} value={formatDate(latestContract.endDate)} />
                      <Separator />
                      <StatRow label={t('detailPage.salary')} value={formatSalary(latestContract.salary)} />
                      <Separator />
                      <StatRow label={t('detailPage.contractStatus')} value={latestContract.status} />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {t('detailPage.noContract')}
                    </p>
                  )}
                </div>
```

**Edit target (new_string):**
```tsx
                {/* 최근 계약 */}
                {canSeeContract && (
                  <div className="rounded-lg border bg-card p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-1">{t('detailPage.contractTitle')}</h3>
                    <Separator className="mb-1" />
                    {latestContract ? (
                      <>
                        <StatRow label={t('detailPage.contractStart')} value={formatDate(latestContract.startDate)} />
                        <Separator />
                        <StatRow label={t('detailPage.contractEnd')} value={formatDate(latestContract.endDate)} />
                        <Separator />
                        <StatRow label={t('detailPage.salary')} value={formatSalary(latestContract.salary)} />
                        <Separator />
                        <StatRow label={t('detailPage.contractStatus')} value={latestContract.status} />
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        {t('detailPage.noContract')}
                      </p>
                    )}
                  </div>
                )}
```

**Steps:**
1. `Edit` 도구로 위 변경 적용

---

## Task 3 — TypeScript 빌드 확인

**Commands:**
```bash
cd /Users/juno/work/football/football
npx tsc --noEmit
```

오류 없으면 완료.

---

## Task 4 — 커밋 및 PR

**Commit message:**
```
feat(players): hide contract section from COACHING_STAFF on PlayerDetailPage

Add canSeeContract flag (ADMIN | GM | FO-TD only) and wrap the contract
div in a conditional render. No backend changes required.
```

**Commands:**
```bash
git add football/src/pages/players/PlayerDetailPage.tsx
git commit -m "feat(players): hide contract section from COACHING_STAFF on PlayerDetailPage

Add canSeeContract flag (ADMIN | GM | FO-TD only) and wrap the contract
div in a conditional render. No backend changes required."
gh pr create \
  --title "feat(players): hide contract section from COACHING_STAFF" \
  --body "## Summary
- \`canSeeContract\` 플래그 추가 (ADMIN | GM | FO-TD)
- 계약 섹션 div를 \`{canSeeContract && ...}\`로 wrap
- COACHING_STAFF 유저는 계약/급여 정보 미노출

## Test Plan
- [x] ADMIN 로그인 → PlayerDetailPage → 계약 섹션 표시 확인
- [x] GM 로그인 → PlayerDetailPage → 계약 섹션 표시 확인
- [x] FO(TD) 로그인 → PlayerDetailPage → 계약 섹션 표시 확인
- [x] COACHING_STAFF 로그인 → PlayerDetailPage → 계약 섹션 미노출 확인
- [x] PLAYER 로그인 → PlayerDetailPage → 계약 섹션 미노출 확인"
```

---

## 역할별 접근 매트릭스

| Role | frontOfficeRole | canSeeContract |
|------|-----------------|----------------|
| ADMIN | — | true |
| GM | — | true |
| FRONT_OFFICE | TD | true |
| FRONT_OFFICE | 기타 | false |
| COACHING_STAFF | — | false |
| PLAYER | — | false |

---

## 주의사항
- `canSeeContract`의 조건은 `canSeeMarketValue`와 동일하다. 나중에 두 플래그의 로직이 달라질 수 있으므로 별도 상수로 유지한다 (공유하지 않는다).
- 백엔드 `/players/:id` API는 계약 데이터를 계속 반환한다. 민감 데이터를 백엔드에서도 역할별로 필터링하려면 별도 작업이 필요하다 (이 플랜의 범위 외).
