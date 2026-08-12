import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { guardianApi, type ChildPlayer, type GuardianDashboard, type AttendanceRecord, type InjuryWithReport } from '@/services/guardian.service'
import { GuardianFeeView } from './GuardianFeeView'
import type { AcademyFee } from '@/types/academy-fee'

const ATTENDANCE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PRESENT: 'default', LATE: 'secondary', ABSENT: 'destructive', ABSENT_AUTHORIZED: 'outline',
}

const INJURY_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ACTIVE: 'destructive', RETURNING: 'secondary', RETURNED: 'default',
}

export default function GuardianPortalPage() {
  const { t } = useTranslation('youth')
  const [children, setChildren] = useState<ChildPlayer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GuardianDashboard | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [injuries, setInjuries] = useState<InjuryWithReport[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    guardianApi.getChildren()
      .then((list) => {
        setChildren(list)
        if (list.length === 1) setSelectedId(list[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setDetailLoading(true)
    Promise.all([
      guardianApi.getDashboard(selectedId).then(setDashboard),
      guardianApi.getAttendance(selectedId).then(setAttendance),
      guardianApi.getInjuries(selectedId).then(setInjuries),
    ]).finally(() => setDetailLoading(false))
  }, [selectedId])

  if (loading) return <p className="p-6 text-muted-foreground">{t('guardianPortal.loading')}</p>
  if (children.length === 0) return <p className="p-6 text-muted-foreground">{t('guardianPortal.noChildren')}</p>

  const child = children.find((c) => c.id === selectedId) ?? null

  return (
    <div className="p-6 space-y-4">
      {children.length > 1 && (
        <Select value={selectedId ?? ''} onValueChange={setSelectedId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder={t('guardianPortal.selectChild')} />
          </SelectTrigger>
          <SelectContent>
            {children.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.playerName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {child && (
        <div>
          <h1 className="text-2xl font-semibold">{child.playerName}</h1>
          <p className="text-sm text-muted-foreground">{child.position} · {child.level} {child.team ? `· ${child.team.name}` : ''}</p>
        </div>
      )}

      {selectedId && (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">{t('guardianPortal.tabs.overview')}</TabsTrigger>
            <TabsTrigger value="attendance">{t('guardianPortal.tabs.attendance')}</TabsTrigger>
            <TabsTrigger value="injuries">{t('guardianPortal.tabs.injuries')}</TabsTrigger>
            <TabsTrigger value="fees">{t('guardianPortal.tabs.fees')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            {detailLoading ? (
              <p className="text-muted-foreground">{t('guardianPortal.loading')}</p>
            ) : dashboard ? (
              <>
                {dashboard.suspension.reason && (
                  <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-4">
                    <p className="text-sm font-medium text-destructive">
                      {t('guardianPortal.overview.suspension')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t(`guardianPortal.overview.suspensionReason.${dashboard.suspension.reason}`)}
                    </p>
                  </div>
                )}

                <div className="border rounded-lg p-4 space-y-2">
                  <p className="font-medium text-sm">{t('guardianPortal.overview.attendance')}</p>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    {(['total', 'attended', 'absent', 'late'] as const).map((key) => (
                      <div key={key} className="bg-muted rounded-md p-3">
                        <p className="text-xs text-muted-foreground">{t(`guardianPortal.overview.${key}`)}</p>
                        <p className="text-xl font-semibold">{dashboard.attendance[key]}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border rounded-lg p-4 space-y-2">
                  <p className="font-medium text-sm">{t('guardianPortal.overview.pendingFees')}</p>
                  {[...dashboard.fees.pending, ...dashboard.fees.overdue].length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('guardianPortal.overview.noFees')}</p>
                  ) : (
                    [...dashboard.fees.pending, ...dashboard.fees.overdue].map((fee) => {
                      const f = fee as AcademyFee
                      return (
                        <div key={f.id} className="flex items-center justify-between text-sm">
                          <span>{f.year}년 {f.month}월</span>
                          <span className="text-muted-foreground">{f.amount.toLocaleString()}원</span>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="border rounded-lg p-4 space-y-2">
                  <p className="font-medium text-sm">{t('guardianPortal.overview.activeInjuries')}</p>
                  {(dashboard.injuries.active as InjuryWithReport[]).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('guardianPortal.overview.noInjuries')}</p>
                  ) : (
                    (dashboard.injuries.active as InjuryWithReport[]).map((inj) => (
                      <div key={inj.id} className="text-sm">
                        <span className="font-medium">{inj.bodyPart}</span>
                        <span className="text-muted-foreground ml-2">· {inj.cause}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="attendance" className="mt-4">
            {detailLoading ? (
              <p className="text-muted-foreground">{t('guardianPortal.loading')}</p>
            ) : attendance.length === 0 ? (
              <p className="text-muted-foreground">{t('guardianPortal.attendance.noData')}</p>
            ) : (
              <div className="space-y-2">
                {attendance.map((rec) => (
                  <div key={rec.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{new Date(rec.session.date).toLocaleDateString('ko-KR')}</p>
                      <p className="text-xs text-muted-foreground">{rec.session.sessionType}</p>
                    </div>
                    <Badge variant={ATTENDANCE_VARIANT[rec.attendance ?? 'ABSENT']}>
                      {t(`guardianPortal.attendance.status.${rec.attendance ?? 'ABSENT'}`)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="injuries" className="mt-4">
            {detailLoading ? (
              <p className="text-muted-foreground">{t('guardianPortal.loading')}</p>
            ) : injuries.length === 0 ? (
              <p className="text-muted-foreground">{t('guardianPortal.injury.noData')}</p>
            ) : (
              <div className="space-y-3">
                {injuries.map((inj) => (
                  <div key={inj.id} className="border rounded-lg p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{inj.bodyPart}</p>
                      <Badge variant={INJURY_STATUS_VARIANT[inj.status]}>
                        {t(`guardianPortal.injury.status.${inj.status}`)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{inj.cause}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(inj.occurredAt).toLocaleDateString('ko-KR')} ·{' '}
                      {t('guardianPortal.injury.expectedReturn')}:{' '}
                      {inj.expectedReturnDate
                        ? new Date(inj.expectedReturnDate).toLocaleDateString('ko-KR')
                        : t('guardianPortal.injury.noReturn')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="fees" className="mt-4">
            <GuardianFeeView playerId={selectedId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
