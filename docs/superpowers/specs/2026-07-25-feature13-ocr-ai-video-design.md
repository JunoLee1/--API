# Feature 13: OCR 경기 기록지 스캔 + AI 영상 요약 설계

## 개요

두 가지 독립 AI 기능:
1. **OCR**: 경기 기록지(스탯 시트) 이미지를 Claude Vision으로 분석 → Match 데이터에 JSON 저장
2. **AI 요약**: 기존 훈련 영상의 제목/태그/세션유형을 Claude에 제공 → 한국어 요약 생성 → TrainingVideo에 저장

둘 다 Anthropic Claude API 사용. 각 기능은 기존 도메인(Match, Video) 모듈에 직접 통합.

---

## 데이터 모델

### Match 테이블 신규 필드
```prisma
model Match {
  // ... 기존 필드 유지 ...
  statSheetRaw       Json?    // Claude Vision 추출 스탯 JSON
  statSheetImagePath String?  // 업로드 이미지 상대경로 (uploads/ 하위)
}
```

`statSheetRaw` JSON 구조 (Claude가 반환하는 형식):
```json
{
  "possession": { "home": 58, "away": 42 },
  "shots": { "home": 14, "away": 8 },
  "shotsOnTarget": { "home": 5, "away": 3 },
  "goals": { "home": 2, "away": 1 },
  "corners": { "home": 6, "away": 3 },
  "fouls": { "home": 11, "away": 14 },
  "yellowCards": { "home": 1, "away": 2 },
  "redCards": { "home": 0, "away": 0 },
  "scorers": [
    { "name": "김민준", "team": "home", "minute": 23 },
    { "name": "박지성", "team": "home", "minute": 67 }
  ]
}
```

### TrainingVideo 테이블 신규 필드
```prisma
model TrainingVideo {
  // ... 기존 필드 유지 ...
  aiSummary String?  // Claude 생성 한국어 요약 (2-3문장)
}
```

---

## API 설계

### 공통 인프라
- **파일**: `apps/api/src/lib/claude.ts`
- `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` 싱글턴
- `ANTHROPIC_API_KEY` 미설정 시 서버 시작 시 경고 로그, 기능 호출 시 503 반환

### OCR 엔드포인트
```
POST /matches/:id/stat-sheet
Content-Type: multipart/form-data
Body: { image: File }  // JPEG/PNG, 최대 5MB
권한: ADMIN, COACHING_STAFF
```

처리 흐름:
1. Multer로 이미지 수신 → `uploads/stat-sheets/{timestamp}-{original}` 저장
2. 파일을 base64로 읽기
3. Claude `claude-haiku-4-5-20251001` Vision 호출 (비용 최적화):
   - 이미지 + 추출 프롬프트(위 JSON 스키마 명시)
4. Claude 응답에서 JSON 파싱 (코드블록 제거, JSON.parse)
5. `Match.statSheetRaw = parsedJson`, `Match.statSheetImagePath = 상대경로` 업데이트
6. `{ statSheetRaw, statSheetImagePath }` 반환

에러:
- 이미지 없음 → 400 `IMAGE_REQUIRED`
- JSON 파싱 실패 → 422 `STAT_EXTRACTION_FAILED` (Claude 원본 텍스트 포함)
- Claude API 오류 → 503 `AI_SERVICE_UNAVAILABLE`

### AI 요약 엔드포인트
```
POST /videos/:id/ai-summary
권한: ADMIN, COACHING_STAFF
```

처리 흐름:
1. `TrainingVideo` 조회 (없으면 404)
2. Claude `claude-haiku-4-5-20251001` 호출:
   ```
   다음 훈련 영상 정보를 바탕으로 코치와 선수가 참고할 수 있는 2-3문장 요약을 한국어로 작성하세요.
   제목: {title}
   세션 유형: {sessionType (한국어 레이블)}
   태그: {tags.join(', ')}
   URL: {url}
   ```
3. `TrainingVideo.aiSummary = responseText` 업데이트
4. `{ aiSummary: string }` 반환

에러:
- Claude API 오류 → 503 `AI_SERVICE_UNAVAILABLE`

---

## FE UI

### A. MatchDetailPage — OCR 스탯 시트

MatchDetail 기존 탭 구조 하단에 "스탯 시트" 섹션 추가:

**상태: 데이터 없음 (ADMIN/COACHING_STAFF에게만 표시)**
```
[ 스캔 업로드 ] 버튼 (ScanLine 아이콘)
클릭 → hidden <input type="file" accept="image/jpeg,image/png"> 트리거
선택 후 → FormData로 POST /matches/:id/stat-sheet
업로드 중: "스캔 분석 중..." 스피너
```

**상태: 데이터 있음**
```
스탯 시트 (AI 분석)  [다시 스캔]
┌──────────────────────────────┐
│ 점유율      홈 58%  어웨이 42% │
│ 슈팅        14      8         │
│ 유효 슈팅   5       3         │
│ 득점        2       1         │
│ 코너킥      6       3         │
│ 파울        11      14        │
│ 경고        1       2         │
│ 퇴장        0       0         │
├──────────────────────────────┤
│ 득점자: 김민준 (홈 23')       │
│        박지성 (홈 67')        │
└──────────────────────────────┘
```

실패 시: `toast.error('스탯 추출에 실패했습니다.')`, 재시도 가능

### B. TrainingVideoPage — AI 요약

기존 영상 테이블 행 또는 상세 뷰에 추가:

**요약 없음 (ADMIN/COACHING_STAFF):**
- 행 끝에 "AI 요약" 버튼 (Sparkles 아이콘, ghost variant)
- 클릭 시 로딩, 완료 후 행 아래 요약 텍스트 inline 표시

**요약 있음:**
- 행 아래 italic muted 텍스트로 요약 표시
- "재생성" 버튼 (Sparkles + 작은 새로고침)

FE 타입 변경:
```typescript
// types/video.ts 에 추가
export interface TrainingVideo {
  // ... 기존 ...
  aiSummary?: string | null
}
```

FE 서비스 추가:
```typescript
// services/video.service.ts 에 추가
generateAiSummary: (id: number) =>
  api.post<{ aiSummary: string }>(`/videos/${id}/ai-summary`, {})
```

---

## 패키지

```bash
cd apps/api
npm install @anthropic-ai/sdk multer @types/multer
```

---

## 권한

| 기능 | ADMIN | COACHING_STAFF | FRONT_OFFICE | PLAYER |
|------|-------|----------------|--------------|--------|
| OCR 업로드 | ✅ | ✅ | ❌ | ❌ |
| OCR 결과 열람 | ✅ | ✅ | ✅ | ❌ |
| AI 요약 생성 | ✅ | ✅ | ❌ | ❌ |
| AI 요약 열람 | ✅ | ✅ | ✅ | ✅ |

---

## 마이그레이션 패턴

```bash
# shadow DB 우회 패턴 (기존 프로젝트 방식)
npx prisma db execute --file ./prisma/migrations/XXXX_feature13/migration.sql --schema ./prisma/schema.prisma
npx prisma migrate resolve --applied XXXX_feature13
npx prisma generate
```

---

## 환경변수

```env
ANTHROPIC_API_KEY=sk-ant-...
```

`apps/api/.env`에 추가. 기존 `.env.example`에도 키 목록 추가.
