# Finance Integrity — 구현 플랜

> 브랜치: `feat/finance-integrity`
> 근거: Jack 재무팀장 페르소나 A 항목 (데이터 정합성)

## 구현 항목

### J1 — 역분개 마킹 (Prisma 마이그레이션 필요)
- `LedgerEntry` 모델에 `reversedById Int?` FK 추가 (self-relation)
- `LedgerRepository.createRefund()` 수정: 환불 생성 후 원본 항목에 `reversedById` 세팅
- `LedgerService.createRefund()` 수정: 원본 항목에 `reversedById`가 이미 있으면 `AppError(400, "ALREADY_REVERSED")` throw

### J4 — 환율 검증
- `LedgerService.create()` 에 검증 추가: `if (rate <= 0 || rate > 10000) throw new AppError(400, "INVALID_EXCHANGE_RATE")`
- `createAutoEntry()` 동일 적용

### J5 — relatedModule 화이트리스트 검증
- 허용 값: `["SalesRecord", "facility", "sponsorship", "equipment", "payroll"]`
- `relatedModule` 있을 때 위 목록에 없으면 `AppError(400, "INVALID_RELATED_MODULE")`
- `relatedId` 있을 때 양수 아니면 `AppError(400, "INVALID_RELATED_ID")`
- `LedgerService.create()` 에 추가

### J10 — 자기승인 방지
- `ReportService.approve()` 에 추가: `if (report.authorId === reviewerId) throw new AppError(403, "SELF_APPROVAL_FORBIDDEN")`

## 파일 대상
- `prisma/schema.prisma` — LedgerEntry reversedById 필드 추가
- `apps/api/src/ledger/ledger.repo.ts` — createRefund 원본 마킹
- `apps/api/src/ledger/ledger.service.ts` — 중복 역분개 차단, 환율 검증, relatedModule 검증
- `apps/api/src/report/report.service.ts` — 자기승인 방지
