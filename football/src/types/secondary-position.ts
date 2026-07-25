import type { Position } from './player'

export interface SecondaryPosition {
  id: number
  playerId: string
  position: Position
  fitnessTarget: number
  createdAt: string
}
