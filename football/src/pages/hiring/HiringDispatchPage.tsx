import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useHiringDispatches } from '@/hooks/useHiringDispatches'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { hiringDispatchApi } from '@/services/hiring-dispatch.service'
import { departmentApi, type Department } from '@/services/department.service'
import {
  EMPLOYMENT_TYPE_LABEL,
  JOB_GRADE_LABEL,
  STAGE_LABEL,
  STATUS_LABEL,
  STATUS_STYLE,
  TARGET_ROLE_OPTIONS,
  type CreateHiringDispatchPayload,
  type EmploymentType,
  type HiringDispatch,
  type HiringDispatchFilter,
  type JobGrade,
} from '@/types/hiring-dispatch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Plus, X } from 'lucide-react'

interface FormState {
  applicationId: string // stringified; empty = free-form path
  candidateName: string
  candidateEmail: string
  jobTitle: string
  jobGrade: JobGrade
  employmentType: EmploymentType
  departmentId: string
  monthlySalary: string
  startDate: string
  targetRole: string
  permissionNotes: string
}

const emptyForm: FormState = {
  applicationId: '',
  candidateName: '',
  candidateEmail: '',
  jobTitle: '',
  jobGrade: 'ASSOCIATE',
  employmentType: 'FULL_TIME',
  departmentId: '',
  monthlySalary: '',
  startDate: '',
  targetRole: 'FRONT_OFFICE',
  permissionNotes: '',
}

const FILTER_OPTIONS: Array<{ value: HiringDispatchFilter; label: string }> = [
  { value: 'me', label: '내 요청' },
  { value: 'all', label: '전체 (관리자)' },
]

function fmtWon(n: string | number) {
  const num = typeof n === 'string' ? Number(n) : n
  if (!Number.isFinite(num)) return String(n)
  return `${num.toLocaleString('ko-KR')}원`
}

/**
 * Maps a backend error code to a Korean UI message. Mirrors the OperatingExpense
 * / AssetRequest pattern (page-local switch). Extract to `lib/` once a third
 * caller lands.
 */
function messageForCode(code: string, fallback: string): string {
  switch (code) {
    case 'MISSING_REQUIRED_FIELD':
      return '필수 항목을 모두 입력해주세요.'
    case 'INVALID_SALARY':
      return '월급여를 확인해주세요.'
    case 'APPLICATION_NOT_FOUND':
      return '지원서를 찾을 수 없습니다.'
    case 'APPLICATION_NOT_OFFERED':
      return '오퍼(OFFERED) 상태의 지원서만 발령할 수 있습니다.'
    case 'HR_ONLY_FOR_FREE_FORM':
      return '지원서 없는 발령은 HR 매니저(또는 관리자)만 생성할 수 있습니다.'
    case 'EMAIL_ALREADY_IN_USE':
      return '이미 사용 중인 이메일입니다.'
    case 'TO_EXCEEDED':
      return '채용 계획(TO)을 초과합니다. 재무 재검증에서 강제 승인이 필요합니다.'
    case 'OFFER_MISMATCH':
      return '오퍼 조건과 발령 조건이 다릅니다. 재무 재검증에서 강제 승인이 필요합니다.'
    case 'SELF_APPROVAL_FORBIDDEN':
      return '본인이 생성한 발령은 결재할 수 없습니다.'
    case 'REASON_REQUIRED':
      return '반려 사유는 필수입니다.'
    case 'NOT_FINANCE_MANAGER':
      return '재무 매니저 권한이 없습니다.'
    case 'NOT_EXECUTIVE':
      return '임원 승인 권한이 없습니다.'
    case 'NOT_HR_MANAGER':
      return 'HR 매니저 권한이 없습니다.'
    case 'INVALID_STATUS':
      return '현재 상태에서 수행할 수 없는 동작입니다. 새로고침 후 다시 시도해주세요.'
    case 'NOT_FOUND':
      return '요청을 찾을 수 없습니다.'
    case 'FORBIDDEN':
      return '권한이 없습니다.'
    default:
      return fallback
  }
}

function isHrOrAdmin(role?: string, foRole?: string | null): boolean {
  if (!role) return false
  if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'GM') return true
  if (role === 'FRONT_OFFICE' && foRole === 'HR_MANAGER') return true
  return false
}

