import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { playerApi } from '@/services/player.service'
import { injuryApi } from '@/services/injury.service'
import { tacticalApi } from '@/services/tactical.service'
import type { Player } from '@/types/player'
import type { InjuryStatus } from '@/types/injury'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FootballPitch } from '@/components/squad/FootballPitch'
import { FormationSlot } from '@/components/squad/FormationSlot'
import { PlayerBench } from '@/components/squad/PlayerBench'
import {
  FORMATION_LAYOUTS,
  SUPPORTED_FORMATIONS,
  type SupportedFormation,
} from '@/components/squad/formation-layouts'
import { getCandidates, buildInitialPlacement } from '@/components/squad/squad-utils'

type ViewMode = 'formation' | 'grid'

interface ActiveInjury {
  playerId: string
  status: InjuryStatus
}

export function SquadPlannerPage() {
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [activeInjuries, setActiveInjuries] = useState<ActiveInjury[]>([])
  const [formation, setFormation] = useState<SupportedFormation>('4-3-3')
  const [viewMode, setViewMode] = useState<ViewMode>('formation')
  const [placement, setPlacement] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)

  const injuredIds = useMemo(
    () => new Set(activeInjuries.map((i) => i.playerId)),
    [activeInjuries],
  )

  const availablePlayers = useMemo(
    () => allPlayers.filter(
      (p) => p.status === 'ACTIVE' && p.level !== 'YOUTH' && !injuredIds.has(p.id),
    ),
    [allPlayers, injuredIds],
  )

  useEffect(() => {
    Promise.all([
      playerApi.list({ status: 'ACTIVE' }),
      injuryApi.active(),
      tacticalApi.list(),
    ])
      .then(([players, injuries, analyses]) => {
        setAllPlayers(players)
        setActiveInjuries(injuries)
        const lastFormation = analyses[0]?.formation
        const supported = SUPPORTED_FORMATIONS.find((f) => f === lastFormation)
        if (supported) setFormation(supported)
      })
      .catch(() => toast.error('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading) {
      const slots = FORMATION_LAYOUTS[formation]
      setPlacement(buildInitialPlacement(slots, availablePlayers))
    }
  }, [formation, loading, availablePlayers])

  const slots = FORMATION_LAYOUTS[formation]

  const placedIds = useMemo(
    () => new Set(Object.values(placement).filter((id): id is string => id !== null)),
    [placement],
  )

  const handleConfirmSuggestion = (slotKey: string, playerId: string) => {
    setPlacement((prev) => ({ ...prev, [slotKey]: playerId }))
  }

  const handleDrop = (toSlotKey: string, playerId: string, fromSlotKey: string | null) => {
    setPlacement((prev) => {
      const next = { ...prev }
      if (fromSlotKey) {
        const displaced = next[toSlotKey] ?? null
        next[toSlotKey] = playerId
        next[fromSlotKey] = displaced
      } else {
        next[toSlotKey] = playerId
      }
      return next
    })
  }

  const handleRemove = (slotKey: string) => {
    setPlacement((prev) => ({ ...prev, [slotKey]: null }))
  }

  const handleBenchDrop = (_playerId: string, fromSlotKey: string) => {
    setPlacement((prev) => ({ ...prev, [fromSlotKey]: null }))
  }

  const handleFormationChange = (f: string) => {
    setFormation(f as SupportedFormation)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  const filledCount = Object.values(placement).filter(Boolean).length
  const voidCount = slots.length - filledCount

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="border-b px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">팀 빌더</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            가용 {availablePlayers.length}명 &nbsp;·&nbsp; 부상 {injuredIds.size}명
            {voidCount > 0 && (
              <span className="ml-2 text-red-400 font-medium">빈 슬롯 {voidCount}개</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={formation} onValueChange={handleFormationChange}>
            <SelectTrigger className="w-32">
              <SelectValue>{formation}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_FORMATIONS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('formation')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'formation'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              포메이션
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              스페인 그리드
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 피치 */}
        <div className="flex-1 p-4 overflow-auto flex items-start justify-center">
          <div className="w-full max-w-xs">
            <FootballPitch viewMode={viewMode}>
              {slots.map((slotDef) => {
                const placedId = placement[slotDef.key] ?? null
                const placedPlayer = placedId
                  ? (allPlayers.find((p) => p.id === placedId) ?? null)
                  : null
                const suggestedPlayer = placedId
                  ? null
                  : (getCandidates(slotDef.position, availablePlayers, placedIds)[0] ?? null)
                return (
                  <FormationSlot
                    key={slotDef.key}
                    slotDef={slotDef}
                    placedPlayer={placedPlayer}
                    suggestedPlayer={suggestedPlayer}
                    onConfirmSuggestion={handleConfirmSuggestion}
                    onDrop={handleDrop}
                    onRemove={handleRemove}
                  />
                )
              })}
            </FootballPitch>
          </div>
        </div>

        {/* 벤치 패널 */}
        <div className="w-44 shrink-0">
          <PlayerBench
            availablePlayers={availablePlayers}
            placedIds={placedIds}
            injuredPlayers={activeInjuries}
            allPlayers={allPlayers}
            onBenchDrop={handleBenchDrop}
          />
        </div>
      </div>
    </div>
  )
}
