import { useState } from 'react'
import { toast } from 'sonner'
import { injuryApi } from '@/services/injury.service'
import type { InjuryAssessment } from '@/types/injury'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

interface Props {
  injuryId: number
  initial: InjuryAssessment | null
  onSaved: (result: { assessment: InjuryAssessment; triggeredReports: boolean }) => void
}

function ScoreField({
  label, hint, value, onChange, min = 0, max = 100,
}: {
  label: string; hint: string; value: number; onChange: (v: number) => void
  min?: number; max?: number
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <Input
        type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
        className="h-8 w-24 text-sm"
      />
    </div>
  )
}

export function AssessmentForm({ injuryId, initial, onSaved }: Props) {
  const [painLevel, setPainLevel] = useState(initial?.painLevel ?? 0)
  const [hasSwelling, setHasSwelling] = useState(initial?.hasSwelling ?? false)
  const [romScore, setRomScore] = useState(initial?.romScore ?? 100)
  const [strengthScore, setStrengthScore] = useState(initial?.strengthScore ?? 100)
  const [sprintScore, setSprintScore] = useState(initial?.sprintScore ?? 100)
  const [jumpScore, setJumpScore] = useState(initial?.jumpScore ?? 100)
  const [psychScore, setPsychScore] = useState(initial?.psychScore ?? 0)
  const [positionRiskScore, setPositionRiskScore] = useState(initial?.positionRiskScore ?? 0)
  const [saving, setSaving] = useState(false)

  const medicalPrev = (painLevel / 10) * 20 + (hasSwelling ? 10 : 0) + ((100 - romScore) / 100) * 10
  const functionalPrev = ((100 - (strengthScore + sprintScore + jumpScore) / 3) / 100) * 40
  const modifierPrev = ((psychScore + positionRiskScore) / 2 / 100) * 20
  const totalPrev = Math.round(medicalPrev + functionalPrev + modifierPrev)

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await injuryApi.saveAssessment(injuryId, {
        painLevel, hasSwelling, romScore,
        strengthScore, sprintScore, jumpScore,
        psychScore, positionRiskScore,
      })
      if (result.triggeredReports) {
        toast.success('가중치 평가 저장 완료 — 외부 의무보고서가 자동 생성됐습니다.')
      } else {
        toast.success('가중치 평가가 저장됐습니다.')
      }
      onSaved(result)
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className={`rounded-lg border p-4 ${totalPrev >= 80 ? 'border-destructive bg-destructive/5' : 'border-border bg-muted/30'}`}>
        <p className="text-xs font-medium text-muted-foreground mb-1">예상 총점</p>
        <p className={`text-3xl font-bold tabular-nums ${totalPrev >= 80 ? 'text-destructive' : ''}`}>
          {totalPrev}
          <span className="text-base font-normal text-muted-foreground ml-1">/ 100</span>
        </p>
        {totalPrev >= 80 && (
          <p className="text-xs text-destructive mt-1">임계점(80점) 초과 — 외부 의무보고서가 생성됩니다</p>
        )}
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span>의학 {medicalPrev.toFixed(1)}/40</span>
          <span>기능 {functionalPrev.toFixed(1)}/40</span>
          <span>보정 {modifierPrev.toFixed(1)}/20</span>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">의학적 소견 (40%)</p>
        <ScoreField label="통증 단계" hint="0=통증 없음, 10=극심한 통증" value={painLevel} onChange={setPainLevel} min={0} max={10} />
        <div className="flex items-center gap-3">
          <Switch checked={hasSwelling} onCheckedChange={setHasSwelling} id="swelling" />
          <Label htmlFor="swelling" className="text-xs">부종 있음</Label>
        </div>
        <ScoreField label="ROM (관절 가동 범위 %)" hint="100=완전 정상, 0=전혀 움직이지 않음" value={romScore} onChange={setRomScore} />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">기능성 평가 (40%)</p>
        <ScoreField label="근력 검사 %" hint="100=정상, 0=전혀 없음" value={strengthScore} onChange={setStrengthScore} />
        <ScoreField label="스프린트/방향전환 %" hint="100=정상 수행, 0=불가" value={sprintScore} onChange={setSprintScore} />
        <ScoreField label="점프 테스트 %" hint="100=정상, 0=불가" value={jumpScore} onChange={setJumpScore} />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">환경·심리 보정 (20%)</p>
        <ScoreField label="심리적 불안도" hint="0=안정, 100=극도의 불안" value={psychScore} onChange={setPsychScore} />
        <ScoreField label="포지션 접촉 빈도 위험성" hint="0=저위험, 100=고위험" value={positionRiskScore} onChange={setPositionRiskScore} />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? '저장 중...' : '평가 저장'}
      </Button>
    </div>
  )
}
