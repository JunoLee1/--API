import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { coachingStaffApi } from '@/services/coaching-staff.service'
import { coachAvailabilityApi } from '@/services/coach-availability.service'
import { trainingApi } from '@/services/training.service'
import type { CoachingStaffMember } from '@/types/coaching-staff'
import type { TrainingSession, TrainingResultRow } from '@/types/training'
import type { Position } from '@/types/player'
import { POSITION_LABEL } from '@/types/player'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { COACHING_ROLE_LABEL } from '@/types/auth'
import type { CoachingRole } from '@/types/auth'
import { getCoachPositions } from '@/lib/coachPositionMap'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, X, UserCheck, UserX, ClipboardList } from 'lucide-react'
import { StaffEvaluationDialog } from '@/components/coaching-staff/StaffEvaluationDialog'

function getThisWeekRange(): { from: string; to: string; label: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const label = `${monday.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`
  return { from: fmt(monday), to: fmt(sunday), label }
}

function getThisMonthRange(): { from: string; to: string; label: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const label = `${now.getFullYear()}년 ${now.getMonth() + 1}월`
  return { from: fmt(first), to: fmt(last), label }
}

function formatDateKR(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function isAbsentToday(absences: CoachingStaffMember['coachAvailabilities']) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return absences.some((a) => {
    const start = new Date(a.startDate)
    const end = new Date(a.endDate)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return start <= today && today <= end
  })
}

interface AbsenceDialogProps {
  open: boolean
  onClose: () => void
  staffId: number
  onCreated: () => void
}

