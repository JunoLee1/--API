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
import { useConfirm } from '@/lib/confirm-dialog'
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
const STATUSES: MaintenanceStatus[] = ['OPEN', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'RESOLVED', 'REJECTED']
const TERMINAL_STATUSES: MaintenanceStatus[] = ['RESOLVED', 'REJECTED']

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
          <Button onClick={() => void handleSave()} disabled={saving}>
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
          <Button onClick={() => void handleSave()} disabled={saving}>{saving ? '저장 중...' : '등록'}</Button>
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
  isFacilityManager: boolean
  isGM: boolean
}

function UpdateMaintenanceDialog({ request, onOpenChange, onSaved, isFacilityManager, isGM }: UpdateMaintenanceDialogProps) {
  const { t } = useTranslation('facility')
  const confirm = useConfirm()
  const [nextStatus, setNextStatus] = useState<MaintenanceStatus>('IN_PROGRESS')
  const [postIncidentReport, setPostIncidentReport] = useState('')
  const [actualCost, setActualCost] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (request) {
      setNextStatus(request.status === 'OPEN' ? 'IN_PROGRESS' : 'PENDING_APPROVAL')
      setPostIncidentReport(request.postIncidentReport ?? '')
      setActualCost(request.actualCost != null ? String(request.actualCost) : '')
      setRejectReason('')
    }
  }, [request])

  const handleUpdateStatus = async () => {
    if (!request) return
    setSaving(true)
    try {
      if (postIncidentReport.trim() || actualCost) {
        const dto: UpdateMaintenanceDto = {
          ...(postIncidentReport.trim() && { postIncidentReport: postIncidentReport.trim() }),
          ...(actualCost && { actualCost: Number(actualCost) }),
        }
        await facilityApi.maintenance.update(request.id, dto)
      }
      await facilityApi.maintenance.updateStatus(request.id, nextStatus)
      toast.success(t('maintenance.updated'))
      onSaved(); onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('maintenance.updateFailed'))
    } finally { setSaving(false) }
  }

  const handleApprove = async () => {
    if (!request) return
    setSaving(true)
    try {
      await facilityApi.maintenance.approve(request.id)
      toast.success(t('maintenance.approved'))
      onSaved(); onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('maintenance.updateFailed'))
    } finally { setSaving(false) }
  }

  const handleGmApprove = async () => {
    if (!request) return
    setSaving(true)
    try {
      await facilityApi.maintenance.gmApprove(request.id)
      toast.success(t('maintenance.gmApproved'))
      onSaved(); onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('maintenance.updateFailed'))
    } finally { setSaving(false) }
  }

  const handleReject = async () => {
    if (!request) return
    const ok = await confirm({ title: '반려 확인', description: '이 유지보수 요청을 반려하시겠습니까?', confirmText: '반려', variant: 'destructive' })
    if (!ok) return
    setSaving(true)
    try {
      await facilityApi.maintenance.reject(request.id, rejectReason.trim() || undefined)
      toast.success(t('maintenance.rejected'))
      onSaved(); onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('maintenance.updateFailed'))
    } finally { setSaving(false) }
  }

  if (!request) return null
  const status = request.status

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('maintenance.form.updateTitle')} — {request.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 처리 내역 / 비용 (FM 또는 상태 진행 시) */}
          {isFacilityManager && (status === 'OPEN' || status === 'IN_PROGRESS') && (
            <>
              <div className="space-y-1.5">
                <Label>{t('maintenance.form.status')}</Label>
                <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as MaintenanceStatus)}>
                  <SelectTrigger><SelectValue>{t(`status.${nextStatus}`)}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {status === 'OPEN' && <SelectItem value="IN_PROGRESS">{t('status.IN_PROGRESS')}</SelectItem>}
                    <SelectItem value="PENDING_APPROVAL">{t('status.PENDING_APPROVAL')}</SelectItem>
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
            </>
          )}

          {/* 반려 사유 (반려 가능한 단계) */}
          {((isFacilityManager && status === 'PENDING_APPROVAL') || (isGM && status === 'APPROVED')) && (
            <div className="space-y-1.5">
              <Label>반려 사유 (선택)</Label>
              <Textarea placeholder="반려 사유를 입력하세요" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} />
            </div>
          )}

          {/* 결재 정보 표시 */}
          {request.approvedBy && (
            <p className="text-xs text-muted-foreground">1차 승인: {request.approvedBy.username}</p>
          )}
          {request.rejectionReason && (
            <p className="text-xs text-destructive">반려 사유: {request.rejectionReason}</p>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>

          {/* 상태 진행 버튼 */}
          {isFacilityManager && (status === 'OPEN' || status === 'IN_PROGRESS') && (
            <Button onClick={() => void handleUpdateStatus()} disabled={saving}>
              {saving ? '처리 중...' : '상태 변경'}
            </Button>
          )}

          {/* FM 1차 승인 */}
          {isFacilityManager && status === 'PENDING_APPROVAL' && (
            <>
              <Button variant="destructive" onClick={() => void handleReject()} disabled={saving}>반려</Button>
              <Button onClick={() => void handleApprove()} disabled={saving}>
                {saving ? '처리 중...' : '1차 승인'}
              </Button>
            </>
          )}

          {/* GM 최종 승인 */}
          {isGM && status === 'APPROVED' && (
            <>
              <Button variant="destructive" onClick={() => void handleReject()} disabled={saving}>반려</Button>
              <Button onClick={() => void handleGmApprove()} disabled={saving}>
                {saving ? '처리 중...' : '최종 승인'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function FacilityPage() {
  const { t } = useTranslation('facility')
  const { user } = useCurrentUser()
  const isFacilityManager =
    user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'FACILITY_MANAGER')
  const isGMRole = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'GM'
  const canWrite = isFacilityManager

  const [inspections, setInspections] = useState<FacilityInspection[]>([])
  const [inspLoading, setInspLoading] = useState(true)
  const [zoneFilter, setZoneFilter] = useState<FacilityZone | ''>('')
  const [typeFilter, setTypeFilter] = useState<InspectionType | ''>('')
  const [resultFilter, setResultFilter] = useState<InspectionResult | ''>('')
  const [showCreateInspection, setShowCreateInspection] = useState(false)

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
                      className={
                        !TERMINAL_STATUSES.includes(req.status) &&
                        (req.status === 'APPROVED' ? isGMRole : isFacilityManager)
                          ? 'cursor-pointer'
                          : ''
                      }
                      onClick={() => {
                        const clickable =
                          !TERMINAL_STATUSES.includes(req.status) &&
                          (req.status === 'APPROVED' ? isGMRole : isFacilityManager)
                        if (clickable) setSelectedRequest(req)
                      }}
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
        isFacilityManager={isFacilityManager}
        isGM={isGMRole}
      />
    </div>
  )
}
