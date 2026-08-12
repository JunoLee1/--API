import api from '@/lib/api'
import type { FormationSnapshot, CreateFormationSnapshotPayload } from '@/types/formation-snapshot'

export const formationSnapshotApi = {
  create: (payload: CreateFormationSnapshotPayload): Promise<FormationSnapshot> =>
    api.post('/formation-snapshots', payload).then(r => r.data),

  listByMatch: (matchId: number): Promise<FormationSnapshot[]> =>
    api.get(`/formation-snapshots/match/${matchId}`).then(r => r.data),
}
