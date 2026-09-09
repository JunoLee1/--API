# Prospect.nationalityId 설계

**Goal:** `Prospect.nationality String?`(국가명 문자열)를 `nationalityId Int? → Country` FK로 교체하여 Player/User와 동일한 패턴을 적용하고, 생성 시 국적을 필수 입력으로 강제한다.

**Issues:** Prospect 국적 셀렉트 (countries API 연동)

**Tech Stack:** Hono + Prisma (BE) / React + TypeScript + shadcn/ui (FE)

---

## 1. DB 스키마

`Prospect` 모델에서 `nationality String?` 제거, `nationalityId Int?` + Country FK 추가.

```prisma
model Prospect {
  // ... 기존 필드 ...
  // 삭제: nationality  String?
  nationalityId   Int?
  country         Country?   @relation(fields: [nationalityId], references: [id])
}
```

**마이그레이션:**
```sql
ALTER TABLE "public"."Prospect" DROP COLUMN IF EXISTS "nationality";
ALTER TABLE "public"."Prospect" ADD COLUMN "nationalityId" INTEGER;
ALTER TABLE "public"."Prospect" ADD CONSTRAINT "Prospect_nationalityId_fkey"
  FOREIGN KEY ("nationalityId") REFERENCES "public"."Country"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

### 불변식
- `nationalityId` 는 DB에서 nullable (기존 행 안전), 생성 API에서 required 강제
- `sign()` 은 Prospect.nationalityId를 Player 생성에 자동 전달

---

## 2. BE API

### 2-1. `POST /prospects` — CreateProspectDto 변경

```typescript
interface CreateProspectDto {
  // 기존 필드 유지
  // 삭제: nationality?: string
  nationalityId: number   // required — 없으면 400 NATIONALITY_REQUIRED
}
```

**검증:**
- `nationalityId` 누락 또는 0 → 400 `NATIONALITY_REQUIRED`

### 2-2. `GET /prospects` / `GET /prospects/:id` — 응답에 country 포함

```typescript
interface ProspectResponse {
  // 기존 필드 유지
  // 삭제: nationality: string | null
  nationalityId: number | null
  country: { id: number; name: string; code: string } | null
}
```

repo `findAll()` / `findById()` select에 `country: { select: { id, name, code } }` 추가.

### 2-3. `sign()` — Prospect.nationalityId → Player 자동 전달

`prospect.service.ts::sign()` 내부에서 Player 생성 시 `nationalityId: prospect.nationalityId` 를 사용. `SignProspectDto`에서 `nationalityId` 제거 (중복 입력 불필요).

---

## 3. FE

### 3-1. 타입 (`football/src/types/prospect.ts`)

```typescript
interface Prospect {
  // 기존 필드 유지
  // 삭제: nationality: string | null
  nationalityId: number | null
  country: { id: number; name: string; code: string } | null
}
```

### 3-2. `ProspectsPage.tsx` 변경

**(a) CreateProspectDialog**
- `nationality: string` state → `nationalityId: string` state (Select value = country id string)
- `onValueChange={setNationalityId}`, SelectItem `value={String(c.id)}`
- API payload: `nationalityId: Number(nationalityId)`
- Submit 버튼: `nationalityId` 미선택 시 disable

**(b) SignProspectDialog**
- nationality Select 제거 (Prospect.nationalityId를 BE가 자동 사용)
- `nationalityId` state, countries fetch, 관련 JSX 제거

**(c) Prospect 목록 테이블**
- `p.nationality ?? '—'` → `p.country?.name ?? '—'`

---

## 4. 파일 변경 목록

| 파일 | 변경 |
|---|---|
| `apps/api/prisma/schema.prisma` | `nationality String?` 삭제, `nationalityId Int?` + Country relation 추가 |
| `apps/api/prisma/migrations/…` | 신규 마이그레이션 |
| `apps/api/src/prospect/dto/prospect.dto.ts` | `CreateProspectDto` — `nationality` 삭제, `nationalityId: number` 추가; `SignProspectDto` — `nationalityId` 제거 |
| `apps/api/src/prospect/prospect.repo.ts` | `findAll()` / `findById()` select에 `country` include |
| `apps/api/src/prospect/prospect.service.ts` | `create()` — NATIONALITY_REQUIRED 가드; `sign()` — `nationalityId: prospect.nationalityId` 전달 |
| `football/src/types/prospect.ts` | `nationality` 제거, `nationalityId`, `country` 추가 |
| `football/src/pages/prospects/ProspectsPage.tsx` | CreateDialog state rename, SignDialog nationality 제거, 테이블 `p.country?.name` |

---

## 5. 테스트

- BE: `create()` nationalityId 누락 → 400 `NATIONALITY_REQUIRED`
- BE: `create()` 성공 시 `country` relation 포함 응답
- BE: `sign()` — Prospect.nationalityId가 Player에 반영됨
- FE: CreateProspectDialog nationality Select 렌더 + 미선택 시 submit disable
- FE: 목록 테이블 `country.name` 표시
