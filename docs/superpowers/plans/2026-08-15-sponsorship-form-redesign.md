# 스폰서십 등록 폼 국내/해외 구분 재설계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스폰서 등록·수정 폼 최상단에 국내/해외 라디오 토글을 추가하고, 선택에 따라 사업자등록번호·주소(카카오 API) 또는 TAX ID·해외주소 필드를 조건부 노출하며 신규 필드를 DB에 저장한다.

**Architecture:** Prisma `Sponsorship` 모델에 7개 필드를 추가(마이그레이션)하고, BE DTO·Repo를 통해 create/update로 흘러가게 한다. FE는 `DaumPostcodeDialog` 컴포넌트를 신설하고 `CreateSponsorshipDialog`·`BankEditDialog` 두 폼을 재설계한다.

**Tech Stack:** Hono/Express + Prisma (BE), React + shadcn/ui + @base-ui/react + react-i18next + react-daum-postcode (FE), Jest (test)

---

## 파일 구조

```
BE
├── apps/api/prisma/schema.prisma              MODIFY — Sponsorship 모델에 7개 필드 추가
├── apps/api/src/sponsorship/dto/
│   └── sponsorship.dto.ts                    MODIFY — CreateSponsorshipDto, UpdateSponsorshipDto 확장
├── apps/api/src/sponsorship/
│   ├── sponsorship.repo.ts                   MODIFY — create() 메서드에 신규 필드 추가
│   └── sponsorship.service.test.ts           CREATE — 신규 필드 전달 TDD 테스트

FE
├── football/src/types/sponsorship.ts          MODIFY — Sponsorship, CreateDto, UpdateDto 타입 확장
├── football/src/locales/ko/sponsorship.json   MODIFY — 신규 i18n 키
├── football/src/locales/en/sponsorship.json   MODIFY — 신규 i18n 키
├── football/src/components/
│   └── DaumPostcodeDialog.tsx                CREATE — 카카오 우편번호 팝업 래퍼
├── football/src/pages/sponsorship/
│   ├── SponsorshipPage.tsx                   MODIFY — CreateSponsorshipDialog 재설계
│   └── SponsorshipDetailPage.tsx             MODIFY — BankEditDialog 재설계
```

---

## Task 1: Prisma 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma:2706-2714`

- [ ] **Step 1: `Sponsorship` 모델에 7개 필드 추가**

`ukSwiftBic String?` 바로 아래에 다음 블록을 삽입한다.

```prisma
  // 국내/해외 구분
  isOverseas            Boolean @default(false)
  // 국내 전용
  businessRegNumber     String?
  postalCode            String?
  address               String?
  addressDetail         String?
  // 해외 전용
  taxId                 String?
  overseasAddress       String?
```

결과: `attachedContract` 관계 선언 바로 위에 위치해야 한다.

- [ ] **Step 2: 마이그레이션 실행**

```bash
cd apps/api
npx prisma migrate dev --name add_sponsorship_region_fields
```

Expected: `The following migration(s) have been created and applied:` 메시지 출력.  
`apps/api/prisma/migrations/20260815000001_add_sponsorship_region_fields/migration.sql` 파일 생성됨.

- [ ] **Step 3: Prisma 클라이언트 재생성 확인**

마이그레이션이 자동으로 `prisma generate`를 실행한다. 확인:

```bash
grep -n "isOverseas" apps/api/src/generated/client/index.d.ts | head -3
```

Expected: `isOverseas` 필드가 포함된 타입 정의 출력.

- [ ] **Step 4: 커밋**

```bash
cd ../..
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/ apps/api/src/generated/
git commit -m "feat(db): add sponsorship region fields (isOverseas, address, taxId, etc)"
```

---

## Task 2: BE — DTO + Repo 신규 필드 전달

**Files:**
- Create: `apps/api/src/sponsorship/sponsorship.service.test.ts`
- Modify: `apps/api/src/sponsorship/dto/sponsorship.dto.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.repo.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/sponsorship/sponsorship.service.test.ts` 신규 파일:

