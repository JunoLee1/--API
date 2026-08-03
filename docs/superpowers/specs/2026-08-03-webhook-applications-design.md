# Inbound Application Webhook Design

**Date:** 2026-08-03  
**Endpoint:** `POST /webhooks/applications/:source`  
**Sources:** saramin, glassdoor, indeed, facebook

---

## Overview

외부 채용 플랫폼(사람인, Glassdoor, Indeed, Facebook)에서 지원서가 접수될 때 우리 시스템으로 push하는 인바운드 webhook 엔드포인트.

---

## DB Changes

### 1. `JobPosting.externalJobId` 추가

```prisma
model JobPosting {
  // ...기존 필드
  externalJobId String?   // 각 플랫폼의 공고 ID (nullable: 직접 등록 공고는 없음)
}
```

### 2. `ApplicationSource` enum에 `FACEBOOK` 추가

```prisma
enum ApplicationSource {
  SARAMIN
  GLASSDOOR
  INDEED
  FACEBOOK   // 신규
  DIRECT
}
```

---

## Module Structure

```
apps/api/src/webhook/
├── webhook.routes.ts
├── webhook.service.ts
├── hmac.middleware.ts
└── adapters/
    ├── types.ts
    ├── saramin.adapter.ts
    ├── glassdoor.adapter.ts
    ├── indeed.adapter.ts
    └── facebook.adapter.ts
```

---

## Request Flow

```
POST /webhooks/applications/:source
  1. express.raw() — raw body 보존 (HMAC 검증에 필요)
  2. hmac.middleware — 소스별 secret으로 서명 검증
  3. JSON.parse(req.body)
  4. adapter.normalize(payload) → NormalizedApplication
  5. webhook.service.handleInbound()
     a. JobPosting 조회 by externalJobId → 없으면 404
     b. JobApplication upsert by (postingId, externalApplicantId)
        - 이미 존재하면 skip (status 유지)
        - 없으면 create with source, status=APPLIED
  6. 200 { received: true }
```

---

## Interfaces

```ts
// adapters/types.ts
export interface NormalizedApplication {
  externalApplicantId: string
  applicantName: string
  email: string
  phone?: string
  resumeUrl?: string
  externalJobId: string
}

export interface WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication
}
```

---

## HMAC Verification

- **알고리즘:** `sha256`
- **비교:** `crypto.timingSafeEqual` (timing attack 방지)
- **소스별 env var:**

| Source    | Env Var                   | Header                      |
|-----------|---------------------------|-----------------------------|
| saramin   | `SARAMIN_WEBHOOK_SECRET`  | `X-Saramin-Signature`       |
| glassdoor | `GLASSDOOR_WEBHOOK_SECRET`| `X-Glassdoor-Signature`     |
| indeed    | `INDEED_WEBHOOK_SECRET`   | `X-Indeed-Signature`        |
| facebook  | `FACEBOOK_WEBHOOK_SECRET` | `X-Hub-Signature-256`       |

Secret 미설정 시 서버 시작 단계에서 경고 로그, 해당 소스 요청은 500 반환.

---

## app.ts Mount

```ts
// webhookRouter는 express.raw()로 별도 마운트 — apiRouter의 express.json()과 충돌 방지
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRouter)
app.use('/api', express.json(), apiRouter)
```

---

## Error Responses

| 상황 | 상태코드 | 에러코드 |
|------|----------|----------|
| 유효하지 않은 source param | 400 | `INVALID_SOURCE` |
| HMAC 서명 불일치 | 401 | `INVALID_SIGNATURE` |
| externalJobId로 JobPosting 없음 | 404 | `JOB_POSTING_NOT_FOUND` |
| 어댑터 파싱 실패 | 400 | `INVALID_PAYLOAD` |

---

## Duplicate Handling

`JobApplication`의 `(postingId, externalApplicantId)` compound unique를 활용.  
동일 지원자 재지원 시 `createOrSkip` — `upsert`로 처리하되 update data는 빈 객체 (기존 status 유지).

---

## Out of Scope

- 알림(notification) 발송 — 별도 이슈로 분리
- 재시도(retry) 큐 — 플랫폼 자체 retry에 의존
- webhook 수신 로그 테이블 — 필요 시 추후 추가
