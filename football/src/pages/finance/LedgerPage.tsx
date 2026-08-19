import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { ledgerApi } from '@/services/ledger.service'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function LedgerPage() {
  const { t } = useTranslation('finance')
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
      toast.success(t('ledger.periodClose.successFull', { year: lockYear, month: lockMonth }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('ledger.periodClose.failed'))
    } finally {
      setLocking(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t('ledger.title')}</h1>

      {canLock && (
        <Card>
          <CardHeader>
            <CardTitle>{t('ledger.periodClose.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="space-y-1">
                <Label htmlFor="lock-year">{t('ledger.periodClose.year')}</Label>
                <Input
                  id="lock-year"
                  type="number"
                  value={lockYear}
                  onChange={(e) => setLockYear(Number(e.target.value))}
                  className="w-28"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lock-month">{t('ledger.periodClose.month')}</Label>
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
                {locking ? t('ledger.periodClose.processing') : t('ledger.periodClose.action')}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {t('ledger.periodClose.description')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