```ts
import { SponsorshipService } from "./sponsorship.service";

const makeRepo = () => ({
  findBySponsorName: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({ id: 1 }),
  createPayments: jest.fn().mockResolvedValue(undefined),
  findById: jest.fn().mockResolvedValue({
    id: 1,
    sponsorName: "테스트",
    isOverseas: false,
    payments: [],
  }),
});

const makeLedger = () => ({} as any);

describe("SponsorshipService.create — region fields", () => {
  it("국내 스폰서 생성 시 isOverseas:false 와 businessRegNumber 를 repo.create 에 전달한다", async () => {
    const repo = makeRepo();
    const service = new SponsorshipService(repo as any, makeLedger());
    await service.create(
      {
        sponsorName: "테스트",
        type: "TITLE",
        totalFee: 1_000_000,
        contractStart: "2026-01-01",
        contractEnd: "2026-12-31",
        paymentSchedule: "ANNUAL",
        isOverseas: false,
        businessRegNumber: "123-45-67890",
        postalCode: "06236",
        address: "서울 강남구 테헤란로 427",
        addressDetail: "10층",
      },
      1,
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        isOverseas: false,
        businessRegNumber: "123-45-67890",
        postalCode: "06236",
        address: "서울 강남구 테헤란로 427",
        addressDetail: "10층",
      }),
    );
  });

  it("해외 스폰서 생성 시 isOverseas:true 와 taxId 를 repo.create 에 전달한다", async () => {
    const repo = makeRepo();
    const service = new SponsorshipService(repo as any, makeLedger());
    await service.create(
      {
        sponsorName: "Overseas Corp",
        type: "KIT",
        totalFee: 500_000,
        contractStart: "2026-01-01",
        contractEnd: "2026-12-31",
        paymentSchedule: "ANNUAL",
        isOverseas: true,
        taxId: "GB123456789",
        overseasAddress: "10 Downing Street, London",
      },
      1,
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        isOverseas: true,
        taxId: "GB123456789",
        overseasAddress: "10 Downing Street, London",
      }),
    );
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd apps/api
npx jest sponsorship.service.test --no-coverage
```

Expected: FAIL — `businessRegNumber` / `taxId` 등이 repo.create 에 포함되지 않아 expect 실패.

- [ ] **Step 3: DTO 확장**

`apps/api/src/sponsorship/dto/sponsorship.dto.ts`의 `CreateSponsorshipDto` 인터페이스에 추가:

```ts
export interface CreateSponsorshipDto {
  sponsorName: string;
  type: SponsorType;
  totalFee: number;
  contractStart: string;
  contractEnd: string;
  paymentSchedule: PaymentSchedule;
  attachedContractId?: number;
  // 국내 계좌
  domesticBankName?: string;
  domesticAccountNumber?: string;
  domesticAccountHolder?: string;
  // 영국 계좌
  ukBankName?: string;
  ukSortCode?: string;
  ukAccountNumber?: string;
  ukSwiftBic?: string;
  // 국내/해외 구분
  isOverseas?: boolean;
  // 국내 전용
  businessRegNumber?: string;
  postalCode?: string;
  address?: string;
  addressDetail?: string;
  // 해외 전용
  taxId?: string;
  overseasAddress?: string;
}
```

`UpdateSponsorshipDto` 에도 동일 8개 필드(모두 optional) 추가:

```ts
export interface UpdateSponsorshipDto {
  sponsorName?: string;
  type?: SponsorType;
  totalFee?: number;
  contractStart?: string;
  contractEnd?: string;
  paymentSchedule?: PaymentSchedule;
  attachedContractId?: number;
  domesticBankName?: string;
  domesticAccountNumber?: string;
  domesticAccountHolder?: string;
  ukBankName?: string;
  ukSortCode?: string;
  ukAccountNumber?: string;
  ukSwiftBic?: string;
  // 국내/해외 구분
  isOverseas?: boolean;
  // 국내 전용
  businessRegNumber?: string;
  postalCode?: string;
  address?: string;
  addressDetail?: string;
  // 해외 전용
  taxId?: string;
  overseasAddress?: string;
}
```

