import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { academyFeeApi } from '@/services/academyFee.service'
import type { AcademyFee } from '@/types/academy-fee'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '납부 대기', SUBMITTED: '확인 중', PAID: '납부 완료', OVERDUE: '연체', LOCKED: '정지'
}
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline', SUBMITTED: 'secondary', PAID: 'default', OVERDUE: 'destructive', LOCKED: 'destructive'
}

interface Props { playerId: string }

export function GuardianFeeView({ playerId }: Props) {
  const [fees, setFees] = useState<AcademyFee[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<number | null>(null)

  useEffect(() => {
    academyFeeApi.getByPlayer(playerId).then(setFees).finally(() => setLoading(false))
  }, [playerId])

  const handleSubmitProof = async (feeId: number) => {
    const url = window.prompt('납부 증빙 이미지 URL을 입력하세요')
    if (!url) return
    setSubmitting(feeId)
    try {
      const updated = await academyFeeApi.submitProof(feeId, url)
      setFees(prev => prev.map(f => f.id === feeId ? updated : f))
    } finally { setSubmitting(null) }
  }

  if (loading) return <p className="text-muted-foreground">불러오는 중...</p>

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">아카데미 회비 내역</h2>
      {fees.map(fee => (
        <div key={fee.id} className="border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">{fee.year}년 {fee.month}월</p>
            <p className="text-sm text-muted-foreground">{fee.amount.toLocaleString()}원 · 기한: {new Date(fee.dueDate).toLocaleDateString('ko-KR')}</p>
            {fee.status === 'SUBMITTED' && <p className="text-xs text-blue-500 mt-1">증빙 확인 중입니다</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[fee.status]}>{STATUS_LABEL[fee.status]}</Badge>
            {(fee.status === 'PENDING' || fee.status === 'OVERDUE') && (
              <Button size="sm" onClick={() => handleSubmitProof(fee.id)} disabled={submitting === fee.id}>
                납부 증빙 제출
              </Button>
            )}
          </div>
        </div>
      ))}
      {fees.length === 0 && <p className="text-muted-foreground">청구된 회비가 없습니다.</p>}
    </div>
  )
}
