import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { guardianApi, type ChildPlayer, type GuardianDashboard, type AttendanceRecord, type InjuryWithReport, type GrowthEvaluation } from '@/services/guardian.service'
import { GrowthRadarChart } from '@/components/player/GrowthRadarChart'
import { GuardianFeeView } from './GuardianFeeView'
import type { AcademyFee } from '@/types/academy-fee'

const ATTENDANCE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PRESENT: 'default', LATE: 'secondary', ABSENT: 'destructive', ABSENT_AUTHORIZED: 'outline',
}

const INJURY_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ACTIVE: 'destructive', RETURNING: 'secondary', RETURNED: 'default',
}

function GuardianLinkCodeForm({ onLinked }: { onLinked: () => void }) {
  const { t } = useTranslation('youth')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleLink = async () => {
    if (!code.trim()) return
    setSubmitting(true)
    try {
      await guardianApi.linkByCode(code.trim())
      toast.success(t('guardianPortal.link.success'))
      onLinked()
    } catch {
      toast.error(t('guardianPortal.link.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-sm mx-auto space-y-4">
      <p className="text-muted-foreground text-sm">{t('guardianPortal.link.description')}</p>
      <div className="flex gap-2">
        <Input
          placeholder={t('guardianPortal.link.codePlaceholder')}
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void handleLink()}
        />
        <Button onClick={() => void handleLink()} disabled={submitting || !code.trim()}>
          {submitting ? '...' : t('guardianPortal.link.submit')}
        </Button>
      </div>
    </div>
  )
}

export default function GuardianPortalPage() {
  const { t } = useTranslation('youth')
  const [children, setChildren] = useState<ChildPlayer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GuardianDashboard | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [injuries, setInjuries] = useState<InjuryWithReport[]>([])
  const [growthReports, setGrowthReports] = useState<GrowthEvaluation[]>([])
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
      guardianApi.getGrowthReports(selectedId).then(setGrowthReports).catch(() => {}),
    ]).finally(() => setDetailLoading(false))
  }, [selectedId])

  if (loading) return <p className="p-6 text-muted-foreground">{t('guardianPortal.loading')}</p>
  if (children.length === 0) return <GuardianLinkCodeForm onLinked={() => window.location.reload()} />

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
            <TabsTrigger value="growth">{t('guardianPortal.tabs.growth')}</TabsTrigger>
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

          <TabsContent value="growth" className="mt-4 space-y-6">
            {detailLoading ? (
              <p className="text-muted-foreground">{t('guardianPortal.loading')}</p>
            ) : growthReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('guardianPortal.growth.empty')}</p>
            ) : (
              <>
                <div className="border rounded-lg p-4 space-y-3">
                  <p className="font-medium text-sm">{t('guardianPortal.growth.latest')}</p>
                  <div className="flex justify-center">
                    <GrowthRadarChart
                      attitudeScore={growthReports[0]!.attitude}
                      fundamentalsScore={growthReports[0]!.fundamentals}
                      spatialScore={growthReports[0]!.spatialAwareness}
                      physicalScore={growthReports[0]!.physical}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('guardianPortal.growth.coach')}: {growthReports[0]!.coachName}
                  </p>
                  {growthReports[0]!.comment && (
                    <p className="text-sm text-muted-foreground border-t pt-2">{growthReports[0]!.comment}</p>
                  )}
                </div>

                <div className="space-y-2">
                  {growthReports.map((rep) => (
                    <div key={rep.id} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{rep.year}년 {rep.month}월</p>
                        <p className="text-xs text-muted-foreground">{t('guardianPortal.growth.coach')}: {rep.coachName}</p>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs text-center mt-1">
                        <div><span className="text-muted-foreground">태도</span><br />{rep.attitude}</div>
                        <div><span className="text-muted-foreground">기본기</span><br />{rep.fundamentals}</div>
                        <div><span className="text-muted-foreground">공간</span><br />{rep.spatialAwareness}</div>
                        <div><span className="text-muted-foreground">체력</span><br />{rep.physical}</div>
                      </div>
                      {rep.comment && (
                        <p className="text-xs text-muted-foreground border-t pt-1 mt-1">{rep.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
