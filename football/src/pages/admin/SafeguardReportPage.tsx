import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { safeguardApi } from '@/services/safeguard.service'
import type { SafeguardReport } from '@/types/safeguard'

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: '접수됨',
  UNDER_REVIEW: '검토 중',
  RESOLVED: '처리 완료',
}
const STATUS_VARIANT: Record<string, 'destructive' | 'secondary' | 'default'> = {
  RECEIVED: 'destructive',
  UNDER_REVIEW: 'secondary',
  RESOLVED: 'default',
}

export default function SafeguardReportPage() {
  const [reports, setReports] = useState<SafeguardReport[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setReports(await safeguardApi.getAll()) }
    catch { /* 권한 없으면 빈 목록 */ }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const handleReview = async (id: number) => {
    await safeguardApi.updateStatus(id, 'UNDER_REVIEW')
    void load()
  }

  const handleResolve = async (id: number) => {
    const note = prompt('처리 결과를 입력하세요:')
    if (note === null) return
    await safeguardApi.updateStatus(id, 'RESOLVED', note)
    void load()
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-red-600">🚨 유소년 보호 신고 현황</h1>
      <p className="text-sm text-muted-foreground">신고자 신원은 시스템에 저장되지 않습니다. 모든 접근은 감사 로그에 기록됩니다.</p>

      {loading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="border rounded-lg p-4 space-y-2 border-l-4 border-l-red-400">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">#{r.id} · {new Date(r.createdAt).toLocaleString('ko-KR')}</span>
                <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </div>
              <p className="text-sm">{r.description}</p>
              {r.contactInfo && (
                <p className="text-xs text-muted-foreground">연락처: {r.contactInfo}</p>
              )}
              {r.accusedUser && (
                <p className="text-xs text-red-500 font-medium">피의자: {r.accusedUser.username} (계정 정지됨)</p>
              )}
              {r.resolvedNote && (
                <p className="text-xs text-muted-foreground border-t pt-2">처리 결과: {r.resolvedNote}</p>
              )}
              <div className="flex gap-2">
                {r.status === 'RECEIVED' && (
                  <Button size="sm" variant="outline" onClick={() => void handleReview(r.id)}>검토 시작</Button>
                )}
                {r.status === 'UNDER_REVIEW' && (
                  <Button size="sm" variant="outline" onClick={() => void handleResolve(r.id)}>처리 완료</Button>
                )}
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <p className="text-muted-foreground">접수된 신고가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}
