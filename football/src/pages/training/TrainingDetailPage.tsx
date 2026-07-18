import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { trainingApi } from '@/services/training.service'
import type { TrainingSessionDetail } from '@/types/training'
import {
  SESSION_TYPE_LABEL,
  SESSION_TYPE_STYLE,
  PHASE_LABEL,
  ATTENDANCE_LABEL,
  ATTENDANCE_STYLE,
} from '@/types/training'
import { trainingReferenceApi } from '@/services/training-reference.service'
import type { TrainingReference, ReferenceSource } from '@/types/training-reference'
import { REFERENCE_SOURCE_LABEL } from '@/types/training-reference'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, CheckCircle, Clock, ExternalLink, Trash2, Plus } from 'lucide-react'
import { POSITION_ABBR, POSITION_ZONE } from '@/types/player'
import type { Position } from '@/types/player'

const ZONE_ABBR_STYLE: Record<string, string> = {
  GK: 'bg-amber-100 text-amber-800 border-amber-200',
  DEF: 'bg-blue-100 text-blue-800 border-blue-200',
  MID: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  FWD: 'bg-rose-100 text-rose-800 border-rose-200',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function TrainingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [session, setSession] = useState<TrainingSessionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const canApprove = user?.role === 'ADMIN' || user?.coachingRole === 'HEAD_COACH'
  const canAddRef = user?.role === 'ADMIN' || user?.role === 'COACHING_STAFF'

  const [refs, setRefs] = useState<TrainingReference[]>([])
  const [refLoading, setRefLoading] = useState(false)
  const [newRefTitle, setNewRefTitle] = useState('')
  const [newRefUrl, setNewRefUrl] = useState('')
  const [newRefSource, setNewRefSource] = useState<ReferenceSource>('EXTERNAL')
  const [newRefTags, setNewRefTags] = useState('')
  const [addingRef, setAddingRef] = useState(false)

  const fetchRefs = (s: TrainingSessionDetail) => {
    trainingReferenceApi.list({ sessionType: s.sessionType })
      .then(setRefs)
      .catch(() => null)
  }

  useEffect(() => {
    if (!id) return
    trainingApi.get(Number(id))
      .then((s) => { setSession(s); fetchRefs(s) })
      .catch(() => toast.error('훈련 세션을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleApprove = async () => {
    if (!session) return
    try {
      await trainingApi.approve(session.id)
      toast.success('승인됐습니다.')
      setSession((prev) => prev ? { ...prev, isApproved: true } : prev)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '승인에 실패했습니다.')
    }
  }

  if (loading) {
    return <div className="p-6 space-y-4 max-w-3xl"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <p className="text-sm">훈련 세션을 찾을 수 없습니다.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate('/training')}>목록으로</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/training')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        {canApprove && !session.isApproved && (
          <Button size="sm" onClick={handleApprove}>승인</Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* 헤더 카드 */}
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${SESSION_TYPE_STYLE[session.sessionType]}`}>
                    {SESSION_TYPE_LABEL[session.sessionType]}
                  </span>
                  {session.isApproved
                    ? <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle className="h-3.5 w-3.5" />승인됨</span>
                    : <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />미승인</span>}
                </div>
                <p className="mt-2 font-semibold text-base">{session.goal}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{formatDate(session.date)}</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* 세션 구성 */}
            {session.contents.length > 0 && (
              <div className="rounded-lg border bg-card p-5">
                <h3 className="text-sm font-semibold mb-2">세션 구성</h3>
                <Separator className="mb-2" />
                <div className="space-y-2">
                  {session.contents.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0 self-start mt-0.5">
                        {PHASE_LABEL[c.phase]}
                      </span>
                      <p className="text-sm">{c.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 참가자 */}
            {session.participants.length > 0 && (
              <div className="rounded-lg border bg-card p-5">
                <h3 className="text-sm font-semibold mb-2">참가 선수 ({session.participants.length}명)</h3>
                <Separator className="mb-2" />
                <div className="space-y-1.5">
                  {session.participants.map((p) => {
                    const pos = p.player.position as Position
                    const zone = POSITION_ZONE[pos]
                    return (
                      <div key={p.playerId} className="flex items-center gap-2">
                        <span className={`inline-flex rounded border px-1 py-0.5 text-[10px] font-mono font-semibold ${ZONE_ABBR_STYLE[zone]}`}>
                          {POSITION_ABBR[pos]}
                        </span>
                        <span className="text-sm">{p.player.playerName}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 결과 / 출석 */}
          {session.results.length > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-2">출석 · 평가</h3>
              <Separator className="mb-2" />
              <div className="space-y-2">
                {session.results.map((r) => {
                  const participant = session.participants.find((p) => p.playerId === r.playerId)
                  return (
                    <div key={r.id} className="flex items-center gap-3 py-1">
                      <span className="text-sm font-medium w-28 truncate">
                        {participant?.player.playerName ?? r.playerId}
                      </span>
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${ATTENDANCE_STYLE[r.attendance]}`}>
                        {ATTENDANCE_LABEL[r.attendance]}
                      </span>
                      {r.performanceScore != null && (
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {r.performanceScore}점
                        </span>
                      )}
                      {r.feedback && (
                        <span className="text-sm text-muted-foreground truncate">{r.feedback}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 훈련 레퍼런스 */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">훈련 레퍼런스</h3>
              {canAddRef && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddingRef(v => !v)}>
                  <Plus className="h-3 w-3 mr-1" />추가
                </Button>
              )}
            </div>

            {addingRef && (
              <div className="space-y-2 border-t pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">제목 *</Label>
                    <Input value={newRefTitle} onChange={e => setNewRefTitle(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">URL *</Label>
                    <Input value={newRefUrl} onChange={e => setNewRefUrl(e.target.value)} className="h-8 text-sm" placeholder="https://" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">출처</Label>
                    <Select
                      value={newRefSource}
                      onValueChange={v => setNewRefSource(v as ReferenceSource)}
                      items={REFERENCE_SOURCE_LABEL}
                    >
                      <SelectTrigger className="h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(REFERENCE_SOURCE_LABEL) as ReferenceSource[]).map(s => (
                          <SelectItem key={s} value={s}>{REFERENCE_SOURCE_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">태그 (쉼표 구분)</Label>
                    <Input value={newRefTags} onChange={e => setNewRefTags(e.target.value)} className="h-8 text-sm" placeholder="압박, 빌드업" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddingRef(false)}>취소</Button>
                  <Button size="sm" className="h-7 text-xs" disabled={refLoading} onClick={async () => {
                    if (!newRefTitle.trim() || !newRefUrl.trim()) return
                    setRefLoading(true)
                    try {
                      await trainingReferenceApi.create({
                        sessionType: session.sessionType,
                        title: newRefTitle.trim(),
                        url: newRefUrl.trim(),
                        source: newRefSource,
                        tags: newRefTags.split(',').map(t => t.trim()).filter(Boolean),
                      })
                      setNewRefTitle(''); setNewRefUrl(''); setNewRefTags(''); setAddingRef(false)
                      fetchRefs(session)
                      toast.success('레퍼런스가 등록됐습니다.')
                    } catch { toast.error('등록에 실패했습니다.') }
                    finally { setRefLoading(false) }
                  }}>등록</Button>
                </div>
              </div>
            )}

            {refs.length === 0 ? (
              <p className="text-xs text-muted-foreground">등록된 레퍼런스가 없습니다.</p>
            ) : (
              <ul className="space-y-1.5">
                {refs.map(r => (
                  <li key={r.id} className="flex items-start gap-2 text-sm">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline flex-1 min-w-0">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{r.title}</span>
                    </a>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">{REFERENCE_SOURCE_LABEL[r.source]}</span>
                      {r.tags.map(t => (
                        <span key={t} className="text-xs border rounded px-1">{t}</span>
                      ))}
                      {canAddRef && (user?.id === r.addedBy.id || user?.role === 'ADMIN') && (
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={async () => {
                          await trainingReferenceApi.delete(r.id)
                          fetchRefs(session)
                        }}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
