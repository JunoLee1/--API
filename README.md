# Football ERP

단일 클럽 내부 운영을 위한 스포츠 ERP 시스템. 선수·코칭스태프 관리부터 급여·채용·시설·스폰서십까지 클럽 운영 전반을 통합 관리합니다.

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| API | Node.js, Express, TypeScript |
| ORM | Prisma + PostgreSQL |
| 인증 | JWT (Access + Refresh Token), Passport.js |
| 알림 | Socket.io (실시간 push) |
| AI | Anthropic SDK (외부 리포트 자동화) |
| 크론 | node-cron |
| 프론트엔드 | React, Vite, Tailwind CSS, shadcn/ui |
| 인프라 | Docker Compose |

---

## 빠른 시작

### 사전 요구사항

- Node.js 20+
- Docker & Docker Compose
- pnpm

### 1. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 주요 항목:

```env
DB_PASSWORD=your_db_password

# CORS
CLIENT_ORIGIN=http://localhost:5173

# JWT (openssl rand -hex 32 로 생성)
JWT_ACCESS_TOKEN_SECRET=...
JWT_REFRESH_TOKEN_SECRET=...

# 전화번호 암호화 키 (정확히 64 hex 문자)
PHONE_ENCRYPTION_KEY=...

# AI 기능 (선택)
ANTHROPIC_API_KEY=...

# 웹훅 서명 검증 (채용 플랫폼 연동 시)
SARAMIN_WEBHOOK_SECRET=...
GLASSDOOR_WEBHOOK_SECRET=...
INDEED_WEBHOOK_SECRET=...
FACEBOOK_WEBHOOK_SECRET=...
```

### 2. DB 실행 및 스키마 적용

```bash
docker compose up -d db

cd apps/api
npx prisma db push
pnpm seed           # 기본 데이터 시드
```

### 3. API 서버 실행

```bash
cd apps/api
pnpm dev            # http://localhost:3000
```

### 4. 프론트엔드 실행

```bash
cd football
pnpm dev            # http://localhost:5173
```

---

## 프로젝트 구조

```
football/
├── apps/api/               # Express API 서버
│   ├── src/
│   │   ├── auth/           # JWT 인증
│   │   ├── player/         # 선수 관리
│   │   ├── player-callup/  # 유소년 → 1군 콜업 워크플로우
│   │   ├── contract/       # 계약 관리
│   │   ├── payroll/        # 급여 관리
│   │   ├── recruitment/    # 채용 공고 · 지원자 관리
│   │   ├── hiring-automation/  # IBI 기반 채용 우선순위 자동화
│   │   ├── sponsorship/    # 스폰서십 계약 관리
│   │   ├── facility/       # 시설 · 예약 · 점검 관리
│   │   ├── hr-report/      # 월간 · 연간 HR 리포트
│   │   ├── training/       # 훈련 세션 관리
│   │   ├── match/          # 경기 관리
│   │   ├── injury/         # 부상 관리
│   │   ├── academy-fee/    # 유소년 회비 관리
│   │   ├── notification/   # 실시간 알림
│   │   ├── webhook/        # 외부 채용 플랫폼 웹훅 수신
│   │   └── jobs/           # 크론 작업
│   └── prisma/
│       └── schema.prisma
└── football/               # React 프론트엔드
    └── src/
        ├── pages/
        └── services/
```

---

## 주요 모듈

### 인사 (HR)
- **선수 관리** — 등록, 포지션, 팀 소속
- **콜업** (`TRAINING` | `OFFICIAL`) — 유소년→1군 콜업 워크플로우. OFFICIAL 콜업은 유효 계약 필수, GM 전결. TRAINING 콜업은 계약 불필요, GM/TD/HEAD_COACH 승인.
- **코칭스태프 관리** — 역할별 접근 제어
- **계약 관리** — 프로/세미프로/임대, 바이아웃 조항, 연장 옵션, 성과 보너스

