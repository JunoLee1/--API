import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { academyFeeApi } from '@/services/academyFee.service'
import type { AcademyFee } from '@/types/academy-fee'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기', SUBMITTED: '확인 중', PAID: '완료', OVERDUE: '연체', LOCKED: '정지'
}
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline', SUBMITTED: 'secondary', PAID: 'default', OVERDUE: 'destructive', LOCKED: 'destructive'
}

export default function AcademyFeePage() {
  const [fees, setFees] = useState<AcademyFee[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  const load = () => {
    setLoading(true)
    academyFeeApi.getAll(filter ? { status: filter } : {}).then(setFees).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const handleApprove = async (id: number) => {
    await academyFeeApi.approve(id)
    load()
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">아카데미 회비 관리</h1>
        <div className="flex gap-2">
          {['', 'PENDING', 'SUBMITTED', 'OVERDUE', 'LOCKED'].map(s => (
            <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>
              {s || '전체'}
            </Button>
          ))}
        </div>
      </div>
      {loading ? <p className="text-muted-foreground">불러오는 중...</p> : (
        <div className="space-y-2">
          {fees.map(fee => (
            <div key={fee.id} className="border rounded-lg p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-medium">{fee.player.playerName}</p>
                <p className="text-sm text-muted-foreground">
                  {fee.year}년 {fee.month}월 · {fee.amount.toLocaleString()}원 · 기한 {new Date(fee.dueDate).toLocaleDateString('ko-KR')}
                </p>
                {fee.paymentProofUrl && (
                  <a href={fee.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline">증빙 확인</a>
                )}
              </div>
              <Badge variant={STATUS_VARIANT[fee.status]}>{STATUS_LABEL[fee.status]}</Badge>
              {fee.status === 'SUBMITTED' && (
                <Button size="sm" onClick={() => handleApprove(fee.id)}>수납 승인</Button>
              )}
            </div>
          ))}
          {fees.length === 0 && <p className="text-muted-foreground">해당하는 회비 내역이 없습니다.</p>}
        </div>
      )}
    </div>
  )
}