- [ ] **Step 4: Repo `create()` 에 신규 필드 추가**

`apps/api/src/sponsorship/sponsorship.repo.ts` `create()` 메서드의 `data` 객체에 추가.  
기존 `...(data.ukSwiftBic && { ukSwiftBic: data.ukSwiftBic }),` 뒤에:

```ts
      isOverseas: data.isOverseas ?? false,
      ...(data.businessRegNumber && { businessRegNumber: data.businessRegNumber }),
      ...(data.postalCode && { postalCode: data.postalCode }),
      ...(data.address && { address: data.address }),
      ...(data.addressDetail && { addressDetail: data.addressDetail }),
      ...(data.taxId && { taxId: data.taxId }),
      ...(data.overseasAddress && { overseasAddress: data.overseasAddress }),
```

`update()` 는 `...data` 스프레드를 사용하므로 변경 불필요 — 새 필드가 자동으로 전달된다.

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx jest sponsorship.service.test --no-coverage
```

Expected: PASS — 2 tests.

- [ ] **Step 6: 커밋**

```bash
cd ../..
git add apps/api/src/sponsorship/
git commit -m "feat(sponsorship): extend DTO and repo to support region fields"
```

---

## Task 3: FE — 타입 정의 + i18n 키

**Files:**
- Modify: `football/src/types/sponsorship.ts`
- Modify: `football/src/locales/ko/sponsorship.json`
- Modify: `football/src/locales/en/sponsorship.json`

- [ ] **Step 1: `Sponsorship` 인터페이스에 신규 필드 추가**

`football/src/types/sponsorship.ts`의 `Sponsorship` 인터페이스에서 `// 영국 계좌` 블록 뒤에 추가:

```ts
  // 국내/해외 구분
  isOverseas: boolean
  // 국내 전용
  businessRegNumber: string | null
  postalCode: string | null
  address: string | null
  addressDetail: string | null
  // 해외 전용
  taxId: string | null
  overseasAddress: string | null
```

- [ ] **Step 2: `CreateSponsorshipDto` + `UpdateSponsorshipDto` 확장**

`CreateSponsorshipDto` 에서 `ukSwiftBic?: string` 뒤에 추가:

```ts
  isOverseas?: boolean
  businessRegNumber?: string
  postalCode?: string
  address?: string
  addressDetail?: string
  taxId?: string
  overseasAddress?: string
```

`UpdateSponsorshipDto` 에도 동일 7개 optional 필드 추가.

- [ ] **Step 3: 한국어 i18n 키 추가**

`football/src/locales/ko/sponsorship.json` 의 `"form"` 객체에 추가:

```json
    "origin": "스폰서 구분",
    "domestic": "국내 스폰서",
    "overseas": "해외 스폰서",
    "businessRegNumber": "사업자등록번호",
    "postalCode": "우편번호",
    "address": "도로명 주소",
    "addressDetail": "상세주소",
    "addressSearch": "주소 검색",
    "taxId": "TAX ID / VAT Number",
    "overseasAddress": "해외 주소"
```

`"bank"` 객체의 기존 키 수정:

```json
    "editTitle": "스폰서 정보 수정",
    "saved": "스폰서 정보가 저장되었습니다."
```

- [ ] **Step 4: 영어 i18n 키 추가**

`football/src/locales/en/sponsorship.json` 의 `"form"` 객체에 추가:

