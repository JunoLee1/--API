import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { tacticalApi } from '@/services/tactical.service'
import { matchApi } from '@/services/match.service'
import type { TacticalAnalysis, TacticalMedia, TacticalPhase } from '@/types/tactical'
import {
  FORMATION_OPTIONS,
  MEDIA_TYPE_LABEL,
  PHASE_LABEL,
  PHASE_STYLE,
  STATUS_LABEL,
  STATUS_STYLE,
} from '@/types/tactical'
import type { Match } from '@/types/match'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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

const API_BASE = '/api'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function matchLabel(m: Match) {
  return `${formatDate(m.date)} ${m.homeTeamName} vs ${m.awayTeamName}`
}

// ─── 등록 다이얼로그 ───────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  matches: Match[]
  onSaved: (id: number) => void
}

function CreateAnalysisDialog({ open, onOpenChange, matches, onSaved }: CreateDialogProps) {
  const [matchId, setMatchId] = useState<string>('')
  const [phase, setPhase] = useState<TacticalPhase>('PRE_MATCH')
  const [formation, setFormation] = useState<string>('')
  const [opponentAnalysis, setOpponentAnalysis] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setMatchId('')
    setPhase('PRE_MATCH')
    setFormation('')
    setOpponentAnalysis('')
  }

  const handleSave = async () => {
    if (!matchId) { toast.error('경기를 선택해주세요.'); return }
    setSaving(true)
    try {
      const result = await tacticalApi.create({
        matchId: Number(matchId),
        phase,
        ...(formation && { formation }),
        ...(opponentAnalysis.trim() && { opponentAnalysis: opponentAnalysis.trim() }),
      })
      toast.success('전술 분석이 등록됐습니다.')
      reset()
      onSaved(result.id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>전술 분석 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>경기 *</Label>
            <Select value={matchId} onValueChange={setMatchId}>
              <SelectTrigger>
                <SelectValue placeholder="경기 선택">
                  {matchId
                    ? matchLabel(matches.find((m) => String(m.id) === matchId)!)
                    : undefined}
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
            <Label>분석 시점 *</Label>
            <Select value={phase} onValueChange={(v) => setPhase(v as TacticalPhase)}>
              <SelectTrigger>
                <SelectValue>{PHASE_LABEL[phase]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PHASES.map((p) => (
                  <SelectItem key={p} value={p}>{PHASE_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>포메이션</Label>
            <Select value={formation} onValueChange={setFormation}>
              <SelectTrigger>
                <SelectValue placeholder="포메이션 선택">
                  {formation || undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FORMATION_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>상대 분석</Label>
            <Textarea
              placeholder="상대팀 분석 내용"
              value={opponentAnalysis}
              onChange={(e) => setOpponentAnalysis(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── 미디어 다이얼로그 ─────────────────────────────────────────────────────────

interface MediaDialogProps {
  analysis: TacticalAnalysis | null
  onClose: () => void
  canUpload: boolean
}

function MediaDialog({ analysis, onClose, canUpload }: MediaDialogProps) {
  const [media, setMedia] = useState<TacticalMedia[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!analysis) return
    // 상세 조회로 미디어 포함 데이터 가져오기
    tacticalApi.get(analysis.id)
      .then((a) => setMedia(a.media ?? []))
      .catch(() => null)
  }, [analysis])

  // 파일 선택 시 미리보기 생성
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

  const handleUpload = async () => {
    if (!analysis || files.length === 0) return
    setUploading(true)
    try {
      const newMedia = await tacticalApi.addMedia(analysis.id, files)
      setMedia((prev) => [...prev, ...newMedia])
      setFiles([])
      setPreviews([])
      toast.success(`${newMedia.length}개 파일이 업로드됐습니다.`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const images = media.filter((m) => m.type === 'image')
  const videos = media.filter((m) => m.type === 'video')

  return (
    <Dialog open={!!analysis} onOpenChange={(v) => { if (!v) { setFiles([]); setPreviews([]); onClose() } }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {analysis
              ? `${analysis.match.homeTeamName} vs ${analysis.match.awayTeamName} — ${PHASE_LABEL[analysis.phase]} 미디어`
              : '미디어'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* 기존 이미지 */}
          {images.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">사진 ({images.length})</p>
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => (
                  <a key={img.id} href={`${API_BASE}${img.url}`} target="_blank" rel="noreferrer">
                    <img
                      src={`${API_BASE}${img.url}`}
                      alt="전술 분석 사진"
                      className="w-full aspect-video object-cover rounded border hover:opacity-80 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 기존 영상 */}
          {videos.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">영상 ({videos.length})</p>
              <div className="space-y-1">
                {videos.map((v) => (
                  <a
                    key={v.id}
                    href={`${API_BASE}${v.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline truncate"
                  >
                    <span className="shrink-0 text-muted-foreground">▶</span>
                    {v.url.split('/').pop()}
                  </a>
                ))}
              </div>
            </div>
          )}

          {media.length === 0 && files.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">등록된 미디어가 없습니다.</p>
          )}

          {/* 업���드 미리보기 */}
          {canUpload && files.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">업로드 예정 ({files.length})</p>
              <div className="space-y-1">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                    {previews[idx] ? (
                      <img src={previews[idx]} alt="" className="h-8 w-12 object-cover rounded shrink-0" />
                    ) : (
                      <span className="text-muted-foreground shrink-0">▶</span>
                    )}
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{MEDIA_TYPE_LABEL[f.type.startsWith('video/') ? 'video' : 'image']}</span>
                    <button onClick={() => removeFile(idx)} className="shrink-0 text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {canUpload && (
          <div className="border-t pt-3 flex gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <Button variant="outline" size="sm" className="flex-1" onClick={() => inputRef.current?.click()}>
              <ImagePlus className="h-4 w-4 mr-1.5" />파일 선택
            </Button>
            <Button size="sm" disabled={files.length === 0 || uploading} onClick={handleUpload}>
              {uploading ? '업로드 중...' : `업로드 (${files.length})`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────────

export function TacticalAnalysisPage() {
  const { user } = useCurrentUser()
  const [analyses, setAnalyses] = useState<TacticalAnalysis[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [mediaTarget, setMediaTarget] = useState<TacticalAnalysis | null>(null)

  const canWrite =
    user?.role === 'ADMIN' ||
    user?.role === 'COACHING_STAFF' ||
    (user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'TACTICAL_ANALYST')

  const canConfirm = user?.role === 'ADMIN' || user?.coachingRole === 'HEAD_COACH'
  const canUploadMedia = user?.role === 'ADMIN' || user?.role === 'COACHING_STAFF'

  const fetchAnalyses = () =>
    tacticalApi
      .list()
      .then(setAnalyses)
      .catch(() => toast.error('전술 분석 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))

  useEffect(() => {
    void fetchAnalyses()
    matchApi.list().then(setMatches).catch(() => null)
  }, [])

  const handleConfirm = async (id: number) => {
    try {
      await tacticalApi.confirm(id)
      toast.success('전술 분석이 확정됐습니다.')
      setAnalyses((prev) => prev.map((a) => a.id === id ? { ...a, status: 'CONFIRMED' } : a))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '확정에 실패했습니다.')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">전술 분석</h1>
          <p className="text-sm text-muted-foreground mt-0.5">경기 전·후 전술 분석 목록</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />전술 등록
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
            등록된 전술 분석이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>경기</TableHead>
                <TableHead className="w-24">시점</TableHead>
                <TableHead className="w-28">포메이션</TableHead>
                <TableHead className="w-20">상태</TableHead>
                <TableHead className="w-24 text-muted-foreground">작성자</TableHead>
                <TableHead className="w-16" />
                {canConfirm && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyses.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="text-sm">
                      {a.match.homeTeamName} vs {a.match.awayTeamName}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(a.match.date)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${PHASE_STYLE[a.phase]}`}>
                      {PHASE_LABEL[a.phase]}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{a.formation ?? '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${STATUS_STYLE[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.createdBy.nickname}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => setMediaTarget(a)}
                      title="미디어"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                  {canConfirm && (
                    <TableCell>
                      {a.status === 'DRAFT' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleConfirm(a.id)}>
                          <Check className="h-3 w-3 mr-1" />확정
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

      <CreateAnalysisDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        matches={matches}
        onSaved={(newId) => {
          setCreateOpen(false)
          setLoading(true)
          void fetchAnalyses().then(() => {
            // 등록 직후 미디어 업로드로 바로 이동
            setAnalyses((prev) => {
              const created = prev.find((a) => a.id === newId)
              if (created) setMediaTarget(created)
              return prev
            })
          })
        }}
      />

      <MediaDialog
        analysis={mediaTarget}
        onClose={() => setMediaTarget(null)}
        canUpload={canUploadMedia}
      />
    </div>
  )
}
