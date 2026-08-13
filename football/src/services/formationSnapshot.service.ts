import { api } from './api'
import type { FormationSnapshot, CreateFormationSnapshotPayload } from '@/types/formation-snapshot'

export const formationSnapshotApi = {
  create: (payload: CreateFormationSnapshotPayload): Promise<FormationSnapshot> =>
    api.post('/formation-snapshots', payload),

  listByMatch: (matchId: number): Promise<FormationSnapshot[]> =>
    api.get(`/formation-snapshots/match/${matchId}`),
}