```json
    "origin": "Sponsor Type",
    "domestic": "Domestic Sponsor",
    "overseas": "Overseas Sponsor",
    "businessRegNumber": "Business Registration No.",
    "postalCode": "Postal Code",
    "address": "Street Address",
    "addressDetail": "Detail Address",
    "addressSearch": "Search Address",
    "taxId": "TAX ID / VAT Number",
    "overseasAddress": "Overseas Address"
```

`"bank"` 객체 수정:

```json
    "editTitle": "Edit Sponsor Info",
    "saved": "Sponsor info saved."
```

- [ ] **Step 5: TypeScript 빌드 확인**

```bash
cd football
npx tsc --noEmit 2>&1 | grep -i sponsorship | head -10
```

Expected: 오류 없음.

- [ ] **Step 6: 커밋**

```bash
cd ..
git add football/src/types/sponsorship.ts football/src/locales/
git commit -m "feat(sponsorship): extend FE types and i18n for region fields"
```

---

## Task 4: DaumPostcodeDialog 컴포넌트

**Files:**
- Create: `football/src/components/DaumPostcodeDialog.tsx`

- [ ] **Step 1: react-daum-postcode 설치**

```bash
cd football
npm install react-daum-postcode
```

Expected: `added N packages` 메시지.

- [ ] **Step 2: 컴포넌트 작성**

`football/src/components/DaumPostcodeDialog.tsx`:

```tsx
import DaumPostcode from 'react-daum-postcode'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DaumPostcodeDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onComplete: (postalCode: string, address: string) => void
}

export function DaumPostcodeDialog({ open, onOpenChange, onComplete }: DaumPostcodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>주소 검색</DialogTitle>
        </DialogHeader>
        <DaumPostcode
          autoClose={false}
          onComplete={(data) => {
            onComplete(data.zonecode, data.roadAddress)
            onOpenChange(false)
          }}
          style={{ height: 400 }}
        />
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: TypeScript 확인**

```bash
npx tsc --noEmit 2>&1 | grep DaumPostcode | head -5
```

Expected: 오류 없음.

- [ ] **Step 4: 커밋**

```bash
cd ..
git add football/src/components/DaumPostcodeDialog.tsx football/package.json football/package-lock.json
git commit -m "feat(sponsorship): add DaumPostcodeDialog component"
```

---

## Task 5: CreateSponsorshipDialog 재설계

**Files:**
- Modify: `football/src/pages/sponsorship/SponsorshipPage.tsx`

- [ ] **Step 1: import 추가**

`SponsorshipPage.tsx` 상단 import 블록에 추가:

```tsx
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DaumPostcodeDialog } from '@/components/DaumPostcodeDialog'
```

- [ ] **Step 2: 신규 state 추가**

`CreateSponsorshipDialog` 함수 내에서 기존 `const [saving, setSaving] = useState(false)` 위에 추가:

```tsx
  const [isOverseas, setIsOverseas] = useState(false)
  const [businessRegNumber, setBusinessRegNumber] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [taxId, setTaxId] = useState('')
  const [overseasAddress, setOverseasAddress] = useState('')
  const [showPostcode, setShowPostcode] = useState(false)
```

- [ ] **Step 3: `reset()` 함수 업데이트**

기존 `reset` 함수 전체를 교체:

```tsx
  const reset = () => {
    setSponsorName('')
    setType('TITLE')
    setTotalFee('')
    setContractStart('')
    setContractEnd('')
    setPaymentSchedule('ANNUAL')
    setIsOverseas(false)
    setBusinessRegNumber('')
    setPostalCode('')
    setAddress('')
    setAddressDetail('')
    setDomesticBankName('')
    setDomesticAccountNumber('')
    setDomesticAccountHolder('')
    setTaxId('')
    setOverseasAddress('')
    setUkBankName('')
    setUkSortCode('')
    setUkAccountNumber('')
    setUkSwiftBic('')
  }
