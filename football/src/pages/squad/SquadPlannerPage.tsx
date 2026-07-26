import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { playerApi } from '@/services/player.service'
import { injuryApi } from '@/services/injury.service'
import { tacticalApi } from '@/services/tactical.service'
import type { Player, PositionZone } from '@/types/player'
import { POSITION_ZONE } from '@/types/player'
import type { InjuryStatus } from '@/types/injury'
import { AlertTriangle } from 'lucide-react'
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

const ZONE_MIN: Record<PositionZone, number> = { GK: 2, DEF: 4, MID: 3, FWD: 2 }

interface ActiveInjury {
  playerId: string
  status: InjuryStatus
}

export function SquadPlannerPage() {
  const { t } = useTranslation('squad')
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

  const squadWarnings = useMemo(() => {
    const counts: Record<PositionZone, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
    availablePlayers.forEach((p) => { counts[POSITION_ZONE[p.position]]++ })
    return (['GK', 'DEF', 'MID', 'FWD'] as PositionZone[])
      .filter((z) => counts[z] < ZONE_MIN[z])
      .map((z) => ({ zone: z, count: counts[z], min: ZONE_MIN[z] }))
  }, [availablePlayers])

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
      .catch(() => toast.error(t('planner.loadFailed')))
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
          <h1 className="text-lg font-semibold tracking-tight">{t('planner.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('planner.available', { count: availablePlayers.length })} &nbsp;·&nbsp; {t('planner.injured', { count: injuredIds.size })}
            {voidCount > 0 && (
              <span className="ml-2 text-red-400 font-medium">{t('planner.emptySlots', { count: voidCount })}</span>
            )}
          </p>
          {squadWarnings.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {squadWarnings.map(({ zone, count, min }) => (
                <span
                  key={zone}
                  className="inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
                >
                  <AlertTriangle className="size-3 shrink-0" />
                  {t('planner.zoneWarning', { zone: t(`zone.${zone}`), count, min })}
                </span>
              ))}
            </div>
          )}
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
              {t('planner.formation')}
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
              {t('planner.spanishGrid')}
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
