# 스카우팅 비디오 평가 파이프라인 설계

**날짜:** 2026-09-05  
**이슈:** #502 #503 #504 #505  
**상태:** 승인됨

---

## 배경

Prospect가 LONGLIST 등록 후 SHORTLIST로 승격되는 과정에서 평가 근거가 `Prospect.notes` 자유 텍스트 하나뿐이었다. 이번 구현은 비디오 1차 적합성 평가(구조화), 포지션·예산 게이트 체크, 전술 적합성 스코어링, 스카우팅 타임라인 로그를 하나의 파이프라인으로 연결한다.

---

## 범위

| 이슈 | 내용 | 처리 방식 |
|------|------|-----------|
| #502 | 비디오 1차 적합성 평가 모델 | `ProspectVideoEvaluation` 신규 |
| #503 | 포지션·예산 게이트 체크 | `/acquisition-gate-check` API + FE soft warning |
| #504 | 전술 적합성 분석 입력 | `scoreData` JSON으로 VideoEvaluation에 통합 |
| #505 | 풀매치·일관성·현장·리그 수준 평가 로그 | `ProspectEvaluationLog` 신규 |

---

## 데이터 모델

### Prospect (기존 모델 필드 추가)

```prisma
currentMarketValue  Int?   // 단위: 만원, #503 예산 소프트 체크용, 수동 입력
```

### ProspectVideoEvaluation (신규, #502 + #504)

```prisma
model ProspectVideoEvaluation {
  id            Int             @id @default(autoincrement())
  prospectId    Int
  qualityPassed Boolean         // Hard gate: 화질 720p 이상
  identifiable  Boolean         // Hard gate: 타겟 선수 식별 가능
  continuity    Boolean         // Hard gate: 풀타임 추적 연속성 확보
  totalScore    Int?            // Soft 합산 0~100
  scoreData     Json?           // {"sprints":72,"passAcc":85,"dualWin":68} 포지션별 자유 키
  result        VideoEvalResult // PASS | FAIL | PENDING (앱 레이어에서 자동 계산)
  notes         String?
  evaluatedById Int
  evaluatedAt   DateTime        @default(now())

  prospect    Prospect @relation(fields: [prospectId], references: [id])
  evaluatedBy User     @relation(fields: [evaluatedById], references: [id])
}

enum VideoEvalResult {
  PASS
  FAIL
  PENDING
}
```

**result 자동 계산 규칙 (서비스 레이어):**
- hard gate 3개 중 하나라도 `false` → `FAIL`
- 전부 `true` + `totalScore >= 70` → `PASS`
- 전부 `true` + (`totalScore < 70` 또는 `totalScore null`) → `PENDING`

**레코드 정책:** Prospect당 N개 허용. 최신 레코드가 현재 상태를 대표한다. 재평가 시 새 레코드 추가(이력 보존).

**쓰기 권한:** SCOUT, GM, TD  
**읽기 권한:** FRONT_OFFICE 전체, HEAD_COACH

### ProspectEvaluationLog (신규, #505)

```prisma
model ProspectEvaluationLog {
  id            Int               @id @default(autoincrement())
  prospectId    Int
  type          EvaluationLogType
  note          String
  evaluatedById Int
  evaluatedAt   DateTime          @default(now())

  prospect    Prospect @relation(fields: [prospectId], references: [id])
  evaluatedBy User     @relation(fields: [evaluatedById], references: [id])
}

enum EvaluationLogType {
  VIDEO_ANALYSIS  // 풀매치 비디오 분석
  CONSISTENCY     // 복수 경기 일관성 평가
  FIELD_VISIT     // 현장 직접 관전
  LEAGUE_LEVEL    // 리그 수준 적절성 확인
}
```

**LONGLIST 단계부터 추가 가능** (기존 NegotiationLog는 ACTIVE 이후만 가능했던 것과 다름).  
**쓰기 권한:** SCOUT, GM, TD  
**읽기 권한:** FRONT_OFFICE 전체, HEAD_COACH

---

## BE API

### ProspectVideoEvaluation

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/prospects/:id/video-evaluations` | 새 평가 제출. result 서버에서 자동 계산. |
| `GET`  | `/prospects/:id/video-evaluations` | 평가 이력 전체 (최신순) |

**POST body:**
```json
{
  "qualityPassed": true,
  "identifiable": true,
  "continuity": false,
  "totalScore": 62,
  "scoreData": { "sprints": 72, "passAcc": 85, "dualWin": 55 },
  "notes": "연속성 확보 실패, 재촬영 필요"
}
```

**POST response:** 생성된 `ProspectVideoEvaluation` 레코드 (계산된 `result` 포함)

### ProspectEvaluationLog

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/prospects/:id/evaluation-logs` | 로그 추가 |
| `GET`  | `/prospects/:id/evaluation-logs` | 로그 전체 (최신순) |

**POST body:**
```json
{
  "type": "FIELD_VISIT",
  "note": "경기 직접 관전. 압박 강도 인상적.",
  "evaluatedAt": "2026-08-28T00:00:00.000Z"
}
```

### SHORTLIST 게이트 변경

**기존:** `POST /prospects/:id/transition { status: 'SHORTLIST' }` 단순 전환  
**변경:** LONGLIST → SHORTLIST 요청 시 서비스 레이어에서 추가 검증:

