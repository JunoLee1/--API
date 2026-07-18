import type { Player, PlayerLevel, Position } from '@/types/player'
import type { SlotDef } from './formation-layouts'
import { ADJACENT_POSITIONS } from './adjacent-positions'

const LEVEL_PRIORITY: Record<PlayerLevel, number> = {
  YOUTH: 0, ROOKIE: 1, SENIOR: 2, VETERAN: 3,
}

export function getCandidates(
  slotPosition: Position,
  availablePlayers: Player[],
  alreadyPlaced: Set<string>,
): Player[] {
  const unplaced = availablePlayers.filter((p) => !alreadyPlaced.has(p.id))
  const exact = unplaced
    .filter((p) => p.position === slotPosition)
    .sort((a, b) => LEVEL_PRIORITY[b.level] - LEVEL_PRIORITY[a.level])
  const adjacentPositions = ADJACENT_POSITIONS[slotPosition] ?? []
  const fallback = unplaced
    .filter((p) => p.position !== slotPosition && adjacentPositions.includes(p.position))
    .sort((a, b) => LEVEL_PRIORITY[b.level] - LEVEL_PRIORITY[a.level])
  return [...exact, ...fallback]
}

export function buildInitialPlacement(
  slots: SlotDef[],
  availablePlayers: Player[],
): Record<string, string | null> {
  const placement: Record<string, string | null> = {}
  const placed = new Set<string>()
  for (const slot of slots) {
    const candidates = getCandidates(slot.position, availablePlayers, placed)
    if (candidates.length > 0) {
      placement[slot.key] = candidates[0].id
      placed.add(candidates[0].id)
    } else {
      placement[slot.key] = null
    }
  }
  return placement
}
