import { useTranslation } from 'react-i18next'
import type { Player } from '@/types/player'
import { POSITION_ABBR, POSITION_ZONE } from '@/types/player'
import type { InjuryStatus } from '@/types/injury'

const DRAG_KEY = 'text/squad-player'

const ZONE_ORDER = ['GK', 'DEF', 'MID', 'FWD'] as const

interface InjuredPlayer {
  playerId: string
  status: InjuryStatus
}

interface PlayerBenchProps {
  availablePlayers: Player[]
  placedIds: Set<string>
  injuredPlayers: InjuredPlayer[]
  allPlayers: Player[]
  onBenchDrop: (playerId: string, fromSlotKey: string) => void
}

function PlayerChip({
  player,
  draggable: isDraggable,
  dim,
}: {
  player: Player
  draggable: boolean
  dim?: boolean
}) {
  return (
    <div
      draggable={isDraggable}
      onDragStart={isDraggable ? (e) => {
        e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ playerId: player.id, fromSlotKey: null }))
        e.dataTransfer.effectAllowed = 'move'
      } : undefined}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors ${
        dim
          ? 'bg-muted/30 border-border/30 text-muted-foreground cursor-not-allowed'
          : isDraggable
          ? 'bg-card border-border hover:border-green-500 cursor-grab active:cursor-grabbing'
          : 'bg-card border-border text-muted-foreground cursor-default'
      }`}
    >
      <span className="font-mono text-[10px] w-7 text-center shrink-0 text-muted-foreground">
        {POSITION_ABBR[player.position]}
      </span>
      <span className="truncate flex-1">{player.playerName}</span>
    </div>
  )
}

export function PlayerBench({
  availablePlayers,
  placedIds,
  injuredPlayers,
  allPlayers,
  onBenchDrop,
}: PlayerBenchProps) {
  const { t } = useTranslation('squad')
  const unplaced = availablePlayers.filter((p) => !placedIds.has(p.id))
  const injuredIds = new Set(injuredPlayers.map((i) => i.playerId))
  const injuredFullPlayers = allPlayers.filter((p) => injuredIds.has(p.id))

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData(DRAG_KEY)
    if (!raw) return
    const { playerId, fromSlotKey } = JSON.parse(raw) as { playerId: string; fromSlotKey: string | null }
    if (fromSlotKey) onBenchDrop(playerId, fromSlotKey)
  }

  return (
    <div
      className="flex flex-col h-full border-l bg-card overflow-y-auto"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="px-3 py-2 border-b shrink-0">
        <p className="text-xs font-semibold text-foreground">{t('bench.title')}</p>
        <p className="text-[10px] text-muted-foreground">{t('bench.unplacedCount', { count: unplaced.length })}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {ZONE_ORDER.map((zone) => {
          const zonePlayers = unplaced.filter((p) => POSITION_ZONE[p.position] === zone)
          if (zonePlayers.length === 0) return null
          return (
            <div key={zone}>
              <p className="text-[10px] font-semibold text-muted-foreground px-1 mb-1">
                {t(`zone.${zone}`)}
              </p>
              <div className="space-y-1">
                {zonePlayers.map((p) => (
                  <PlayerChip key={p.id} player={p} draggable />
                ))}
              </div>
            </div>
          )
        })}

        {injuredFullPlayers.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-red-400 px-1 mb-1">{t('bench.injured')}</p>
            <div className="space-y-1">
              {injuredFullPlayers.map((p) => (
                <PlayerChip key={p.id} player={p} draggable={false} dim />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
