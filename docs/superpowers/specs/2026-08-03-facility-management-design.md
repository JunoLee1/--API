# Facility Management Design

**Date:** 2026-08-03  
**Endpoints:** `/api/facility/inspections`, `/api/facility/maintenance`

---

## Overview

시설 점검(FacilityInspection)과 유지보수 요청(MaintenanceRequest) CRUD API. 점검 결과 ISSUE_FOUND 시 MaintenanceRequest 자동 생성 + EMERGENCY 알림 발송.

---

## API Endpoints

### FacilityInspection

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/facility/inspections` | 목록 (zone, type, result 필터) |
| POST | `/api/facility/inspections` | 생성 |
| GET | `/api/facility/inspections/:id` | 상세 |
| PATCH | `/api/facility/inspections/:id` | 수정 |

### MaintenanceRequest

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/facility/maintenance` | 목록 (status, priority 필터) |
| POST | `/api/facility/maintenance` | 생성 |
| GET | `/api/facility/maintenance/:id` | 상세 |
| PATCH | `/api/facility/maintenance/:id` | 수정 (RESOLVED 전환 포함) |

---

## Auto-Trigger Logic

### 점검 → 유지보수 자동 생성

`POST /api/facility/inspections` 에서 `result = ISSUE_FOUND`이면:

1. `MaintenanceRequest` 자동 생성
   - `priority: EMERGENCY`
   - `sourceInspectionId`: 방금 생성된 inspection id 연결
   - `title`: `"[자동] {zone} 구역 점검 이상 감지"`
   - `description`: inspection notes 인용
2. EMERGENCY 알림 즉시 발송
3. 응답에 `createdMaintenanceId` 포함

### EMERGENCY 알림 발송 조건

`MaintenanceRequest`가 `priority = EMERGENCY`로 생성될 때 (수동/자동 모두):

- **DB**: 전체 유저 대상 `FACILITY_EMERGENCY` Notification 레코드 `createMany`
- **Socket**: `getIO().to("staff-room").emit("notification:facility", { type: "FACILITY_EMERGENCY", title, body })`

### RESOLVED 알림

`PATCH /api/facility/maintenance/:id` 에서 `status → RESOLVED`:

- `resolvedAt` 자동 설정
- **DB**: 전체 유저 대상 `FACILITY_MAINTENANCE_RESOLVED` Notification `createMany`
- **Socket**: `staff-room` emit

---

## Permissions

| 액션 | 허용 역할 |
|------|-----------|
| 생성 / 수정 | ADMIN, FRONT_OFFICE |
| 조회 | 전체 역할 (인증 필요) |

---

## Module Structure

```
apps/api/src/facility/
├── facility.routes.ts               # 두 서브도메인 라우터 통합
├── inspection/
│   ├── inspection.controller.ts
│   ├── inspection.service.ts        # NotificationService + MaintenanceRepo 참조
│   ├── inspection.repo.ts
│   └── dto/inspection.dto.ts
└── maintenance/
    ├── maintenance.controller.ts
    ├── maintenance.service.ts       # NotificationService 참조
    ├── maintenance.repo.ts
    └── dto/maintenance.dto.ts
```

`facility.routes.ts`에서 두 라우터를 `/inspections`, `/maintenance`로 마운트.  
`apiRouter.ts`에 `/api/facility` 등록.

---

## Key Types

```ts
// inspection.dto.ts
interface CreateInspectionDto {
  type: InspectionType;           // DAILY | MONTHLY | QUARTERLY | ANNUAL
  facilityZone: FacilityZone;     // GROUND | MECHANICAL | STRUCTURAL | SAFETY | SANITATION
  result: InspectionResult;       // OK | ISSUE_FOUND
  isStatutory?: boolean;
  certificateUrl?: string;
  statutoryDeadline?: string;
  inspectedAt?: string;
  notes?: string;
}

interface InspectionListQuery {
  zone?: FacilityZone;
  type?: InspectionType;
  result?: InspectionResult;
}

// maintenance.dto.ts
interface CreateMaintenanceDto {
  title: string;
  description: string;
  priority: MaintenancePriority;  // EMERGENCY | HIGH | NORMAL
  sourceInspectionId?: number;
  estimatedCost?: number;
}

interface UpdateMaintenanceDto {
  title?: string;
  description?: string;
  priority?: MaintenancePriority;
  status?: MaintenanceStatus;     // OPEN | IN_PROGRESS | RESOLVED
  postIncidentReport?: string;
  estimatedCost?: number;
  actualCost?: number;
}

interface MaintenanceListQuery {
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
}
```

---

## Error Codes

| 상황 | 상태코드 | 코드 |
|------|----------|------|
| Inspection 없음 | 404 | `INSPECTION_NOT_FOUND` |
| MaintenanceRequest 없음 | 404 | `MAINTENANCE_REQUEST_NOT_FOUND` |
| 권한 없음 | 403 | `FORBIDDEN` |
| 이미 RESOLVED | 409 | `ALREADY_RESOLVED` |

---

## Out of Scope

- 점검 일정 자동 생성 (cron)
- 첨부파일 업로드 (certificateUrl은 외부 URL 문자열)
- 유지보수 담당자 배정 필드
