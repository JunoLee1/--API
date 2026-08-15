# 스폰서십 등록 폼 국내/해외 구분 재설계

> 작성일: 2026-08-15  
> 대상 페이지: SponsorshipPage (CreateSponsorshipDialog), SponsorshipDetailPage (BankEditDialog)

---

## 배경

현재 스폰서 등록 폼은 국내 계좌와 영국 계좌 섹션을 동시에 노출하며, 국내/해외 구분 없이 선택적 입력을 허용한다. 사업자등록번호·주소(우편번호) 등 국내 스폰서 전용 필드와 TAX ID·해외 주소 등 해외 스폰서 전용 필드가 없다.

---

## 목표

- 폼 최상단 `◉ 국내 스폰서 / ◯ 해외 스폰서` 라디오 토글로 구분
- 선택에 따라 관련 필드만 노출
- 신규 필드(사업자등록번호, 주소, TAX ID 등)를 DB에 저장
- 수정 Dialog(BankEditDialog)도 동일 패턴 적용

---

## Prisma 스키마 변경

`Sponsorship` 모델에 7개 필드 추가. 기존 bank 필드 유지.

```prisma
model Sponsorship {
  // ... 기존 필드 ...

  // 국내/해외 구분
  isOverseas            Boolean @default(false)

  // 국내 전용
  businessRegNumber     String?   // 사업자등록번호
  postalCode            String?   // 우편번호
  address               String?   // 도로명 주소 (카카오 API 반환값)
  addressDetail         String?   // 상세주소 (직접 입력)

  // 해외 전용
  taxId                 String?   // TAX ID / VAT Number
  overseasAddress       String?   // 해외 주소 (자유 입력)
}
```

마이그레이션: `prisma migrate dev --name add-sponsorship-region-fields`

---

## BE 변경

### `apps/api/src/sponsorship/sponsorship.service.ts`
- `createSponsorship` DTO에 신규 7개 필드 수용 (모두 optional)
- `updateSponsorship` DTO에도 동일 필드 추가

### `apps/api/src/sponsorship/sponsorship.routes.ts` / `sponsorship.controller.ts`
- 기존 create/update 핸들러에서 신규 필드를 body에서 꺼내 서비스로 전달
- 별도 엔드포인트 불필요

---

## FE 변경

### `football/src/types/sponsorship.ts`
- `Sponsorship` 인터페이스에 7개 필드 추가 (`isOverseas: boolean`, 나머지 `string | null`)
- `CreateSponsorshipDto`에 신규 7개 optional 필드 추가
- `UpdateSponsorshipDto`에도 동일 추가

### `football/src/components/DaumPostcodeDialog.tsx` (신규)
- `react-daum-postcode` 패키지 (`npm install react-daum-postcode`) 설치 후 래퍼 컴포넌트
- Props: `open`, `onOpenChange`, `onComplete(postalCode: string, address: string)`
- shadcn Dialog 안에 `<DaumPostcode autoClose={false} onComplete={...} />` 렌더링

### `football/src/pages/sponsorship/SponsorshipPage.tsx` — `CreateSponsorshipDialog`
- `isOverseas: boolean` state 추가 (기본값 `false`)
- 폼 최상단에 라디오 그룹:
  ```
  ◉ 국내 스폰서   ◯ 해외 스폰서
  ```
  - `@/components/ui/radio-group`의 `<RadioGroup>` + `<RadioGroupItem>` 사용
- **국내 선택 시 노출 필드**:
  1. 사업자등록번호 — `<Input>` (하이픈 포함 자유 입력)
  2. 우편번호 + 주소 — `<Input readonly>` + "검색" 버튼 → `DaumPostcodeDialog`
  3. 상세주소 — `<Input>` 직접 입력
  4. 국내 계좌 (기존: 은행명, 계좌번호, 예금주)
- **해외 선택 시 노출 필드**:
  1. TAX ID / VAT Number — `<Input>`
  2. 해외 주소 — `<Textarea>` 자유 입력
  3. 해외 계좌 (기존: 은행명, Sort Code, 계좌번호, SWIFT/BIC)
- `reset()` 함수에 신규 state 포함
- `handleSave()` — DTO에 `isOverseas` 및 선택된 구분에 맞는 필드만 포함, 반대 구분 필드는 미포함

### `football/src/pages/sponsorship/SponsorshipDetailPage.tsx` — `BankEditDialog`
- 컴포넌트명 `SponsorInfoEditDialog`로 변경 (파일 내부)
- `isOverseas` state: `sponsorship.isOverseas`로 초기화
- CreateDialog와 동일한 라디오 토글 + 조건부 필드 구성
- `handleSave()` — `sponsorshipApi.update`에 `isOverseas` 및 관련 필드 전달

---

## 예외 처리

- 우편번호 팝업 닫기(취소) 시 기존 주소 값 유지
- `DaumPostcodeDialog` 로딩 실패 시 toast 에러 표시
- 국내→해외 전환 시 국내 전용 state 초기화 (반대도 동일)
  - 단, 기존 저장된 데이터 표시 중(수정 Dialog)에는 토글 변경 후 해당 구분 필드만 초기화

---

## 구현 범위 요약

| 항목 | BE | FE |
|------|----|----|
| Prisma 스키마 + 마이그레이션 | 7개 필드 추가 | — |
| DTO/서비스/컨트롤러 | create·update에 신규 필드 수용 | — |
| 타입 정의 | — | Sponsorship, Create/UpdateDto 확장 |
| DaumPostcodeDialog | — | 신규 컴포넌트 |
| CreateSponsorshipDialog | — | 라디오 토글 + 조건부 필드 |
| SponsorInfoEditDialog | — | BankEditDialog 확장 |
