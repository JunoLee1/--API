import type { Position } from '@/types/player'

export interface GridZone {
  col: 1 | 2 | 3 | 4 | 5
  row: 1 | 2 | 3
}

export interface SlotDef {
  key: string
  position: Position
  top: number    // % from top (GK = 88%)
  left: number   // % from left
  gridZone: GridZone
}

export const SUPPORTED_FORMATIONS = [
  '4-3-3', '4-4-2', '4-2-3-1', '4-1-4-1',
  '3-5-2', '3-4-3', '5-3-2', '5-4-1',
] as const
export type SupportedFormation = typeof SUPPORTED_FORMATIONS[number]

export const FORMATION_LAYOUTS: Record<SupportedFormation, SlotDef[]> = {
  '4-3-3': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'LB',  position: 'LEFT_FULL_BACK',                top: 72, left: 15, gridZone: { col: 1, row: 3 } },
    { key: 'CB1', position: 'CENTER_BACK',                   top: 72, left: 35, gridZone: { col: 2, row: 3 } },
    { key: 'CB2', position: 'CENTER_BACK',                   top: 72, left: 65, gridZone: { col: 4, row: 3 } },
    { key: 'RB',  position: 'RIGHT_FULL_BACK',               top: 72, left: 85, gridZone: { col: 5, row: 3 } },
    { key: 'LCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 25, gridZone: { col: 2, row: 2 } },
    { key: 'CM',  position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 50, gridZone: { col: 3, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 75, gridZone: { col: 4, row: 2 } },
    { key: 'LW',  position: 'WINGER',                        top: 28, left: 18, gridZone: { col: 1, row: 1 } },
    { key: 'ST',  position: 'STRIKER',                       top: 20, left: 50, gridZone: { col: 3, row: 1 } },
    { key: 'RW',  position: 'WINGER',                        top: 28, left: 82, gridZone: { col: 5, row: 1 } },
  ],
  '4-4-2': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'LB',  position: 'LEFT_FULL_BACK',                top: 72, left: 15, gridZone: { col: 1, row: 3 } },
    { key: 'CB1', position: 'CENTER_BACK',                   top: 72, left: 35, gridZone: { col: 2, row: 3 } },
    { key: 'CB2', position: 'CENTER_BACK',                   top: 72, left: 65, gridZone: { col: 4, row: 3 } },
    { key: 'RB',  position: 'RIGHT_FULL_BACK',               top: 72, left: 85, gridZone: { col: 5, row: 3 } },
    { key: 'LM',  position: 'LEFT_ATTACK_MIDFIELDER',        top: 52, left: 12, gridZone: { col: 1, row: 2 } },
    { key: 'LCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 37, gridZone: { col: 2, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 63, gridZone: { col: 4, row: 2 } },
    { key: 'RM',  position: 'RIGHT_ATTACK_MIDFIELDER',       top: 52, left: 88, gridZone: { col: 5, row: 2 } },
    { key: 'LST', position: 'STRIKER',                       top: 22, left: 35, gridZone: { col: 2, row: 1 } },
    { key: 'RST', position: 'STRIKER',                       top: 22, left: 65, gridZone: { col: 4, row: 1 } },
  ],
  '4-2-3-1': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'LB',  position: 'LEFT_FULL_BACK',                top: 72, left: 15, gridZone: { col: 1, row: 3 } },
    { key: 'CB1', position: 'CENTER_BACK',                   top: 72, left: 35, gridZone: { col: 2, row: 3 } },
    { key: 'CB2', position: 'CENTER_BACK',                   top: 72, left: 65, gridZone: { col: 4, row: 3 } },
    { key: 'RB',  position: 'RIGHT_FULL_BACK',               top: 72, left: 85, gridZone: { col: 5, row: 3 } },
    { key: 'LDM', position: 'LEFT_DEFENSIVE_MIDFIELDER',     top: 60, left: 35, gridZone: { col: 2, row: 2 } },
    { key: 'RDM', position: 'RIGHT_DEFENSIVE_MIDFIELDER',    top: 60, left: 65, gridZone: { col: 4, row: 2 } },
    { key: 'LAM', position: 'LEFT_ATTACK_MIDFIELDER',        top: 42, left: 18, gridZone: { col: 1, row: 2 } },
    { key: 'CAM', position: 'CENTRAL_ATTACK_MIDFIELDER',     top: 42, left: 50, gridZone: { col: 3, row: 2 } },
    { key: 'RAM', position: 'RIGHT_ATTACK_MIDFIELDER',       top: 42, left: 82, gridZone: { col: 5, row: 2 } },
    { key: 'ST',  position: 'STRIKER',                       top: 20, left: 50, gridZone: { col: 3, row: 1 } },
  ],
  '4-1-4-1': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'LB',  position: 'LEFT_FULL_BACK',                top: 72, left: 15, gridZone: { col: 1, row: 3 } },
    { key: 'CB1', position: 'CENTER_BACK',                   top: 72, left: 35, gridZone: { col: 2, row: 3 } },
    { key: 'CB2', position: 'CENTER_BACK',                   top: 72, left: 65, gridZone: { col: 4, row: 3 } },
    { key: 'RB',  position: 'RIGHT_FULL_BACK',               top: 72, left: 85, gridZone: { col: 5, row: 3 } },
    { key: 'CDM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 62, left: 50, gridZone: { col: 3, row: 2 } },
    { key: 'LM',  position: 'LEFT_ATTACK_MIDFIELDER',        top: 48, left: 12, gridZone: { col: 1, row: 2 } },
    { key: 'LCM', position: 'CENTRAL_ATTACK_MIDFIELDER',     top: 48, left: 37, gridZone: { col: 2, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_ATTACK_MIDFIELDER',     top: 48, left: 63, gridZone: { col: 4, row: 2 } },
    { key: 'RM',  position: 'RIGHT_ATTACK_MIDFIELDER',       top: 48, left: 88, gridZone: { col: 5, row: 2 } },
    { key: 'ST',  position: 'STRIKER',                       top: 20, left: 50, gridZone: { col: 3, row: 1 } },
  ],
  '3-5-2': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'CB1', position: 'CENTER_BACK',                   top: 72, left: 25, gridZone: { col: 2, row: 3 } },
    { key: 'CB2', position: 'CENTER_BACK',                   top: 72, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'CB3', position: 'CENTER_BACK',                   top: 72, left: 75, gridZone: { col: 4, row: 3 } },
    { key: 'LWB', position: 'LEFT_WING_BACK',                top: 58, left: 10, gridZone: { col: 1, row: 2 } },
    { key: 'LCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 32, gridZone: { col: 2, row: 2 } },
    { key: 'CM',  position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 50, gridZone: { col: 3, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 68, gridZone: { col: 4, row: 2 } },
    { key: 'RWB', position: 'RIGHT_WING_BACK',               top: 58, left: 90, gridZone: { col: 5, row: 2 } },
    { key: 'LST', position: 'STRIKER',                       top: 22, left: 35, gridZone: { col: 2, row: 1 } },
    { key: 'RST', position: 'STRIKER',                       top: 22, left: 65, gridZone: { col: 4, row: 1 } },
  ],
  '3-4-3': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'CB1', position: 'CENTER_BACK',                   top: 72, left: 25, gridZone: { col: 2, row: 3 } },
    { key: 'CB2', position: 'CENTER_BACK',                   top: 72, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'CB3', position: 'CENTER_BACK',                   top: 72, left: 75, gridZone: { col: 4, row: 3 } },
    { key: 'LM',  position: 'LEFT_ATTACK_MIDFIELDER',        top: 52, left: 12, gridZone: { col: 1, row: 2 } },
    { key: 'LCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 37, gridZone: { col: 2, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 63, gridZone: { col: 4, row: 2 } },
    { key: 'RM',  position: 'RIGHT_ATTACK_MIDFIELDER',       top: 52, left: 88, gridZone: { col: 5, row: 2 } },
    { key: 'LW',  position: 'WINGER',                        top: 28, left: 18, gridZone: { col: 1, row: 1 } },
    { key: 'ST',  position: 'STRIKER',                       top: 22, left: 50, gridZone: { col: 3, row: 1 } },
    { key: 'RW',  position: 'WINGER',                        top: 28, left: 82, gridZone: { col: 5, row: 1 } },
  ],
  '5-3-2': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'LWB', position: 'LEFT_WING_BACK',                top: 70, left: 8,  gridZone: { col: 1, row: 3 } },
    { key: 'LB',  position: 'LEFT_FULL_BACK',                top: 74, left: 25, gridZone: { col: 2, row: 3 } },
    { key: 'CB',  position: 'CENTER_BACK',                   top: 76, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'RB',  position: 'RIGHT_FULL_BACK',               top: 74, left: 75, gridZone: { col: 4, row: 3 } },
    { key: 'RWB', position: 'RIGHT_WING_BACK',               top: 70, left: 92, gridZone: { col: 5, row: 3 } },
    { key: 'LCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 25, gridZone: { col: 2, row: 2 } },
    { key: 'CM',  position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 50, gridZone: { col: 3, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 75, gridZone: { col: 4, row: 2 } },
    { key: 'LST', position: 'STRIKER',                       top: 22, left: 35, gridZone: { col: 2, row: 1 } },
    { key: 'RST', position: 'STRIKER',                       top: 22, left: 65, gridZone: { col: 4, row: 1 } },
  ],
  '5-4-1': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'LWB', position: 'LEFT_WING_BACK',                top: 70, left: 8,  gridZone: { col: 1, row: 3 } },
    { key: 'LB',  position: 'LEFT_FULL_BACK',                top: 74, left: 25, gridZone: { col: 2, row: 3 } },
    { key: 'CB',  position: 'CENTER_BACK',                   top: 76, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'RB',  position: 'RIGHT_FULL_BACK',               top: 74, left: 75, gridZone: { col: 4, row: 3 } },
    { key: 'RWB', position: 'RIGHT_WING_BACK',               top: 70, left: 92, gridZone: { col: 5, row: 3 } },
    { key: 'LM',  position: 'LEFT_ATTACK_MIDFIELDER',        top: 50, left: 12, gridZone: { col: 1, row: 2 } },
    { key: 'LCM', position: 'CENTRAL_ATTACK_MIDFIELDER',     top: 50, left: 37, gridZone: { col: 2, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_ATTACK_MIDFIELDER',     top: 50, left: 63, gridZone: { col: 4, row: 2 } },
    { key: 'RM',  position: 'RIGHT_ATTACK_MIDFIELDER',       top: 50, left: 88, gridZone: { col: 5, row: 2 } },
    { key: 'ST',  position: 'STRIKER',                       top: 20, left: 50, gridZone: { col: 3, row: 1 } },
  ],
}
