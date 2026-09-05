import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { prospectApi } from '@/services/prospect.service'
import type {
  Prospect, ProspectVideoEvaluation, ProspectEvaluationLog,
  VideoEvalResult, EvaluationLogType, CreateVideoEvaluationDto, CreateEvaluationLogDto,
} from '@/types/prospect'
import {
  VIDEO_EVAL_RESULT_LABEL, VIDEO_EVAL_RESULT_STYLE,
  EVAL_LOG_TYPE_LABEL, EVAL_LOG_TYPE_DOT,
  STATUS_LABEL, STATUS_STYLE,
} from '@/types/prospect'
import { POSITION_LABEL, PLAY_STYLE_LABEL } from '@/types/player'

// ─── VideoEvalDialog ─────────────────────────────────────────────────────────

function computePreviewResult(
  qualityPassed: boolean,
  identifiable: boolean,
  continuity: boolean,
  totalScore: string,
): VideoEvalResult {
  if (!qualityPassed || !identifiable || !continuity) return 'FAIL'
  const score = Number(totalScore)
  if (!isNaN(score) && score >= 70) return 'PASS'
  return 'PENDING'
}

interface VideoEvalDialogProps {
  prospectId: number
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function VideoEvalDialog({ prospectId, open, onOpenChange, onSaved }: VideoEvalDialogProps) {
  const [qualityPassed, setQualityPassed] = useState(false)
  const [identifiable, setIdentifiable] = useState(false)
  const [continuity, setContinuity] = useState(false)
  const [totalScore, setTotalScore] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setQualityPassed(false)
      setIdentifiable(false)
      setContinuity(false)
      setTotalScore('')
      setNotes('')
    }
  }, [open])

  const previewResult = computePreviewResult(qualityPassed, identifiable, continuity, totalScore)

  const handleSave = async () => {
    setSaving(true)
    try {
      const dto: CreateVideoEvaluationDto = {
        qualityPassed,
        identifiable,
        continuity,
        totalScore: totalScore !== '' ? Number(totalScore) : null,
        notes: notes || null,
      }
      await prospectApi.videoEvaluations.create(prospectId, dto)
      toast.success('평가가 저장되었습니다')
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>비디오 1차 평가</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Hard Gate (모두 충족 필수)</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="quality" checked={qualityPassed} onCheckedChange={(v) => setQualityPassed(!!v)} />
                <Label htmlFor="quality" className="text-sm">화질 720p 이상</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="identifiable" checked={identifiable} onCheckedChange={(v) => setIdentifiable(!!v)} />
                <Label htmlFor="identifiable" className="text-sm">타겟 선수 식별 가능</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="continuity" checked={continuity} onCheckedChange={(v) => setContinuity(!!v)} />
                <Label htmlFor="continuity" className="text-sm">풀타임 추적 연속성</Label>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Soft 합산 점수 (0~100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={totalScore}
              onChange={(e) => setTotalScore(e.target.value)}
              placeholder="예: 78"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">메모</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="평가 내용 메모"
              className="mt-1 h-20 resize-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">예상 결과:</span>
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${VIDEO_EVAL_RESULT_STYLE[previewResult]}`}>
              {VIDEO_EVAL_RESULT_LABEL[previewResult]}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── EvalTab ─────────────────────────────────────────────────────────────────

interface EvalTabProps {
  prospect: Prospect
  canWrite: boolean
}

function EvalTab({ prospect, canWrite }: EvalTabProps) {
  const [evaluations, setEvaluations] = useState<ProspectVideoEvaluation[]>([])
  const [logs, setLogs] = useState<ProspectEvaluationLog[]>([])
  const [loadingEval, setLoadingEval] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [evalDialogOpen, setEvalDialogOpen] = useState(false)

  const [logType, setLogType] = useState<EvaluationLogType>('FIELD_VISIT')
  const [logNote, setLogNote] = useState('')
  const [logDate, setLogDate] = useState('')
  const [addingLog, setAddingLog] = useState(false)
  const [logFormOpen, setLogFormOpen] = useState(false)

  const loadEvals = useCallback(() => {
    setLoadingEval(true)
    prospectApi.videoEvaluations.list(prospect.id)
      .then(setEvaluations)
      .catch(() => toast.error('평가 이력을 불러오지 못했습니다'))
      .finally(() => setLoadingEval(false))
  }, [prospect.id])

  const loadLogs = useCallback(() => {
    setLoadingLogs(true)
    prospectApi.evaluationLogs.list(prospect.id)
      .then(setLogs)
      .catch(() => toast.error('스카우팅 로그를 불러오지 못했습니다'))
      .finally(() => setLoadingLogs(false))
  }, [prospect.id])

  useEffect(() => { loadEvals(); loadLogs() }, [loadEvals, loadLogs])

  const handleAddLog = async () => {
    if (!logNote.trim()) return
    setAddingLog(true)
    try {
      const dto: CreateEvaluationLogDto = {
        type: logType,
        note: logNote.trim(),
        ...(logDate && { evaluatedAt: logDate }),
      }
      await prospectApi.evaluationLogs.create(prospect.id, dto)
      toast.success('로그가 추가되었습니다')
      setLogNote('')
      setLogDate('')
      setLogFormOpen(false)
      loadLogs()
    } catch {
      toast.error('로그 추가에 실패했습니다')
    } finally {
      setAddingLog(false)
    }
  }

  const [latest, ...history] = evaluations

  return (
    <div className="space-y-6">
      {/* 비디오 1차 평가 섹션 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">비디오 1차 평가</h3>
          {canWrite && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEvalDialogOpen(true)}>
              + 새 평가
            </Button>
          )}
        </div>
        {loadingEval ? (
          <Skeleton className="h-20 w-full" />
        ) : !latest ? (
          <p className="text-sm text-muted-foreground">평가 기록 없음</p>
        ) : (
          <div className="space-y-2">
            <div className="rounded border p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${VIDEO_EVAL_RESULT_STYLE[latest.result]}`}>
                  {VIDEO_EVAL_RESULT_LABEL[latest.result]}
                </span>
                {latest.qualityPassed && <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5">화질 ✓</span>}
                {!latest.qualityPassed && <span className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">화질 ✗</span>}
                {latest.identifiable && <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5">식별 ✓</span>}
                {!latest.identifiable && <span className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">식별 ✗</span>}
                {latest.continuity && <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5">연속성 ✓</span>}
                {!latest.continuity && <span className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">연속성 ✗</span>}
              </div>
              {latest.totalScore != null && (
                <p className="text-xs text-muted-foreground">총점: {latest.totalScore} / 100</p>
              )}
              {latest.notes && <p className="text-xs text-muted-foreground">{latest.notes}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(latest.evaluatedAt).toLocaleDateString('ko-KR')} · {latest.evaluatedBy.nickname}
              </p>
            </div>
            {history.length > 0 && (
              <div className="space-y-1">
                {history.map((ev) => (
                  <div key={ev.id} className="rounded border border-dashed px-3 py-2 flex items-center gap-2 bg-muted/30">
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${VIDEO_EVAL_RESULT_STYLE[ev.result]}`}>
                      {VIDEO_EVAL_RESULT_LABEL[ev.result]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ev.totalScore != null ? `${ev.totalScore}점` : '—'} · {new Date(ev.evaluatedAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 스카우팅 로그 섹션 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">스카우팅 로그</h3>
          {canWrite && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLogFormOpen((v) => !v)}>
              {logFormOpen ? '취소' : '+ 로그 추가'}
            </Button>
          )}
        </div>

        {logFormOpen && (
          <div className="rounded border p-3 mb-3 space-y-2 bg-muted/20">
            <Select value={logType} onValueChange={(v) => setLogType(v as EvaluationLogType)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(EVAL_LOG_TYPE_LABEL) as EvaluationLogType[]).map((t) => (
                  <SelectItem key={t} value={t}>{EVAL_LOG_TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={logNote}
              onChange={(e) => setLogNote(e.target.value)}
              placeholder="평가 내용"
              className="h-16 resize-none text-sm"
            />
            <Input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="h-8 text-sm"
            />
            <Button size="sm" className="h-7 text-xs" onClick={handleAddLog} disabled={addingLog || !logNote.trim()}>
              저장
            </Button>
          </div>
        )}

        {loadingLogs ? (
          <Skeleton className="h-20 w-full" />
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">로그 없음</p>
        ) : (
          <div className="border-l-2 border-muted pl-4 space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="relative">
                <div className={`absolute -left-[21px] top-1 w-2 h-2 rounded-full ${EVAL_LOG_TYPE_DOT[log.type]}`} />
                <p className="text-xs font-medium">{EVAL_LOG_TYPE_LABEL[log.type]}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{log.note}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(log.evaluatedAt).toLocaleDateString('ko-KR')} · {log.evaluatedBy.nickname}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {canWrite && (
        <VideoEvalDialog
          prospectId={prospect.id}
          open={evalDialogOpen}
          onOpenChange={setEvalDialogOpen}
          onSaved={loadEvals}
        />
      )}
    </div>
  )
}

// ─── InfoTab ─────────────────────────────────────────────────────────────────

interface InfoTabProps {
  prospect: Prospect
  canWrite: boolean
  onUpdated: (p: Prospect) => void
}

function InfoTab({ prospect, canWrite, onUpdated }: InfoTabProps) {
  const [marketValue, setMarketValue] = useState(String(prospect.currentMarketValue ?? ''))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setMarketValue(String(prospect.currentMarketValue ?? ''))
  }, [prospect.id, prospect.currentMarketValue])

  const handleSaveMarketValue = async () => {
    setSaving(true)
    try {
      const updated = await prospectApi.update(prospect.id, {
        currentMarketValue: marketValue !== '' ? Number(marketValue) : null,
      })
      onUpdated(updated)
      toast.success('저장되었습니다')
    } catch {
      toast.error('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">이름</p>
          <p className="font-medium">{prospect.name}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">포지션</p>
          <p>{prospect.position ? POSITION_LABEL[prospect.position] : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">국적</p>
          <p>{prospect.nationality ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">현소속</p>
          <p>{prospect.currentTeam ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">상태</p>
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${STATUS_STYLE[prospect.status]}`}>
            {STATUS_LABEL[prospect.status]}
          </span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">플레이스타일</p>
          <p>{prospect.playStyle ? PLAY_STYLE_LABEL[prospect.playStyle] : '—'}</p>
        </div>
      </div>

      {canWrite && (
        <div>
          <Label className="text-xs text-muted-foreground">예상 시가 (만원)</Label>
          <div className="flex gap-2 mt-1">
            <Input
              type="number"
              value={marketValue}
              onChange={(e) => setMarketValue(e.target.value)}
              placeholder="예: 20000"
              className="h-8 text-sm"
            />
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSaveMarketValue} disabled={saving}>
              저장
            </Button>
          </div>
        </div>
      )}

      {prospect.notes && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">메모</p>
          <p className="text-sm whitespace-pre-wrap">{prospect.notes}</p>
        </div>
      )}
    </div>
  )
}

// ─── ProspectDetailSheet ─────────────────────────────────────────────────────

interface ProspectDetailSheetProps {
  prospect: Prospect | null
  open: boolean
  onOpenChange: (v: boolean) => void
  canWrite: boolean
  onUpdated: (p: Prospect) => void
}

export function ProspectDetailSheet({
  prospect,
  open,
  onOpenChange,
  canWrite,
  onUpdated,
}: ProspectDetailSheetProps) {
  if (!prospect) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] max-w-full overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{prospect.name}</SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="info">
          <TabsList className="mb-4">
            <TabsTrigger value="info">기본정보</TabsTrigger>
            <TabsTrigger value="eval">평가</TabsTrigger>
          </TabsList>
          <TabsContent value="info">
            <InfoTab prospect={prospect} canWrite={canWrite} onUpdated={onUpdated} />
          </TabsContent>
          <TabsContent value="eval">
            <EvalTab prospect={prospect} canWrite={canWrite} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
