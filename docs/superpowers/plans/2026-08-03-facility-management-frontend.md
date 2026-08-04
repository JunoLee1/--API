# Facility Management Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the facility management UI (inspections + maintenance requests) for FACILITY_MANAGER and FACILITY_STAFF roles.

**Architecture:** Single `/facility` page with two tabs — "시설 점검" (inspections) and "유지보수" (maintenance). Each tab has a filterable table and a create dialog. FACILITY_MANAGER can also update maintenance request status. All data comes from the existing backend at `/api/facility/*`.

**Tech Stack:** React, TypeScript, shadcn/ui (Table, Dialog, Select, Tabs, Badge), react-i18next (`facility` namespace), sonner toasts, existing `api` helper from `@/services/api`.

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `football/src/types/facility.ts` | Create | TS types, style/label constants for all facility enums |
| `football/src/services/facility.service.ts` | Create | `facilityApi` — inspections + maintenance CRUD |
| `football/src/pages/facility/FacilityPage.tsx` | Create | Main page with Tabs: inspections list + maintenance list |
| `football/src/locales/ko/facility.json` | Create | Korean translations |
| `football/src/locales/en/facility.json` | Create | English translations |
| `football/src/i18n.ts` | Modify | Register `facility` namespace |
| `football/src/locales/ko/common.json` | Modify | Add `nav.item.facilityMgmt` label |
| `football/src/locales/en/common.json` | Modify | Add `nav.item.facilityMgmt` label |
| `football/src/layouts/AppShell.tsx` | Modify | Add `/facility` nav item for FACILITY_MANAGER + FACILITY_STAFF |
| `football/src/App.tsx` | Modify | Add `<Route path="/facility" element={<FacilityPage />} />` |

---

### Task 1: Types + Service

**Files:**
- Create: `football/src/types/facility.ts`
- Create: `football/src/services/facility.service.ts`

- [ ] **Step 1: Create types file**

```typescript
// football/src/types/facility.ts
export type FacilityZone = 'GROUND' | 'MECHANICAL' | 'STRUCTURAL' | 'SAFETY' | 'SANITATION' | 'OPERATIONS'
export type InspectionType = 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
export type InspectionResult = 'OK' | 'ISSUE_FOUND'
export type MaintenancePriority = 'EMERGENCY' | 'HIGH' | 'NORMAL'
export type MaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'

export interface FacilityInspection {
  id: number
  type: InspectionType
  facilityZone: FacilityZone
  result: InspectionResult
  isStatutory: boolean
  certificateUrl: string | null
  statutoryDeadline: string | null
  inspectedAt: string
  notes: string | null
  inspectedBy: { id: number; username: string }
  createdAt: string
}

export interface MaintenanceRequest {
  id: number
  title: string
  description: string
  priority: MaintenancePriority
  status: MaintenanceStatus
  estimatedCost: number | null
  actualCost: number | null
  postIncidentReport: string | null
  sourceInspection: { id: number; type: InspectionType; facilityZone: FacilityZone } | null
  createdBy: { id: number; username: string }
  createdAt: string
  resolvedAt: string | null
}

export interface CreateInspectionDto {
  type: InspectionType
  facilityZone: FacilityZone   // matches backend field name (not "zone")
  result: InspectionResult
  isStatutory?: boolean
  inspectedAt?: string
  notes?: string
}

export interface CreateMaintenanceDto {
  title: string
  description: string
  priority: MaintenancePriority
  estimatedCost?: number
}

export interface UpdateMaintenanceDto {
  status?: MaintenanceStatus
  postIncidentReport?: string
  actualCost?: number
}

export const ZONE_LABEL: Record<FacilityZone, string> = {
  GROUND: '경기장',
  MECHANICAL: '기계실',
  STRUCTURAL: '구조물',
  SAFETY: '안전시설',
  SANITATION: '위생',
  OPERATIONS: '운영시설',
}

export const INSPECTION_TYPE_LABEL: Record<InspectionType, string> = {
  DAILY: '일일',
  MONTHLY: '월간',
  QUARTERLY: '분기',
  ANNUAL: '연간',
}

export const RESULT_LABEL: Record<InspectionResult, string> = {
  OK: '정상',
  ISSUE_FOUND: '이상 발견',
}

export const RESULT_STYLE: Record<InspectionResult, string> = {
  OK: 'bg-green-100 text-green-800 border-green-200',
  ISSUE_FOUND: 'bg-red-100 text-red-800 border-red-200',
}

export const PRIORITY_LABEL: Record<MaintenancePriority, string> = {
  EMERGENCY: '긴급',
  HIGH: '높음',
  NORMAL: '일반',
}

export const PRIORITY_STYLE: Record<MaintenancePriority, string> = {
  EMERGENCY: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  NORMAL: 'bg-gray-100 text-gray-600 border-gray-200',
}

export const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  OPEN: '접수',
  IN_PROGRESS: '처리중',
  RESOLVED: '완료',
}

export const STATUS_STYLE: Record<MaintenanceStatus, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
  RESOLVED: 'bg-green-100 text-green-800 border-green-200',
}
```

