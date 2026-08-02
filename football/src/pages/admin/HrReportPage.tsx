import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { hrReportApi } from "@/services/hr-report.service"
import type { HrMonthlyReport, HrAnnualReport } from "@/types/hr-report"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-1 border-b last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function MonthlyReport({ data }: { data: HrMonthlyReport }) {
  const { t } = useTranslation("admin")

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">{t("hrReport.executiveSummary")}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm mb-2 font-medium">{data.executiveSummary.playerHeadline}</p>
          <ul className="list-disc list-inside space-y-1">
            {data.executiveSummary.keyChanges.length > 0
              ? data.executiveSummary.keyChanges.map((c, i) => (
                  <li key={i} className="text-sm text-muted-foreground">{c}</li>
                ))
              : <li className="text-sm text-muted-foreground">{t("hrReport.noData")}</li>
            }
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("hrReport.headcount")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">{t("hrReport.players")}</p>
            <StatRow label={t("hrReport.ownPlayers")} value={data.headcount.players.own} />
            <StatRow label={t("hrReport.loanIn")} value={data.headcount.players.loanIn} />
            <StatRow label={t("hrReport.onLoanOut")} value={data.headcount.players.onLoanOut} />
            <StatRow label={t("hrReport.total")} value={data.headcount.players.total} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">{t("hrReport.staff")}</p>
            <StatRow label={t("hrReport.admin")} value={data.headcount.users.admin} />
            <StatRow label={t("hrReport.frontOffice")} value={data.headcount.users.frontOffice} />
            <StatRow label={t("hrReport.coachingStaff")} value={data.headcount.users.coachingStaff} />
            <StatRow label={t("hrReport.staffRecords")} value={data.headcount.staffRecords.active} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("hrReport.recruitment")}</CardTitle></CardHeader>
        <CardContent>
          <StatRow label={t("hrReport.transfersIn")} value={data.recruitment.transfersIn} />
          <StatRow label={t("hrReport.transfersOut")} value={data.recruitment.transfersOut} />
          <StatRow label={t("hrReport.newContracts")} value={data.recruitment.newContractsStarted} />
          <StatRow label={t("hrReport.openCoachingRounds")} value={data.recruitment.openCoachingRounds} />
          <StatRow label={t("hrReport.openJobPostings")} value={data.recruitment.openJobPostings} />
          {data.recruitment.inBreakdown.length > 0 && (
            <div className="mt-2 flex gap-1 flex-wrap">
              {data.recruitment.inBreakdown.map((r) => (
                <Badge key={r.type} variant="secondary">{r.type} {r.count}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("hrReport.turnover")}</CardTitle></CardHeader>
        <CardContent>
          <StatRow label={t("hrReport.arrivals")} value={data.turnover.arrivals} />
          <StatRow label={t("hrReport.departures")} value={data.turnover.departures} />
          <StatRow label={t("hrReport.netChange")} value={(data.turnover.netChange >= 0 ? "+" : "") + data.turnover.netChange} />
          <StatRow label={t("hrReport.turnoverRate")} value={`${data.turnover.turnoverRate}%`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("hrReport.attendance")}</CardTitle></CardHeader>
        <CardContent>
          <StatRow label={t("hrReport.attendanceRate")} value={`${data.attendance.attendanceRate}%`} />
          <StatRow label={t("hrReport.present")} value={`${data.attendance.present} / ${data.attendance.total}`} />
          <StatRow label={t("hrReport.absentUnauthorized")} value={data.attendance.absentUnauthorized} />
          <StatRow label={t("hrReport.lateUnauthorized")} value={data.attendance.lateUnauthorized} />
          <StatRow label={t("hrReport.absentAuthorized")} value={data.attendance.absentAuthorized} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("hrReport.issues")}</CardTitle></CardHeader>
        <CardContent>
          <StatRow label={t("hrReport.incidents")} value={data.issues.totalIncidents} />
          <StatRow label={t("hrReport.injuries")} value={data.issues.newInjuries} />
          <StatRow label={t("hrReport.safeguardReports")} value={data.issues.safeguardReports} />
          {data.issues.incidents.length > 0 && (
            <div className="mt-2 flex gap-1 flex-wrap">
              {data.issues.incidents.map((r) => (
                <Badge key={r.type} variant="destructive">{r.type} {r.count}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AnnualReport({ data }: { data: HrAnnualReport }) {
  const { t } = useTranslation("admin")
  const fmt = (n: number) => n.toLocaleString("ko-KR")

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">{t("hrReport.kpi")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6">
          <StatRow label={t("hrReport.avgHeadcount")} value={`${data.kpi.avgHeadcount}명`} />
          <StatRow label={t("hrReport.totalRecruitment")} value={`${data.kpi.totalRecruitment}명`} />
          <StatRow label={t("hrReport.annualTurnoverRate")} value={`${data.kpi.annualTurnoverRate}%`} />
          <StatRow label={t("hrReport.avgAttendanceRate")} value={`${data.kpi.avgAttendanceRate}%`} />
          <StatRow label={t("hrReport.totalIncidents")} value={`${data.kpi.totalIncidents}건`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("hrReport.monthlyBreakdown")}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left py-1">월</th>
                <th className="text-right py-1">선수단</th>
                <th className="text-right py-1">이직률</th>
                <th className="text-right py-1">출석률</th>
                <th className="text-right py-1">이슈</th>
              </tr>
            </thead>
            <tbody>
              {data.monthlyBreakdown.map((row) => (
                <tr key={row.month} className="border-b last:border-0">
                  <td className="py-1">{row.month}월</td>
                  <td className="text-right">{row.headcount}</td>
                  <td className="text-right">{row.turnoverRate}%</td>
                  <td className="text-right">{row.attendanceRate}%</td>
                  <td className="text-right">{row.incidents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("hrReport.wageAnalysis")}</CardTitle></CardHeader>
        <CardContent>
          <StatRow label={t("hrReport.totalAnnualWage")} value={`₩${fmt(data.wageAnalysis.totalAnnualWage)}`} />
          <StatRow label={t("hrReport.avgSalary")} value={`₩${fmt(data.wageAnalysis.avgSalary)}`} />
          <StatRow label={t("hrReport.minSalary")} value={`₩${fmt(data.wageAnalysis.minSalary)}`} />
          <StatRow label={t("hrReport.maxSalary")} value={`₩${fmt(data.wageAnalysis.maxSalary)}`} />
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1">{t("hrReport.distribution")}</p>
            <div className="space-y-1">
              {data.wageAnalysis.distribution.map((d) => (
                <div key={d.label} className="flex items-center gap-2 text-sm">
                  <span className="w-24 text-muted-foreground">{d.label}</span>
                  <div className="flex-1 bg-muted rounded h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 rounded"
                      style={{
                        width: `${data.wageAnalysis.playerCount > 0 ? (d.count / data.wageAnalysis.playerCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("hrReport.turnover")}</CardTitle></CardHeader>
          <CardContent>
            <StatRow label={t("hrReport.annualTurnoverRate")} value={`${data.turnover.annualRate}%`} />
            <StatRow label={t("hrReport.departures")} value={`${data.turnover.totalDepartures}명`} />
            {data.turnover.peakMonth > 0 && (
              <StatRow label={t("hrReport.peakMonth")} value={`${data.turnover.peakMonth}월`} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("hrReport.attendance")}</CardTitle></CardHeader>
          <CardContent>
            <StatRow label={t("hrReport.avgAttendanceRate")} value={`${data.attendance.annualRate}%`} />
            <StatRow label={t("hrReport.totalAbsences")} value={`${data.attendance.totalAbsences}건`} />
            {data.attendance.worstMonth > 0 && (
              <StatRow label={t("hrReport.worstMonth")} value={`${data.attendance.worstMonth}월`} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("hrReport.issues")}</CardTitle></CardHeader>
        <CardContent>
          <StatRow label={t("hrReport.incidents")} value={`${data.issues.total}건`} />
          <StatRow label={t("hrReport.injuries")} value={`${data.issues.totalInjuries}명`} />
          {data.issues.byType.length > 0 && (
            <div className="mt-2 flex gap-1 flex-wrap">
              {data.issues.byType.map((r) => (
                <Badge key={r.type} variant="secondary">{r.type} {r.count}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function HrReportPage() {
  const { t } = useTranslation("admin")
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [tab, setTab] = useState<"monthly" | "annual">("monthly")
  const [monthly, setMonthly] = useState<HrMonthlyReport | null>(null)
  const [annual, setAnnual] = useState<HrAnnualReport | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      if (tab === "monthly") {
        setMonthly(await hrReportApi.monthly(year, month))
      } else {
        setAnnual(await hrReportApi.annual(year))
      }
    } catch {
      toast.error("보고서 조회 실패")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">{t("hrReport.title")}</h1>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as "monthly" | "annual"); setMonthly(null); setAnnual(null) }}>
        <TabsList>
          <TabsTrigger value="monthly">{t("hrReport.tabMonthly")}</TabsTrigger>
          <TabsTrigger value="annual">{t("hrReport.tabAnnual")}</TabsTrigger>
        </TabsList>

        <div className="flex gap-2 mt-3 items-end">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t("hrReport.year")}</p>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {tab === "monthly" && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t("hrReport.month")}</p>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={load} disabled={loading}>
            {loading ? "조회 중..." : t("hrReport.generate")}
          </Button>
        </div>

        <TabsContent value="monthly" className="mt-4">
          {monthly
            ? <MonthlyReport data={monthly} />
            : <p className="text-sm text-muted-foreground text-center py-8">연도·월을 선택하고 조회 버튼을 누르세요.</p>
          }
        </TabsContent>
        <TabsContent value="annual" className="mt-4">
          {annual
            ? <AnnualReport data={annual} />
            : <p className="text-sm text-muted-foreground text-center py-8">연도를 선택하고 조회 버튼을 누르세요.</p>
          }
        </TabsContent>
      </Tabs>
    </div>
  )
}
