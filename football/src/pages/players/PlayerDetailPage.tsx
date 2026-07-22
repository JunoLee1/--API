import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { playerApi } from '@/services/player.service'
import type { PlayerDetail, PlayerStatus, PositionZone, TransferType, MarketValueEntry } from '@/types/player'
import {
  POSITION_ABBR,
  POSITION_LABEL,
  POSITION_ZONE,
  LEVEL_LABEL,
  STATUS_LABEL,
} from '@/types/player'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ArrowLeft, Pencil, ShieldAlert, Trash2, TrendingUp } from 'lucide-react'
import { useConfirm } from '@/lib/confirm-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlayerFormDialog } from './PlayerFormDialog'
import { PlayerStatusDialog } from './PlayerStatusDialog'
import { PlayerDevelopmentPlanTab } from './PlayerDevelopmentPlanTab'
import { StatsTab } from './tabs/StatsTab'
import { JerseyTab } from './tabs/JerseyTab'
import { MotivationTab } from './tabs/MotivationTab'
import { PositionDiversityChart } from '@/components/players/PositionDiversityChart'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const ZONE_STYLE: Record<PositionZone, { badge: string; avatar: string }> = {
  GK: { badge: 'bg-amber-100 text-amber-800 border-amber-300', avatar: 'bg-amber-100 text-amber-800' },
  DEF: { badge: 'bg-blue-100 text-blue-800 border-blue-300', avatar: 'bg-blue-100 text-blue-800' },
  MID: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', avatar: 'bg-emerald-100 text-emerald-800' },
  FWD: { badge: 'bg-rose-100 text-rose-800 border-rose-300', avatar: 'bg-rose-100 text-rose-800' },
}

const STATUS_STYLE: Record<PlayerStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  ON_LOAN: 'bg-purple-100 text-purple-800 border-purple-200',
  RELEASED: 'bg-gray-100 text-gray-600 border-gray-200',
  RETIRED: 'bg-gray-100 text-gray-500 border-gray-200',
}

