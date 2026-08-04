import { useEffect, useState } from 'react'
import { teamApi } from '@/services/team.service'
import type { Team } from '@/types/team'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2 } from 'lucide-react'

export function TeamSelectPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    teamApi.list()
      .then((data) => setTeams(data.filter((t) => t.isActive)))
      .catch(() => toast.error('팀 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = (team: Team) => {
    localStorage.setItem('superAdminTeamId', String(team.id))
    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">구단 선택</h1>
          <p className="text-sm text-muted-foreground">관리할 구단을 선택하세요.</p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            활성 구단이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {teams.map((team) => (
              <Button
                key={team.id}
                variant="outline"
                className="w-full h-14 justify-start gap-3 text-left"
                onClick={() => handleSelect(team)}
              >
                <Building2 className="w-5 h-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col items-start">
                  <span className="font-medium text-sm">{team.name}</span>
                  {team.ageGroup && (
                    <span className="text-xs text-muted-foreground">{team.ageGroup}</span>
                  )}
                </div>
                {team.club?.isLite && (
                  <span className="ml-auto text-xs text-muted-foreground border rounded px-1.5 py-0.5">
                    Lite
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
