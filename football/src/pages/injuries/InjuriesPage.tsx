import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { injuryApi } from '@/services/injury.service'
import { partnerApi } from '@/services/partner.service'
import type { Injury, InjuryStatus, InjuryCause, HospitalType } from '@/types/injury'
import type { Partner } from '@/types/partner'
import {
  CAUSE_LABEL,
  INJURY_STATUS_LABEL,
  INJURY_STATUS_STYLE,
} from '@/types/injury'
import { usePlayers } from '@/hooks/usePlayers'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'

const STATUSES: InjuryStatus[] = [
  'OCCURRED', 'DIAGNOSED', 'REHABILITATING', 'READY_TO_RETURN', 'RETURNED',
]
const CAUSES: InjuryCause[] = ['TRAINING', 'MATCH', 'OTHER']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

interface CreateInjuryDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  playerId: string
  onSaved: () => void
}

const HOSPITAL_TYPE_LABEL: Record<HospitalType, string> = {
  ACCREDITED: '협진 병원',
  GENERAL: '일반/외부 병원',
}

function CreateInjuryDialog({ open, onOpenChange, playerId, onSaved }: CreateInjuryDialogProps) {
  const [bodyPart, setBodyPart] = useState('')
  const [cause, setCause] = useState<InjuryCause>('TRAINING')
  const [expectedReturn, setExpectedReturn] = useState('')
  const [hospitalType, setHospitalType] = useState<HospitalType | ''>('')
  const [hospitalId, setHospitalId] = useState<string>('')
  const [customHospitalName, setCustomHospitalName] = useState('')
  const [hospitals, setHospitals] = useState<Partner[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) partnerApi.list('HOSPITAL').then(setHospitals).catch(() => null)
  }, [open])

  const handleSave = async () => {
    if (!bodyPart.trim()) { toast.error('부상 부위를 입력해주세요.'); return }
    if (hospitalType === 'ACCREDITED' && !hospitalId) { toast.error('협진 병원을 선택해주세요.'); return }
    if (hospitalType === 'GENERAL' && !customHospitalName.trim()) { toast.error('병원명을 입력해주세요.'); return }
    setSaving(true)
    try {
      await injuryApi.create({
        playerId,
        bodyPart: bodyPart.trim(),
        cause,
        ...(expectedReturn && { expectedReturnDate: expectedReturn }),
        ...(hospitalType && { hospitalType }),
        ...(hospitalType === 'ACCREDITED' && hospitalId && { partnerId: Number(hospitalId) }),
        ...(hospitalType === 'GENERAL' && customHospitalName.trim() && { customHospitalName: customHospitalName.trim() }),
      })
      toast.success('부상이 등록됐습니다.')
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
        <DialogHeader><DialogTitle>부상 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>부상 부위 *</Label>
            <Input placeholder="예: 왼쪽 무릎" value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>원인 *</Label>
            <Select value={cause} onValueChange={(v) => setCause(v as InjuryCause)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAUSES.map((c) => <SelectItem key={c} value={c}>{CAUSE_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>복귀 예정일</Label>
            <Input type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>진료 병원</Label>
            <Select value={hospitalType} onValueChange={(v) => { setHospitalType(v as HospitalType | ''); setHospitalId(''); setCustomHospitalName('') }}>
              <SelectTrigger><SelectValue placeholder="선택 안 함" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">선택 안 함</SelectItem>
                {(['ACCREDITED', 'GENERAL'] as HospitalType[]).map((t) => (
                  <SelectItem key={t} value={t}>{HOSPITAL_TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hospitalType === 'ACCREDITED' && (
            <div className="space-y-1.5">
              <Label>협진 병원 선택 *</Label>
              <Select value={hospitalId} onValueChange={setHospitalId}>
                <SelectTrigger><SelectValue placeholder="병원 선택" /></SelectTrigger>
                <SelectContent>
                  {hospitals.map((h) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {hospitalType === 'GENERAL' && (
            <div className="space-y-1.5">
              <Label>병원명 *</Label>
              <Input placeholder="예: 삼성서울병원 응급실" value={customHospitalName} onChange={(e) => setCustomHospitalName(e.target.value)} />
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

export function InjuriesPage() {
  const { user } = useCurrentUser()
  const { players, loading: playersLoading } = usePlayers()
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
  const [injuries, setInjuries] = useState<Injury[]>([])
  const [loadingInjuries, setLoadingInjuries] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const isMedical = user?.role === 'ADMIN' || user?.coachingRole === 'MEDICAL'
  const canWrite = isMedical

  const fetchInjuries = (pid: string) => {
    setLoadingInjuries(true)
    injuryApi
      .byPlayer(pid)
      .then(setInjuries)
      .catch(() => toast.error('부상 이력을 불러오지 못했습니다.'))
      .finally(() => setLoadingInjuries(false))
  }

  const handlePlayerChange = (pid: string) => {
    setSelectedPlayerId(pid)
    setInjuries([])
    fetchInjuries(pid)
  }

  const handleStatusChange = async (injuryId: number, status: InjuryStatus) => {
    try {
      await injuryApi.updateStatus(injuryId, status)
      toast.success('부상 상태가 변경됐습니다.')
      fetchInjuries(selectedPlayerId)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '변경에 실패했습니다.')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">부상 현황</h1>
          <p className="text-sm text-muted-foreground mt-0.5">선수를 선택하면 부상 이력이 표시됩니다.</p>
        </div>
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        {playersLoading ? (
          <Skeleton className="h-8 w-56" />
        ) : (
          <Select value={selectedPlayerId} onValueChange={(v) => v && handlePlayerChange(v)}>
            <SelectTrigger className="w-56 h-8 text-sm bg-background">
              {selectedPlayerId
                ? <span className="truncate">{players.find(p => p.id === selectedPlayerId)?.playerName ?? selectedPlayerId}</span>
                : <span className="text-muted-foreground">선수 선택</span>}
            </SelectTrigger>
            <SelectContent>
              {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {canWrite && selectedPlayerId && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />부상 등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {!selectedPlayerId ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">선수를 선택해주세요.</div>
        ) : loadingInjuries ? (
          <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : injuries.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">부상 이력이 없습니다.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>부상 부위</TableHead>
                <TableHead>원인</TableHead>
                <TableHead>발생일</TableHead>
                <TableHead>복귀 예정일</TableHead>
                <TableHead>상태</TableHead>
                {canWrite && <TableHead className="w-36">상태 변경</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {injuries.map((inj) => (
                <TableRow key={inj.id}>
                  <TableCell className="font-medium">{inj.bodyPart}</TableCell>
                  <TableCell>{CAUSE_LABEL[inj.cause]}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(inj.occurredAt)}</TableCell>
                  <TableCell className="tabular-nums">
                    {inj.expectedReturnDate ? formatDate(inj.expectedReturnDate) : '—'}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${INJURY_STATUS_STYLE[inj.status]}`}>
                      {INJURY_STATUS_LABEL[inj.status]}
                    </span>
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <Select
                        value={inj.status}
                        onValueChange={(v) => handleStatusChange(inj.id, v as InjuryStatus)}
                      >
                        <SelectTrigger className="h-7 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{INJURY_STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {canWrite && selectedPlayerId && (
        <CreateInjuryDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          playerId={selectedPlayerId}
          onSaved={() => { setCreateOpen(false); fetchInjuries(selectedPlayerId) }}
        />
      )}
    </div>
  )
}
