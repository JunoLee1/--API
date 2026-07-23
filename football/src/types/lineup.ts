import type { SupportedFormation } from '@/components/squad/formation-layouts'

export interface LineupPlayer {
  id: string
  playerName: string
  position: string
}

export interface LineupSlotData {
  slotKey: string
  isStarter: boolean
  player: LineupPlayer
}

export interface MatchLineup {
  matchId: number
  formation: SupportedFormation
  isConfirmed: boolean
  confirmedAt: string | null
  teamType: 'FIRST_TEAM' | 'YOUTH' | null
  slots: LineupSlotData[]
}

export interface SaveLineupPayload {
  formation: string
  slots: {
    playerId: string
    slotKey: string
    isStarter: boolean
  }[]
}

export interface LineupDragPayload {
  playerId: string
  playerName: string
  position: string
  src: 'POOL' | 'BENCH'
  srcKey?: string
  srcSlotKey?: string
}
