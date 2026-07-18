import { useNavigate } from 'react-router-dom'
import type { Player } from '@/types/player'
import { POSITION_ABBR } from '@/types/player'
import type { SlotDef } from './formation-layouts'

const DRAG_KEY = 'text/squad-player'

interface FormationSlotProps {
  slotDef: SlotDef
  placedPlayer: Player | null
  suggestedPlayer: Player | null
  onConfirmSuggestion: (slotKey: string, playerId: string) => void
  onDrop: (toSlotKey: string, playerId: string, fromSlotKey: string | null) => void
  onRemove: (slotKey: string) => void
}

export function FormationSlot({
  slotDef,
  placedPlayer,
  suggestedPlayer,
  onConfirmSuggestion,
  onDrop,
  onRemove,
}: FormationSlotProps) {
  const navigate = useNavigate()
  const style = {
    position: 'absolute' as const,
    top: `${slotDef.top}%`,
    left: `${slotDef.left}%`,
    transform: 'translate(-50%, -50%)',
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData(DRAG_KEY)
    if (!raw) return
    const { playerId, fromSlotKey } = JSON.parse(raw) as { playerId: string; fromSlotKey: string | null }
    onDrop(slotDef.key, playerId, fromSlotKey)
  }

  // 채워진 슬롯
  if (placedPlayer) {
    return (
      <div
        style={style}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ playerId: placedPlayer.id, fromSlotKey: slotDef.key }))
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDoubleClick={() => onRemove(slotDef.key)}
        title="드래그로 이동 / 더블클릭으로 해제"
        className="flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing z-10"
      >
        <div className="bg-green-800/90 border-2 border-green-400 rounded-full px-2 py-1 text-white text-[10px] font-bold whitespace-nowrap shadow-lg">
          {POSITION_ABBR[placedPlayer.position]}
        </div>
        <div className="bg-green-900/80 border border-green-500/60 rounded px-1.5 py-0.5 text-white text-[9px] whitespace-nowrap max-w-[64px] truncate shadow">
          {placedPlayer.playerName}
        </div>
      </div>
    )
  }

  // 제안 슬롯 (큐 1순위)
  if (suggestedPlayer) {
    return (
      <div
        style={style}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => onConfirmSuggestion(slotDef.key, suggestedPlayer.id)}
        title={`${suggestedPlayer.playerName} 배치 확정`}
        className="flex flex-col items-center gap-0.5 cursor-pointer opacity-60 hover:opacity-90 transition-opacity z-10"
      >
        <div className="bg-green-800/50 border-2 border-dashed border-green-400/70 rounded-full px-2 py-1 text-white/80 text-[10px] font-bold whitespace-nowrap shadow">
          {POSITION_ABBR[suggestedPlayer.position]}
        </div>
        <div className="bg-green-900/40 border border-dashed border-green-500/40 rounded px-1.5 py-0.5 text-white/70 text-[9px] whitespace-nowrap max-w-[64px] truncate">
          {suggestedPlayer.playerName}
        </div>
      </div>
    )
  }

  // 빈 슬롯 (Void)
  return (
    <div
      style={style}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => navigate(`/prospects?position=${slotDef.position}`)}
      title={`${POSITION_ABBR[slotDef.position]} 영입 후보 찾기`}
      className="flex flex-col items-center gap-0.5 cursor-pointer z-10 group"
    >
      <div className="bg-red-900/40 border-2 border-dashed border-red-500 rounded-full w-10 h-10 flex items-center justify-center shadow group-hover:bg-red-900/60 transition-colors">
        <span className="text-red-300 text-xs font-bold">?</span>
      </div>
      <div className="bg-red-900/30 border border-dashed border-red-500/60 rounded px-1.5 py-0.5 text-red-300 text-[9px] font-semibold">
        {POSITION_ABBR[slotDef.position]}
      </div>
    </div>
  )
}
