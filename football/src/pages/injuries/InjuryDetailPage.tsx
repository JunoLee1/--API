import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { injuryApi } from '@/services/injury.service'
import type {
  InjuryDetail, InjuryReport, RehabStage, RiskLevel, SecurityLevel,
  InjuryAssessment, ExternalReport,
} from '@/types/injury'
import {
  INJURY_STATUS_LABEL, INJURY_STATUS_STYLE,
  CAUSE_LABEL, BODY_PART_LABEL,
  REHAB_STAGE_LABEL, RISK_LEVEL_LABEL, RISK_LEVEL_STYLE, SECURITY_LEVEL_LABEL,
  EXTERNAL_REPORT_TARGET_LABEL, EXTERNAL_REPORT_STATUS_LABEL, EXTERNAL_REPORT_STATUS_STYLE,
  type BodyPart,
} from '@/types/injury'
import { AssessmentForm } from '@/components/injury/AssessmentForm'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { ArrowLeft, User } from 'lucide-react'
import { POSITION_LABEL } from '@/types/player'

const REHAB_STAGES: RehabStage[] = ['INITIAL_TREATMENT', 'ACUTE_TREATMENT', 'REHABILITATION', 'RETURN_TRAINING', 'CLEARED']
const RISK_LEVELS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH']
const SECURITY_LEVELS: SecurityLevel[] = ['INTERNAL', 'MEDICAL', 'PRIVATE']

const STATUS_STEPS: InjuryDetail['status'][] = [
  'OCCURRED', 'DIAGNOSED', 'REHABILITATING', 'READY_TO_RETURN', 'RETURNED',
]