function calcAge(dateOfBirth: string): number {
  const birth = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatSalary(salary: number): string {
  if (salary >= 100_000_000) return `${(salary / 100_000_000).toFixed(1)}억원`
  if (salary >= 10_000) return `${(salary / 10_000).toFixed(0)}만원`
  return `${salary.toLocaleString()}원`
}

function fmtMv(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`
  return String(v)
}

function fmtMvTick(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(0)}억`
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`
  return String(v)
}

const TRANSFER_TYPE_LABEL: Record<TransferType, string> = {
  PERMANENT: '완전 이적',
  LOAN_OUT: '임대 출신',
  LOAN_IN: '임대 영입',
  FREE: '자유 계약',
  RELEASE: '방출',
}

interface StatRowProps {
  label: string
  value: string | number
}
function StatRow({ label, value }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [player, setPlayer] = useState<PlayerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  const [mvHistory, setMvHistory] = useState<MarketValueEntry[]>([])
  const [mvInput, setMvInput] = useState('')
  const [mvSaving, setMvSaving] = useState(false)

  const confirm = useConfirm()
  const canWrite = user?.role === 'ADMIN' || user?.role === 'FRONT_OFFICE'
  const canChangeStatus = user?.role === 'ADMIN'
  const isOwnProfile = user?.role === 'PLAYER' && player?.userId === user?.id
  const canSeeMarketValue =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' && (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'TD'))
  const canUpdateMarketValue = canSeeMarketValue
  const canAssignJersey = user?.role === 'ADMIN' || user?.role === 'FRONT_OFFICE'
  const canRetireJersey =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' && (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'TD'))
  const canReactivateJersey = user?.role === 'ADMIN'

  const handleDelete = async () => {
    if (!player) return
    const ok = await confirm({
      title: '선수 삭제',
      description: `${player.playerName} 선수를 완전히 삭제합니다. 이 작업은 되돌릴 수 없습니다.`,
      confirmText: '삭제',
    })
    if (!ok) return
    try {
      await playerApi.delete(player.id)
      toast.success('선수가 삭제됐습니다.')
      navigate('/players')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  const fetchPlayer = () => {
    if (!id) return
    setLoading(true)
    playerApi
      .get(id)
      .then(setPlayer)
      .catch(() => toast.error('선수 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPlayer()
  }, [id])

  useEffect(() => {
    if (!id || !canSeeMarketValue) return
    playerApi.getMarketValueHistory(id).then(setMvHistory).catch(() => null)
  }, [id, canSeeMarketValue])

  const handleMvUpdate = async () => {
    if (!id || !mvInput) return
    const val = Number(mvInput.replace(/[^0-9]/g, ''))
    if (!val || val <= 0) { toast.error('올바른 금액을 입력해주세요.'); return }
    setMvSaving(true)
    try {
      await playerApi.updateMarketValue(id, val)
      toast.success('시장가치가 업데이트됐습니다.')
      setMvInput('')
      fetchPlayer()
      playerApi.getMarketValueHistory(id).then(setMvHistory).catch(() => null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '업데이트에 실패했습니다.')
    } finally {
      setMvSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <p className="text-sm">선수를 찾을 수 없습니다.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate('/players')}>
          목록으로
        </Button>
      </div>
    )
  }

  const zone = POSITION_ZONE[player.position]
  const zoneStyle = ZONE_STYLE[zone]
  const latestContract = player.contracts[0] ?? null

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate('/players')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        {canWrite && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            정보 수정
          </Button>
        )}
        {canChangeStatus && (
          <Button variant="outline" size="sm" onClick={() => setStatusOpen(true)}>
            <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
            상태 변경
          </Button>
        )}
        {user?.role === 'ADMIN' && (
          <Button variant="destructive" size="sm" onClick={() => void handleDelete()}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            삭제
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <Tabs defaultValue="info" className="h-full flex flex-col">
          <div className="px-6 pt-4 border-b shrink-0">
            <TabsList>
              <TabsTrigger value="info">기본 정보</TabsTrigger>
              <TabsTrigger value="stats">스탯</TabsTrigger>
              <TabsTrigger value="jersey">등번호</TabsTrigger>
              {isOwnProfile && <TabsTrigger value="motivation">동기부여</TabsTrigger>}
              <TabsTrigger value="pdp">발전 계획</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="info" className="flex-1 overflow-auto p-6 mt-0">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* 프로필 카드 */}
              <div className="rounded-lg border bg-card p-5 flex items-start gap-5">
                <Avatar className={`h-16 w-16 text-xl font-semibold ${zoneStyle.avatar}`}>
                  <AvatarFallback className={zoneStyle.avatar}>
                    {player.playerName.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold tracking-tight">{player.playerName}</h2>
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-mono font-bold ${zoneStyle.badge}`}
                    >
                      {POSITION_ABBR[player.position]}
                    </span>
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${STATUS_STYLE[player.status]}`}
                    >
                      {STATUS_LABEL[player.status]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{POSITION_LABEL[player.position]}</p>
                  {player.playStyle ? (
                    <span className="inline-flex items-center text-xs bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full mt-1">
                      {player.playStyle}
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs text-muted-foreground mt-1">미분류</span>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <span>{player.nationality.name}</span>
                    <span>·</span>
                    <span>{LEVEL_LABEL[player.level]}</span>
                    <span>·</span>
                    <span>{calcAge(player.dateOfBirth)}세</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 신체 정보 */}
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-1">신체 정보</h3>
                  <Separator className="mb-1" />
                  <StatRow label="생년월일" value={formatDate(player.dateOfBirth)} />
                  <Separator />
                  <StatRow label="나이" value={`${calcAge(player.dateOfBirth)}세`} />
                  <Separator />
                  <StatRow label="신장" value={`${player.height} cm`} />
                  <Separator />
                  <StatRow label="체중" value={`${player.weight} kg`} />
                  <Separator />
                  <StatRow label="주발" value={player.preferredFoot === 'LEFT' ? '왼발' : '오른발'} />
                  {player.externalId && (
                    <>
                      <Separator />
                      <StatRow label="외부 ID" value={player.externalId} />
                    </>
                  )}
                  {canSeeMarketValue && (
                    <>
                      <Separator />
                      <StatRow
                        label="시장가치"
                        value={
                          player.currentMarketValue != null
                            ? formatSalary(player.currentMarketValue)
                            : '—'
                        }
                      />
                    </>
                  )}
                </div>

                {/* 최근 계약 */}
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-1">최근 계약</h3>
                  <Separator className="mb-1" />
                  {latestContract ? (
                    <>
                      <StatRow label="계약 시작" value={formatDate(latestContract.startDate)} />
                      <Separator />
                      <StatRow label="계약 만료" value={formatDate(latestContract.endDate)} />
                      <Separator />
                      <StatRow label="연봉" value={formatSalary(latestContract.salary)} />
                      <Separator />
                      <StatRow label="계약 상태" value={latestContract.status} />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      등록된 계약이 없습니다.
                    </p>
                  )}
                </div>
              </div>

              {/* 이적 이력 */}
              {player.transfers.length > 0 && (
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-1">이적 이력</h3>
                  <Separator className="mb-1" />
                  <div className="space-y-0">
                    {player.transfers.map((t, i) => (
                      <div key={t.id}>
                        {i > 0 && <Separator />}
                        <div className="flex items-center justify-between py-2.5 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">
                              {TRANSFER_TYPE_LABEL[t.type]}
                            </span>
                            <span className="text-sm text-muted-foreground truncate">
                              {t.fromClub && t.toClub
                                ? `${t.fromClub} → ${t.toClub}`
                                : t.fromClub ?? t.toClub ?? '—'}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-medium">
                              {t.fee != null ? formatSalary(t.fee) : '비공개'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(t.date)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 시장가치 추이 */}
              {canSeeMarketValue && (
                <div className="rounded-lg border bg-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      시장가치 추이
                    </h3>
                    {canUpdateMarketValue && (
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          placeholder="금액 (원)"
                          value={mvInput}
                          onChange={(e) => setMvInput(e.target.value)}
                          className="h-7 w-32 text-xs"
                          onKeyDown={(e) => { if (e.key === 'Enter') void handleMvUpdate() }}
                        />
                        <Button
                          size="sm"
                          className="h-7 text-xs px-2"
                          disabled={mvSaving || !mvInput}
                          onClick={() => void handleMvUpdate()}
                        >
                          {mvSaving ? '저장 중' : '업데이트'}
                        </Button>
                      </div>
                    )}
                  </div>
                  {mvHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      시장가치 이력이 없습니다.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart
                        data={[...mvHistory].reverse().map((e) => ({
                          date: new Date(e.recordedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' }),
                          value: e.value,
                          label: fmtMv(e.value),
                        }))}
                        margin={{ top: 8, right: 12, bottom: 0, left: 8 }}
                      >
                        <defs>
                          <linearGradient id="mvGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis
                          tickFormatter={fmtMvTick}
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          tickLine={false}
                          axisLine={false}
                          width={40}
                        />
                        <Tooltip
                          formatter={(v: number) => [fmtMv(v), '시장가치']}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#2563eb"
                          strokeWidth={2}
                          fill="url(#mvGrad)"
                          dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
              {/* 포지션 다양성 지수 (유스 전용) */}
              {player.team?.type === 'YOUTH' && (
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">포지션 다양성 지수</h3>
                  <PositionDiversityChart playerId={player.id} />
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="pdp" className="flex-1 overflow-auto mt-0">
            <PlayerDevelopmentPlanTab playerId={player.id} />
          </TabsContent>
          <TabsContent value="stats" className="flex-1 overflow-auto mt-0">
            <StatsTab playerId={player.id} />
          </TabsContent>
          <TabsContent value="jersey" className="flex-1 overflow-auto mt-0">
            <JerseyTab
              playerId={player.id}
              teamId={player.teamId ?? null}
              canAssign={canAssignJersey}
              canRetire={canRetireJersey}
              canReactivate={canReactivateJersey}
            />
          </TabsContent>
          {isOwnProfile && (
            <TabsContent value="motivation" className="flex-1 overflow-auto mt-0">
              <MotivationTab playerId={player.id} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {canWrite && (
        <PlayerFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          player={player}
          onSaved={() => {
            setEditOpen(false)
            fetchPlayer()
          }}
        />
      )}
      {canChangeStatus && (
        <PlayerStatusDialog
          open={statusOpen}
          onOpenChange={setStatusOpen}
          player={player}
          onSaved={() => {
            setStatusOpen(false)
            fetchPlayer()
          }}
        />
      )}
    </div>
  )
}