- [ ] **Step 2: Create service file**

```typescript
// football/src/services/facility.service.ts
import { api } from './api'
import type {
  FacilityInspection,
  MaintenanceRequest,
  CreateInspectionDto,
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
  FacilityZone,
  InspectionType,
  InspectionResult,
  MaintenancePriority,
  MaintenanceStatus,
} from '@/types/facility'

export const facilityApi = {
  inspections: {
    list: (params?: { zone?: FacilityZone; type?: InspectionType; result?: InspectionResult }) => {
      const q = new URLSearchParams()
      if (params?.zone) q.set('zone', params.zone)
      if (params?.type) q.set('type', params.type)
      if (params?.result) q.set('result', params.result)
      const qs = q.toString()
      return api.get<FacilityInspection[]>(`/facility/inspections${qs ? `?${qs}` : ''}`)
    },
    create: (dto: CreateInspectionDto) =>
      api.post<FacilityInspection & { createdMaintenanceId?: number }>('/facility/inspections', dto),
  },
  maintenance: {
    list: (params?: { status?: MaintenanceStatus; priority?: MaintenancePriority }) => {
      const q = new URLSearchParams()
      if (params?.status) q.set('status', params.status)
      if (params?.priority) q.set('priority', params.priority)
      const qs = q.toString()
      return api.get<MaintenanceRequest[]>(`/facility/maintenance${qs ? `?${qs}` : ''}`)
    },
    create: (dto: CreateMaintenanceDto) =>
      api.post<MaintenanceRequest>('/facility/maintenance', dto),
    update: (id: number, dto: UpdateMaintenanceDto) =>
      api.patch<MaintenanceRequest>(`/facility/maintenance/${id}`, dto),
  },
}
```

- [ ] **Step 3: Commit**

```bash
git add football/src/types/facility.ts football/src/services/facility.service.ts
git commit -m "feat(facility): add types and API service"
```

---

### Task 2: Locale Files

**Files:**
- Create: `football/src/locales/ko/facility.json`
- Create: `football/src/locales/en/facility.json`
- Modify: `football/src/locales/ko/common.json` (line 74, inside `nav.item`)
- Modify: `football/src/locales/en/common.json` (inside `nav.item`)

- [ ] **Step 1: Create Korean locale**

