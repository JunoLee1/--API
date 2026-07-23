import { useState } from 'react'
import { toast } from 'sonner'
import { growthReportApi } from '@/services/growthReport.service'
import type { CreateGrowthEvaluationPayload } from '@/types/growth-report'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  playerId: string
  onSaved: () => void
}

const SCORE_FIELDS = [
  { scoreKey: 'attitudeScore', commentKey: 'attitudeComment', label: '태도' },
  { scoreKey: 'fundamentalsScore', commentKey: 'fundamentalsComment', label: '기본기' },
  { scoreKey: 'spatialScore', commentKey: 'spatialComment', label: '공간인식' },
  { scoreKey: 'physicalScore', commentKey: 'physicalComment', label: '체력' },
] as const

type ScoreKey = 'attitudeScore' | 'fundamentalsScore' | 'spatialScore' | 'physicalScore'
type CommentKey = 'attitudeComment' | 'fundamentalsComment' | 'spatialComment' | 'physicalComment'

const now = new Date()

const defaultForm = (): CreateGrowthEvaluationPayload => ({
  playerId: '',
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  attitudeScore: 5,
  attitudeComment: '',
  fundamentalsScore: 5,
  fundamentalsComment: '',
  spatialScore: 5,
  spatialComment: '',
  physicalScore: 5,
  physicalComment: '',
})

export function GrowthEvaluationFormDialog({ open, onOpenChange, playerId, onSaved }: Props) {
  const [form, setForm] = useState<CreateGrowthEvaluationPayload>(() => ({
    ...defaultForm(),
    playerId,
  }))
  const [loading, setLoading] = useState(false)

  const setScore = (key: ScoreKey, v: number) => setForm((f) => ({ ...f, [key]: Math.max(1, Math.min(10, v)) }))
  const setComment = (key: CommentKey, v: string) => setForm((f) => ({ ...f, [key]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await growthReportApi.createEvaluation({ ...form, playerId })
      toast.success('성장 평가가 저장됐습니다.')
      onSaved()
      onOpenChange(false)
      setForm({ ...defaultForm(), playerId })
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>성장 평가 작성</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-2">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label>연도</Label>
              <Input
                type="number"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                min={2000}
                max={2100}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label>월</Label>
              <Input
                type="number"
                value={form.month}
                onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))}
                min={1}
                max={12}
              />
            </div>
          </div>

          {SCORE_FIELDS.map(({ scoreKey, commentKey, label }) => (
            <div key={scoreKey} className="space-y-2 border rounded-md p-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium">{label}</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="w-6 h-6 rounded border text-sm font-bold flex items-center justify-center hover:bg-muted"
                    onClick={() => setScore(scoreKey, form[scoreKey] - 1)}
                  >-</button>
                  <span className="w-6 text-center font-semibold text-sm">{form[scoreKey]}</span>
                  <button
                    type="button"
                    className="w-6 h-6 rounded border text-sm font-bold flex items-center justify-center hover:bg-muted"
                    onClick={() => setScore(scoreKey, form[scoreKey] + 1)}
                  >+</button>
                  <span className="text-xs text-muted-foreground">/10</span>
                </div>
              </div>
              <Input
                placeholder={`${label} 코멘트`}
                value={form[commentKey]}
                onChange={(e) => setComment(commentKey, e.target.value)}
                required
              />
            </div>
          ))}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '저장 중...' : '저장'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
