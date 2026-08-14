import { useState } from 'react'
import { toast } from 'sonner'
import { ledgerApi } from '@/services/ledger.service'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function LedgerPage() {
  const { user } = useCurrentUser()

  const canLock = !!user && (
    ['ADMIN', 'SUPER_ADMIN', 'GM'].includes(user.role) ||
    (user.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'FINANCE_MANAGER')
  )

  const [lockYear, setLockYear] = useState(new Date().getFullYear())
  const [lockMonth, setLockMonth] = useState(new Date().getMonth() + 1)
  const [locking, setLocking] = useState(false)

  const handleLockPeriod = async () => {
    setLocking(true)
    try {
      await ledgerApi.lockPeriod(lockYear, lockMonth)
      toast.success(`${lockYear}년 ${lockMonth}월 기간이 마감됐습니다.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '기간 마감에 실패했습니다.')
    } finally {
      setLocking(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">장부 관리</h1>

      {canLock && (
        <Card>
          <CardHeader>
            <CardTitle>기간 마감</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="space-y-1">
                <Label htmlFor="lock-year">연도</Label>
                <Input
                  id="lock-year"
                  type="number"
                  value={lockYear}
                  onChange={(e) => setLockYear(Number(e.target.value))}
                  className="w-28"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lock-month">월</Label>
                <Input
                  id="lock-month"
                  type="number"
                  min={1}
                  max={12}
                  value={lockMonth}
                  onChange={(e) => setLockMonth(Number(e.target.value))}
                  className="w-20"
                />
              </div>
              <Button
                onClick={handleLockPeriod}
                disabled={locking}
                variant="destructive"
              >
                {locking ? '처리 중...' : '기간 마감'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              마감된 기간에는 새 장부 항목 및 환불을 등록할 수 없습니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