```json
// football/src/locales/ko/facility.json
{
  "inspections": {
    "title": "시설 점검",
    "addButton": "점검 등록",
    "noData": "점검 기록이 없습니다.",
    "loadFailed": "점검 목록을 불러오지 못했습니다.",
    "createFailed": "점검 등록에 실패했습니다.",
    "created": "점검이 등록되었습니다.",
    "autoMaintenance": "이상 발견 — 유지보수 요청이 자동 생성되었습니다.",
    "col": {
      "date": "점검일",
      "zone": "구역",
      "type": "종류",
      "result": "결과",
      "statutory": "법정",
      "notes": "비고"
    },
    "form": {
      "title": "점검 등록",
      "zone": "구역 *",
      "type": "점검 종류 *",
      "result": "결과 *",
      "statutory": "법정 점검",
      "date": "점검일",
      "notes": "비고",
      "notesPlaceholder": "특이사항을 입력하세요"
    },
    "filterAll": "전체"
  },
  "maintenance": {
    "title": "유지보수",
    "addButton": "요청 등록",
    "noData": "유지보수 요청이 없습니다.",
    "loadFailed": "유지보수 목록을 불러오지 못했습니다.",
    "createFailed": "유지보수 요청 등록에 실패했습니다.",
    "updateFailed": "상태 변경에 실패했습니다.",
    "created": "유지보수 요청이 등록되었습니다.",
    "updated": "상태가 변경되었습니다.",
    "col": {
      "title": "제목",
      "priority": "우선순위",
      "status": "상태",
      "source": "출처",
      "createdBy": "등록자",
      "date": "등록일"
    },
    "form": {
      "createTitle": "유지보수 요청 등록",
      "updateTitle": "상태 변경",
      "title": "제목 *",
      "titlePlaceholder": "요청 제목을 입력하세요",
      "description": "내용 *",
      "descriptionPlaceholder": "상세 내용을 입력하세요",
      "priority": "우선순위 *",
      "estimatedCost": "예상 비용 (원)",
      "status": "상태 *",
      "postIncidentReport": "처리 내역",
      "postIncidentReportPlaceholder": "처리 내역을 입력하세요",
      "actualCost": "실제 비용 (원)"
    },
    "filterAll": "전체"
  },
  "zone": {
    "GROUND": "경기장",
    "MECHANICAL": "기계실",
    "STRUCTURAL": "구조물",
    "SAFETY": "안전시설",
    "SANITATION": "위생",
    "OPERATIONS": "운영시설"
  },
  "inspectionType": {
    "DAILY": "일일",
    "MONTHLY": "월간",
    "QUARTERLY": "분기",
    "ANNUAL": "연간"
  },
  "result": {
    "OK": "정상",
    "ISSUE_FOUND": "이상 발견"
  },
  "priority": {
    "EMERGENCY": "긴급",
    "HIGH": "높음",
    "NORMAL": "일반"
  },
  "status": {
    "OPEN": "접수",
    "IN_PROGRESS": "처리중",
    "RESOLVED": "완료"
  }
}
```

- [ ] **Step 2: Create English locale**