export function HiringDispatchPage() {
  const { user } = useCurrentUser()
  const [filter, setFilter] = useState<HiringDispatchFilter>('me')
  const { dispatches, loading, reload } = useHiringDispatches(filter)

  const [departments, setDepartments] = useState<Department[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [detailId, setDetailId] = useState<number | null>(null)
  const [detail, setDetail] = useState<HiringDispatch | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [cancelingId, setCancelingId] = useState<number | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelBusy, setCancelBusy] = useState(false)

  const canCreate = isHrOrAdmin(user?.role, user?.frontOfficeRole)

  useEffect(() => {
    void (async () => {
      try {
        const depts = await departmentApi.list()
        setDepartments(depts)
      } catch {
        // Non-fatal — user can still submit if they know the departmentId,
        // though the picker will fall back to an empty list.
      }
    })()
  }, [])

  const openCreate = () => {
    setForm({
      ...emptyForm,
      departmentId: departments[0]?.id != null ? String(departments[0].id) : '',
    })
    setCreateOpen(true)
  }

  const handleSubmit = async () => {
    // Match server-side validation client-side to save the round trip.
    if (
      !form.candidateName.trim() ||
      !form.candidateEmail.trim() ||
      !form.jobTitle.trim() ||
      !form.departmentId ||
      !form.startDate ||
      !form.targetRole
    ) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }
    const salary = parseInt(form.monthlySalary, 10)
    if (!Number.isFinite(salary) || salary < 0) {
      toast.error('월급여를 확인해주세요.')
      return
    }

    const payload: CreateHiringDispatchPayload = {
      candidateName: form.candidateName.trim(),
      candidateEmail: form.candidateEmail.trim(),
      jobTitle: form.jobTitle.trim(),
      jobGrade: form.jobGrade,
      employmentType: form.employmentType,
      departmentId: parseInt(form.departmentId, 10),
      monthlySalary: salary,
      startDate: form.startDate,
      targetRole: form.targetRole,
    }
    if (form.applicationId.trim()) {
      const appId = parseInt(form.applicationId, 10)
      if (Number.isFinite(appId)) payload.applicationId = appId
    }
    if (form.permissionNotes.trim()) {
      payload.permissionNotes = form.permissionNotes.trim()
    }

    setSaving(true)
    try {
      await hiringDispatchApi.create(payload)
      toast.success('발령 요청이 생성됐습니다. 재무 재검증을 기다립니다.')
      setCreateOpen(false)
      setForm(emptyForm)
      await reload()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForCode(code, code || '발령 요청 생성에 실패했습니다.'))
    } finally {
      setSaving(false)
    }
  }

  const loadDetail = async (id: number) => {
    setDetailLoading(true)
    try {
      setDetail(await hiringDispatchApi.get(id))
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForCode(code, code || '상세 조회에 실패했습니다.'))
    } finally {
      setDetailLoading(false)
    }
  }

  const openDetail = (id: number) => {
    setDetailId(id)
    setDetail(null)
    void loadDetail(id)
  }

  const openCancel = (id: number) => {
    setCancelingId(id)
    setCancelReason('')
  }

  const submitCancel = async () => {
    if (!cancelingId) return
    const reason = cancelReason.trim()
    if (!reason) {
      toast.error('취소 사유를 입력해주세요.')
      return
    }
    setCancelBusy(true)
    try {
      await hiringDispatchApi.cancel(cancelingId, reason)
      toast.success('발령 요청이 취소됐습니다.')
      setCancelingId(null)
      setCancelReason('')
      await reload()
      if (detailId === cancelingId) void loadDetail(cancelingId)
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForCode(code, code || '취소에 실패했습니다.'))
    } finally {
      setCancelBusy(false)
    }
  }

  const departmentName = (id: number) =>
    departments.find((d) => d.id === id)?.name ?? `#${id}`

  const sortedDispatches = useMemo(
    () => [...dispatches].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [dispatches],
  )

  const currentFilterLabel =
    FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? filter

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">채용 발령</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            채용 확정된 후보자의 조직 발령 요청을 생성하고 결재 상태를 추적합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as HiringDispatchFilter)}>
            <SelectTrigger className="h-8">
              <SelectValue>{currentFilterLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} label={o.label}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate && (
            <Button size="sm" onClick={openCreate} disabled={!user}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />신규 발령
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : sortedDispatches.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {filter === 'me'
              ? '아직 생성한 발령 요청이 없습니다.'
              : '해당 조건의 발령 요청이 없습니다.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>생성일</TableHead>
                <TableHead>후보자</TableHead>
                <TableHead>직무</TableHead>
                <TableHead>직급</TableHead>
                <TableHead>부서</TableHead>
                <TableHead className="text-right">월급여</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDispatches.map((r) => {
                // Cancel is only meaningful pre-execution; anything else the
                // backend rejects with INVALID_STATUS anyway.
                const cancellable =
                  r.status === 'CREATED' || r.status === 'BUDGET_REVERIFIED'
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(r.id)}
                  >
                    <TableCell className="tabular-nums text-sm">
                      {new Date(r.createdAt).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell className="text-sm">{r.candidateName}</TableCell>
                    <TableCell className="text-sm">{r.jobTitle}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {JOB_GRADE_LABEL[r.jobGrade]}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.department.name}
                    </TableCell>
                    <TableCell className="tabular-nums font-medium text-sm text-right">
                      {fmtWon(r.monthlySalary)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLE[r.status]}>
                        {STATUS_LABEL[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {cancellable && canCreate && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-muted-foreground"
                          onClick={() => openCancel(r.id)}
                        >
                          <X className="h-3 w-3 mr-1" />취소
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create dialog — HR-only (canCreate gates the button). */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>신규 발령 요청</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>지원서 ID (선택)</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={form.applicationId}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    applicationId: e.target.value.replace(/[^0-9]/g, ''),
                  }))
                }
                placeholder="OFFERED 상태의 지원서 ID (없으면 비워두세요)"
              />
              <p className="text-xs text-muted-foreground">
                지원서 없이도 발령 가능 (임원 스카웃 / 즉시 계약직). HR 매니저 또는
                관리자만 허용됩니다.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>후보자 이름 *</Label>
                <Input
                  value={form.candidateName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, candidateName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>이메일 *</Label>
                <Input
                  type="email"
                  value={form.candidateEmail}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, candidateEmail: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>직무 (Job Title) *</Label>
              <Input
                value={form.jobTitle}
                onChange={(e) =>
                  setForm((p) => ({ ...p, jobTitle: e.target.value }))
                }
                placeholder="예: 시니어 마케팅 매니저"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>직급 *</Label>
                <Select
                  value={form.jobGrade}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, jobGrade: v as JobGrade }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue>{JOB_GRADE_LABEL[form.jobGrade]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(JOB_GRADE_LABEL) as JobGrade[]).map((g) => (
                      <SelectItem key={g} value={g} label={JOB_GRADE_LABEL[g]}>
                        {JOB_GRADE_LABEL[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>고용 유형 *</Label>
                <Select
                  value={form.employmentType}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, employmentType: v as EmploymentType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {EMPLOYMENT_TYPE_LABEL[form.employmentType]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map(
                      (t) => (
                        <SelectItem key={t} value={t} label={EMPLOYMENT_TYPE_LABEL[t]}>
                          {EMPLOYMENT_TYPE_LABEL[t]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>부서 *</Label>
              <Select
                value={form.departmentId}
                onValueChange={(v) => setForm((p) => ({ ...p, departmentId: v ?? '' }))}
              >
                <SelectTrigger>
                  <SelectValue>
                    {form.departmentId
                      ? departmentName(Number(form.departmentId))
                      : '-- 부서를 선택해주세요 --'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)} label={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>월급여 (원) *</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={
                    form.monthlySalary
                      ? Number(form.monthlySalary).toLocaleString('ko-KR')
                      : ''
                  }
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      monthlySalary: e.target.value.replace(/[^0-9]/g, ''),
                    }))
                  }
                  placeholder="5,000,000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>입사일 *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, startDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>대상 시스템 롤 *</Label>
              <Select
                value={form.targetRole}
                onValueChange={(v) => setForm((p) => ({ ...p, targetRole: v ?? '' }))}
              >
                <SelectTrigger>
                  <SelectValue>
                    {TARGET_ROLE_OPTIONS.find((o) => o.value === form.targetRole)
                      ?.label ?? form.targetRole}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TARGET_ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} label={o.label}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                발령 실행 시 자동 생성되는 계정에 부여될 시스템 롤입니다.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>추가 권한 요청 (선택)</Label>
              <Textarea
                value={form.permissionNotes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, permissionNotes: e.target.value }))
                }
                rows={2}
                placeholder="예: 계약 모듈 편집 권한, 재무 리포트 조회 권한 등"
              />
              <p className="text-xs text-muted-foreground">
                입력 시 발령 실행 후 HR에게 별도 알림이 전달되어 수동 부여 처리를
                진행합니다.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              취소
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? '생성 중...' : '발령 요청 생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog. */}
      <Dialog
        open={cancelingId !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCancelingId(null)
            setCancelReason('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>발령 요청 취소</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              취소 사유를 입력해주세요. 요청자에게 알림으로 전달됩니다.
            </p>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="예: 후보자 사퇴로 인한 취소"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelingId(null)
                setCancelReason('')
              }}
              disabled={cancelBusy}
            >
              닫기
            </Button>
            <Button
              variant="destructive"
              onClick={() => void submitCancel()}
              disabled={cancelBusy}
            >
              취소 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog. */}
      <Dialog
        open={detailId !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDetailId(null)
            setDetail(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>발령 요청 #{detailId ?? ''}</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3 py-2 text-sm max-h-[70vh] overflow-y-auto pr-1">
              <div className="flex items-center gap-2">
                <Badge className={STATUS_STYLE[detail.status]}>
                  {STATUS_LABEL[detail.status]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {EMPLOYMENT_TYPE_LABEL[detail.employmentType]} ·{' '}
                  {JOB_GRADE_LABEL[detail.jobGrade]}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">후보자</span>
                <span className="col-span-2">
                  {detail.candidateName} ({detail.candidateEmail})
                </span>

                <span className="text-muted-foreground">직무</span>
                <span className="col-span-2">{detail.jobTitle}</span>

                <span className="text-muted-foreground">부서</span>
                <span className="col-span-2">
                  {detail.department.parent
                    ? `${detail.department.parent.name} > `
                    : ''}
                  {detail.department.name}
                </span>

                <span className="text-muted-foreground">월급여</span>
                <span className="col-span-2 tabular-nums font-medium">
                  {fmtWon(detail.monthlySalary)}
                </span>

                <span className="text-muted-foreground">입사일</span>
                <span className="col-span-2">
                  {new Date(detail.startDate).toLocaleDateString('ko-KR')}
                </span>

                <span className="text-muted-foreground">대상 롤</span>
                <span className="col-span-2">
                  {detail.targetRole}
                  {detail.targetFrontOfficeRole
                    ? ` / ${detail.targetFrontOfficeRole}`
                    : ''}
                  {detail.targetCoachingRole
                    ? ` / ${detail.targetCoachingRole}`
                    : ''}
                </span>

                {detail.application && (
                  <>
                    <span className="text-muted-foreground">연동 지원서</span>
                    <span className="col-span-2">
                      #{detail.application.id} · {detail.application.applicantName}
                    </span>
                  </>
                )}

                {detail.createdUser && (
                  <>
                    <span className="text-muted-foreground">생성된 계정</span>
                    <span className="col-span-2">
                      {detail.createdUser.username} ({detail.createdUser.email})
                    </span>
                  </>
                )}

                {detail.onboarding && (
                  <>
                    <span className="text-muted-foreground">온보딩 OTP</span>
                    <span className="col-span-2 tabular-nums">
                      {detail.onboarding.otpCode}{' '}
                      <span className="text-xs text-muted-foreground">
                        (
                        {new Date(
                          detail.onboarding.otpExpiresAt,
                        ).toLocaleDateString('ko-KR')}{' '}
                        만료)
                      </span>
                    </span>
                  </>
                )}

                {detail.permissionNotes && (
                  <>
                    <span className="text-muted-foreground">추가 권한 메모</span>
                    <span className="col-span-2 whitespace-pre-wrap">
                      {detail.permissionNotes}
                    </span>
                  </>
                )}
              </div>

              {detail.approvals.length > 0 && (
                <div className="border-t pt-2">
                  <p className="font-medium mb-1.5">결재 이력</p>
                  <ul className="space-y-1">
                    {detail.approvals.map((a) => (
                      <li key={a.id} className="text-xs">
                        <span className="text-muted-foreground">
                          {new Date(a.createdAt).toLocaleString('ko-KR')} ·{' '}
                          {STAGE_LABEL[a.stage]} · {a.reviewer.nickname}
                        </span>
                        <span
                          className={
                            a.action === 'APPROVED'
                              ? 'ml-1 text-emerald-700'
                              : 'ml-1 text-red-700'
                          }
                        >
                          {a.action === 'APPROVED' ? '승인' : '반려'}
                        </span>
                        {a.reason && (
                          <span className="ml-1 text-muted-foreground">
                            · {a.reason}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
