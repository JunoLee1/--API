import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { prospectApi } from '@/services/prospect.service'
import { api } from '@/services/api'
import type {
  Prospect, ProspectStatus, CreateProspectDto, SignProspectDto,
  VisaEligibility, WorkPermitStatus,
} from '@/types/prospect'
import {
  STATUS_LABEL, STATUS_STYLE,
  VISA_ELIGIBILITY_LABEL, WORK_PERMIT_LABEL,
} from '@/types/prospect'
import type { Position } from '@/types/player'
import { POSITION_LABEL } from '@/types/player'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus } from 'lucide-react'

interface Country { id: number; name: string }

const STATUSES: (ProspectStatus | 'ALL')[] = ['ALL', 'ACTIVE', 'MEDICAL_TEST', 'CONTRACT_PENDING', 'SIGNED', 'ARCHIVED']
const POSITIONS: Position[] = [
  'GOALKEEPER', 'STRIKER', 'SHADOW_STRIKER', 'WINGER',
  'CENTRAL_ATTACK_MIDFIELDER', 'RIGHT_ATTACK_MIDFIELDER', 'LEFT_ATTACK_MIDFIELDER',
  'CENTRAL_DEFENSIVE_MIDFIELDER', 'LEFT_DEFENSIVE_MIDFIELDER', 'RIGHT_DEFENSIVE_MIDFIELDER',
  'CENTER_BACK', 'LEFT_WING_BACK', 'LEFT_FULL_BACK', 'RIGHT_WING_BACK', 'RIGHT_FULL_BACK',
]
const VISA_OPTIONS: VisaEligibility[] = ['NOT_REQUIRED', 'CONFIRMED', 'UNCERTAIN']
const WORK_PERMIT_OPTIONS: WorkPermitStatus[] = ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── CreateProspectDialog ───────────────────────────────────────────────────

