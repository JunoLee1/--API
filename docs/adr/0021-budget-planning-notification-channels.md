# ADR 0021: 편성 워크플로우 알림 채널

**Status:** Accepted
**Date:** 2026-08-29
**Related:** [PRD 2026-08-29 annual-budget-planning-workflow](../superpowers/specs/2026-08-29-annual-budget-planning-workflow.md), Issue #404

## Context

편성 워크플로우 (PRD 2026-08-29) 는 5가지 알림 이벤트를 발생시킨다. 각 이벤트의 수신자·긴급도·Miss 리스크가 상이하므로 채널 선택을 표준화할 필요.

Football repo 실질 인프라:
- **in-app**: `NotificationRepository` (i18n 지원, OperatingExpense 워크플로우에서 사용 중)
- **email**: `apps/api/src/lib/email.ts` (nodemailer, SMTP). 기존 사용처: 초대·부상·채용 결과·콜업
- **SMS / Push**: 없음 (SMS 는 자산관리 ERP 별도 repo, 모바일 앱 부재)

이슈 #404 grill 세션 (2026-08-29) 에서 3가지 방침을 검토:
- (A) 전부 in-app
- (B) 중요 이벤트만 email 병행
- (C) 전부 in-app + email

(B) 선택. 이벤트별 긴급도·Miss 리스크 차등화가 편성 사이클 (연 1회) 특성에 맞음.

## Decision

**중요 이벤트만 email 병행. 나머지는 in-app 만.** 채널 매핑은 이 ADR 로 관리.

### 이벤트별 채널 매핑

| # | 이벤트 | 수신자 | 채널 | 사유 |
|---|--------|--------|------|------|
| 1 | Draft ready (closeSeason 훅 완료) | FinanceManager (1명) | **in-app 만** | 마감 없음, FM 이 대시보드 리듬 있음 |
| 2 | `CAPACITY_FAILED` alert | GM (1명) | **in-app + email** | 편성 blocking, 즉시 조치 필요 |
| 3 | Review 창 개방 (D-0) | 모든 Team.leader + Department.head | **in-app + email** | 초기 알림 강도, 팀장 전체 인식 필요 |
| 4a | 리마인더 D-7 | 미신청 팀·부서 | **in-app 만** | 여유 있음 |
| 4b | 리마인더 D-3 | 미신청 팀·부서 | **in-app 만** | 여전히 여유 |
| 4c | 리마인더 D-1 | 미신청 팀·부서 | **in-app + email** | 마지막 기회, D+14 지나면 자동 Basic 확정 |
| 5 | 편성 확정 결과 | 팀장·부서장 | **in-app 만** | 참고용, 액션 없음 (이의 신청은 별도 API) |

### 발송 계약

- **in-app 발송 실패 시**: 재시도 없음. 로그만 (기존 `NotificationRepository` 패턴)
- **email 발송 실패 시**: 3회 지수 백오프 재시도 (기존 nodemailer 패턴 확장). 최종 실패 시 audit log 에 기록
- **email 필수 검증**: 수신자 email 없거나 검증 안 됨 → in-app 만 발송, warn log
- **Opt-out**: 이 ADR 에서는 opt-out 미지원. 필요 시 다음 ADR 로 (User preference 확장)

### 재편성 시 알림

`RE_PLANNING` 트리거 시:
- 이벤트 #3 (Review 창 재개방) 이 재발송됨 → 동일 채널 (in-app + email)
- GM 이 재편성 사유를 `reason` 필드에 기록, 알림 본문에 포함

## Alternatives Considered

**(A) 전부 in-app**: 기존 인프라만 사용. 확장 없음. 리스크: 대시보드 안 보면 miss. 편성은 연 1회 사이클이라 팀장이 매일 확인 안 할 가능성 높음. 특히 CAPACITY_FAILED 는 GM 즉시 반응 필요. 기각.

**(C) 전부 in-app + email**: 확실하지만 팀장·부서장이 편성 사이클 동안 여러 이메일 수신. D-7/D-3 리마인더까지 email 발송하면 spam 느낌. Miss 리스크 낮은 이벤트에 오버스펙. 기각.

**SMS 도입**: 자산관리 ERP 에서 사용 이력 있으나 football repo 로 인프라 이식하려면 별도 작업. 편성은 긴급도가 SMS 급 아님 (분 단위 반응 필요 X). 기각.

**Slack/Discord 웹훅**: 조직이 사용하는 채팅 툴 통합. 현재 football 프로젝트에서 사용 확인 안 됨. 스코프 밖.

**Opt-out 지원**: 편성 사이클 알림은 업무 요구사항 (팀장은 매년 신청 참여 필수) → opt-out 부적절. 기각.

## Consequences

**신규 유틸**
- `apps/api/src/lib/email.ts` 에 5개 함수 추가:
  - `sendCapacityFailedEmail(gm, seasonId, retryResult)` — 이벤트 #2
  - `sendReviewOpenedEmail(recipient, seasonId, deadline)` — 이벤트 #3
  - `sendReviewDeadlineD1Email(recipient, seasonId, deadline)` — 이벤트 #4c
- `NotificationRepository` 확장 없음 (기존 `create*` 메서드 재사용)

**신규 서비스**
- `NotificationService.notifyBudgetPlanEvent(event: BudgetPlanEvent, context)` — 이벤트 → (in-app + email) 라우팅
- Event enum: `DRAFT_READY | CAPACITY_FAILED | REVIEW_OPENED | REMINDER_D7 | REMINDER_D3 | REMINDER_D1 | FINALIZED`

**영향**
- Issue #400, #401, #402, #405, #406 의 TODO 마커 → 이 서비스 호출로 교체
- Issue #404 (이 ADR 의 원천) 는 이제 AFK 로 진행 가능

**모니터링**
- Email 발송 실패율 대시보드 (기존 email 발송 지표 확장)
- 편성 사이클 종료 후 리마인더 효과 분석 (D-7/D-3/D-1 발송 후 신청률 변화)
