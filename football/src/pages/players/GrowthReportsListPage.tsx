import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { playerApi } from '@/services/player.service'
import type { Player } from '@/types/player'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { TrendingUp } from 'lucide-react'

function calcAge(dateOfBirth: string): number {
  const birth = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function GrowthReportsListPage() {
  const { t } = useTranslation('youth')
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    playerApi.list({ level: 'YOUTH' })
      .then(r => setPlayers(r.data))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(
    () => players.filter(p => p.playerName.toLowerCase().includes(search.toLowerCase())),
    [players, search],
  )

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{t('growthReportListPage.title')}</h1>
      <Input
        placeholder={t('growthReportListPage.searchPlaceholder')}
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-xs"
      />
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">{t('growthReportListPage.noData')}</p>
      ) : (
        <div className="border rounded-lg divide-y">
          {filtered.map(player => (
            <div key={player.id} className="flex items-center gap-4 px-4 py-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs">{player.playerName.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{player.playerName}</p>
                <p className="text-xs text-muted-foreground">
                  {calcAge(player.dateOfBirth)}{t('growthReportListPage.yearsOld')} · {player.position}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => navigate(`/players/${player.id}?tab=growth`)}
              >
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                {t('growthReportListPage.viewReport')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
