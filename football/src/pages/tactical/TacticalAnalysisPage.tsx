import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { tacticalApi } from '@/services/tactical.service'
import { matchApi } from '@/services/match.service'
import { playerApi } from '@/services/player.service'
import type {
  TacticalAnalysis,
  TacticalPhase,
  CreateTacticalDto,
  UpdateTacticalDto,
} from '@/types/tactical'
import {
  FORMATION_OPTIONS,
  PHASE_STYLE,
  STATUS_STYLE,
} from '@/types/tactical'
import type { Match } from '@/types/match'
import type { Player } from '@/types/player'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Check, ImagePlus, Plus, X } from 'lucide-react'

const PHASES: TacticalPhase[] = ['PRE_MATCH', 'POST_MATCH']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function matchLabel(m: Match) {
  return `${formatDate(m.date)} ${m.homeTeamName} vs ${m.awayTeamName}`
}

// ─── FormationSelect (재사용) ──────────────────────────────────────────────────

function FormationSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="선택">{value || undefined}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {FORMATION_OPTIONS.map((f) => (
            <SelectItem key={f} value={f}>{f}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ─── PlayerSelectRow (MOM / 보완 필요) ───────────────────────────────────────

function PlayerSelectRow({
  label,
  players,
  playerId,
  note,
  onPlayerChange,
  onNoteChange,
}: {
  label: string
  players: Player[]
  playerId: string
  note: string
  onPlayerChange: (v: string) => void
  onNoteChange: (v: string) => void
}) {
  const selected = players.find((p) => p.id === playerId)
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={playerId} onValueChange={onPlayerChange}>
        <SelectTrigger>
          <SelectValue placeholder="선수 선택">
            {selected?.playerName ?? undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {players.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="코멘트 (선택)"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
      />
    </div>
  )
}

// ─── AnalysisFormDialog (create + edit 통합) ──────────────────────────────────

type FormMode = 'create' | 'edit'

interface AnalysisFormDialogProps {
  mode: FormMode
  open: boolean
  onOpenChange: (v: boolean) => void
  matches: Match[]
  players: Player[]
  initial?: TacticalAnalysis
  onSaved: () => void
}

function AnalysisFormDialog({
  mode,
  open,
  onOpenChange,
  matches,
  players,
  initial,
  onSaved,
}: AnalysisFormDialogProps) {
  const { t } = useTranslation('match')
  // ── common ──
  const [matchId, setMatchId] = useState(initial ? String(initial.matchId) : '')
  const [phase, setPhase] = useState<TacticalPhase>(initial?.phase ?? 'PRE_MATCH')
  const [opponentAnalysis, setOpponentAnalysis] = useState(initial?.opponentAnalysis ?? '')
  // ── PRE_MATCH ──
  const [formation, setFormation] = useState(initial?.formation ?? '')
  const [opponentFormation, setOpponentFormation] = useState(initial?.opponentFormation ?? '')
  const [opponentKeyThreat, setOpponentKeyThreat] = useState(initial?.opponentKeyThreat ?? '')
  const [opponentWeakness, setOpponentWeakness] = useState(initial?.opponentWeakness ?? '')
  const [opponentKeyPlayer, setOpponentKeyPlayer] = useState(initial?.opponentKeyPlayer ?? '')
  // ── POST_MATCH ──
  const [tacticalCompliance, setTacticalCompliance] = useState(initial?.tacticalCompliance ?? '')
  const [concededAnalysis, setConcededAnalysis] = useState(initial?.concededAnalysis ?? '')
  const [momPlayerId, setMomPlayerId] = useState(initial?.momPlayerId ?? '')
  const [momNote, setMomNote] = useState(initial?.momNote ?? '')
  const [improvementPlayerId, setImprovementPlayerId] = useState(initial?.improvementPlayerId ?? '')
  const [improvementNote, setImprovementNote] = useState(initial?.improvementNote ?? '')
  // ── files (create 모드) ──
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setMatchId('')
    setPhase('PRE_MATCH')
    setFormation('')
    setOpponentFormation('')
    setOpponentKeyThreat('')
    setOpponentWeakness('')
    setOpponentKeyPlayer('')
    setOpponentAnalysis('')
    setTacticalCompliance('')
    setConcededAnalysis('')
    setMomPlayerId('')
    setMomNote('')
    setImprovementPlayerId('')
    setImprovementNote('')
    setFiles([])
    setPreviews([])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    setFiles((prev) => [...prev, ...selected])
    selected.forEach((f) => {
      if (f.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (ev) => setPreviews((prev) => [...prev, ev.target!.result as string])
        reader.readAsDataURL(f)
      } else {
        setPreviews((prev) => [...prev, ''])
      }
    })
    e.target.value = ''
  }

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const buildPreDto = (): Omit<CreateTacticalDto, 'matchId' | 'phase'> => ({
    formation: formation || undefined,
    opponentFormation: opponentFormation || undefined,
    opponentKeyThreat: opponentKeyThreat || undefined,
    opponentWeakness: opponentWeakness || undefined,
    opponentKeyPlayer: opponentKeyPlayer || undefined,
    opponentAnalysis: opponentAnalysis || undefined,
  })

  const buildPostDto = (): Omit<CreateTacticalDto, 'matchId' | 'phase'> => ({
    formation: formation || undefined,
    tacticalCompliance: tacticalCompliance || undefined,
    concededAnalysis: concededAnalysis || undefined,
    momPlayerId: momPlayerId || undefined,
    momNote: momNote || undefined,
    improvementPlayerId: improvementPlayerId || undefined,
    improvementNote: improvementNote || undefined,
    opponentAnalysis: opponentAnalysis || undefined,
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      if (mode === 'create') {
        if (!matchId) { toast.error(t('tactical.form.required')); setSaving(false); return }
        const phaseDto = phase === 'PRE_MATCH' ? buildPreDto() : buildPostDto()
        const result = await tacticalApi.create({ matchId: Number(matchId), phase, ...phaseDto })
        if (files.length > 0) {
          await tacticalApi.addMedia(result.id, files).catch(() => {
            toast.error(t('tactical.form.saveFailed'))
          })
        }
        toast.success(t('tactical.form.createSuccess'))
      } else {
        const phaseDto: UpdateTacticalDto = phase === 'PRE_MATCH'
          ? {
              formation,
              opponentFormation,
              opponentKeyThreat,
              opponentWeakness,
              opponentKeyPlayer,
              opponentAnalysis,
            }
          : {
              formation,
              tacticalCompliance,
              concededAnalysis,
              momPlayerId,
              momNote,
              improvementPlayerId,
              improvementNote,
              opponentAnalysis,
            }
        await tacticalApi.update(initial!.id, phaseDto)
        toast.success(t('tactical.form.editSuccess'))
      }
      reset()
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('tactical.form.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const title = mode === 'create'
    ? t('tactical.form.createTitle')
    : t('tactical.form.editTitle')

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onOpenChange(false) } }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          {/* ── 공통: 경기 + 시점 ── */}
          <div className="space-y-1.5">
            <Label>{t('tactical.form.matchLabel')} *</Label>
            <Select value={matchId} onValueChange={setMatchId} disabled={mode === 'edit'}>
              <SelectTrigger>
                <SelectValue placeholder={t('tactical.form.matchPlaceholder')}>
                  {matchId ? matchLabel(matches.find((m) => String(m.id) === matchId)!) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {matches.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{matchLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('tactical.form.phaseLabel')} *</Label>
            <Select value={phase} onValueChange={(v) => setPhase(v as TacticalPhase)} disabled={mode === 'edit'}>
              <SelectTrigger>
                <SelectValue>{t(`tactical.phase.${phase}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PHASES.map((ph) => (
                  <SelectItem key={ph} value={ph}>{t(`tactical.phase.${ph}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── PRE_MATCH: 🛡️ 사전 전력 분석 ── */}
          {phase === 'PRE_MATCH' && (
            <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
              <p className="text-xs font-semibold text-blue-700">🛡️ 사전 전력 분석 — 상대팀 파악</p>
              <FormationSelect
                label={t('tactical.form.formationLabel')}
                value={formation}
                onChange={setFormation}
              />
              <FormationSelect
                label={t('tactical.form.opponentFormationLabel')}
                value={opponentFormation}
                onChange={setOpponentFormation}
              />
              <div className="space-y-1.5">
                <Label>{t('tactical.form.opponentKeyThreatLabel')}</Label>
                <Textarea
                  placeholder="예: 좌측 윙백의 오버래핑, 전방 압박 강도"
                  value={opponentKeyThreat}
                  onChange={(e) => setOpponentKeyThreat(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('tactical.form.opponentWeaknessLabel')}</Label>
                <Textarea
                  placeholder="예: 백라인 뒷공간, 세트피스 허용률"
                  value={opponentWeakness}
                  onChange={(e) => setOpponentWeakness(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('tactical.form.opponentKeyPlayerLabel')}</Label>
                <Input
                  placeholder="예: 10번 공격형 미드필더"
                  value={opponentKeyPlayer}
                  onChange={(e) => setOpponentKeyPlayer(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('tactical.form.opponentAnalysisLabel')}</Label>
                <Textarea
                  placeholder="추가 분석 내용"
                  value={opponentAnalysis}
                  onChange={(e) => setOpponentAnalysis(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* ── POST_MATCH: ⚔️ 사후 경기 리뷰 ── */}
          {phase === 'POST_MATCH' && (
            <div className="space-y-3 rounded-lg border border-purple-100 bg-purple-50/40 p-3">
              <p className="text-xs font-semibold text-purple-700">⚔️ 사후 경기 리뷰 — 우리 팀 수행도</p>
              <FormationSelect
                label={t('tactical.form.formationLabel')}
                value={formation}
                onChange={setFormation}
              />
              <div className="space-y-1.5">
                <Label>{t('tactical.form.tacticalComplianceLabel')}</Label>
                <Textarea
                  placeholder="예: 전방 압박 이행 80%, 측면 전환 부족"
                  value={tacticalCompliance}
                  onChange={(e) => setTacticalCompliance(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('tactical.form.concededAnalysisLabel')}</Label>
                <Textarea
                  placeholder="예: 코너킥 수비 마크 이탈, 2선 압박 타이밍 지연"
                  value={concededAnalysis}
                  onChange={(e) => setConcededAnalysis(e.target.value)}
                  rows={2}
                />
              </div>
              <PlayerSelectRow
                label={t('tactical.form.momLabel')}
                players={players}
                playerId={momPlayerId}
                note={momNote}
                onPlayerChange={setMomPlayerId}
                onNoteChange={setMomNote}
              />
              <PlayerSelectRow
                label={t('tactical.form.improvementLabel')}
                players={players}
                playerId={improvementPlayerId}
                note={improvementNote}
                onPlayerChange={setImprovementPlayerId}
                onNoteChange={setImprovementNote}
              />
              <div className="space-y-1.5">
                <Label>{t('tactical.form.opponentAnalysisLabel')}</Label>
                <Textarea
                  placeholder="추가 리뷰 내용"
                  value={opponentAnalysis}
                  onChange={(e) => setOpponentAnalysis(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* ── 파일 업로드 (create 모드만) ── */}
          {mode === 'create' && (
            <div className="space-y-1.5">
              <Label>{t('tactical.form.mediaLabel')}</Label>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4 mr-1.5" />파일 선택
              </Button>
              {files.length > 0 && (
                <div className="space-y-1 mt-1">
                  {files.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                      {previews[idx] ? (
                        <img src={previews[idx]} alt="" className="h-7 w-10 object-cover rounded shrink-0" />
                      ) : (
                        <span className="text-muted-foreground text-xs shrink-0">▶</span>
                      )}
                      <span className="flex-1 truncate text-xs">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={saving}>
            {t('tactical.form.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('tactical.form.saving') : mode === 'create' ? t('tactical.form.create') : t('tactical.form.update')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────────

export function TacticalAnalysisPage() {
  const { t } = useTranslation('match')
  const { user } = useCurrentUser()
  const [analyses, setAnalyses] = useState<TacticalAnalysis[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TacticalAnalysis | null>(null)

  const canWrite =
    user?.role === 'ADMIN' ||
    (user?.role === 'COACHING_STAFF' && user?.coachingRole !== 'HEAD_COACH') ||
    (user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'TACTICAL_ANALYST')

  const canConfirm = user?.role === 'ADMIN' || user?.coachingRole === 'HEAD_COACH'

  const isPlayer = user?.role === 'PLAYER'

  const fetchAnalyses = () =>
    tacticalApi
      .list(isPlayer ? { phase: 'POST_MATCH' } : undefined)
      .then(setAnalyses)
      .catch(() => toast.error(t('tactical.loadFailed')))
      .finally(() => setLoading(false))

  useEffect(() => {
    void fetchAnalyses()
    if (!isPlayer) {
      matchApi.list().then(setMatches).catch(() => null)
      playerApi.list().then(setPlayers).catch(() => null)
    }
  }, [])

  const handleConfirm = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await tacticalApi.confirm(id)
      toast.success(t('tactical.confirmSuccess'))
      setAnalyses((prev) => prev.map((a) => a.id === id ? { ...a, status: 'CONFIRMED' } : a))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('tactical.confirmFailed'))
    }
  }

  const handleRowClick = (a: TacticalAnalysis) => {
    if (!canWrite) return
    setEditTarget(a)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('tactical.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isPlayer ? t('tactical.playerDescription') : t('tactical.description')}
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('tactical.addButton')}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : analyses.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('tactical.noData')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('tactical.col.match')}</TableHead>
                <TableHead className="w-24">{t('tactical.col.phase')}</TableHead>
                <TableHead className="w-28">{t('tactical.col.formation')}</TableHead>
                <TableHead className="w-20">{t('tactical.col.status')}</TableHead>
                <TableHead className="w-24 text-muted-foreground">{t('tactical.col.createdBy')}</TableHead>
                {canConfirm && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyses.map((a) => (
                <TableRow
                  key={a.id}
                  className={canWrite ? 'cursor-pointer' : ''}
                  onClick={() => handleRowClick(a)}
                >
                  <TableCell>
                    <div className="text-sm">{a.match.homeTeamName} vs {a.match.awayTeamName}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{formatDate(a.match.date)}</div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${PHASE_STYLE[a.phase]}`}>
                      {t(`tactical.phase.${a.phase}`)}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{a.formation ?? '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${STATUS_STYLE[a.status]}`}>
                      {t(`tactical.status.${a.status}`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.createdBy.nickname}</TableCell>
                  {canConfirm && (
                    <TableCell>
                      {a.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={(e) => handleConfirm(a.id, e)}
                        >
                          <Check className="h-3 w-3 mr-1" />{t('tactical.confirm')}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 등록 다이얼로그 */}
      <AnalysisFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        matches={matches}
        players={players}
        onSaved={() => {
          setCreateOpen(false)
          setLoading(true)
          void fetchAnalyses()
        }}
      />

      {/* 수정 다이얼로그 */}
      <AnalysisFormDialog
        mode="edit"
        open={!!editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null) }}
        matches={matches}
        players={players}
        initial={editTarget ?? undefined}
        onSaved={() => {
          setEditTarget(null)
          setLoading(true)
          void fetchAnalyses()
        }}
      />
    </div>
  )
}