interface CreateProspectDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateProspectDialog({ open, onOpenChange, onSaved }: CreateProspectDialogProps) {
  const [name, setName] = useState('')
  const [nationality, setNationality] = useState('')
  const [position, setPosition] = useState<Position | ''>('')
  const [currentTeam, setCurrentTeam] = useState('')
  const [notes, setNotes] = useState('')
  const [visaRequired, setVisaRequired] = useState(false)
  const [visaEligibility, setVisaEligibility] = useState<VisaEligibility>('NOT_REQUIRED')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast.error('이름을 입력해주세요.'); return }
    setSaving(true)
    try {
      const dto: CreateProspectDto = {
        name: name.trim(),
        ...(nationality.trim() && { nationality: nationality.trim() }),
        ...(position && { position }),
        ...(currentTeam.trim() && { currentTeam: currentTeam.trim() }),
        ...(notes.trim() && { notes: notes.trim() }),
      }
      const prospect = await prospectApi.create(dto)
      if (visaRequired) {
        await prospectApi.update(prospect.id, { visaRequired: true, visaEligibility })
      }
      toast.success('영입 후보가 등록됐습니다.')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>영입 후보 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>이름 *</Label>
            <Input placeholder="선수 이름" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>국적</Label>
            <Input placeholder="예: 대한민국" value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>포지션</Label>
            <Select value={position} onValueChange={(v) => setPosition(v as Position)}>
              <SelectTrigger><SelectValue placeholder="포지션 선택" /></SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => <SelectItem key={p} value={p}>{POSITION_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>현 소속팀</Label>
            <Input placeholder="예: FC 서울" value={currentTeam} onChange={(e) => setCurrentTeam(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea placeholder="스카우트 노트" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="visaRequired"
              checked={visaRequired}
              onCheckedChange={(v) => setVisaRequired(!!v)}
            />
            <Label htmlFor="visaRequired" className="cursor-pointer">외국 선수 — 비자/노동허가 필요</Label>
          </div>
          {visaRequired && (
            <div className="space-y-1.5 pl-6">
              <Label>취득 가능성</Label>
              <Select value={visaEligibility} onValueChange={(v) => setVisaEligibility(v as VisaEligibility)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VISA_OPTIONS.map((v) => <SelectItem key={v} value={v}>{VISA_ELIGIBILITY_LABEL[v]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── SignProspectDialog ─────────────────────────────────────────────────────

interface SignProspectDialogProps {
  prospect: Prospect
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function SignProspectDialog({ prospect, open, onOpenChange, onSaved }: SignProspectDialogProps) {
  const [countries, setCountries] = useState<Country[]>([])
  const [nationalityId, setNationalityId] = useState<string>('')
  const [dob, setDob] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [foot, setFoot] = useState<'LEFT' | 'RIGHT' | 'BOTH'>('RIGHT')
  const [position, setPosition] = useState<Position | ''>(prospect.position ?? '')
  const [contractStart, setContractStart] = useState('')
  const [contractEnd, setContractEnd] = useState('')
  const [salary, setSalary] = useState('')
  const [workPermitStatus, setWorkPermitStatus] = useState<WorkPermitStatus>(
    prospect.visaRequired ? 'PENDING' : 'NOT_REQUIRED'
  )
  const [workPermitExpiry, setWorkPermitExpiry] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    api.get<{ data: Country[] } | Country[]>('/countries')
      .then((res) => setCountries(Array.isArray(res) ? res : res.data))
      .catch(() => null)
  }, [open])

  const handleSave = async () => {
    if (!dob || !height || !weight || !nationalityId || !contractStart || !contractEnd || !salary) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const dto: SignProspectDto = {
        dateOfBirth: dob,
        height: Number(height),
        weight: Number(weight),
        nationalityId: Number(nationalityId),
        preferredFoot: foot,
        ...(position && { position }),
        contractStartDate: contractStart,
        contractEndDate: contractEnd,
        salary: Number(salary),
        workPermitStatus,
        ...(workPermitExpiry && { workPermitExpiry }),
      }
      await prospectApi.sign(prospect.id, dto)
      toast.success('계약 성사! 선수가 등록됐습니다.')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '처리에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>계약 성사 — {prospect.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
          <p className="text-xs text-muted-foreground">선수 등록 및 계약 정보를 입력하면 단일 트랜잭션으로 처리됩니다.</p>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">선수 기본 정보</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>생년월일 *</Label>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>국적 *</Label>
                <Select value={nationalityId} onValueChange={setNationalityId}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>키 (cm) *</Label>
                <Input type="number" placeholder="183" value={height} onChange={(e) => setHeight(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>몸무게 (kg) *</Label>
                <Input type="number" placeholder="78" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>주발</Label>
                <Select value={foot} onValueChange={(v) => setFoot(v as typeof foot)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RIGHT">오른발</SelectItem>
                    <SelectItem value="LEFT">왼발</SelectItem>
                    <SelectItem value="BOTH">양발</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>포지션</Label>
                <Select value={position} onValueChange={(v) => setPosition(v as Position)}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => <SelectItem key={p} value={p}>{POSITION_LABEL[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">계약 정보</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>계약 시작일 *</Label>
                <Input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>계약 종료일 *</Label>
                <Input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>연봉 (원) *</Label>
              <Input type="number" placeholder="500000000" value={salary} onChange={(e) => setSalary(e.target.value)} />
            </div>
          </div>

          {prospect.visaRequired && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">노동허가 / 비자</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>노동허가 상태</Label>
                  <Select value={workPermitStatus} onValueChange={(v) => setWorkPermitStatus(v as WorkPermitStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WORK_PERMIT_OPTIONS.map((s) => <SelectItem key={s} value={s}>{WORK_PERMIT_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>만료일</Label>
                  <Input type="date" value={workPermitExpiry} onChange={(e) => setWorkPermitExpiry(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '처리 중...' : '계약 성사 처리'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── ProspectsPage ──────────────────────────────────────────────────────────

export function ProspectsPage() {
  const { user } = useCurrentUser()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'ALL'>('ACTIVE')
  const [position, setPosition] = useState<Position | ''>(
    (searchParams.get('position') as Position) ?? ''
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [signTarget, setSignTarget] = useState<Prospect | null>(null)

  const canWrite =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' && (
      user.frontOfficeRole === 'SCOUT' ||
      user.frontOfficeRole === 'GM' ||
      user.frontOfficeRole === 'TD'
    ))
  const canSign =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' && (
      user.frontOfficeRole === 'GM' ||
      user.frontOfficeRole === 'CONTRACT_MANAGER'
    ))
  const canRead =
    user?.role === 'ADMIN' ||
    user?.role === 'FRONT_OFFICE' ||
    (user?.role === 'COACHING_STAFF' && user.coachingRole === 'HEAD_COACH')

  const fetchProspects = (status?: ProspectStatus) => {
    setLoading(true)
    prospectApi
      .list(status)
      .then(setProspects)
      .catch(() => toast.error('영입 후보 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const status = statusFilter === 'ALL' ? undefined : statusFilter
    void fetchProspects(status)
  }, [statusFilter])

  const handleTransition = async (id: number, status: ProspectStatus) => {
    try {
      await prospectApi.transition(id, status)
      toast.success(`상태가 '${STATUS_LABEL[status]}'로 변경됐습니다.`)
      const s = statusFilter === 'ALL' ? undefined : statusFilter
      void fetchProspects(s)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '변경에 실패했습니다.')
    }
  }

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        접근 권한이 없습니다.
      </div>
    )
  }

  const renderActions = (p: Prospect) => {
    if (!canWrite && !canSign) return null
    switch (p.status) {
      case 'ACTIVE':
        return canWrite ? (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => handleTransition(p.id, 'MEDICAL_TEST')}>메디컬 테스트</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
              onClick={() => handleTransition(p.id, 'ARCHIVED')}>종료</Button>
          </div>
        ) : null
      case 'MEDICAL_TEST':
        return canWrite ? (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => handleTransition(p.id, 'CONTRACT_PENDING')}>계약 협상 시작</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
              onClick={() => handleTransition(p.id, 'ARCHIVED')}>종료</Button>
          </div>
        ) : null
      case 'CONTRACT_PENDING':
        return (
          <div className="flex gap-1">
            {canSign && (
              <Button size="sm" className="h-7 text-xs"
                onClick={() => setSignTarget(p)}>계약 성사</Button>
            )}
            {canWrite && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                onClick={() => handleTransition(p.id, 'ARCHIVED')}>협상 결렬</Button>
            )}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">영입 후보</h1>
          <p className="text-sm text-muted-foreground mt-0.5">스카우트 추적 중인 선수 목록</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />후보 등록
          </Button>
        )}
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProspectStatus | 'ALL')}>
          <SelectTrigger className="w-40 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s === 'ALL' ? '전체' : STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={position || 'ALL'} onValueChange={(v) => setPosition(v === 'ALL' ? '' : v as Position)}>
          <SelectTrigger className="w-40 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체 포지션</SelectItem>
            {POSITIONS.map((p) => (
              <SelectItem key={p} value={p}>{POSITION_LABEL[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : prospects.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            등록된 영입 후보가 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>이름</TableHead>
                <TableHead className="w-24">포지션</TableHead>
                <TableHead>소속팀</TableHead>
                <TableHead className="w-20">국적</TableHead>
                <TableHead className="w-28">상태</TableHead>
                <TableHead className="w-20">비자</TableHead>
                <TableHead className="w-28 text-muted-foreground">등록일</TableHead>
                <TableHead className="w-28 text-muted-foreground">등록자</TableHead>
                {(canWrite || canSign) && <TableHead className="w-48" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(position ? prospects.filter((p) => p.position === position) : prospects).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-sm">{p.position ? POSITION_LABEL[p.position] : '—'}</TableCell>
                  <TableCell className="text-sm">{p.currentTeam ?? '—'}</TableCell>
                  <TableCell className="text-sm">{p.nationality ?? '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${STATUS_STYLE[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {p.visaRequired && p.visaEligibility ? (
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${
                        p.visaEligibility === 'CONFIRMED' ? 'bg-green-50 text-green-700 border-green-200' :
                        p.visaEligibility === 'UNCERTAIN' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-gray-50 text-gray-500 border-gray-200'
                      }`}>
                        {VISA_ELIGIBILITY_LABEL[p.visaEligibility]}
                      </span>
                    ) : p.visaRequired ? (
                      <span className="text-xs text-muted-foreground">미확인</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(p.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.createdBy?.nickname ?? '—'}
                  </TableCell>
                  {(canWrite || canSign) && (
                    <TableCell>{renderActions(p)}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateProspectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => {
          setCreateOpen(false)
          const status = statusFilter === 'ALL' ? undefined : statusFilter
          void fetchProspects(status)
        }}
      />

      {signTarget && (
        <SignProspectDialog
          prospect={signTarget}
          open={!!signTarget}
          onOpenChange={(v) => { if (!v) setSignTarget(null) }}
          onSaved={() => {
            setSignTarget(null)
            const status = statusFilter === 'ALL' ? undefined : statusFilter
            void fetchProspects(status)
          }}
        />
      )}
    </div>
  )
}
