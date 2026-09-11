# ProspectVideoEvaluation 수정 기능 디자인

**날짜:** 2026-09-11  
**범위:** BE PATCH 엔드포인트 1개 + FE VideoEvalDialog 재사용 확장

---

## 배경

현재 `ProspectVideoEvaluation`은 생성(POST)만 가능하고 수정(PATCH)이 없다. 평가자가 점수를 누락하거나 실수한 경우 DB 직접 조작 외 방법이 없어 수정 엔드포인트와 FE 편집 UI가 필요하다.

---

## 설계 결정

| 항목 | 결정 |
|---|---|
| 수정 권한 | `canWrite` 전체 (Scout·GM·TD) — 본인 작성 여부 무관 |
| 이력 처리 | 덮어쓰기 (PATCH) — 단순 실수 정정 목적. 새 레코드 생성 없음 |
| result 재계산 | `computeVideoEvalResult`로 자동 재계산 — 수동 입력 불가 |
| 편집 대상 | 최신 평가 + 이전 이력 카드 모두 편집 버튼 노출 |

---

## BE

### 엔드포인트

```
PATCH /prospects/:id/video-evaluations/:evalId
```

**권한:** `canWrite(role, frontOfficeRole)` — 403 FORBIDDEN  
**검증:** `evalId`의 `prospectId`가 `:id`와 다르면 404 EVAL_NOT_FOUND

**요청 바디 (모든 필드 optional):**

```ts
interface UpdateProspectVideoEvaluationDto {
  qualityPassed?: boolean
  identifiable?: boolean
  continuity?: boolean
  jerseyNumber?: number | null
  totalScore?: number | null
  scoreData?: Record<string, number> | null
  pipelineData?: PipelineData | null
  notes?: string | null
}
```

**처리 흐름:**
1. 기존 레코드 조회 (`findUnique`) — 없으면 404
2. dto 필드를 기존 값에 merge
3. `computeVideoEvalResult`로 result 재계산
4. `update` 실행 후 `include: { evaluatedBy }` 포함 반환

### 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `prospect/dto/video-evaluation.dto.ts` | `UpdateProspectVideoEvaluationDto` 추가 |
| `prospect/prospect.repo.ts` | `updateVideoEvaluation(evalId, dto, result)` 추가 |
| `prospect/prospect.service.ts` | `updateVideoEvaluation(prospectId, evalId, dto)` 추가 |
| `prospect/prospect.controller.ts` | `updateVideoEvaluation` 핸들러 추가 |
| `prospect/prospect.routes.ts` | `PATCH /:id/video-evaluations/:evalId` 추가 |

---

## FE

### VideoEvalDialog 확장

`initialData?: ProspectVideoEvaluation` prop 추가.  
`open` 시 `initialData`가 있으면 state를 pre-fill, 없으면 기존 빈 폼 동작 유지.  
저장 시 `initialData` 존재 여부로 create/update 분기:

```ts
if (initialData) {
  await prospectApi.videoEvaluations.update(prospectId, initialData.id, dto)
} else {
  await prospectApi.videoEvaluations.create(prospectId, dto)
}
```

### EvalTab 변경

- 최신 평가 카드: 우상단에 편집 아이콘 버튼 (`Pencil` lucide) → `VideoEvalDialog` 오픈
- 이전 이력 카드 (dashed border): 동일하게 편집 아이콘 추가

### prospect.service.ts (FE) 변경

```ts
videoEvaluations: {
  // 기존
  list: ...,
  create: ...,
  // 신규
  update: (prospectId: number, evalId: number, dto: UpdateVideoEvaluationDto) =>
    api.patch<ProspectVideoEvaluation>(`/prospects/${prospectId}/video-evaluations/${evalId}`, dto),
}
```

### 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `football/src/types/prospect.ts` | `UpdateVideoEvaluationDto` 타입 추가 |
| `football/src/services/prospect.service.ts` | `videoEvaluations.update` 추가 |
| `football/src/pages/prospects/ProspectDetailSheet.tsx` | `VideoEvalDialog` `initialData` prop, EvalTab 편집 버튼 |

---

## 테스트

- BE: `PATCH` 정상 수정 + result 재계산 검증 (totalScore 미입력 → PENDING, ≥70 → PASS)
- BE: 다른 prospect의 evalId로 요청 시 404
- BE: canWrite 없는 role → 403
