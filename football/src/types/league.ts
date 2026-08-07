export type LeagueLevel = 'K3' | 'K_LEAGUE_2' | 'K_LEAGUE_1' | 'EPL' | 'OTHER'

export type Confederation = 'UEFA' | 'AFC' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'OFC'

export interface LeagueClub {
  clubId: number
  joinedAt: string
  club: { id: number; name: string }
}

export interface League {
  id: number
  name: string
  level: LeagueLevel
  year: number
  isActive: boolean
  countryId: number | null
  confederation: Confederation | null
  country: { id: number; name: string; code: string } | null
  clubs: LeagueClub[]
  createdAt: string
}

export interface CreateLeagueDto {
  name: string
  level: LeagueLevel
  year: number
  countryId?: number
  confederation?: Confederation
}

export interface UpdateLeagueDto {
  name?: string
  isActive?: boolean
  countryId?: number | null
  confederation?: Confederation | null
}

export const LEAGUE_LEVEL_LABEL: Record<LeagueLevel, string> = {
  K3: 'K3',
  K_LEAGUE_2: 'K리그2',
  K_LEAGUE_1: 'K리그1',
  EPL: '잉글랜드 프리미어리그',
  OTHER: '기타',
}

export const LEAGUE_LEVEL_LABEL_EN: Record<LeagueLevel, string> = {
  K3: 'K3',
  K_LEAGUE_2: 'K League 2',
  K_LEAGUE_1: 'K League 1',
  EPL: 'English Premier League',
  OTHER: 'Other',
}

export const LEAGUE_LEVELS: LeagueLevel[] = ['K_LEAGUE_1', 'K_LEAGUE_2', 'K3', 'EPL', 'OTHER']
