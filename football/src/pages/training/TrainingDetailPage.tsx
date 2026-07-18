import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { trainingApi } from '@/services/training.service'
import type { TrainingSessionDetail, AttendanceStatus } from '@/types/training'
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
import { trainingLoadApi } from '@/services/training-load.service'
import type { TrainingLoad } from '@/types/training-load'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, CheckCircle, Clock, ExternalLink, Trash2, Plus, Save } from 'lucide-react'
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
  const canScore = user?.role === 'ADMIN' || user?.role === 'COACHING_STAFF'

  type ResultInput = { attendance: AttendanceStatus; performanceScore: string; feedback: string }
  const [resultInputs, setResultInputs] = useState<Record<string, ResultInput>>({})
  const [saving, setSaving] = useState(false)

  const [loads, setLoads] = useState<TrainingLoad[]>([])
  const [loadInputs, setLoadInputs] = useState<Record<string, { rpe: string; load: string }>>({})

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
      .then((s) => {
        setSession(s)
        fetchRefs(s)
        trainingLoadApi.list({ sessionId: Number(id) }).then(setLoads).catch(() => null)
        const init: Record<string, ResultInput> = {}
        for (const p of s.participants) {
          const existing = s.results.find((r) => r.playerId === p.playerId)
          init[p.playerId] = {
            attendance: existing?.attendance ?? 'PRESENT',
            performanceScore: existing?.performanceScore != null ? String(existing.performanceScore) : '',
            feedback: existing?.feedback ?? '',
          }
        }
        setResultInputs(init)
      })
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

  const handleSaveAll = async () => {
    if (!session) return
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(resultInputs).map(([playerId, input]) =>
          trainingApi.upsertResult(session.id, {
            playerId,
            attendance: input.attendance,
            ...(input.performanceScore !== '' ? { performanceScore: Number(input.performanceScore) } : {}),
            ...(input.feedback.trim() !== '' ? { feedback: input.feedback.trim() } : {}),
          })
        )
      )
      toast.success('평가가 저장됐습니다.')
      const updated = await trainingApi.get(session.id)
      setSession(updated)
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
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
        {canScore && Object.keys(resultInputs).length > 0 && (
          <Button size="sm" variant="outline" onClick={handleSaveAll} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1" />{saving ? '저장 중...' : '평가 저장'}
          </Button>
        )}
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

          {/* 출석 · 평가 */}
          {session.participants.length > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3">
                출석 · 평가
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {session.participants.length}명
                </span>
              </h3>
              <Separator className="mb-3" />
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-8" />
                    <TableHead>선수</TableHead>
                    <TableHead className="w-36">출석</TableHead>
                    <TableHead className="w-24 text-center">점수 (1–10)</TableHead>
                    <TableHead>피드백</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.participants.map((p) => {
                    const pos = p.player.position as Position
                    const zone = POSITION_ZONE[pos]
                    const input = resultInputs[p.playerId]
                    const hasResult = session.results.some((r) => r.playerId === p.playerId)
                    return (
                      <TableRow key={p.playerId}>
                        <TableCell>
                          <span className={`inline-flex rounded border px-1 py-0.5 text-[10px] font-mono font-semibold ${ZONE_ABBR_STYLE[zone]}`}>
                            {POSITION_ABBR[pos]}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {p.player.playerName}
                          {hasResult && <span className="ml-1.5 text-[10px] text-green-600">●</span>}
                        </TableCell>
                        <TableCell>
                          {canScore && input ? (
                            <Select
                              value={input.attendance}
                              onValueChange={(v) =>
                                setResultInputs((prev) => ({
                                  ...prev,
                                  [p.playerId]: { ...prev[p.playerId]!, attendance: v as AttendanceStatus },
                                }))
                              }
                            >
                              <SelectTrigger className="h-7 text-xs w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((s) => (
                                  <SelectItem key={s} value={s}>{ATTENDANCE_LABEL[s]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            input && (
                              <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${ATTENDANCE_STYLE[input.attendance]}`}>
                                {ATTENDANCE_LABEL[input.attendance]}
                              </span>
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {canScore && input ? (
                            <Input
                              type="number" min={1} max={10}
                              className="w-16 h-7 text-center text-sm mx-auto"
                              value={input.performanceScore}
                              onChange={(e) =>
                                setResultInputs((prev) => ({
                                  ...prev,
                                  [p.playerId]: { ...prev[p.playerId]!, performanceScore: e.target.value },
                                }))
                              }
                            />
                          ) : (
                            <span className="tabular-nums text-sm">
                              {input?.performanceScore || '—'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {canScore && input ? (
                            <Input
                              className="h-7 text-sm"
                              placeholder="피드백 (선택)"
                              value={input.feedback}
                              onChange={(e) =>
                                setResultInputs((prev) => ({
                                  ...prev,
                                  [p.playerId]: { ...prev[p.playerId]!, feedback: e.target.value },
                                }))
                              }
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground">{input?.feedback || '—'}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* 훈련 부하 */}
          {session.participants.length > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-2">훈련 부하</h3>
              <Separator className="mb-2" />
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>선수</TableHead>
                    <TableHead className="w-28 text-center">RPE (1–10)</TableHead>
                    <TableHead className="w-28 text-center">부하</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.participants.map((p) => {
                    const existing = loads.find((l) => l.playerId === p.playerId)
                    const input = loadInputs[p.playerId] ?? {
                      rpe: existing ? String(existing.rpe) : '',
                      load: existing?.load != null ? String(existing.load) : '',
                    }
                    const isOwnRpe = user?.role === 'PLAYER' && String(user.id) === p.playerId
                    const canSetLoad =
                      user?.role === 'ADMIN' ||
                      user?.coachingRole === 'PHYSICAL_COACH' ||
                      user?.coachingRole === 'HEAD_COACH'
                    return (
                      <TableRow key={p.playerId}>
                        <TableCell className="font-medium">{p.player.playerName}</TableCell>
                        <TableCell className="text-center">
                          {isOwnRpe ? (
                            <Input
                              type="number" min={1} max={10}
                              className="w-16 h-7 text-center text-sm"
                              value={input.rpe}
                              onChange={(e) =>
                                setLoadInputs((prev) => ({
                                  ...prev,
                                  [p.playerId]: { ...input, rpe: e.target.value },
                                }))
                              }
                            />
                          ) : (
                            <span className="tabular-nums text-sm">{existing?.rpe ?? '—'}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {canSetLoad ? (
                            <Input
                              type="number" min={0}
                              className="w-20 h-7 text-center text-sm"
                              value={input.load}
                              onChange={(e) =>
                                setLoadInputs((prev) => ({
                                  ...prev,
                                  [p.playerId]: { ...input, load: e.target.value },
                                }))
                              }
                            />
                          ) : (
                            <span className="tabular-nums text-sm">{existing?.load ?? '—'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(isOwnRpe || canSetLoad) && (
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs"
                              onClick={async () => {
                                try {
                                  const payload: {
                                    playerId: string
                                    sessionId: number
                                    rpe?: number
                                    load?: number
                                  } = { playerId: p.playerId, sessionId: session.id }
                                  if (isOwnRpe && input.rpe) payload.rpe = Number(input.rpe)
                                  if (canSetLoad && input.load) payload.load = Number(input.load)
                                  await trainingLoadApi.upsert(payload)
                                  toast.success('저장됐습니다.')
                                  const updated = await trainingLoadApi.list({ sessionId: session.id })
                                  setLoads(updated)
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : '저장 실패')
                                }
                              }}
                            >
                              저장
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
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