```

- [ ] **Step 4: `handleSave()` — DTO 업데이트**

`handleSave` 내 `const dto: CreateSponsorshipDto = { ... }` 블록 전체를 교체:

```tsx
    const dto: CreateSponsorshipDto = {
      sponsorName: sponsorName.trim(),
      type,
      totalFee: Number(totalFee),
      contractStart,
      contractEnd,
      paymentSchedule,
      isOverseas,
      ...(!isOverseas && businessRegNumber && { businessRegNumber }),
      ...(!isOverseas && postalCode && { postalCode }),
      ...(!isOverseas && address && { address }),
      ...(!isOverseas && addressDetail && { addressDetail }),
      ...(!isOverseas && domesticBankName && { domesticBankName }),
      ...(!isOverseas && domesticAccountNumber && { domesticAccountNumber }),
      ...(!isOverseas && domesticAccountHolder && { domesticAccountHolder }),
      ...(isOverseas && taxId && { taxId }),
      ...(isOverseas && overseasAddress && { overseasAddress }),
      ...(isOverseas && ukBankName && { ukBankName }),
      ...(isOverseas && ukSortCode && { ukSortCode }),
      ...(isOverseas && ukAccountNumber && { ukAccountNumber }),
      ...(isOverseas && ukSwiftBic && { ukSwiftBic }),
    }