```json
// football/src/locales/en/facility.json
{
  "inspections": {
    "title": "Facility Inspections",
    "addButton": "Add Inspection",
    "noData": "No inspections recorded.",
    "loadFailed": "Failed to load inspections.",
    "createFailed": "Failed to create inspection.",
    "created": "Inspection created.",
    "autoMaintenance": "Issue found — a maintenance request was automatically created.",
    "col": {
      "date": "Date",
      "zone": "Zone",
      "type": "Type",
      "result": "Result",
      "statutory": "Statutory",
      "notes": "Notes"
    },
    "form": {
      "title": "Add Inspection",
      "zone": "Zone *",
      "type": "Type *",
      "result": "Result *",
      "statutory": "Statutory inspection",
      "date": "Inspection date",
      "notes": "Notes",
      "notesPlaceholder": "Enter any notes"
    },
    "filterAll": "All"
  },
  "maintenance": {
    "title": "Maintenance",
    "addButton": "New Request",
    "noData": "No maintenance requests.",
    "loadFailed": "Failed to load maintenance requests.",
    "createFailed": "Failed to create maintenance request.",
    "updateFailed": "Failed to update status.",
    "created": "Maintenance request created.",
    "updated": "Status updated.",
    "col": {
      "title": "Title",
      "priority": "Priority",
      "status": "Status",
      "source": "Source",
      "createdBy": "Created by",
      "date": "Date"
    },
    "form": {
      "createTitle": "New Maintenance Request",
      "updateTitle": "Update Status",
      "title": "Title *",
      "titlePlaceholder": "Enter request title",
      "description": "Description *",
      "descriptionPlaceholder": "Enter details",
      "priority": "Priority *",
      "estimatedCost": "Estimated cost (KRW)",
      "status": "Status *",
      "postIncidentReport": "Resolution notes",
      "postIncidentReportPlaceholder": "Describe how the issue was resolved",
      "actualCost": "Actual cost (KRW)"
    },
    "filterAll": "All"
  },
  "zone": {
    "GROUND": "Ground",
    "MECHANICAL": "Mechanical",
    "STRUCTURAL": "Structural",
    "SAFETY": "Safety",
    "SANITATION": "Sanitation",
    "OPERATIONS": "Operations"
  },
  "inspectionType": {
    "DAILY": "Daily",
    "MONTHLY": "Monthly",
    "QUARTERLY": "Quarterly",
    "ANNUAL": "Annual"
  },
  "result": {
    "OK": "OK",
    "ISSUE_FOUND": "Issue Found"
  },
  "priority": {
    "EMERGENCY": "Emergency",
    "HIGH": "High",
    "NORMAL": "Normal"
  },
  "status": {
    "OPEN": "Open",
    "IN_PROGRESS": "In Progress",
    "RESOLVED": "Resolved"
  }
}
```

- [ ] **Step 3: Add nav label to ko/common.json**

In `football/src/locales/ko/common.json`, inside `"nav" > "item"`, add after `"recruitment": "채용 관리"`:

```json
"facilityMgmt": "시설 관리"
```

- [ ] **Step 4: Add nav label to en/common.json**

In `football/src/locales/en/common.json`, inside `"nav" > "item"`, add after the `"recruitment"` entry:

```json
"facilityMgmt": "Facility"
```

- [ ] **Step 5: Commit**

```bash
git add football/src/locales/
git commit -m "feat(facility): add facility locale files (ko + en)"
```

---

### Task 3: FacilityPage Component

**Files:**
- Create: `football/src/pages/facility/FacilityPage.tsx`

- [ ] **Step 1: Create the page**

