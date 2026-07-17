import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { coachApi } from '@/services/coach.service'
import type {
  Coach, TutorAssignment, TutorType, LanguageProficiency,
} from '@/types/coach'
import {
  COACHING_ROLE_LABEL, COACH_STATUS_LABEL, COACH_STATUS_STYLE,
  LANGUAGE_LABEL, TIER1_ROLES,
} from '@/types/coach'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Plus } from 'lucide-react'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function NumericField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number" step="0.01"
        className="h-8 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

// ─── Evaluation Section ──────────────────────────────────────────────────────

interface EvalSectionProps {
  coach: Coach
  canWrite: boolean
  onSaved: () => void
}

function EvaluationSection({ coach, canWrite, onSaved }: EvalSectionProps) {
  const isTier1 = (TIER1_ROLES as string[]).includes(coach.coachingRole)

  // HEAD_COACH
  const [hcPossession, setHcPossession] = useState(String(coach.headCoachEval?.possession ?? ''))
  const [hcPressing, setHcPressing] = useState(String(coach.headCoachEval?.pressingIntensity ?? ''))
  const [hcPassAcc, setHcPassAcc] = useState(String(coach.headCoachEval?.progressivePassAccuracy ?? ''))
  const [hcActivity, setHcActivity] = useState(String(coach.headCoachEval?.teamActivity ?? ''))
  const [hcPhilosophy, setHcPhilosophy] = useState(String(coach.headCoachEval?.philosophyFitScore ?? ''))
  const [hcSource, setHcSource] = useState(coach.headCoachEval?.dataSource ?? '')

  // DEFENSIVE_COACH
  const [dcTackle, setDcTackle] = useState(String(coach.defensiveCoachEval?.tackleSuccessRate ?? ''))
  const [dcClear, setDcClear] = useState(String(coach.defensiveCoachEval?.clearances ?? ''))
  const [dcBlocks, setDcBlocks] = useState(String(coach.defensiveCoachEval?.blocks ?? ''))
  const [dcErrors, setDcErrors] = useState(String(coach.defensiveCoachEval?.defensiveErrors ?? ''))
  const [dcRecovery, setDcRecovery] = useState(String(coach.defensiveCoachEval?.ballRecovery ?? ''))
  const [dcPressing, setDcPressing] = useState(String(coach.defensiveCoachEval?.pressingIntensity ?? ''))
  const [dcSource, setDcSource] = useState(coach.defensiveCoachEval?.dataSource ?? '')

  // ATTACKING_COACH
  const [acXG, setAcXG] = useState(String(coach.attackingCoachEval?.xG ?? ''))
  const [acXA, setAcXA] = useState(String(coach.attackingCoachEval?.xA ?? ''))
  const [acChance, setAcChance] = useState(String(coach.attackingCoachEval?.chanceCreation ?? ''))
  const [acDribble, setAcDribble] = useState(String(coach.attackingCoachEval?.dribbleSuccessRate ?? ''))
  const [acPassAcc, setAcPassAcc] = useState(String(coach.attackingCoachEval?.progressivePassAccuracy ?? ''))
  const [acShot, setAcShot] = useState(String(coach.attackingCoachEval?.shotConversionRate ?? ''))
  const [acGoalInv, setAcGoalInv] = useState(String(coach.attackingCoachEval?.goalInvolvement ?? ''))
  const [acSource, setAcSource] = useState(coach.attackingCoachEval?.dataSource ?? '')

  // GOALKEEPER_COACH
  const [gkPsxG, setGkPsxG] = useState(String(coach.goalkeeperCoachEval?.psxG ?? ''))
  const [gkDiff, setGkDiff] = useState(String(coach.goalkeeperCoachEval?.xGConcededDiff ?? ''))
  const [gkPass, setGkPass] = useState(String(coach.goalkeeperCoachEval?.buildupPassAccuracy ?? ''))
  const [gkSource, setGkSource] = useState(coach.goalkeeperCoachEval?.dataSource ?? '')

  // Tier2
  const [t2Score, setT2Score] = useState(String(coach.tier2Eval?.fitScore ?? ''))
  const [t2Notes, setT2Notes] = useState(coach.tier2Eval?.notes ?? '')

  const [saving, setSaving] = useState(false)

  const buildDto = (): Record<string, unknown> => {
    if (coach.coachingRole === 'HEAD_COACH') {
      return {
        ...(hcPossession && { possession: Number(hcPossession) }),
        ...(hcPressing && { pressingIntensity: Number(hcPressing) }),
        ...(hcPassAcc && { progressivePassAccuracy: Number(hcPassAcc) }),
        ...(hcActivity && { teamActivity: Number(hcActivity) }),
        ...(hcPhilosophy && { philosophyFitScore: Number(hcPhilosophy) }),
        ...(hcSource.trim() && { dataSource: hcSource.trim() }),
      }
    }
    if (coach.coachingRole === 'DEFENSIVE_COACH') {
      return {
        ...(dcTackle && { tackleSuccessRate: Number(dcTackle) }),
        ...(dcClear && { clearances: Number(dcClear) }),
        ...(dcBlocks && { blocks: Number(dcBlocks) }),
        ...(dcErrors && { defensiveErrors: Number(dcErrors) }),
        ...(dcRecovery && { ballRecovery: Number(dcRecovery) }),
        ...(dcPressing && { pressingIntensity: Number(dcPressing) }),
        ...(dcSource.trim() && { dataSource: dcSource.trim() }),
      }
    }
    if (coach.coachingRole === 'ATTACKING_COACH') {
      return {
        ...(acXG && { xG: Number(acXG) }),
        ...(acXA && { xA: Number(acXA) }),
        ...(acChance && { chanceCreation: Number(acChance) }),
        ...(acDribble && { dribbleSuccessRate: Number(acDribble) }),
        ...(acPassAcc && { progressivePassAccuracy: Number(acPassAcc) }),
        ...(acShot && { shotConversionRate: Number(acShot) }),
        ...(acGoalInv && { goalInvolvement: Number(acGoalInv) }),
        ...(acSource.trim() && { dataSource: acSource.trim() }),
      }
    }
    if (coach.coachingRole === 'GOALKEEPER_COACH') {
      return {
        ...(gkPsxG && { psxG: Number(gkPsxG) }),
        ...(gkDiff && { xGConcededDiff: Number(gkDiff) }),
        ...(gkPass && { buildupPassAccuracy: Number(gkPass) }),
        ...(gkSource.trim() && { dataSource: gkSource.trim() }),
      }
    }
    // Tier2
    return {
      ...(t2Score && { fitScore: Number(t2Score) }),
      ...(t2Notes.trim() && { notes: t2Notes.trim() }),
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await coachApi.upsertEvaluation(coach.id, buildDto())
      toast.success('평가 데이터가 저장됐습니다.')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">평가 데이터</h2>
        {canWrite && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        )}
      </div>

      {coach.coachingRole === 'HEAD_COACH' && (
        <div className="grid grid-cols-2 gap-3">
          <NumericField label="점유율 (%)" value={hcPossession} onChange={setHcPossession} />
          <NumericField label="압박 강도" value={hcPressing} onChange={setHcPressing} />
          <NumericField label="전진패스 성공률 (%)" value={hcPassAcc} onChange={setHcPassAcc} />
          <NumericField label="활동량" value={hcActivity} onChange={setHcActivity} />
          <NumericField label="철학 부합도 (0–100)" value={hcPhilosophy} onChange={setHcPhilosophy} />
          <div className="space-y-1.5">
            <Label className="text-xs">데이터 출처</Label>
            <Input className="h-8 text-sm" value={hcSource} onChange={(e) => setHcSource(e.target.value)} />
          </div>
        </div>
      )}

      {coach.coachingRole === 'DEFENSIVE_COACH' && (
        <div className="grid grid-cols-2 gap-3">
          <NumericField label="태클 성공률 (%)" value={dcTackle} onChange={setDcTackle} />
          <NumericField label="클리어" value={dcClear} onChange={setDcClear} />
          <NumericField label="블록" value={dcBlocks} onChange={setDcBlocks} />
          <NumericField label="수비 실책" value={dcErrors} onChange={setDcErrors} />
          <NumericField label="볼 리커버리" value={dcRecovery} onChange={setDcRecovery} />
          <NumericField label="압박 강도" value={dcPressing} onChange={setDcPressing} />
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">데이터 출처</Label>
            <Input className="h-8 text-sm" value={dcSource} onChange={(e) => setDcSource(e.target.value)} />
          </div>
        </div>
      )}

      {coach.coachingRole === 'ATTACKING_COACH' && (
        <div className="grid grid-cols-2 gap-3">
          <NumericField label="xG" value={acXG} onChange={setAcXG} />
          <NumericField label="xA" value={acXA} onChange={setAcXA} />
          <NumericField label="찬스 메이킹" value={acChance} onChange={setAcChance} />
          <NumericField label="드리블 성공률 (%)" value={acDribble} onChange={setAcDribble} />
          <NumericField label="전진패스 성공률 (%)" value={acPassAcc} onChange={setAcPassAcc} />
          <NumericField label="샷 전환율 (%)" value={acShot} onChange={setAcShot} />
          <NumericField label="득점 관여율 (%)" value={acGoalInv} onChange={setAcGoalInv} />
          <div className="space-y-1.5">
            <Label className="text-xs">데이터 출처</Label>
            <Input className="h-8 text-sm" value={acSource} onChange={(e) => setAcSource(e.target.value)} />
          </div>
        </div>
      )}

      {coach.coachingRole === 'GOALKEEPER_COACH' && (
        <div className="grid grid-cols-2 gap-3">
          <NumericField label="PSxG" value={gkPsxG} onChange={setGkPsxG} />
          <NumericField label="xG 대비 실점 차" value={gkDiff} onChange={setGkDiff} />
          <NumericField label="빌드업 패스 성공률 (%)" value={gkPass} onChange={setGkPass} />
          <div className="space-y-1.5">
            <Label className="text-xs">데이터 출처</Label>
            <Input className="h-8 text-sm" value={gkSource} onChange={(e) => setGkSource(e.target.value)} />
          </div>
        </div>
      )}

      {!isTier1 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">fitScore (0–100)</Label>
            <Input type="number" className="h-8 text-sm" value={t2Score} onChange={(e) => setT2Score(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">메모</Label>
            <Textarea rows={2} className="text-sm" value={t2Notes} onChange={(e) => setT2Notes(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tutor Section ───────────────────────────────────────────────────────────

interface TutorSectionProps {
  coachId: number
  tutors: TutorAssignment[]
  canWrite: boolean
  onSaved: () => void
}

function TutorSection({ coachId, tutors, canWrite, onSaved }: TutorSectionProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [type, setType] = useState<TutorType>('EXTERNAL')
  const [externalName, setExternalName] = useState('')
  const [externalContact, setExternalContact] = useState('')
  const [language, setLanguage] = useState<LanguageProficiency | ''>('')
  const [saving, setSaving] = useState(false)

  const LANGS: LanguageProficiency[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

  const handleAdd = async () => {
    if (type === 'EXTERNAL' && !externalName.trim()) {
      toast.error('외부 튜터 이름을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await coachApi.createTutor(coachId, {
        type,
        ...(type === 'EXTERNAL' && externalName.trim() && { externalName: externalName.trim() }),
        ...(type === 'EXTERNAL' && externalContact.trim() && { externalContact: externalContact.trim() }),
        ...(language && { languageProficiency: language }),
      })
      toast.success('튜터가 배정됐습니다.')
      setType('EXTERNAL'); setExternalName(''); setExternalContact(''); setLanguage('')
      setAddOpen(false)
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateSession = async (tutor: TutorAssignment, delta: number) => {
    try {
      await coachApi.updateTutor(coachId, tutor.id, { sessionCount: tutor.sessionCount + delta })
      onSaved()
    } catch {
      toast.error('세션 수 변경에 실패했습니다.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">튜터 배정</h2>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />튜터 추가
          </Button>
        )}
      </div>

      {tutors.length === 0 ? (
        <p className="text-sm text-muted-foreground">배정된 튜터가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {tutors.map((t) => (
            <div key={t.id} className="rounded border px-3 py-2 text-sm flex items-center justify-between gap-2">
              <div>
                <span className="font-medium">
                  {t.type === 'INTERNAL' ? t.internalTutor?.nickname ?? '—' : t.externalName}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {t.type === 'EXTERNAL' ? '외부' : '내부'}
                  {t.languageProficiency && ` · ${LANGUAGE_LABEL[t.languageProficiency]}`}
                  {t.tacticalImplementationRate !== null && ` · 전술이행률 ${t.tacticalImplementationRate}%`}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canWrite && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                    onClick={() => void handleUpdateSession(t, -1)}
                    disabled={t.sessionCount <= 0}>−</Button>
                )}
                <span className="text-xs tabular-nums w-12 text-center">
                  {t.sessionCount}세션
                </span>
                {canWrite && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                    onClick={() => void handleUpdateSession(t, 1)}>+</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>튜터 배정</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>유형</Label>
              <Select value={type} onValueChange={(v) => setType(v as TutorType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXTERNAL">외부 전문가</SelectItem>
                  <SelectItem value="INTERNAL">내부 코칭스태프</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === 'EXTERNAL' && (
              <>
                <div className="space-y-1.5">
                  <Label>이름 *</Label>
                  <Input value={externalName} onChange={(e) => setExternalName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>연락처</Label>
                  <Input placeholder="010-0000-0000" value={externalContact} onChange={(e) => setExternalContact(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>언어 숙련도 (CEFR)</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as LanguageProficiency)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => <SelectItem key={l} value={l}>{LANGUAGE_LABEL[l]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>취소</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? '저장 중...' : '배정'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── CoachDetailPage ─────────────────────────────────────────────────────────

export function CoachDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [coach, setCoach] = useState<Coach | null>(null)
  const [loading, setLoading] = useState(true)

  const canWrite =
    user?.role === 'FRONT_OFFICE' && (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'TD')
  const canRead =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' && (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'TD'))

  const fetchCoach = () => {
    if (!id) return
    setLoading(true)
    coachApi.getById(Number(id))
      .then(setCoach)
      .catch(() => toast.error('코치 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { void fetchCoach() }, [id])

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        접근 권한이 없습니다.
      </div>
    )
  }

  if (loading || !coach) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const backUrl = coach.hiringRoundId ? `/coaches?roundId=${coach.hiringRoundId}` : '/coaches'

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate(backUrl)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{coach.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {COACHING_ROLE_LABEL[coach.coachingRole]}
            {coach.nationality && ` · ${coach.nationality}`}
          </p>
        </div>
        <span className={`ml-auto inline-flex items-center rounded border px-2 py-0.5 text-xs ${COACH_STATUS_STYLE[coach.status]}`}>
          {COACH_STATUS_LABEL[coach.status]}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* 기본 정보 */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">기본 정보</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">역할</span>
              <span>{COACHING_ROLE_LABEL[coach.coachingRole]}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">국적</span>
              <span>{coach.nationality ?? '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">채용 라운드</span>
              <span>{coach.hiringRoundId ? `#${coach.hiringRoundId}` : '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">패키지 리드</span>
              <span>{coach.packageLead ? coach.packageLead.name : '—'}</span>
            </div>
            {coach.notes && (
              <div className="flex gap-2 col-span-2">
                <span className="text-muted-foreground w-20 shrink-0">메모</span>
                <span className="text-sm">{coach.notes}</span>
              </div>
            )}
          </div>
        </div>

        <hr />

        {/* 평가 데이터 */}
        <EvaluationSection coach={coach} canWrite={canWrite} onSaved={fetchCoach} />

        <hr />

        {/* 튜터 배정 */}
        <TutorSection
          coachId={coach.id}
          tutors={coach.tutorAssignments}
          canWrite={canWrite}
          onSaved={fetchCoach}
        />
      </div>
    </div>
  )
}
