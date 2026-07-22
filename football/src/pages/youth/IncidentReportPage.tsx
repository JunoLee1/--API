import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { incidentReportApi } from '@/services/incidentReport.service'
import type { IncidentReport } from '@/types/incident-report'
import { IncidentReportFormDialog } from './IncidentReportFormDialog'

const STATUS_LABEL: Record<string, string> = { DRAFT: '초안', SUBMITTED: '제출됨', SIGNED: '서명완료' }
const STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'default'> = {
  DRAFT: 'outline', SUBMITTED: 'secondary', SIGNED: 'default',
}

export default function IncidentReportPage() {
  const [reports, setReports] = useState<IncidentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setReports(await incidentReportApi.getAll()) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSign = async (id: number, role: 'SUPERVISOR' | 'MEDICAL') => {
    await incidentReportApi.sign(id, role)
    load()
  }

  const handleSubmitReport = async (id: number) => {
    await incidentReportApi.submit(id)
    load()
  }

  const allPlayers = reports.map(r => ({ id: r.playerId, playerName: r.player.playerName, teamId: r.teamId }))
  const uniquePlayers = [...new Map(allPlayers.map(p => [p.id, p])).values()]

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">사고 보고서</h1>
        <Button onClick={() => setDialogOpen(true)}>+ 보고서 작성</Button>
      </div>

      {loading ? <p className="text-muted-foreground">불러오는 중...</p> : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{r.player.playerName}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    ({r.type === 'MATCH' ? '경기 중' : '훈련 중'})
                  </span>
                </div>
                <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>감독서명: {r.supervisorSigned ? '✅' : '❌'}</span>
                <span>의무서명: {r.medicalSigned ? '✅' : '❌'}</span>
              </div>
              {r.status === 'DRAFT' && (
                <Button size="sm" variant="outline" onClick={() => handleSubmitReport(r.id)}>제출</Button>
              )}
              {r.status === 'SUBMITTED' && (
                <div className="flex gap-2">
                  {!r.supervisorSigned && (
                    <Button size="sm" variant="outline" onClick={() => handleSign(r.id, 'SUPERVISOR')}>감독 서명</Button>
                  )}
                  {!r.medicalSigned && (
                    <Button size="sm" variant="outline" onClick={() => handleSign(r.id, 'MEDICAL')}>의무팀 서명</Button>
                  )}
                </div>
              )}
            </div>
          ))}
          {reports.length === 0 && <p className="text-muted-foreground">사고 보고서가 없습니다.</p>}
        </div>
      )}

      <IncidentReportFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={load}
        players={uniquePlayers}
      />
    </div>
  )
}
