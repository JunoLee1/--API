import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { playerApi } from '@/services/player.service'
import type { PlayerDetail, PlayerStatus, PositionZone } from '@/types/player'
import {
  POSITION_ABBR,
  POSITION_LABEL,
  POSITION_ZONE,
  LEVEL_LABEL,
  STATUS_LABEL,
} from '@/types/player'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ArrowLeft, Pencil, ShieldAlert, Trash2 } from 'lucide-react'
import { useConfirm } from '@/lib/confirm-dialog'
import { PlayerFormDialog } from './PlayerFormDialog'
import { PlayerStatusDialog } from './PlayerStatusDialog'

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

  const confirm = useConfirm()
  const canWrite = user?.role === 'ADMIN' || user?.role === 'FRONT_OFFICE'
  const canChangeStatus = user?.role === 'ADMIN'

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

      <div className="flex-1 overflow-auto p-6">
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
        </div>
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