### 급여
- **급여 설정** (`PayrollConfig`) — 기본급, 수당 항목 설정
- **급여 계산** (`PayrollRun`) — 월별 자동 계산, 성과 보너스 포함
- **직원 수당** — 부서별 수당 지급 이력

### 채용
- **채용 공고** — DRAFT → OPEN → CLOSED 상태머신, GM 승인 필요
- **지원자 관리** — APPLIED → SCREENING → INTERVIEW → REFERENCE_CHECK → OFFERED → ONBOARDED
- **면접 관리** — 1·2차 면접, 점수 기록
- **레퍼런스 체크** — PENDING / CLEAR / FLAGGED
- **온보딩** — OTP 이메일 인증 → MFA 등록 완료

### 채용 자동화
- **IBI (Importance-Backfill Index)** — 부서별 공백 위험도 자동 계산
- **우선순위 큐** — 리그 레벨 가중치 + IBI + 컴플라이언스 위반 보너스
- **분기 크론** — 1월·4월·7월·10월 1일 09:00 자동 채용 공고 DRAFT 생성

### 시설
- **시설 등록** — 유형별 (PITCH / GYM / TREATMENT_ROOM / MEETING_ROOM / OFFICE / OTHER)
- **예약** — 충돌 감지, 상태 관리 (PENDING → APPROVED → CANCELLED)
- **정기 점검** — SCHEDULED → COMPLETED / OVERDUE 자동 전환, 알림

### 스폰서십
- **파트너 계약** — 계약 기간, 금액, 서비스 항목 관리
- **장비 대여** — 파트너사 장비 대여 이력

### 재무
- **예산 계획** — 부서별 예산 배정
- **운영비 · 식비** — 지출 기록 및 승인
- **재무 리포트** — KPI 요약

### 유소년
- **아카데미 회비** — 월별 자동 청구, 연체→LOCKED 에스컬레이션
- **발달 계획** — 포지션별 성장 목표
- **안전 관리** (Safeguarding) — 사건 보고, 대응 워크플로우

### 리포트 · 분석
- **HR 리포트** — 월간/연간 이직률, 출근율, 채용 현황, 채용 우선순위 큐
- **훈련 부하** — 세션별 강도 분석
- **외부 리포트 자동화** — AI 기반 부상 평가 리포트 생성

---

## 역할 구조

```
ADMIN
├── FRONT_OFFICE
│   ├── GM             # 전체 열람 + 승인 전결
│   ├── TD             # 전술·스카우팅 중심
│   ├── HR_MANAGER     # 채용·인사 관리
│   ├── CONTRACT_MANAGER
│   ├── FINANCE_MANAGER
│   ├── SCOUT
│   └── ...
├── COACHING_STAFF
│   ├── HEAD_COACH
│   ├── ASSISTANT_COACH
│   ├── MEDICAL
│   └── ...
└── PLAYER
```

---

## 테스트

```bash
cd apps/api

# 전체
pnpm test

# 특정 모듈
npx jest __test__/player-callup
npx jest __test__/hiring-automation
npx jest __test__/recruitment
```

> 테스트는 실제 DB에 대해 실행됩니다 (shadow DB 미사용). `DATABASE_URL` 필수.

---

## 웹훅 연동

외부 채용 플랫폼(사람인, Glassdoor, Indeed, Facebook Jobs)에서 지원서를 수신합니다.

```
POST /api/webhook/inbound/:source
```

각 플랫폼별 HMAC 서명 검증 후 `JobApplication`으로 upsert. `.env`에 시크릿 키 설정 필요.

---

## 스키마 변경

```bash
cd apps/api

# 스키마 수정 후
npx prisma db push       # shadow DB 없이 직접 적용
npx prisma generate      # 클라이언트 재생성
```

---

## 기여 가이드

- 브랜치: `feat/<기능명>`
- 테스트 먼저 (`__test__/<module>/`) → 구현 → 커밋
- PR은 `main` 기준으로 생성
