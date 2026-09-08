# Prospect Nationality FK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Prospect.nationality String?` with `nationalityId Int? → Country` FK, enforce nationality as required on create, and propagate from Prospect to Player on sign.

**Architecture:** DB migration first (drop column, add FK), then DTO → repo → service layer in BE, then FE types and ProspectsPage dialogs. The sign() flow is simplified: `prospect.nationalityId` feeds directly into Player creation, removing the duplicate `nationalityId` field from `SignProspectDto`.

**Tech Stack:** Prisma (schema + raw SQL migration), Express/TypeScript (BE), React + shadcn/ui (FE)

---

### Task 1: DB Schema + Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (lines 876–885 Country model, lines 1895–1918 Prospect model)
- Create: `apps/api/prisma/migrations/20260908000002_prospect_nationality_fk/migration.sql`

- [ ] **Step 1: Update schema.prisma — Prospect model**

In the `Prospect` model (line 1898), replace:
```prisma
  nationality       String?
```
with:
```prisma
  nationalityId     Int?
  nationality       Country?   @relation(fields: [nationalityId], references: [id])
```

- [ ] **Step 2: Update schema.prisma — Country model**

In the `Country` model backrelations (after `leagues League[]`, line ~884), add:
```prisma
  prospects Prospect[]
```

- [ ] **Step 3: Create migration SQL**

Create file `apps/api/prisma/migrations/20260908000002_prospect_nationality_fk/migration.sql`:

```sql
-- DropColumn
ALTER TABLE "public"."Prospect" DROP COLUMN IF EXISTS "nationality";

-- AddColumn
ALTER TABLE "public"."Prospect" ADD COLUMN "nationalityId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Prospect"
  ADD CONSTRAINT "Prospect_nationalityId_fkey"
  FOREIGN KEY ("nationalityId") REFERENCES "public"."Country"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 4: Run `prisma generate` to regenerate client**

```bash
cd apps/api && npx prisma generate
```

Expected: client regenerated with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260908000002_prospect_nationality_fk/
git commit -m "feat: Prospect.nationality String → nationalityId Int FK to Country"
```

---

### Task 2: BE DTO Changes

**Files:**
- Modify: `apps/api/src/prospect/dto/prospect.dto.ts`

- [ ] **Step 1: Write failing test (create without nationalityId)**