1. `ProspectVideoEvaluation` 최신 레코드 조회
2. 없거나 `result != 'PASS'` → `400 VIDEO_EVAL_REQUIRED`
   ```json
   { "code": "VIDEO_EVAL_REQUIRED", "latestResult": "FAIL" }
   ```
3. PASS 확인 후 상태 전환 진행

### 예산·포지션 게이트 체크 (#503, 신규)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET`  | `/prospects/:id/acquisition-gate-check` | soft warning 데이터 조회 |

**Response:**
```json
{
  "positionMatched": true,
  "budgetWarning": false,
  "matchedSurveys": [
    { "id": 3, "position": "CB", "budgetMin": 5000, "budgetMax": 30000 }
  ]
}
```

- `positionMatched`: `status=OPEN`인 `PlayerAcquisitionSurvey`의 응답 항목(`PlayerAcquisitionSurveyResponseItem`) 중 `position = Prospect.position`인 것이 하나라도 있으면 true
- `budgetWarning`: `Prospect.currentMarketValue`가 매칭된 모든 response item의 `budgetMax`를 초과하는 경우 true (currentMarketValue null이거나 매칭 item 없으면 false)

---

## FE

### 파일 구조

```
football/src/
├── types/prospect.ts                    # VideoEvalResult, ProspectVideoEvaluation,
│                                        # ProspectEvaluationLog, EvaluationLogType 추가
├── api/prospectApi.ts                   # videoEvaluations.list/create,
│                                        # evaluationLogs.list/create,
│                                        # acquisitionGateCheck 추가
└── pages/prospects/
    ├── ProspectsPage.tsx                # selectedProspect 상태 + Sheet 연동
    │                                    # SHORTLIST 승격 버튼 플로우 변경
    └── ProspectDetailSheet.tsx          # 신규
```

### ProspectDetailSheet

**Sheet 너비:** `w-[480px]` (기존 Dialog 패턴과 일관성 유지)

**탭 구성 (2개):**

**탭 1 — 기본정보**
- 이름, 포지션, 국적, 현소속, 상태 badge, playStyle
- 비자 정보 (visaRequired, visaEligibility)
- `currentMarketValue` 입력 (SCOUT/TD/GM 편집 가능, 단위 표기: 만원)
- `notes` textarea 편집

**탭 2 — 평가**

*위 섹션: 비디오 1차 평가*
- 최신 평가 카드: result badge (PASS=green / FAIL=red / PENDING=amber) + hard gate 3개 chip + totalScore + scoreData 항목 요약
- 이전 평가 이력: 접힌 형태로 최신순 표시 (날짜 + result만 표시)
- `+ 새 평가` 버튼 → `VideoEvalDialog`

`VideoEvalDialog`:
- Hard gate 3개 Checkbox (화질 / 선수 식별 / 추적 연속성)
- totalScore: 0~100 숫자 입력
- scoreData: Prospect.playStyle 기반 지표 키 템플릿 자동 제안, 각 키에 숫자 입력
- notes: textarea
- 제출 전 result 미리보기 표시 ("현재 조건: FAIL")
- 제출 시 result 서버에서 계산 (FE 계산은 preview용)

*아래 섹션: 스카우팅 로그*
- 타임라인 (최신순), type별 좌측 색상 바 구분
  - VIDEO_ANALYSIS: indigo / CONSISTENCY: violet / FIELD_VISIT: teal / LEAGUE_LEVEL: amber
- `+ 로그 추가` 버튼 → 소형 인라인 폼 (type select + note textarea + evaluatedAt datepicker)
- LONGLIST 단계부터 추가 가능

### SHORTLIST 승격 플로우 (FE)

```
"쇼트리스트 승격" 버튼 클릭
  → GET /prospects/:id/acquisition-gate-check
  → positionMatched=false 또는 budgetWarning=true 시:
      confirm dialog: "포지션 미매칭 / 예산 초과 가능성. 그래도 승격하시겠습니까?"
  → 확인 (또는 경고 없음)
  → POST /prospects/:id/transition { status: 'SHORTLIST' }
  → 400 VIDEO_EVAL_REQUIRED 수신 시:
      toast.error("비디오 평가 PASS 필요. 평가 탭에서 먼저 평가를 완료해주세요.")
```

---

## 설계 결정 사항

- **#504 통합:** 전술 적합성 지표는 별도 모델 없이 `ProspectVideoEvaluation.scoreData` JSON으로 통합. playStyle 기반 키 템플릿은 FE에서만 제안하고 서버는 임의 JSON 수용.
- **result 계산 위치:** 서버 서비스 레이어에서 계산 후 저장. FE는 preview 표시용으로만 동일 로직 복사.
- **#503 hard block 없음:** 예산·포지션 체크는 FE soft warning만. BE는 VideoEval 게이트만 hard block.
- **EvaluationLog evaluatedAt:** 클라이언트가 과거 날짜 전달 가능 (현장 방문 후 늦게 입력하는 경우).
- **CONTEXT.md 업데이트 필요:** `ProspectVideoEvaluation`, `ProspectEvaluationLog` 엔티티 문서화.
