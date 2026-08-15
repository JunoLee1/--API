# HR·훈련 UX 공백 보완 설계

> 작성일: 2026-08-15  
> 대상 페르소나: Steve (HR 담당자), 이연주 (K리그 HR팀장)  
> 항목: S2 채용 충원률 / Y2 출결 정정 이력 모달 / Y5 HR 보고서 페널티 섹션

---

## 배경

페르소나 분석(2026-08-07) 미구현 항목 중 Steve·이연주 관련 3개를 처리한다.  
S4(세션별 출결 미등록 현황)는 이미 구현 완료 확인, 제외.

---

## S2 — 채용 공고 충원률 표시

### 목표

채용 담당자가 공고 목록에서 "필요 인원 대비 현재 몇 명 온보딩됐나"를 한눈에 확인한다.

### 현황

- BE `GET /recruitment/headcount-progress` 완성됨
  - 반환: `{ postingId, targetHeadcount, hiredCount, fillRate }[]`
  - `hiredCount`: ONBOARDED 상태 지원자 수만 집계
- FE `recruitment.service.ts`에 해당 API 호출 없음
- `JobPostingListPage.tsx`에 충원률 UI 없음

### 설계

**FE `recruitment.service.ts`**:
- `headcountProgress(): Promise<HeadcountProgressItem[]>` 함수 추가
- `GET /recruitment/headcount-progress` 호출

**FE `JobPostingListPage.tsx`**:
- 페이지 마운트 시 `headcountProgress()` 호출, 결과를 `postingId` 키로 Map 구성
- 각 공고 카드에 Progress 바 + "N/M명" 텍스트 렌더링
  - shadcn/ui `<Progress>` 컴포넌트 사용
  - `fillRate` 기준 퍼센트, `hiredCount/targetHeadcount` 텍스트
  - `headcount === 0`이면 섹션 미노출

### 예외 처리

- `headcountProgress()` 실패 시 진행률 섹션 silent 숨김 (공고 목록 로딩은 유지)

---

## Y2 — 출결 정정 이력 모달

### 목표

이연주가 출결 정정 이의신청 대응 시 "언제, 누가, 무엇을, 왜 바꿨나"를 TrainingResultsPage에서 바로 확인한다.

### 현황

- `correctAttendance()` 호출 시 AuditLog `action: "ATTENDANCE_CORRECTED"`, `targetId: resultId`, `detail: { before, after, reason }` 저장됨
- `GET /admin/audit-logs` 엔드포인트 존재. `targetId` + `action` 필터 지원 여부 확인 필요
- FE `TrainingResultsPage`에 이력 조회 UI 없음

### 설계

**BE `admin.service.getAuditLogs()`**:
- `targetId?: string`, `action?: string` 필터 파라미터 추가 (미지원 시)
- 쿼리: `WHERE targetId = $targetId AND action = $action ORDER BY createdAt DESC`

**FE `TrainingResultsPage`**:
- 각 결과 행에 "수정됨 ↕" 뱃지 조건부 표시
  - 조건: 해당 `resultId`에 `ATTENDANCE_CORRECTED` 로그가 존재할 때
  - 로그 존재 여부는 결과 목록 조회 시 BE에서 함께 반환하거나, 별도 API 호출로 확인
- 뱃지 클릭 시 Dialog 열림
  - 헤더: "선수명 — YYYY-MM-DD 훈련 정정 이력"
  - 항목: `정정일시 | 관리자명 | 이전값 → 이후값 | 사유`
  - 데이터: `GET /admin/audit-logs?targetId={resultId}&action=ATTENDANCE_CORRECTED`

**정정 이력 유무 판단 방법**:
- training 결과 목록 조회 후, `resultId` 목록으로 AuditLog를 일괄 조회
  - `SELECT DISTINCT targetId FROM AuditLog WHERE action = 'ATTENDANCE_CORRECTED' AND targetId IN (resultIds)`
- Set으로 변환 후 각 결과에 `hasCorrectionHistory: boolean` 병합하여 반환
- Prisma 스키마 변경 없음, 추가 쿼리 1회로 처리

### 예외 처리

- 이력 로딩 실패 시 Dialog 내 에러 텍스트 표시 ("이력을 불러올 수 없습니다")
- 이력 0건이면 Dialog 미열림 (뱃지 자체가 미노출)

---

## Y5 — HR 보고서 페널티 섹션

### 목표

Steve·이연주가 "페널티 발동 선수가 누구인지, 경고 임박은 누구인지"를 HR 보고서에서 즉시 확인하고 출결 드릴다운으로 이동한다.

### 현황

- `calcEffectiveAbsences(absences, lateCount) = absences + floor(lateCount / 3)` 로직 존재
- `shouldTriggerPenalty(effectiveAbsences) = effectiveAbsences > 0 && effectiveAbsences % 3 === 0` 로직 존재
- `drillAttendance()` 엔드포인트에서 effectiveAbsences 계산됨
- `HrReportPage` 출석률·무단결석만 표시, 페널티 누적 선수 미노출

### 설계

**BE `ops-report.service.ts`**:
- `getPenaltyStatus(teamId, seasonId)` 메서드 추가
  - 해당 팀·시즌의 TrainingResult 집계: 선수별 `absentUnauth`, `lateUnauth` 합산
  - `effectiveAbsences = absentUnauth + floor(lateUnauth / 3)` 계산
  - `effectiveAbsences === 0` 제외
  - 상태 분류:
    - `effectiveAbsences % 3 === 0` → `"TRIGGERED"` (페널티 발동)
    - `effectiveAbsences % 3 === 2` → `"WARNING"` (경고, 임박)
    - `effectiveAbsences % 3 === 1` → `"NORMAL"` (1회 누적)
  - 반환: `{ playerId, playerName, effectiveAbsences, status }[]` (effectiveAbsences 내림차순)

**BE `ops-report.routes.ts`**:
- `GET /ops-report/penalty-status` 라우트 추가
- 접근 권한: `canReadHR()` 미들웨어 적용

**FE `ops-report.service.ts`**:
- `penaltyStatus(teamId, seasonId)` 함수 추가

**FE `HrReportPage.tsx`**:
- 기존 출석 섹션 아래 "실효 결석 누적 현황" 섹션 추가
- 테이블: 선수명 | 실효 결석 | 상태 (배지: red=페널티발동, amber=경고, gray=정상)
- 선수명 클릭 시 출결 드릴다운(`/hr/attendance-drill?playerId={id}`)으로 이동
- 데이터 없음(모두 0회) 시 "페널티 누적 선수 없음" 빈 상태 표시

### 예외 처리

- API 실패 시 섹션 내 에러 상태 표시 (HR 보고서 전체 로딩은 유지)

---

## 공통 사항

- 신규 엔드포인트 모두 기존 인증 미들웨어(`requireUser`) + 권한 체크 적용
- 기존 shadcn/ui 컴포넌트 (Progress, Dialog, Badge, Table) 재사용
- 별도 Prisma 마이그레이션 없음 (스키마 변경 없음)

---

## 구현 범위 요약

| 항목 | BE | FE |
|------|----|----|
| S2 | 없음 (이미 완성) | service 함수 + JobPostingListPage Progress UI |
| Y2 | audit-logs targetId/action 필터 확인·추가, training 결과 API에 hasCorrectionHistory 추가 | TrainingResultsPage 뱃지 + Dialog |
| Y5 | getPenaltyStatus() 메서드 + GET /ops-report/penalty-status 라우트 | HrReportPage 섹션 + penaltyStatus service |
