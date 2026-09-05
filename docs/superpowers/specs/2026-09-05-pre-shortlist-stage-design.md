# PRE_SHORTLIST 단계 도입 설계

## 목표

롱리스트(LONGLIST)의 과부화를 해소하기 위해 "발굴만 된 선수"와 "적극 평가 중인 선수"를 명시적으로 구분하는 중간 단계를 도입한다.

## 배경

현재 파이프라인에서 LONGLIST는 "방금 발굴한 선수"부터 "비디오 평가가 거의 완료된 선수"까지 혼재한다. PRE_SHORTLIST 단계를 필수 경로로 삽입해 파이프라인 가시성을 확보한다.

## 파이프라인 변경

**기존:**
```
LONGLIST → SHORTLIST (VIDEO_EVAL PASS 필수) → ACTIVE → MEDICAL_TEST → CONTRACT_PENDING → SIGNED
```

**변경 후:**
```
LONGLIST → PRE_SHORTLIST → SHORTLIST (VIDEO_EVAL PASS 필수) → ACTIVE → MEDICAL_TEST → CONTRACT_PENDING → SIGNED
```

- LONGLIST → PRE_SHORTLIST: 하드 게이트 없음, 스카우트 판단으로 승격
- PRE_SHORTLIST → SHORTLIST: VIDEO_EVAL PASS 필수 (기존 LONGLIST→SHORTLIST 게이트 그대로 이동)
- LONGLIST → SHORTLIST 직행: 차단 (`MUST_GO_THROUGH_PRE_SHORTLIST` 400 에러)
- 보류(ARCHIVED)는 모든 단계에서 가능 (변경 없음)

## 데이터 모델

### Prisma

`ProspectStatus` enum에 `PRE_SHORTLIST` 추가:

```prisma
enum ProspectStatus {
  LONGLIST
  PRE_SHORTLIST  // 신규
  SHORTLIST
  ACTIVE
  MEDICAL_TEST
  CONTRACT_PENDING
  SIGNED
  ARCHIVED
}
```

마이그레이션 1개 필요.

## BE 변경

### `apps/api/src/prospect/prospect.service.ts`

1. `NON_ACTIVE_STATUSES`에 `"PRE_SHORTLIST"` 추가:
   ```ts
   const NON_ACTIVE_STATUSES: ProspectStatus[] = ["LONGLIST", "PRE_SHORTLIST", "SHORTLIST", "SIGNED", "ARCHIVED"];
   ```

2. `updateStatus` 게이트 이동: SHORTLIST 전이 시 prospect 현재 상태를 fetch해 직행 차단 + VIDEO_EVAL PASS 검사:
   ```ts
   if (dto.status === "SHORTLIST") {
     const prospect = await this.repo.findById(id);
     if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
     if (prospect.status === "LONGLIST") throw new AppError(400, "MUST_GO_THROUGH_PRE_SHORTLIST");
     const latest = await this.repo.getLatestVideoEvaluation(id);
     if (!latest || latest.result !== "PASS") throw new AppError(400, "VIDEO_EVAL_REQUIRED");
   }
   ```

### `apps/api/src/prospect/dto/prospect.dto.ts`

`CreateProspectDto.status` 허용값에서 `SHORTLIST` 제거, `PRE_SHORTLIST` 추가:

```ts
status?: 'LONGLIST' | 'PRE_SHORTLIST';
```

### 테스트 (`apps/api/src/prospect/prospect.service.test.ts`)

- LONGLIST → SHORTLIST 직행 시 `MUST_GO_THROUGH_PRE_SHORTLIST` 400 에러 반환
- PRE_SHORTLIST → SHORTLIST: VIDEO_EVAL PASS 없으면 `VIDEO_EVAL_REQUIRED` 400 에러
- PRE_SHORTLIST → SHORTLIST: VIDEO_EVAL PASS 있으면 정상 전환

## FE 변경

### `football/src/types/prospect.ts`

```ts
export type ProspectStatus =
  | 'LONGLIST'
  | 'PRE_SHORTLIST'   // 신규
  | 'SHORTLIST'
  | 'ACTIVE'
  | 'MEDICAL_TEST'
  | 'CONTRACT_PENDING'
  | 'SIGNED'
  | 'ARCHIVED'

export const STATUS_LABEL: Record<ProspectStatus, string> = {
  LONGLIST: '롱리스트',
  PRE_SHORTLIST: '적극 검토 중',  // 신규
  SHORTLIST: '쇼트리스트',
  // ...나머지 동일
}

export const STATUS_STYLE: Record<ProspectStatus, string> = {
  LONGLIST: 'bg-slate-100 text-slate-700 border-slate-200',
  PRE_SHORTLIST: 'bg-sky-100 text-sky-700 border-sky-200',  // 신규
  SHORTLIST: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  // ...나머지 동일
}
```

`CreateProspectDto.status`:
```ts
status?: 'LONGLIST' | 'PRE_SHORTLIST'
```

### `football/src/pages/prospects/ProspectsPage.tsx`

1. `STATUSES` 필터 배열에 `'PRE_SHORTLIST'` 추가

2. `listStatus` 상태 타입 확장 및 Select 항목 추가:
   ```ts
   const [listStatus, setListStatus] = useState<'LONGLIST' | 'PRE_SHORTLIST' | 'SHORTLIST'>('LONGLIST')
   ```
   SelectItem 3개: 롱리스트 / 적극 검토 중 / 쇼트리스트

3. 전환 버튼 변경:
   ```tsx
   case 'LONGLIST':
     // "쇼트리스트 승격" → "평가 시작" (PRE_SHORTLIST 전환)
     <Button onClick={() => handleTransition(p.id, 'PRE_SHORTLIST')}>평가 시작</Button>
     <Button onClick={() => handleTransition(p.id, 'ARCHIVED')}>보류</Button>

   case 'PRE_SHORTLIST':  // 신규
     <Button onClick={() => handleTransition(p.id, 'SHORTLIST')}>쇼트리스트 승격</Button>
     <Button onClick={() => handleTransition(p.id, 'ARCHIVED')}>보류</Button>
   ```

4. `handleTransition` acquisition gate check: 조건 `status === 'SHORTLIST'` 그대로 유지 (PRE_SHORTLIST→SHORTLIST 시점에 동일하게 발동)

## 권한

변경 없음. 기존 `canWrite`(SCOUT, GM, TD) / `canRead` 권한 그대로 적용.

## 비디오 평가 타이밍

단계 제한 없음. 비디오 평가는 어느 단계에서나 추가 가능 (현재와 동일). PRE_SHORTLIST가 사실상 평가가 일어나는 단계이나 코드 레벨 강제는 하지 않는다. 필요 시 나중에 추가.
