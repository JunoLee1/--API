# 전술 분석 PRE/POST 시점 분기 폼 설계

**날짜:** 2026-07-18  
**범위:** `TacticalAnalysis` 도메인 — 경기 전·후 분기 폼, 상세/수정 다이얼로그, 파일 업로드 통합

---

## 목표

전술 분석 등록/수정 폼을 분석 시점(PRE_MATCH / POST_MATCH)에 따라 분기한다.
- PRE_MATCH: 🛡️ 사전 전력 분석 — 상대팀 패턴·약점 파악
- POST_MATCH: ⚔️ 사후 경기 리뷰 — 우리 팀 전술 수행도·개선점 파악

---

## 스키마 변경

`TacticalAnalysis` 모델에 nullable 컬럼 추가 (마이그레이션: `20260718_tactical_phase_fields`):

### PRE_MATCH 전용
| 필드 | 타입 | 설명 |
|------|------|------|
| `opponentFormation` | `String?` | 상대팀 예상 포메이션 |
| `opponentKeyThreat` | `String? @db.Text` | 빌드업/공격 전개 특징 (Key Threat) |
| `opponentWeakness` | `String? @db.Text` | 수비 취약점 및 공략 포인트 |
| `opponentKeyPlayer` | `String?` | 요주의 인물 |

### POST_MATCH 전용
| 필드 | 타입 | 설명 |
|------|------|------|
| `tacticalCompliance` | `String? @db.Text` | 전술 지시 이행도 평가 |
| `concededAnalysis` | `String? @db.Text` | 실점/위기 발생 원인 분석 |
| `momPlayerId` | `String?` | 수훈 선수 FK → Player |
| `momNote` | `String?` | 수훈 선수 코멘트 |
| `improvementPlayerId` | `String?` | 보완 필요 선수 FK → Player |
| `improvementNote` | `String?` | 보완 필요 선수 코멘트 |

### 기존 필드 재활용
- `formation String?` — PRE: "우리 팀 계획 포메이션", POST: "우리 팀 실제 포메이션"
- `opponentAnalysis String?` — 양쪽 모두 "기타 메모"로 유지

---

## BE 변경

### `tactical.dto.ts`
`CreateAnalysisDto` + `UpdateAnalysisDto` 에 새 필드 추가 (전부 optional).

### `tactical.repo.ts`
- `create()`: 새 필드 포함해서 저장
- `update(id, dto)` 메서드 추가: 모든 phase-specific 필드 업데이트
- `findAll()` select에 새 필드 추가
- Player 관계 include: momPlayer, improvementPlayer (nickname 포함)

### `tactical.service.ts`
`updateAnalysis(id, dto)` 메서드 추가.

### `tactical.controller.ts` + `tactical.routes.ts`
`PATCH /:id` 엔드포인트 추가 (ADMIN + COACHING_STAFF + TACTICAL_ANALYST).

---

## FE 변경

### `types/tactical.ts`
- `TacticalAnalysis` 인터페이스에 새 필드 추가
- `CreateTacticalDto` / `UpdateTacticalDto` 업데이트
- `momPlayer`, `improvementPlayer` 중첩 타입 추가

### `services/tactical.service.ts`
`update(id, dto)` 메서드 추가.

### `TacticalAnalysisPage.tsx`

#### AnalysisFormDialog (create + edit 통합)
- create 모드: 경기 선택, 시점 선택, phase-specific 필드, 파일 업로드
- edit 모드: 기존 값 pre-fill, phase 고정(변경 불가), 수정 저장
- phase 선택에 따라 아래 섹션 동적 전환:

```
공통
  경기 *              [Select]   — edit 모드에서 disabled
  분석 시점 *         [Select]   — edit 모드에서 disabled

🛡️ PRE_MATCH 섹션
  우리 팀 계획 포메이션   [FORMATION_OPTIONS Select]
  상대팀 예상 포메이션    [FORMATION_OPTIONS Select]
  빌드업/공격 전개 특징   [Textarea]
  수비 취약점 및 공략 포인트 [Textarea]
  요주의 인물           [Input]
  기타 메모             [Textarea]

⚔️ POST_MATCH 섹션
  우리 팀 실제 포메이션   [FORMATION_OPTIONS Select]
  전술 지시 이행도 평가   [Textarea]
  실점/위기 발생 원인     [Textarea]
  수훈 선수 (MOM)         [Player Select] + [Input 메모]
  보완 필요 선수          [Player Select] + [Input 메모]
  기타 메모               [Textarea]

공통
  사진/영상              [파일 선택 + 미리보기]
```

#### 메인 페이지 행 클릭
테이블 행 클릭 → edit 모드로 `AnalysisFormDialog` 오픈.

#### 선수 목록
`playerApi.list()` 또는 기존 `matchApi` 활용 가능한 경우 선수 목록 로드.  
→ 기존 `/players` API 또는 직접 조회.

---

## 제약

- `momPlayerId` / `improvementPlayerId` 는 우리 팀 Player만 선택 가능 (Player 목록 = 전체 등록 선수)
- 파일 업로드는 create 완료 후 분석 ID로 `POST /tactical/:id/media` 호출 (기존 방식 유지)
- edit 모드에서 기존 업로드 파일 목록 표시 (조회 전용; 삭제 기능 미포함)