function AbsenceDialog({ open, onClose, staffId, onCreated }: AbsenceDialogProps) {
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' })
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!form.startDate || !form.endDate) {
      toast.error('날짜를 모두 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await coachAvailabilityApi.create({
        userId: staffId,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim() || undefined,
      })
      toast.success('부재 등록됐습니다.')
      setForm({ startDate: '', endDate: '', reason: '' })
      onCreated()
      onClose()
    } catch {
      toast.error('등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>부재 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>시작일 *</Label>
            <Input type="date" value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>종료일 *</Label>
            <Input type="date" value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>사유</Label>
            <Textarea rows={2} placeholder="사유 (선택)" value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={() => void handleCreate()} disabled={saving}>
            {saving ? '저장 중...' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface StaffCardProps {
  member: CoachingStaffMember
  canEdit: boolean
  canEval: boolean
  currentUserId: number
  onRefresh: () => void
}

function StaffCard({ member, canEdit, canEval, currentUserId, onRefresh }: StaffCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [evalOpen, setEvalOpen] = useState(false)
  const absent = isAbsentToday(member.coachAvailabilities)

  const handleDeleteAbsence = async (absenceId: number) => {
    try {
      await coachAvailabilityApi.delete(absenceId)
      toast.success('삭제됐습니다.')
      onRefresh()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            {absent
              ? <UserX className="h-4 w-4 text-destructive" />
              : <UserCheck className="h-4 w-4 text-green-600" />}
            <span className="font-medium text-sm">{member.nickname ?? '(닉네임 없음)'}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {member.coachingRole ? (COACHING_ROLE_LABEL[member.coachingRole] ?? member.coachingRole) : '—'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {(canEval || canEdit) && (
            <Button
              variant="ghost" size="icon" className="h-6 w-6 shrink-0"
              onClick={() => setEvalOpen(true)}
              title="평가"
            >
              <ClipboardList className="h-3.5 w-3.5" />
            </Button>
          )}
          {canEdit && (
            <Button
              variant="ghost" size="icon" className="h-6 w-6 shrink-0"
              onClick={() => setDialogOpen(true)}
              title="부재 등록"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {member.coachAvailabilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {member.coachAvailabilities.map((a) => (
            <Badge key={a.id} variant="secondary" className="text-xs gap-1">
              {formatDateKR(a.startDate)}–{formatDateKR(a.endDate)}
              {a.reason && <span className="text-muted-foreground">· {a.reason}</span>}
              {(canEdit || a.createdById === currentUserId) && (
                <button
                  className="ml-0.5 hover:text-destructive"
                  onClick={() => void handleDeleteAbsence(a.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {dialogOpen && (
        <AbsenceDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          staffId={member.id}
          onCreated={onRefresh}
        />
      )}
      <StaffEvaluationDialog
        open={evalOpen}
        onClose={() => setEvalOpen(false)}
        staffUserId={member.id}
        staffNickname={member.nickname ?? '(닉네임 없음)'}
        canCreate={canEval}
      />
    </div>
  )
}

const week = getThisWeekRange()
const month = getThisMonthRange()

export function StaffManagementPage() {
  const { user } = useCurrentUser()
  const [staff, setStaff] = useState<CoachingStaffMember[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [results, setResults] = useState<TrainingResultRow[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  const canEdit = user?.role === 'ADMIN' || user?.coachingRole === 'HEAD_COACH'
  const canEval = user?.role === 'ADMIN' || user?.coachingRole === 'HEAD_COACH'

  const fetchStaff = useCallback(() => {
    setStaffLoading(true)
    coachingStaffApi
      .list()
      .then(setStaff)
      .catch(() => toast.error('스태프 목록을 불러오지 못했습니다.'))
      .finally(() => setStaffLoading(false))
  }, [])

  useEffect(() => {
    fetchStaff()
    setDataLoading(true)
    Promise.all([
      trainingApi.list(),
      trainingApi.getResults({ from: month.from, to: month.to }),
    ])
      .then(([allSessions, allResults]) => {
        setSessions(
          allSessions.filter((s) => {
            const d = s.date.slice(0, 10)
            return d >= week.from && d <= week.to
          }),
        )
        setResults(allResults)
      })
      .catch(() => toast.error('훈련 데이터를 불러오지 못했습니다.'))
      .finally(() => setDataLoading(false))
  }, [fetchStaff])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">스태프 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">코칭스태프 현황 · 세션 배정 · 성과</p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* Section 1: 스태프 현황 */}
        <section>
          <h2 className="text-sm font-semibold mb-3">이번 주 스태프 현황</h2>
          {staffLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 코칭스태프가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {staff.map((member) => (
                <StaffCard
                  key={member.id}
                  member={member}
                  canEdit={canEdit}
                  canEval={canEval}
                  currentUserId={user?.id ?? 0}
                  onRefresh={fetchStaff}
                />
              ))}
            </div>
          )}
        </section>

        <Separator />

        {/* Section 2: 이번 주 세션 배정 */}
        <section>
          <h2 className="text-sm font-semibold mb-1">이번 주 세션 배정</h2>
          <p className="text-xs text-muted-foreground mb-3">{week.label}</p>
          {dataLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">이번 주 등록된 세션이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {staff.map((member) => {
                const mySessions = sessions.filter((s) => s.createdById === member.id)
                if (mySessions.length === 0) return null
                return (
                  <div key={member.id} className="rounded-md border px-4 py-3">
                    <p className="text-xs font-semibold mb-1.5">
                      {member.nickname ?? '—'} · {member.coachingRole ? (COACHING_ROLE_LABEL[member.coachingRole] ?? member.coachingRole) : '—'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {mySessions.map((s) => (
                        <Badge key={s.id} variant="outline" className="text-xs">
                          {s.date.slice(5, 10)} {s.sessionType.replace(/_/g, ' ')} — {s.goal.slice(0, 20)}{s.goal.length > 20 ? '…' : ''}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <Separator />

        {/* Section 3: 코치별 포지션 성과 */}
        <section>
          <h2 className="text-sm font-semibold mb-1">코치별 포지션 성과</h2>
          <p className="text-xs text-muted-foreground mb-3">{month.label} 훈련 결과 기준</p>
          {dataLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {staff
                .filter((m) => m.coachingRole && getCoachPositions(m.coachingRole as CoachingRole))
                .map((member) => {
                  const positions = getCoachPositions(member.coachingRole as CoachingRole) ?? []
                  const posResults = results.filter(
                    (r) => positions.includes(r.player.position as Position) && r.performanceScore != null,
                  )
                  const avg =
                    posResults.length > 0
                      ? (posResults.reduce((sum, r) => sum + (r.performanceScore ?? 0), 0) / posResults.length).toFixed(1)
                      : null

                  return (
                    <div key={member.id} className="rounded-md border px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold">
                          {member.nickname ?? '—'} · {member.coachingRole ? (COACHING_ROLE_LABEL[member.coachingRole] ?? member.coachingRole) : '—'}
                        </p>
                        {avg != null ? (
                          <span className="text-lg font-bold tabular-nums">
                            {avg}<span className="text-xs font-normal text-muted-foreground">점</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">데이터 없음</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        담당: {positions.map((p) => POSITION_LABEL[p] ?? p).join(', ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        평가 결과 {posResults.length}건
                      </p>
                    </div>
                  )
                })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
