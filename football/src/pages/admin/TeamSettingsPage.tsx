import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { teamApi } from '@/services/team.service'
import { teamAdminApi } from '@/services/teamAdmin.service'
import { Button } from '@/components/ui/button'
import type { Team } from '@/types/team'

export default function TeamSettingsPage() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && user.role !== 'ADMIN') { navigate('/dashboard'); return }
    teamApi.list().then(setTeams).finally(() => setLoading(false))
  }, [user])

  const toggleLite = async (team: Team) => {
    await teamAdminApi.setLite(team.id, !team.isLite)
    setTeams(prev => prev.map(t => t.id === team.id ? { ...t, isLite: !t.isLite } : t))
  }

  if (loading) return <p className="p-6 text-muted-foreground">불러오는 중...</p>

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">구단 설정</h1>
      <p className="text-sm text-muted-foreground">Lite Mode를 활성화하면 복잡한 기능이 비활성화되고 핵심 기능만 사용할 수 있습니다.</p>
      <div className="space-y-3">
        {teams.map(team => (
          <div key={team.id} className="border rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{team.name}</p>
              <p className="text-xs text-muted-foreground">{team.isLite ? 'Lite Mode 활성' : '일반 모드'}</p>
            </div>
            <Button
              size="sm"
              variant={team.isLite ? 'default' : 'outline'}
              onClick={() => toggleLite(team)}
            >
              {team.isLite ? 'Lite Mode 비활성화' : 'Lite Mode 활성화'}
            </Button>
          </div>
        ))}
        {teams.length === 0 && <p className="text-muted-foreground">구단 정보가 없습니다.</p>}
      </div>
    </div>
  )
}