function StatusTimeline({ current }: { current: InjuryDetail['status'] }) {
  const currentIdx = STATUS_STEPS.indexOf(current)
  return (
    <div className="flex items-center gap-0 w-full">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx < currentIdx
        const active = idx === currentIdx
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                active ? 'bg-primary border-primary text-primary-foreground' :
                done ? 'bg-primary/20 border-primary text-primary' :
                'bg-muted border-muted-foreground/30 text-muted-foreground'
              }`}>
                {done ? '✓' : idx + 1}
              </div>
              <span className={`text-[10px] mt-1 text-center whitespace-nowrap ${active ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                {INJURY_STATUS_LABEL[step]}
              </span>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function InjuryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [injury, setInjury] = useState<InjuryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [report, setReport] = useState<InjuryReport | null>(null)
  const [signing, setSigning] = useState(false)
  const [assessment, setAssessment] = useState<InjuryAssessment | null>(null)
  const [externalReports, setExternalReports] = useState<ExternalReport[]>([])

  const [diagnosisName, setDiagnosisName] = useState('')
  const [treatmentContent, setTreatmentContent] = useState('')
  const [rehabStage, setRehabStage] = useState<RehabStage | ''>('')
  const [trainingReturnDate, setTrainingReturnDate] = useState('')
  const [matchAvailable, setMatchAvailable] = useState<boolean | ''>('')
  const [reinjuryRisk, setReinjuryRisk] = useState<RiskLevel | ''>('')
  const [medicalOpinion, setMedicalOpinion] = useState('')
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>('INTERNAL')

  const isMedical = user?.role === 'ADMIN' ||
    (user?.role === 'COACHING_STAFF' && (user?.coachingRole === 'MEDICAL' || user?.coachingRole === 'MEDICAL_DIRECTOR'))

  function fillForm(r: InjuryReport) {
    setDiagnosisName(r.diagnosisName ?? '')
    setTreatmentContent(r.treatmentContent ?? '')
    setRehabStage(r.rehabStage ?? '')
    setTrainingReturnDate(r.trainingReturnDate ? r.trainingReturnDate.slice(0, 10) : '')
    setMatchAvailable(r.matchAvailable ?? '')
    setReinjuryRisk(r.reinjuryRisk ?? '')
    setMedicalOpinion(r.medicalOpinion ?? '')
    setSecurityLevel(r.securityLevel)
  }

  useEffect(() => {
    if (!id) return
    Promise.all([
      injuryApi.get(Number(id)),
      injuryApi.getReport(Number(id)),
      injuryApi.getAssessment(Number(id)),
      injuryApi.getExternalReports(Number(id)),
    ])
      .then(([inj, r, assess, reports]) => {
        setInjury(inj)
        if (r) { fillForm(r); setReport(r) }
        setAssessment(assess)
        setExternalReports(reports)
      })
      .catch(() => { toast.error('불러오지 못했습니다.'); navigate('/injuries') })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    try {
      const updated = await injuryApi.saveReport(Number(id), {
        diagnosisName: diagnosisName || undefined,
        treatmentContent: treatmentContent || undefined,
        rehabStage: rehabStage || undefined,
        trainingReturnDate: trainingReturnDate || undefined,
        matchAvailable: matchAvailable === '' ? undefined : matchAvailable,
        reinjuryRisk: reinjuryRisk || undefined,
        medicalOpinion: medicalOpinion || undefined,
        securityLevel,
      })
      setReport(updated)
      toast.success('의료 보고서가 저장됐습니다.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const mySignRole =
    user?.role === 'ADMIN' ? 'MEDICAL' :
    user?.coachingRole === 'HEAD_COACH' ? 'COACH' :
    user?.coachingRole === 'PHYSICAL_COACH' ? 'TRAINER' :
    (user?.coachingRole === 'MEDICAL' || user?.coachingRole === 'MEDICAL_DIRECTOR') ? 'MEDICAL' :
    null

  const handleToggleSign = async () => {
    if (!id || !mySignRole) return
    setSigning(true)
    try {
      const isSigned =
        mySignRole === 'COACH' ? !!report?.coachSignedAt :
        mySignRole === 'TRAINER' ? !!report?.trainerSignedAt :
        !!report?.medicalSignedAt
      const updated = isSigned
        ? await injuryApi.unsignReport(Number(id))
        : await injuryApi.signReport(Number(id))
      setReport(updated)
      toast.success(isSigned ? '서명이 취소됐습니다.' : '서명했습니다.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '서명 처리에 실패했습니다.')
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }
  if (!injury) return null

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/injuries')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">부상 상세 / 의료 보고서</h1>
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs mt-0.5 ${INJURY_STATUS_STYLE[injury.status]}`}>
            {INJURY_STATUS_LABEL[injury.status]}
          </span>
        </div>
        {isMedical && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-8">

          <div>
            <h2 className="text-sm font-semibold mb-3">기본 정보</h2>
            <div className="rounded-lg border bg-muted/40 px-4 py-3 flex items-center gap-3 mb-4">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="text-sm">
                <p className="font-medium">{injury.player.playerName}</p>
                <p className="text-muted-foreground text-xs">
                  {POSITION_LABEL[injury.player.position as keyof typeof POSITION_LABEL] ?? '—'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">부상 부위</p>
                <p className="font-medium">{BODY_PART_LABEL[injury.bodyPart as BodyPart] ?? injury.bodyPart}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">발생 원인</p>
                <p className="font-medium">{CAUSE_LABEL[injury.cause]}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">부상 일자</p>
                <p className="font-medium tabular-nums">
                  {new Date(injury.occurredAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">복귀 예정일</p>
                <p className="font-medium tabular-nums">
                  {injury.expectedReturnDate
                    ? new Date(injury.expectedReturnDate).toLocaleDateString('ko-KR')
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-3">의료 보고서</h2>
            {!isMedical && (
              <p className="text-sm text-muted-foreground mb-4">의료팀만 작성할 수 있습니다.</p>
            )}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>진단명</Label>
                <Input
                  placeholder="예: 우측 전방십자인대 파열"
                  value={diagnosisName}
                  onChange={(e) => setDiagnosisName(e.target.value)}
                  disabled={!isMedical}
                />
              </div>

              <div className="space-y-1.5">
                <Label>치료 내용</Label>
                <Textarea
                  placeholder="치료 방법, 처방 내용 등"
                  value={treatmentContent}
                  onChange={(e) => setTreatmentContent(e.target.value)}
                  rows={3}
                  disabled={!isMedical}
                />
              </div>

              <div className="space-y-1.5">
                <Label>재활 단계</Label>
                <Select
                  value={rehabStage}
                  onValueChange={(v) => setRehabStage(v as RehabStage)}
                  disabled={!isMedical}
                >
                  <SelectTrigger>
                    <span>{rehabStage ? REHAB_STAGE_LABEL[rehabStage] : <span className="text-muted-foreground">선택 안 함</span>}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {REHAB_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{REHAB_STAGE_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>훈련 복귀 가능 시점</Label>
                  <Input
                    type="date"
                    value={trainingReturnDate}
                    onChange={(e) => setTrainingReturnDate(e.target.value)}
                    disabled={!isMedical}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>경기 출전 가능 여부</Label>
                  <Select
                    value={matchAvailable === '' ? '' : String(matchAvailable)}
                    onValueChange={(v) => setMatchAvailable(v === '' ? '' : v === 'true')}
                    disabled={!isMedical}
                  >
                    <SelectTrigger>
                      <span>
                        {matchAvailable === ''
                          ? <span className="text-muted-foreground">선택 안 함</span>
                          : matchAvailable ? '가능' : '불가'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">가능</SelectItem>
                      <SelectItem value="false">불가</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>재부상 위험</Label>
                <Select
                  value={reinjuryRisk}
                  onValueChange={(v) => setReinjuryRisk(v as RiskLevel)}
                  disabled={!isMedical}
                >
                  <SelectTrigger>
                    {reinjuryRisk
                      ? <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${RISK_LEVEL_STYLE[reinjuryRisk]}`}>{RISK_LEVEL_LABEL[reinjuryRisk]}</span>
                      : <span className="text-muted-foreground">선택 안 함</span>}
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map((r) => (
                      <SelectItem key={r} value={r}>{RISK_LEVEL_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>의학적 소견</Label>
                <Textarea
                  placeholder="의사 소견, 권고 사항 등"
                  value={medicalOpinion}
                  onChange={(e) => setMedicalOpinion(e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                  disabled={!isMedical}
                />
              </div>

              <div className="space-y-1.5">
                <Label>보안 등급</Label>
                <Select
                  value={securityLevel}
                  onValueChange={(v) => setSecurityLevel(v as SecurityLevel)}
                  disabled={!isMedical}
                >
                  <SelectTrigger>
                    <span>{SECURITY_LEVEL_LABEL[securityLevel]}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {SECURITY_LEVELS.map((s) => (
                      <SelectItem key={s} value={s}>{SECURITY_LEVEL_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {/* 상태 타임라인 */}
          {injury && (
            <section className="border rounded-lg p-5">
              <h2 className="text-sm font-semibold mb-4">부상 진행 상태</h2>
              <StatusTimeline current={injury.status} />
            </section>
          )}

          {/* 가중치 평가 */}
          {isMedical && injury && (
            <section className="border rounded-lg p-5">
              <h2 className="text-sm font-semibold mb-1">가중치 평가 (RTP)</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Medical 40% · Functional 40% · Modifier 20% — 80점 이상 시 외부 의무보고서 자동 생성
              </p>
              <AssessmentForm
                injuryId={injury.id}
                initial={assessment}
                onSaved={({ assessment: a, triggeredReports }) => {
                  setAssessment(a)
                  if (triggeredReports) {
                    injuryApi.getExternalReports(injury.id).then(setExternalReports)
                  }
                }}
              />
            </section>
          )}

          {/* 외부 의무보고서 */}
          {externalReports.length > 0 && (
            <section className="border rounded-lg p-5">
              <h2 className="text-sm font-semibold mb-3">외부 의무보고서</h2>
              <div className="space-y-2">
                {externalReports.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-medium">
                      {EXTERNAL_REPORT_TARGET_LABEL[r.target]}
                    </span>
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${EXTERNAL_REPORT_STATUS_STYLE[r.status]}`}>
                      {EXTERNAL_REPORT_STATUS_LABEL[r.status]}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {report && (
            <div>
              <h2 className="text-sm font-semibold mb-3">복귀 계획 조율</h2>
              <p className="text-xs text-muted-foreground mb-3">
                감독·트레이너·의료팀 3자 모두 서명해야 복귀 계획이 확정됩니다.
              </p>
              <div className="space-y-2">
                {([
                  { role: 'COACH' as const, label: '감독', signedAt: report.coachSignedAt, signer: report.coachSigner },
                  { role: 'TRAINER' as const, label: '트레이너', signedAt: report.trainerSignedAt, signer: report.trainerSigner },
                  { role: 'MEDICAL' as const, label: '의료팀', signedAt: report.medicalSignedAt, signer: report.medicalSigner },
                ]).map(({ role, label, signedAt, signer }) => (
                  <div key={role} className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${signedAt ? 'border-green-200 bg-green-50' : 'bg-muted/30'}`}>
                    <div className="text-sm">
                      <span className="font-medium">{label}</span>
                      {signedAt && signer && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {signer.nickname} · {new Date(signedAt).toLocaleDateString('ko-KR')}
                        </span>
                      )}
                      {!signedAt && <span className="text-xs text-muted-foreground ml-2">미서명</span>}
                    </div>
                    {mySignRole === role && (
                      <Button
                        size="sm"
                        variant={signedAt ? 'outline' : 'default'}
                        onClick={handleToggleSign}
                        disabled={signing}
                        className={signedAt ? 'text-red-600 border-red-300 hover:bg-red-50' : ''}
                      >
                        {signing ? '처리 중...' : signedAt ? '서명 취소' : '서명'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