```tsx
// football/src/pages/facility/FacilityPage.tsx
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { facilityApi } from '@/services/facility.service'
import type {
  FacilityInspection,
  MaintenanceRequest,
  FacilityZone,
  InspectionType,
  InspectionResult,
  MaintenancePriority,
  MaintenanceStatus,
  CreateInspectionDto,
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
} from '@/types/facility'
import {
  ZONE_LABEL,
  INSPECTION_TYPE_LABEL,
  RESULT_LABEL,
  RESULT_STYLE,
  PRIORITY_LABEL,
  PRIORITY_STYLE,
  STATUS_LABEL,
  STATUS_STYLE,
} from '@/types/facility'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'

const ZONES: FacilityZone[] = ['GROUND', 'MECHANICAL', 'STRUCTURAL', 'SAFETY', 'SANITATION', 'OPERATIONS']
const INSPECTION_TYPES: InspectionType[] = ['DAILY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']
const RESULTS: InspectionResult[] = ['OK', 'ISSUE_FOUND']
const PRIORITIES: MaintenancePriority[] = ['EMERGENCY', 'HIGH', 'NORMAL']
const STATUSES: MaintenanceStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

// ── Inspection Create Dialog ──────────────────────────────────────────────────
interface CreateInspectionDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateInspectionDialog({ open, onOpenChange, onSaved }: CreateInspectionDialogProps) {
  const { t } = useTranslation('facility')
  const [zone, setZone] = useState<FacilityZone>('GROUND')
  const [type, setType] = useState<InspectionType>('DAILY')
  const [result, setResult] = useState<InspectionResult>('OK')
  const [isStatutory, setIsStatutory] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = () => { setZone('GROUND'); setType('DAILY'); setResult('OK'); setIsStatutory(false); setNotes('') }

  const handleSave = async () => {
    setSaving(true)
    try {
      const dto: CreateInspectionDto = { facilityZone: zone, type, result, isStatutory, ...(notes.trim() && { notes: notes.trim() }) }
      const res = await facilityApi.inspections.create(dto)
      if ('createdMaintenanceId' in res && res.createdMaintenanceId) {
        toast.success(t('inspections.autoMaintenance'))
      } else {
        toast.success(t('inspections.created'))
      }
      onSaved()
      onOpenChange(false)
      reset()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('inspections.createFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('inspections.form.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('inspections.form.zone')}</Label>
            <Select value={zone} onValueChange={(v) => setZone(v as FacilityZone)}>
              <SelectTrigger><SelectValue>{t(`zone.${zone}`)}</SelectValue></SelectTrigger>
              <SelectContent>
                {ZONES.map((z) => <SelectItem key={z} value={z}>{t(`zone.${z}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('inspections.form.type')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as InspectionType)}>
              <SelectTrigger><SelectValue>{t(`inspectionType.${type}`)}</SelectValue></SelectTrigger>
              <SelectContent>
                {INSPECTION_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{t(`inspectionType.${tp}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('inspections.form.result')}</Label>
            <Select value={result} onValueChange={(v) => setResult(v as InspectionResult)}>
              <SelectTrigger><SelectValue>{t(`result.${result}`)}</SelectValue></SelectTrigger>
              <SelectContent>
                {RESULTS.map((r) => <SelectItem key={r} value={r}>{t(`result.${r}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="statutory" checked={isStatutory} onCheckedChange={(v) => setIsStatutory(Boolean(v))} />
            <Label htmlFor="statutory">{t('inspections.form.statutory')}</Label>
          </div>
          <div className="space-y-1.5">
            <Label>{t('inspections.form.notes')}</Label>
            <Textarea
              placeholder={t('inspections.form.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Maintenance Create Dialog ─────────────────────────────────────────────────
interface CreateMaintenanceDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateMaintenanceDialog({ open, onOpenChange, onSaved }: CreateMaintenanceDialogProps) {
  const { t } = useTranslation('facility')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<MaintenancePriority>('NORMAL')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = () => { setTitle(''); setDescription(''); setPriority('NORMAL'); setEstimatedCost('') }

  const handleSave = async () => {
    if (!title.trim()) { toast.error('제목을 입력하세요'); return }
    if (!description.trim()) { toast.error('내용을 입력하세요'); return }
    setSaving(true)
    try {
      const dto: CreateMaintenanceDto = {
        title: title.trim(),
        description: description.trim(),
        priority,
        ...(estimatedCost && { estimatedCost: Number(estimatedCost) }),
      }
      await facilityApi.maintenance.create(dto)
      toast.success(t('maintenance.created'))
      onSaved()
      onOpenChange(false)
      reset()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('maintenance.createFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('maintenance.form.createTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('maintenance.form.title')}</Label>
            <Input placeholder={t('maintenance.form.titlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('maintenance.form.description')}</Label>
            <Textarea placeholder={t('maintenance.form.descriptionPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('maintenance.form.priority')}</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as MaintenancePriority)}>
              <SelectTrigger><SelectValue>{t(`priority.${priority}`)}</SelectValue></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('maintenance.form.estimatedCost')}</Label>
            <Input type="number" placeholder="0" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Maintenance Update Dialog ─────────────────────────────────────────────────
interface UpdateMaintenanceDialogProps {
  request: MaintenanceRequest | null
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function UpdateMaintenanceDialog({ request, onOpenChange, onSaved }: UpdateMaintenanceDialogProps) {
  const { t } = useTranslation('facility')
  const [status, setStatus] = useState<MaintenanceStatus>('OPEN')
  const [postIncidentReport, setPostIncidentReport] = useState('')
  const [actualCost, setActualCost] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (request) {
      setStatus(request.status)
      setPostIncidentReport(request.postIncidentReport ?? '')
      setActualCost(request.actualCost != null ? String(request.actualCost) : '')
    }
  }, [request])

  const handleSave = async () => {
    if (!request) return
    setSaving(true)
    try {
      const dto: UpdateMaintenanceDto = {
        status,
        ...(postIncidentReport.trim() && { postIncidentReport: postIncidentReport.trim() }),
        ...(actualCost && { actualCost: Number(actualCost) }),
      }
      await facilityApi.maintenance.update(request.id, dto)
      toast.success(t('maintenance.updated'))
      onSaved()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('maintenance.updateFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('maintenance.form.updateTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('maintenance.form.status')}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as MaintenanceStatus)}>
              <SelectTrigger><SelectValue>{t(`status.${status}`)}</SelectValue></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('maintenance.form.postIncidentReport')}</Label>
            <Textarea placeholder={t('maintenance.form.postIncidentReportPlaceholder')} value={postIncidentReport} onChange={(e) => setPostIncidentReport(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('maintenance.form.actualCost')}</Label>
            <Input type="number" placeholder="0" value={actualCost} onChange={(e) => setActualCost(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function FacilityPage() {
  const { t } = useTranslation('facility')
  const { user } = useCurrentUser()
  const canWrite = user?.role === 'ADMIN' || user?.role === 'FRONT_OFFICE'

  // Inspections state
  const [inspections, setInspections] = useState<FacilityInspection[]>([])
  const [inspLoading, setInspLoading] = useState(true)
  const [zoneFilter, setZoneFilter] = useState<FacilityZone | ''>('')
  const [typeFilter, setTypeFilter] = useState<InspectionType | ''>('')
  const [resultFilter, setResultFilter] = useState<InspectionResult | ''>('')
  const [showCreateInspection, setShowCreateInspection] = useState(false)

  // Maintenance state
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([])
  const [maintLoading, setMaintLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<MaintenancePriority | ''>('')
  const [showCreateMaintenance, setShowCreateMaintenance] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null)

  const fetchInspections = useCallback(() => {
    setInspLoading(true)
    facilityApi.inspections.list({
      zone: zoneFilter || undefined,
      type: typeFilter || undefined,
      result: resultFilter || undefined,
    })
      .then(setInspections)
      .catch(() => toast.error(t('inspections.loadFailed')))
      .finally(() => setInspLoading(false))
  }, [t, zoneFilter, typeFilter, resultFilter])

  const fetchMaintenance = useCallback(() => {
    setMaintLoading(true)
    facilityApi.maintenance.list({
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
    })
      .then(setMaintenance)
      .catch(() => toast.error(t('maintenance.loadFailed')))
      .finally(() => setMaintLoading(false))
  }, [t, statusFilter, priorityFilter])

  useEffect(() => { fetchInspections() }, [fetchInspections])
  useEffect(() => { fetchMaintenance() }, [fetchMaintenance])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">시설 관리</h1>
      </div>

      <div className="flex-1 overflow-auto">
        <Tabs defaultValue="inspections" className="flex flex-col h-full">
          <div className="border-b px-6 shrink-0">
            <TabsList className="h-9 bg-transparent p-0 gap-4">
              <TabsTrigger value="inspections" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2">
                {t('inspections.title')}
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2">
                {t('maintenance.title')}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Inspections Tab ── */}
          <TabsContent value="inspections" className="flex-1 overflow-auto mt-0">
            <div className="px-6 py-3 border-b flex items-center justify-between gap-4 shrink-0">
              <div className="flex gap-2">
                <Select value={zoneFilter} onValueChange={(v) => setZoneFilter(v as FacilityZone | '')}>
                  <SelectTrigger className="w-32 h-8 text-sm">
                    <SelectValue>{zoneFilter ? t(`zone.${zoneFilter}`) : t('inspections.filterAll')}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('inspections.filterAll')}</SelectItem>
                    {ZONES.map((z) => <SelectItem key={z} value={z}>{t(`zone.${z}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as InspectionType | '')}>
                  <SelectTrigger className="w-28 h-8 text-sm">
                    <SelectValue>{typeFilter ? t(`inspectionType.${typeFilter}`) : t('inspections.filterAll')}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('inspections.filterAll')}</SelectItem>
                    {INSPECTION_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{t(`inspectionType.${tp}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={resultFilter} onValueChange={(v) => setResultFilter(v as InspectionResult | '')}>
                  <SelectTrigger className="w-28 h-8 text-sm">
                    <SelectValue>{resultFilter ? t(`result.${resultFilter}`) : t('inspections.filterAll')}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('inspections.filterAll')}</SelectItem>
                    {RESULTS.map((r) => <SelectItem key={r} value={r}>{t(`result.${r}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {canWrite && (
                <Button size="sm" onClick={() => setShowCreateInspection(true)}>
                  <Plus className="h-4 w-4 mr-1" />{t('inspections.addButton')}
                </Button>
              )}
            </div>
            {inspLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : inspections.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                {t('inspections.noData')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-24">{t('inspections.col.date')}</TableHead>
                    <TableHead className="w-28">{t('inspections.col.zone')}</TableHead>
                    <TableHead className="w-20">{t('inspections.col.type')}</TableHead>
                    <TableHead className="w-28">{t('inspections.col.result')}</TableHead>
                    <TableHead className="w-16 text-center">{t('inspections.col.statutory')}</TableHead>
                    <TableHead>{t('inspections.col.notes')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspections.map((insp) => (
                    <TableRow key={insp.id}>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">
                        {formatDate(insp.inspectedAt)}
                      </TableCell>
                      <TableCell className="text-sm">{ZONE_LABEL[insp.facilityZone]}</TableCell>
                      <TableCell className="text-sm">{INSPECTION_TYPE_LABEL[insp.type]}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${RESULT_STYLE[insp.result]}`}>
                          {RESULT_LABEL[insp.result]}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{insp.isStatutory ? '✓' : ''}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{insp.notes ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* ── Maintenance Tab ── */}
          <TabsContent value="maintenance" className="flex-1 overflow-auto mt-0">
            <div className="px-6 py-3 border-b flex items-center justify-between gap-4 shrink-0">
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as MaintenanceStatus | '')}>
                  <SelectTrigger className="w-28 h-8 text-sm">
                    <SelectValue>{statusFilter ? t(`status.${statusFilter}`) : t('maintenance.filterAll')}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('maintenance.filterAll')}</SelectItem>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as MaintenancePriority | '')}>
                  <SelectTrigger className="w-28 h-8 text-sm">
                    <SelectValue>{priorityFilter ? t(`priority.${priorityFilter}`) : t('maintenance.filterAll')}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('maintenance.filterAll')}</SelectItem>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {canWrite && (
                <Button size="sm" onClick={() => setShowCreateMaintenance(true)}>
                  <Plus className="h-4 w-4 mr-1" />{t('maintenance.addButton')}
                </Button>
              )}
            </div>
            {maintLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : maintenance.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                {t('maintenance.noData')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t('maintenance.col.title')}</TableHead>
                    <TableHead className="w-24">{t('maintenance.col.priority')}</TableHead>
                    <TableHead className="w-24">{t('maintenance.col.status')}</TableHead>
                    <TableHead className="w-32 text-muted-foreground">{t('maintenance.col.source')}</TableHead>
                    <TableHead className="w-24 text-muted-foreground">{t('maintenance.col.createdBy')}</TableHead>
                    <TableHead className="w-20 tabular-nums text-muted-foreground">{t('maintenance.col.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenance.map((req) => (
                    <TableRow
                      key={req.id}
                      className={canWrite && req.status !== 'RESOLVED' ? 'cursor-pointer' : ''}
                      onClick={() => { if (canWrite && req.status !== 'RESOLVED') setSelectedRequest(req) }}
                    >
                      <TableCell className="font-medium">{req.title}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${PRIORITY_STYLE[req.priority]}`}>
                          {PRIORITY_LABEL[req.priority]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${STATUS_STYLE[req.status]}`}>
                          {STATUS_LABEL[req.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {req.sourceInspection ? `${ZONE_LABEL[req.sourceInspection.facilityZone]} 점검` : '수동 등록'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{req.createdBy.username}</TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">{formatDate(req.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateInspectionDialog
        open={showCreateInspection}
        onOpenChange={setShowCreateInspection}
        onSaved={fetchInspections}
      />
      <CreateMaintenanceDialog
        open={showCreateMaintenance}
        onOpenChange={setShowCreateMaintenance}
        onSaved={fetchMaintenance}
      />
      <UpdateMaintenanceDialog
        request={selectedRequest}
        onOpenChange={(v) => { if (!v) setSelectedRequest(null) }}
        onSaved={fetchMaintenance}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add football/src/pages/facility/FacilityPage.tsx
git commit -m "feat(facility): add FacilityPage with inspections and maintenance tabs"
```

---

### Task 4: Wire Route, Nav, i18n

**Files:**
- Modify: `football/src/i18n.ts`
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`

- [ ] **Step 1: Register facility namespace in i18n.ts**

Add these imports near the top of `football/src/i18n.ts` (after `import koAdmin`):

```typescript
import koFacility from './locales/ko/facility.json';
import enFacility from './locales/en/facility.json';
```

Add `facility: koFacility` inside the `ko` resources object, and `facility: enFacility` inside the `en` resources object.

- [ ] **Step 2: Add route in App.tsx**

Find the existing `<Route path="/equipment" element={<EquipmentPage />} />` line. Add after it:

```tsx
<Route path="/facility" element={<FacilityPage />} />
```

Also add the import at the top of the file near other page imports:

```tsx
import { FacilityPage } from '@/pages/facility/FacilityPage'
```

- [ ] **Step 3: Add nav item in AppShell.tsx**

Find the equipment nav item (around line 371-377):

```typescript
  {
    to: '/equipment',
    label: 'nav.item.equipment',
    icon: Package,
    section: 'nav.section.management',
    roles: ['ADMIN', 'FRONT_OFFICE', 'COACHING_STAFF'],
  },
```

Add the facility nav item **after** this block:

```typescript
  {
    to: '/facility',
    label: 'nav.item.facilityMgmt',
    icon: Building2,
    section: 'nav.section.management',
    roles: ['ADMIN', 'FRONT_OFFICE'],
    frontOfficeRoles: ['FACILITY_MANAGER', 'FACILITY_STAFF'],
  },
```

`Building2` is already imported (used by `/admin/departments` and `/admin/partners`).

- [ ] **Step 4: Commit**

```bash
git add football/src/i18n.ts football/src/App.tsx football/src/layouts/AppShell.tsx
git commit -m "feat(facility): wire route, nav item, and i18n namespace"
```

---

### Task 5: PR

- [ ] **Step 1: Push and open PR**

```bash
git push origin HEAD
gh pr create \
  --title "feat: facility management frontend (inspections + maintenance)" \
  --body "시설관리팀(FACILITY_MANAGER, FACILITY_STAFF)을 위한 시설 점검 및 유지보수 요청 UI 추가"
```

- [ ] **Step 2: Merge**

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull origin main
```