```

- [ ] **Step 5: 폼 JSX 교체**

`<div className="space-y-4">` 내부의 기존 모든 필드(스폰서명~영국계좌)를 다음 구조로 교체:

```tsx
        <div className="space-y-4">
          {/* 국내/해외 구분 */}
          <div className="space-y-1.5">
            <Label>{t('form.origin')}</Label>
            <RadioGroup
              value={isOverseas ? 'overseas' : 'domestic'}
              onValueChange={(v) => setIsOverseas(v === 'overseas')}
            >
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="domestic" />
                  {t('form.domestic')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="overseas" />
                  {t('form.overseas')}
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* 공통 필드 */}
          <div className="space-y-1.5">
            <Label>{t('form.sponsorName')}</Label>
            <Input
              placeholder={t('form.sponsorNamePlaceholder')}
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('form.type')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as SponsorType)}>
              <SelectTrigger><SelectValue>{SPONSOR_TYPE_LABEL[type]}</SelectValue></SelectTrigger>
              <SelectContent>
                {SPONSOR_TYPES.map((tp) => (
                  <SelectItem key={tp} value={tp}>{SPONSOR_TYPE_LABEL[tp]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('form.totalFee')}</Label>
            <Input
              type="number"
              placeholder="0"
              value={totalFee}
              onChange={(e) => setTotalFee(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('form.contractStart')}</Label>
              <Input
                type="date"
                value={contractStart}
                onChange={(e) => setContractStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('form.contractEnd')}</Label>
              <Input
                type="date"
                value={contractEnd}
                onChange={(e) => setContractEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('form.paymentSchedule')}</Label>
            <Select value={paymentSchedule} onValueChange={(v) => setPaymentSchedule(v as PaymentSchedule)}>
              <SelectTrigger><SelectValue>{PAYMENT_SCHEDULE_LABEL[paymentSchedule]}</SelectValue></SelectTrigger>
              <SelectContent>
                {PAYMENT_SCHEDULES.map((s) => (
                  <SelectItem key={s} value={s}>{PAYMENT_SCHEDULE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 국내 전용 필드 */}
          {!isOverseas && (
            <>
              <div className="space-y-1.5">
                <Label>{t('form.businessRegNumber')}</Label>
                <Input
                  placeholder="000-00-00000"
                  value={businessRegNumber}
                  onChange={(e) => setBusinessRegNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('form.address')}</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    placeholder={t('form.postalCode')}
                    value={postalCode}
                    className="w-28"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPostcode(true)}
                  >
                    {t('form.addressSearch')}
                  </Button>
                </div>
                <Input readOnly placeholder={t('form.address')} value={address} />
                <Input
                  placeholder={t('form.addressDetail')}
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                />
              </div>
              <div className="pt-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('form.bankSection.domestic')}</p>
                <div className="space-y-2">
                  <Input placeholder={t('form.bank.bankName')} value={domesticBankName} onChange={(e) => setDomesticBankName(e.target.value)} />
                  <Input placeholder={t('form.bank.accountNumber')} value={domesticAccountNumber} onChange={(e) => setDomesticAccountNumber(e.target.value)} />
                  <Input placeholder={t('form.bank.accountHolder')} value={domesticAccountHolder} onChange={(e) => setDomesticAccountHolder(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* 해외 전용 필드 */}
          {isOverseas && (
            <>
              <div className="space-y-1.5">
                <Label>{t('form.taxId')}</Label>
                <Input
                  placeholder="GB123456789"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('form.overseasAddress')}</Label>
                <Textarea
                  placeholder="10 Downing Street, London, UK"
                  value={overseasAddress}
                  onChange={(e) => setOverseasAddress(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="pt-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('form.bankSection.uk')}</p>
                <div className="space-y-2">
                  <Input placeholder={t('form.bank.bankName')} value={ukBankName} onChange={(e) => setUkBankName(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder={t('form.bank.sortCode')} value={ukSortCode} onChange={(e) => setUkSortCode(e.target.value)} />
                    <Input placeholder={t('form.bank.accountNumber')} value={ukAccountNumber} onChange={(e) => setUkAccountNumber(e.target.value)} />
                  </div>
                  <Input placeholder={t('form.bank.swiftBic')} value={ukSwiftBic} onChange={(e) => setUkSwiftBic(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>
```

`</div>` (space-y-4 닫는 태그) 뒤, `<DialogFooter>` 앞에 `DaumPostcodeDialog` 추가:

```tsx
        <DaumPostcodeDialog
          open={showPostcode}
          onOpenChange={setShowPostcode}
          onComplete={(pc, addr) => {
            setPostalCode(pc)
            setAddress(addr)
          }}
        />
```

DialogContent의 `className="max-w-lg"` 를 `className="max-w-lg max-h-[90vh] overflow-y-auto"` 로 변경 (폼이 길어지므로).

- [ ] **Step 6: TypeScript 확인**

```bash
cd football
npx tsc --noEmit 2>&1 | grep -i "SponsorshipPage\|CreateSponsorship" | head -10
```

Expected: 오류 없음.

- [ ] **Step 7: 커밋**

```bash
cd ..
git add football/src/pages/sponsorship/SponsorshipPage.tsx
git commit -m "feat(sponsorship): redesign CreateSponsorshipDialog with domestic/overseas toggle"
```

---

## Task 6: SponsorInfoEditDialog 재설계

**Files:**
- Modify: `football/src/pages/sponsorship/SponsorshipDetailPage.tsx`

> 참고: `BankEditDialog` 컴포넌트를 파일 내에서 재설계한다 (컴포넌트명 자체는 내부 변경 최소화를 위해 유지 가능하나, 타이틀/저장 메시지 키만 변경).

- [ ] **Step 1: import 추가**

`SponsorshipDetailPage.tsx` 상단에 추가:

```tsx
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DaumPostcodeDialog } from '@/components/DaumPostcodeDialog'
```

- [ ] **Step 2: BankEditDialog — 신규 state 추가**

`BankEditDialog` 함수 내 기존 `const [form, setForm] = useState({ ... })` 를 개별 state로 분리하고 신규 필드 추가:

```tsx
function BankEditDialog({ open, onOpenChange, sponsorship, onSaved }: BankEditDialogProps) {
  const { t } = useTranslation('sponsorship')
  const [isOverseas, setIsOverseas] = useState(sponsorship.isOverseas)
  const [businessRegNumber, setBusinessRegNumber] = useState(sponsorship.businessRegNumber ?? '')
  const [postalCode, setPostalCode] = useState(sponsorship.postalCode ?? '')
  const [address, setAddress] = useState(sponsorship.address ?? '')
  const [addressDetail, setAddressDetail] = useState(sponsorship.addressDetail ?? '')
  const [taxId, setTaxId] = useState(sponsorship.taxId ?? '')
  const [overseasAddress, setOverseasAddress] = useState(sponsorship.overseasAddress ?? '')
  const [domesticBankName, setDomesticBankName] = useState(sponsorship.domesticBankName ?? '')
  const [domesticAccountNumber, setDomesticAccountNumber] = useState(sponsorship.domesticAccountNumber ?? '')
  const [domesticAccountHolder, setDomesticAccountHolder] = useState(sponsorship.domesticAccountHolder ?? '')
  const [ukBankName, setUkBankName] = useState(sponsorship.ukBankName ?? '')
  const [ukSortCode, setUkSortCode] = useState(sponsorship.ukSortCode ?? '')
  const [ukAccountNumber, setUkAccountNumber] = useState(sponsorship.ukAccountNumber ?? '')
  const [ukSwiftBic, setUkSwiftBic] = useState(sponsorship.ukSwiftBic ?? '')
  const [showPostcode, setShowPostcode] = useState(false)
  const [saving, setSaving] = useState(false)
```

- [ ] **Step 3: `useEffect` 동기화 업데이트**

기존 `useEffect`의 `setForm(...)` 블록 전체를 교체:

```tsx
  useEffect(() => {
    if (open) {
      setIsOverseas(sponsorship.isOverseas)
      setBusinessRegNumber(sponsorship.businessRegNumber ?? '')
      setPostalCode(sponsorship.postalCode ?? '')
      setAddress(sponsorship.address ?? '')
      setAddressDetail(sponsorship.addressDetail ?? '')
      setTaxId(sponsorship.taxId ?? '')
      setOverseasAddress(sponsorship.overseasAddress ?? '')
      setDomesticBankName(sponsorship.domesticBankName ?? '')
      setDomesticAccountNumber(sponsorship.domesticAccountNumber ?? '')
      setDomesticAccountHolder(sponsorship.domesticAccountHolder ?? '')
      setUkBankName(sponsorship.ukBankName ?? '')
      setUkSortCode(sponsorship.ukSortCode ?? '')
      setUkAccountNumber(sponsorship.ukAccountNumber ?? '')
      setUkSwiftBic(sponsorship.ukSwiftBic ?? '')
    }
  }, [open, sponsorship])
```

- [ ] **Step 4: `handleSave()` 업데이트**

기존 `handleSave` 전체를 교체:

```tsx
  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await sponsorshipApi.update(sponsorship.id, {
        isOverseas,
        ...(!isOverseas && businessRegNumber ? { businessRegNumber } : { businessRegNumber: undefined }),
        ...(!isOverseas && postalCode ? { postalCode } : { postalCode: undefined }),
        ...(!isOverseas && address ? { address } : { address: undefined }),
        ...(!isOverseas && addressDetail ? { addressDetail } : { addressDetail: undefined }),
        ...(!isOverseas && domesticBankName ? { domesticBankName } : { domesticBankName: undefined }),
        ...(!isOverseas && domesticAccountNumber ? { domesticAccountNumber } : { domesticAccountNumber: undefined }),
        ...(!isOverseas && domesticAccountHolder ? { domesticAccountHolder } : { domesticAccountHolder: undefined }),
        ...(isOverseas && taxId ? { taxId } : { taxId: undefined }),
        ...(isOverseas && overseasAddress ? { overseasAddress } : { overseasAddress: undefined }),
        ...(isOverseas && ukBankName ? { ukBankName } : { ukBankName: undefined }),
        ...(isOverseas && ukSortCode ? { ukSortCode } : { ukSortCode: undefined }),
        ...(isOverseas && ukAccountNumber ? { ukAccountNumber } : { ukAccountNumber: undefined }),
        ...(isOverseas && ukSwiftBic ? { ukSwiftBic } : { ukSwiftBic: undefined }),
      })
      toast.success(t('bank.saved'))
      onSaved(updated)
      onOpenChange(false)
    } catch {
      toast.error(t('bank.saveFailed'))
    } finally {
      setSaving(false)
    }
  }
```

- [ ] **Step 5: Dialog JSX 교체**

기존 `const field = (...)` 헬퍼 함수 정의 전체를 삭제한다.  
그런 다음 `return (` 이하 `<Dialog>` 반환문 전체를 아래 구조로 교체:

```tsx
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('bank.editTitle')}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          {/* 국내/해외 구분 */}
          <div className="space-y-1.5">
            <Label>{t('form.origin')}</Label>
            <RadioGroup
              value={isOverseas ? 'overseas' : 'domestic'}
              onValueChange={(v) => setIsOverseas(v === 'overseas')}
            >
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="domestic" />
                  {t('form.domestic')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="overseas" />
                  {t('form.overseas')}
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* 국내 전용 */}
          {!isOverseas && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('form.businessRegNumber')}</Label>
                <Input placeholder="000-00-00000" value={businessRegNumber} onChange={(e) => setBusinessRegNumber(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('form.address')}</Label>
                <div className="flex gap-2">
                  <Input readOnly placeholder={t('form.postalCode')} value={postalCode} className="w-28" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowPostcode(true)}>
                    {t('form.addressSearch')}
                  </Button>
                </div>
                <Input readOnly value={address} />
                <Input placeholder={t('form.addressDetail')} value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} />
              </div>
              <div>
                <p className="text-xs font-medium mb-2">{t('bank.domestic')}</p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('bank.bankName')}</Label>
                    <Input value={domesticBankName} onChange={(e) => setDomesticBankName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('bank.accountNumber')}</Label>
                    <Input value={domesticAccountNumber} onChange={(e) => setDomesticAccountNumber(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('bank.accountHolder')}</Label>
                    <Input value={domesticAccountHolder} onChange={(e) => setDomesticAccountHolder(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 해외 전용 */}
          {isOverseas && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('form.taxId')}</Label>
                <Input placeholder="GB123456789" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('form.overseasAddress')}</Label>
                <Textarea
                  placeholder="10 Downing Street, London, UK"
                  value={overseasAddress}
                  onChange={(e) => setOverseasAddress(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <p className="text-xs font-medium mb-2">{t('bank.uk')}</p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('bank.bankName')}</Label>
                    <Input value={ukBankName} onChange={(e) => setUkBankName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t('bank.sortCode')}</Label>
                      <Input value={ukSortCode} onChange={(e) => setUkSortCode(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t('bank.accountNumber')}</Label>
                      <Input value={ukAccountNumber} onChange={(e) => setUkAccountNumber(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('bank.swiftBic')}</Label>
                    <Input value={ukSwiftBic} onChange={(e) => setUkSwiftBic(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DaumPostcodeDialog
          open={showPostcode}
          onOpenChange={setShowPostcode}
          onComplete={(pc, addr) => {
            setPostalCode(pc)
            setAddress(addr)
          }}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '저장 중...' : t('bank.editButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
```

- [ ] **Step 6: TypeScript 확인**

```bash
cd football
npx tsc --noEmit 2>&1 | grep -i "SponsorshipDetailPage\|BankEditDialog" | head -10
```

Expected: 오류 없음.

- [ ] **Step 7: 전체 BE 테스트 확인**

```bash
cd ../apps/api
npx jest --no-coverage 2>&1 | tail -5
```

Expected: `Tests: N passed, N total` — 실패 없음.

- [ ] **Step 8: 커밋**

```bash
cd ../..
git add football/src/pages/sponsorship/SponsorshipDetailPage.tsx
git commit -m "feat(sponsorship): redesign BankEditDialog with domestic/overseas toggle"
```