In `apps/api/__test__/prospect/prospect.service.test.ts`, add to the `ProspectService - create` describe (add one if it doesn't exist):

```typescript
describe("ProspectService - create", () => {
  beforeEach(() => jest.clearAllMocks());

  test("create without nationalityId → 400 NATIONALITY_REQUIRED", async () => {
    mockRepo.checkDuplicate.mockResolvedValue({ prospects: [], squadPlayers: [] });
    await expect(
      service.create({ name: "John", nationalityId: 0 } as any)
    ).rejects.toMatchObject({ statusCode: 400, code: "NATIONALITY_REQUIRED" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx jest --testPathPattern="prospect.service" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `NATIONALITY_REQUIRED` not thrown yet.

- [ ] **Step 3: Update `CreateProspectDto`**

In `apps/api/src/prospect/dto/prospect.dto.ts`, replace:
```typescript
export interface CreateProspectDto {
  name: string;
  nationality?: string;
  position?: Position;
  currentTeam?: string;
  notes?: string;
  createdById?: number;
  status?: 'LONGLIST' | 'PRE_SHORTLIST';
  playStyle?: string;
}
```
with:
```typescript
export interface CreateProspectDto {
  name: string;
  nationalityId: number;
  position?: Position;
  currentTeam?: string;
  notes?: string;
  createdById?: number;
  status?: 'LONGLIST' | 'PRE_SHORTLIST';
  playStyle?: string;
}
```

- [ ] **Step 4: Update `UpdateProspectDto`**

In `apps/api/src/prospect/dto/prospect.dto.ts`, replace:
```typescript
export interface UpdateProspectDto {
  name?: string;
  nationality?: string;
  position?: Position;
  currentTeam?: string;
  notes?: string;
  visaRequired?: boolean;
  visaEligibility?: VisaEligibility;
  currentMarketValue?: number | null;
}
```
with:
```typescript
export interface UpdateProspectDto {
  name?: string;
  nationalityId?: number;
  position?: Position;
  currentTeam?: string;
  notes?: string;
  visaRequired?: boolean;
  visaEligibility?: VisaEligibility;
  currentMarketValue?: number | null;
}
```

- [ ] **Step 5: Update `SignProspectDto` — remove `nationalityId`**

In `apps/api/src/prospect/dto/prospect.dto.ts`, replace:
```typescript
export interface SignProspectDto {
  dateOfBirth: string;
  preferredFoot?: Foot;
  height: number;
  weight: number;
  nationalityId: number;
  position?: Position;
  contractStartDate: string;
  contractEndDate: string;
  salary: number;
  signingBonus?: number;
  managedById?: number;
  workPermitStatus?: WorkPermitStatus;
  workPermitExpiry?: string;
}
```
with:
```typescript
export interface SignProspectDto {
  dateOfBirth: string;
  preferredFoot?: Foot;
  height: number;
  weight: number;
  position?: Position;
  contractStartDate: string;
  contractEndDate: string;
  salary: number;
  signingBonus?: number;
  managedById?: number;
  workPermitStatus?: WorkPermitStatus;
  workPermitExpiry?: string;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/prospect/dto/prospect.dto.ts
git commit -m "refactor: Prospect DTOs — nationalityId required on create, removed from sign"
```

---

### Task 3: BE Repo Changes

**Files:**
- Modify: `apps/api/src/prospect/prospect.repo.ts`

- [ ] **Step 1: Update `PROSPECT_SELECT` — swap nationality for country**

In `prospect.repo.ts`, replace:
```typescript
const PROSPECT_SELECT = {
  id: true,
  name: true,
  nationality: true,
```
with:
```typescript
const PROSPECT_SELECT = {
  id: true,
  name: true,
  nationalityId: true,
  country: { select: { id: true, name: true, code: true } },
```

- [ ] **Step 2: Update `create()` data**

In `prospect.repo.ts`, replace in the `create()` method:
```typescript
        nationality: dto.nationality ?? null,
```
with:
```typescript
        nationalityId: dto.nationalityId,
```

- [ ] **Step 3: Update `update()` data**

In `prospect.repo.ts`, inside the `update()` method, replace:
```typescript
        ...(dto.nationality !== undefined && { nationality: dto.nationality }),
```
with:
```typescript
        ...(dto.nationalityId !== undefined && { nationalityId: dto.nationalityId }),
```

- [ ] **Step 4: Update `sign()` — fetch nationalityId from prospect, use instead of dto**

In `prospect.repo.ts`, in the `sign()` method, replace the prospect select:
```typescript
      select: { id: true, status: true, name: true, position: true, playStyle: true },
```
with:
```typescript
      select: { id: true, status: true, name: true, position: true, playStyle: true, nationalityId: true },
```

Then in the player.create data, replace:
```typescript
          nationalityId: dto.nationalityId,
```
with:
```typescript
          ...(prospect.nationalityId != null && { nationalityId: prospect.nationalityId }),
```

- [ ] **Step 5: Run tests**

```bash
cd apps/api && npx jest --testPathPattern="prospect" --no-coverage 2>&1 | tail -30
```

Expected: the new `NATIONALITY_REQUIRED` test still fails (guard not in service yet), all existing prospect tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/prospect/prospect.repo.ts
git commit -m "refactor: prospect repo — country FK select, nationalityId in create/update/sign"
```

---

### Task 4: BE Service Guard + Tests

**Files:**
- Modify: `apps/api/src/prospect/prospect.service.ts`
- Modify: `apps/api/__test__/prospect/prospect.service.test.ts`
- Modify: `apps/api/__test__/prospect/prospect.controller.test.ts`

- [ ] **Step 1: Add `NATIONALITY_REQUIRED` guard in `create()`**

In `prospect.service.ts`, replace:
```typescript
  async create(dto: CreateProspectDto) {
    const { squadPlayers } = await this.repo.checkDuplicate(dto.name);
    if (squadPlayers.length > 0) throw new AppError(409, "ALREADY_IN_SQUAD");
    return this.repo.create(dto);
  }
```
with:
```typescript
  async create(dto: CreateProspectDto) {
    if (!dto.nationalityId) throw new AppError(400, "NATIONALITY_REQUIRED");
    const { squadPlayers } = await this.repo.checkDuplicate(dto.name);
    if (squadPlayers.length > 0) throw new AppError(409, "ALREADY_IN_SQUAD");
    return this.repo.create(dto);
  }
```

- [ ] **Step 2: Run the NATIONALITY_REQUIRED test**

```bash
cd apps/api && npx jest --testPathPattern="prospect.service" --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS including the new `NATIONALITY_REQUIRED` test.

- [ ] **Step 3: Update service test fixture — replace nationality with nationalityId + country**

In `apps/api/__test__/prospect/prospect.service.test.ts`, replace:
```typescript
const activeProspect = {
  id: 1,
  name: "John Doe",
  nationality: "English",
```
with:
```typescript
const activeProspect = {
  id: 1,
  name: "John Doe",
  nationalityId: 1,
  country: { id: 1, name: "England", code: "GB" },
```

- [ ] **Step 4: Update controller test fixtures — replace nationality with nationalityId**

In `apps/api/__test__/prospect/prospect.controller.test.ts`, replace all three occurrences of:
```typescript
body: { name: "Test", nationality: "French", position: "STRIKER", currentTeam: "FC Lyon" }
```
with:
```typescript
body: { name: "Test", nationalityId: 1, position: "STRIKER", currentTeam: "FC Lyon" }
```

- [ ] **Step 5: Run all prospect tests**

```bash
cd apps/api && npx jest --testPathPattern="prospect" --no-coverage 2>&1 | tail -30
```

Expected: all PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd apps/api && npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/prospect/prospect.service.ts apps/api/__test__/prospect/
git commit -m "feat: NATIONALITY_REQUIRED guard in prospect create; update test fixtures"
```

---

### Task 5: FE Types + ProspectsPage

**Files:**
- Modify: `football/src/types/prospect.ts`
- Modify: `football/src/pages/prospects/ProspectsPage.tsx`

- [ ] **Step 1: Update `Prospect` interface in `football/src/types/prospect.ts`**

Replace:
```typescript
export interface Prospect {
  id: number
  name: string
  nationality: string | null
```
with:
```typescript
export interface Prospect {
  id: number
  name: string
  nationalityId: number | null
  country: { id: number; name: string; code: string } | null
```

- [ ] **Step 2: Update `CreateProspectDto` in `football/src/types/prospect.ts`**

Replace:
```typescript
export interface CreateProspectDto {
  name: string
  nationality?: string
```
with:
```typescript
export interface CreateProspectDto {
  name: string
  nationalityId: number
```

- [ ] **Step 3: Update `UpdateProspectDto` in `football/src/types/prospect.ts`**

`UpdateProspectDto` extends `Partial<CreateProspectDto>` — since `CreateProspectDto` now has `nationalityId: number`, `UpdateProspectDto` will automatically have `nationalityId?: number`. No change needed.

- [ ] **Step 4: Update `SignProspectDto` in `football/src/types/prospect.ts`**

Replace:
```typescript
export interface SignProspectDto {
  dateOfBirth: string
  height: number
  weight: number
  nationalityId: number
  preferredFoot?: 'LEFT' | 'RIGHT' | 'BOTH'
```
with:
```typescript
export interface SignProspectDto {
  dateOfBirth: string
  height: number
  weight: number
  preferredFoot?: 'LEFT' | 'RIGHT' | 'BOTH'
```

- [ ] **Step 5: Update `CreateProspectDialog` — state rename + Select values + required**

In `ProspectsPage.tsx`, in `CreateProspectDialog`:

5a. Replace state declaration:
```typescript
  const [nationality, setNationality] = useState('')
```
with:
```typescript
  const [nationalityId, setNationalityId] = useState<string>('')
```

5b. Replace DTO construction in `doCreate()`:
```typescript
        ...(nationality.trim() && { nationality: nationality.trim() }),
```
with:
```typescript
        nationalityId: Number(nationalityId),
```

5c. Replace the nationality Select JSX (lines ~173–186):
```tsx
          <div className="space-y-1.5">
            <Label>{t('prospects.form.nationalityLabel')}</Label>
            <Select value={nationality} onValueChange={setNationality}>
              <SelectTrigger>
                <SelectValue placeholder="국적 선택">
                  {nationality || undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {countries.map(c => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
```
with:
```tsx
          <div className="space-y-1.5">
            <Label>{t('prospects.form.nationalityLabel')} *</Label>
            <Select value={nationalityId} onValueChange={setNationalityId}>
              <SelectTrigger>
                <SelectValue placeholder="국적 선택" />
              </SelectTrigger>
              <SelectContent>
                {countries.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
```

5d. Disable submit when nationalityId not selected. Replace the footer save button:
```tsx
          <Button onClick={handleSave} disabled={saving}>{saving ? t('prospects.form.saving') : t('prospects.form.create')}</Button>
```
with:
```tsx
          <Button onClick={handleSave} disabled={saving || !nationalityId}>{saving ? t('prospects.form.saving') : t('prospects.form.create')}</Button>
```

- [ ] **Step 6: Update `SignProspectDialog` — remove nationality select**

In `SignProspectDialog`:

6a. Remove state declarations:
```typescript
  const [countries, setCountries] = useState<Country[]>([])
  const [nationalityId, setNationalityId] = useState<string>('')
```

6b. Remove the countries fetch `useEffect`:
```typescript
  useEffect(() => {
    if (!open) return
    api.get<{ data: Country[] } | Country[]>('/countries')
      .then((res) => setCountries(Array.isArray(res) ? res : res.data))
      .catch(() => null)
  }, [open])
```

6c. In `handleSave`, replace the validation guard:
```typescript
    if (!dob || !height || !weight || !nationalityId || !contractStart || !contractEnd || !salary) {
```
with:
```typescript
    if (!dob || !height || !weight || !contractStart || !contractEnd || !salary) {
```

6d. In `handleSave`, remove `nationalityId` from the DTO:
```typescript
      const dto: SignProspectDto = {
        dateOfBirth: dob,
        height: Number(height),
        weight: Number(weight),
        nationalityId: Number(nationalityId),
        preferredFoot: foot,
```
replace with:
```typescript
      const dto: SignProspectDto = {
        dateOfBirth: dob,
        height: Number(height),
        weight: Number(weight),
        preferredFoot: foot,
```

6e. Remove the nationality Select JSX from the sign dialog (the `<div>` containing the nationality Label + Select near line ~337–344):
```tsx
              <div className="space-y-1.5">
                <Label>{t('prospects.signForm.nationalityLabel')} *</Label>
                <Select value={nationalityId} onValueChange={setNationalityId}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
```
Remove that block entirely from the grid.

- [ ] **Step 7: Update prospect table column**

In `ProspectsPage.tsx`, replace (line ~663):
```tsx
                  <TableCell className="text-sm">{p.nationality ?? '—'}</TableCell>
```
with:
```tsx
                  <TableCell className="text-sm">{p.country?.name ?? '—'}</TableCell>
```

- [ ] **Step 8: TypeScript check**

```bash
cd football && npx tsc --noEmit 2>&1 | grep -E "prospect|Prospect" | head -20
```

Expected: no errors related to prospect types.

- [ ] **Step 9: Commit**

```bash
git add football/src/types/prospect.ts football/src/pages/prospects/ProspectsPage.tsx
git commit -m "feat: FE — Prospect nationalityId FK; CreateDialog required, SignDialog simplified"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Drop `nationality String?` from schema | Task 1 |
| Add `nationalityId Int?` + Country FK | Task 1 |
| Migration SQL | Task 1 |
| `CreateProspectDto.nationalityId: number` (required) | Task 2 |
| Remove `nationality` from `UpdateProspectDto` | Task 2 |
| Remove `nationalityId` from `SignProspectDto` | Task 2 |
| `PROSPECT_SELECT` includes `country { id name code }` | Task 3 |
| `create()` uses `nationalityId` | Task 3 |
| `sign()` reads `prospect.nationalityId` for Player | Task 3 |
| `create()` guard: 400 `NATIONALITY_REQUIRED` | Task 4 |
| FE `Prospect` type: `country` replaces `nationality` | Task 5 |
| FE `CreateProspectDto.nationalityId: number` | Task 5 |
| FE `SignProspectDto` removes `nationalityId` | Task 5 |
| CreateDialog: Select by id, required, disable submit | Task 5 |
| SignDialog: remove nationality select | Task 5 |
| Table: `p.country?.name` | Task 5 |

**Placeholder scan:** No TBDs. All code blocks are complete.

**Type consistency:** `nationalityId` is `number` in BE DTOs and FE types. `country` select is `{ id, name, code }` in both repo and FE types. `SignProspectDto` has `nationalityId` removed in both BE and FE.

**Edge case:** `sign()` uses `prospect.nationalityId != null && { nationalityId: ... }` — if Prospect was created with no nationalityId (legacy data), Player is created without nationalityId. This matches the spec invariant: "DB에서 nullable (기존 행 안전)".
