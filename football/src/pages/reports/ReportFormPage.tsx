import { useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { reportApi } from '@/services/report.service'
import type { ReportType } from '@/types/report'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Paperclip, X, ScanLine, Loader2 } from 'lucide-react'
import { hrReportApi } from '@/services/hr-report.service'

const ALL_TYPES: ReportType[] = ['PERFORMANCE', 'MEDICAL', 'TRAINING', 'HR', 'FINANCIAL', 'ASSET']
type HrPeriod = 'monthly' | 'annual'

const now = new Date()
const THIS_YEAR = now.getFullYear()
const THIS_MONTH = now.getMonth() + 1
const YEARS = Array.from({ length: 5 }, (_, i) => THIS_YEAR - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

// ─── Monthly form state ───────────────────────────────────────────────────────
interface MonthlyData {
  year: number; month: number
  ownPlayers: string; loanIn: string; onLoanOut: string
  admin: string; frontOffice: string; coachingStaff: string; staffRecords: string
  transfersIn: string; transfersOut: string; newContracts: string
  openCoachingRounds: string; openJobPostings: string
  present: string; absentUnauthorized: string; lateUnauthorized: string; absentAuthorized: string
  totalIncidents: string; newInjuries: string; safeguardReports: string
  notes: string
}

const initMonthly = (): MonthlyData => ({
  year: THIS_YEAR, month: THIS_MONTH,
  ownPlayers: '', loanIn: '', onLoanOut: '',
  admin: '', frontOffice: '', coachingStaff: '', staffRecords: '',
  transfersIn: '', transfersOut: '', newContracts: '', openCoachingRounds: '', openJobPostings: '',
  present: '', absentUnauthorized: '', lateUnauthorized: '', absentAuthorized: '',
  totalIncidents: '', newInjuries: '', safeguardReports: '',
  notes: '',
})

function serializeMonthly(d: MonthlyData): string {
  const total = [d.present, d.absentUnauthorized, d.lateUnauthorized, d.absentAuthorized]
    .map(Number).reduce((a, b) => a + b, 0)
  const attendanceRate = total > 0 ? ((Number(d.present) / total) * 100).toFixed(1) : '-'
  const net = Number(d.transfersIn) - Number(d.transfersOut)

  return `보고 기간: ${d.year}년 ${d.month}월

## 1. 인원 현황
- 자체 선수: ${d.ownPlayers}명 / 임대 영입: ${d.loanIn}명 / 임대 방출: ${d.onLoanOut}명
- 관리직: ${d.admin}명 / 프런트: ${d.frontOffice}명 / 코칭스태프: ${d.coachingStaff}명
- 직원기록(활성): ${d.staffRecords}명

## 2. 이적·채용
- 영입: ${d.transfersIn}명 / 방출: ${d.transfersOut}명 / 순변동: ${net >= 0 ? '+' : ''}${net}명
- 신규 계약 체결: ${d.newContracts}건
- 열린 코칭 채용: ${d.openCoachingRounds}건 / 열린 구인공고: ${d.openJobPostings}건

## 3. 출석
- 출석: ${d.present}건 / 무단결석: ${d.absentUnauthorized}건 / 무단지각: ${d.lateUnauthorized}건 / 공인결석: ${d.absentAuthorized}건
- 출석률: ${attendanceRate}%

## 4. 이슈
- 사건사고: ${d.totalIncidents}건 / 신규 부상자: ${d.newInjuries}명 / 세이프가드 신고: ${d.safeguardReports}건

## 5. 특이사항
${d.notes || '없음'}`
}

// ─── Annual form state ────────────────────────────────────────────────────────
interface MonthRow { headcount: string; turnoverRate: string; attendanceRate: string; incidents: string }
interface AnnualData {
  year: number
  avgHeadcount: string; totalRecruitment: string; annualTurnoverRate: string
  avgAttendanceRate: string; totalIncidents: string
  monthlyBreakdown: MonthRow[]
  totalAnnualWage: string; avgSalary: string; minSalary: string; maxSalary: string
  dist300: string; dist300_500: string; dist500_1000: string; dist1000plus: string
  totalDepartures: string; peakMonth: string
  annualAttendanceRate: string; totalAbsences: string; worstMonth: string
  totalIssues: string; totalInjuries: string; issuesByType: string
  summary: string
}

const initAnnual = (): AnnualData => ({
  year: THIS_YEAR,
  avgHeadcount: '', totalRecruitment: '', annualTurnoverRate: '', avgAttendanceRate: '', totalIncidents: '',
  monthlyBreakdown: Array.from({ length: 12 }, () => ({ headcount: '', turnoverRate: '', attendanceRate: '', incidents: '' })),
  totalAnnualWage: '', avgSalary: '', minSalary: '', maxSalary: '',
  dist300: '', dist300_500: '', dist500_1000: '', dist1000plus: '',
  totalDepartures: '', peakMonth: '',
  annualAttendanceRate: '', totalAbsences: '', worstMonth: '',
  totalIssues: '', totalInjuries: '', issuesByType: '',
  summary: '',
})

function serializeAnnual(d: AnnualData): string {
  const monthTable = d.monthlyBreakdown
    .map((r, i) => `| ${i + 1}월 | ${r.headcount} | ${r.turnoverRate} | ${r.attendanceRate} | ${r.incidents} |`)
    .join('\n')

  return `보고 기간: ${d.year}년 연간

## 1. 연간 KPI
- 평균 선수단: ${d.avgHeadcount}명 / 총 영입: ${d.totalRecruitment}명
- 연간 이직률: ${d.annualTurnoverRate}% / 평균 출석률: ${d.avgAttendanceRate}%
- 총 사건사고: ${d.totalIncidents}건

## 2. 월별 현황
| 월 | 선수단 | 이직률(%) | 출석률(%) | 이슈 |
|---|---|---|---|---|
${monthTable}

## 3. 임금 분석
- 총 연봉합계: ${d.totalAnnualWage}만원 / 평균: ${d.avgSalary}만원 / 최소: ${d.minSalary}만원 / 최대: ${d.maxSalary}만원
- 구간별: 300만미만 ${d.dist300}명 / 300~500만 ${d.dist300_500}명 / 500~1000만 ${d.dist500_1000}명 / 1000만+ ${d.dist1000plus}명

## 4. 이직
- 연간 이직률: ${d.annualTurnoverRate}% / 총 방출: ${d.totalDepartures}명 / 최다 이직 월: ${d.peakMonth}월

## 5. 출석
- 연간 출석률: ${d.annualAttendanceRate}% / 총 결석·지각: ${d.totalAbsences}건 / 최저 출석 월: ${d.worstMonth}월

## 6. 이슈
- 총 이슈: ${d.totalIssues}건 / 총 부상자: ${d.totalInjuries}명
- 유형별: ${d.issuesByType || '-'}

## 7. 종합 평가
${d.summary || '없음'}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-sm text-muted-foreground shrink-0">{label}</span>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, unit, wide }: { value: string; onChange: (v: string) => void; unit?: string; wide?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <Input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} className={`${wide ? 'w-36' : 'w-24'} h-8 text-sm`} />
      {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
    </div>
  )
}

function MonthlyForm({ data, onChange }: { data: MonthlyData; onChange: (d: MonthlyData) => void }) {
  const set = (k: keyof MonthlyData) => (v: string | number) => onChange({ ...data, [k]: v })

  const total = [data.present, data.absentUnauthorized, data.lateUnauthorized, data.absentAuthorized]
    .map(Number).reduce((a, b) => a + b, 0)
  const attendanceRate = total > 0 ? ((Number(data.present) / total) * 100).toFixed(1) : '-'

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="space-y-1">
          <Label className="text-xs">연도</Label>
          <Select value={String(data.year)} onValueChange={(v) => set('year')(Number(v))}>
            <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">월</Label>
          <Select value={String(data.month)} onValueChange={(v) => set('month')(Number(v))}>
            <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m) => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">1. 인원 현황</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <FieldRow label="자체 선수"><NumInput value={data.ownPlayers} onChange={set('ownPlayers')} unit="명" /></FieldRow>
          <FieldRow label="임대 영입"><NumInput value={data.loanIn} onChange={set('loanIn')} unit="명" /></FieldRow>
          <FieldRow label="임대 방출"><NumInput value={data.onLoanOut} onChange={set('onLoanOut')} unit="명" /></FieldRow>
          <FieldRow label="관리직"><NumInput value={data.admin} onChange={set('admin')} unit="명" /></FieldRow>
          <FieldRow label="프런트"><NumInput value={data.frontOffice} onChange={set('frontOffice')} unit="명" /></FieldRow>
          <FieldRow label="코칭스태프"><NumInput value={data.coachingStaff} onChange={set('coachingStaff')} unit="명" /></FieldRow>
          <FieldRow label="직원기록(활성)"><NumInput value={data.staffRecords} onChange={set('staffRecords')} unit="명" /></FieldRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">2. 이적·채용</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <FieldRow label="영입"><NumInput value={data.transfersIn} onChange={set('transfersIn')} unit="명" /></FieldRow>
          <FieldRow label="방출"><NumInput value={data.transfersOut} onChange={set('transfersOut')} unit="명" /></FieldRow>
          <FieldRow label="신규 계약 체결"><NumInput value={data.newContracts} onChange={set('newContracts')} unit="건" /></FieldRow>
          <FieldRow label="열린 코칭 채용"><NumInput value={data.openCoachingRounds} onChange={set('openCoachingRounds')} unit="건" /></FieldRow>
          <FieldRow label="열린 구인공고"><NumInput value={data.openJobPostings} onChange={set('openJobPostings')} unit="건" /></FieldRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">3. 출석</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <FieldRow label="출석"><NumInput value={data.present} onChange={set('present')} unit="건" /></FieldRow>
          <FieldRow label="무단 결석"><NumInput value={data.absentUnauthorized} onChange={set('absentUnauthorized')} unit="건" /></FieldRow>
          <FieldRow label="무단 지각"><NumInput value={data.lateUnauthorized} onChange={set('lateUnauthorized')} unit="건" /></FieldRow>
          <FieldRow label="공인 결석"><NumInput value={data.absentAuthorized} onChange={set('absentAuthorized')} unit="건" /></FieldRow>
          <div className="flex items-center gap-3 pt-2 border-t mt-1">
            <span className="w-36 text-sm text-muted-foreground shrink-0">출석률</span>
            <span className="text-sm font-semibold tabular-nums">{attendanceRate}%</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">자동계산</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">4. 이슈</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <FieldRow label="사건사고"><NumInput value={data.totalIncidents} onChange={set('totalIncidents')} unit="건" /></FieldRow>
          <FieldRow label="신규 부상자"><NumInput value={data.newInjuries} onChange={set('newInjuries')} unit="명" /></FieldRow>
          <FieldRow label="세이프가드 신고"><NumInput value={data.safeguardReports} onChange={set('safeguardReports')} unit="건" /></FieldRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">5. 특이사항</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={data.notes} onChange={(e) => set('notes')(e.target.value)} rows={4} placeholder="이달의 주요 이슈, 조치사항 등을 자유롭게 작성하세요." />
        </CardContent>
      </Card>
    </div>
  )
}

function AnnualForm({ data, onChange }: { data: AnnualData; onChange: (d: AnnualData) => void }) {
  const set = (k: keyof AnnualData) => (v: string | number) => onChange({ ...data, [k]: v })
  const setRow = (i: number, k: keyof MonthRow, v: string) => {
    const next = data.monthlyBreakdown.map((r, idx) => idx === i ? { ...r, [k]: v } : r)
    onChange({ ...data, monthlyBreakdown: next })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">연도</Label>
        <Select value={String(data.year)} onValueChange={(v) => set('year')(Number(v))}>
          <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">1. 연간 KPI</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <FieldRow label="평균 선수단"><NumInput value={data.avgHeadcount} onChange={set('avgHeadcount')} unit="명" /></FieldRow>
          <FieldRow label="총 영입"><NumInput value={data.totalRecruitment} onChange={set('totalRecruitment')} unit="명" /></FieldRow>
          <FieldRow label="연간 이직률"><NumInput value={data.annualTurnoverRate} onChange={set('annualTurnoverRate')} unit="%" /></FieldRow>
          <FieldRow label="평균 출석률"><NumInput value={data.avgAttendanceRate} onChange={set('avgAttendanceRate')} unit="%" /></FieldRow>
          <FieldRow label="총 사건사고"><NumInput value={data.totalIncidents} onChange={set('totalIncidents')} unit="건" /></FieldRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">2. 월별 현황</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-1 w-10">월</th>
                <th className="text-center py-1">선수단</th>
                <th className="text-center py-1">이직률(%)</th>
                <th className="text-center py-1">출석률(%)</th>
                <th className="text-center py-1">이슈</th>
              </tr>
            </thead>
            <tbody>
              {data.monthlyBreakdown.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1 text-muted-foreground">{i + 1}월</td>
                  {(['headcount', 'turnoverRate', 'attendanceRate', 'incidents'] as const).map((k) => (
                    <td key={k} className="py-1 px-1">
                      <Input type="number" min={0} value={r[k]} onChange={(e) => setRow(i, k, e.target.value)} className="h-7 w-20 text-center text-sm mx-auto" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">3. 임금 분석</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <FieldRow label="총 연봉합계"><NumInput value={data.totalAnnualWage} onChange={set('totalAnnualWage')} unit="만원" wide /></FieldRow>
          <FieldRow label="평균 연봉"><NumInput value={data.avgSalary} onChange={set('avgSalary')} unit="만원" wide /></FieldRow>
          <FieldRow label="최소 연봉"><NumInput value={data.minSalary} onChange={set('minSalary')} unit="만원" wide /></FieldRow>
          <FieldRow label="최대 연봉"><NumInput value={data.maxSalary} onChange={set('maxSalary')} unit="만원" wide /></FieldRow>
          <div className="pt-1 space-y-1">
            <p className="text-xs text-muted-foreground">구간별 계약 수</p>
            <div className="space-y-2">
              <FieldRow label="300만 미만"><NumInput value={data.dist300} onChange={set('dist300')} unit="명" /></FieldRow>
              <FieldRow label="300~500만"><NumInput value={data.dist300_500} onChange={set('dist300_500')} unit="명" /></FieldRow>
              <FieldRow label="500~1000만"><NumInput value={data.dist500_1000} onChange={set('dist500_1000')} unit="명" /></FieldRow>
              <FieldRow label="1000만+"><NumInput value={data.dist1000plus} onChange={set('dist1000plus')} unit="명" /></FieldRow>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">4. 이직</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <FieldRow label="총 방출"><NumInput value={data.totalDepartures} onChange={set('totalDepartures')} unit="명" /></FieldRow>
          <FieldRow label="최다 이직 월">
            <Select value={data.peakMonth} onValueChange={set('peakMonth')}>
              <SelectTrigger className="w-20 h-8"><SelectValue placeholder="-" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">-</SelectItem>
                {MONTHS.map((m) => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">5. 출석</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <FieldRow label="연간 출석률"><NumInput value={data.annualAttendanceRate} onChange={set('annualAttendanceRate')} unit="%" /></FieldRow>
          <FieldRow label="총 결석·지각"><NumInput value={data.totalAbsences} onChange={set('totalAbsences')} unit="건" /></FieldRow>
          <FieldRow label="최저 출석 월">
            <Select value={data.worstMonth} onValueChange={set('worstMonth')}>
              <SelectTrigger className="w-20 h-8"><SelectValue placeholder="-" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">-</SelectItem>
                {MONTHS.map((m) => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">6. 이슈</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <FieldRow label="총 이슈"><NumInput value={data.totalIssues} onChange={set('totalIssues')} unit="건" /></FieldRow>
          <FieldRow label="총 부상자"><NumInput value={data.totalInjuries} onChange={set('totalInjuries')} unit="명" /></FieldRow>
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">유형별 (예: 폭력 2건, 도핑 1건)</span>
            <Input value={data.issuesByType} onChange={(e) => set('issuesByType')(e.target.value)} placeholder="유형별 이슈 입력" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">7. 종합 평가 및 내년 계획</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={data.summary} onChange={(e) => set('summary')(e.target.value)} rows={5} placeholder="연간 총평 및 내년도 계획을 작성하세요." />
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function ReportFormPage() {
  const { t } = useTranslation('report')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useCurrentUser()
  const isAdmin = user?.role === 'ADMIN'
  const foRole = user?.frontOfficeRole
  const deptCategories = user?.departmentCategories ?? []
  const TYPES = ALL_TYPES.filter((tp) => {
    if (tp === 'HR') return isAdmin || foRole === 'HR_MANAGER' || foRole === 'HR_STAFF' || deptCategories.includes('HR')
    if (tp === 'FINANCIAL') return isAdmin || user?.role === 'GM' || foRole === 'FINANCE_MANAGER' || foRole === 'FINANCE_STAFF' || deptCategories.includes('FINANCE')
    if (tp === 'ASSET') return isAdmin || foRole === 'ASSET_MANAGER' || foRole === 'ASSET_STAFF'
    return true
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const initialType = searchParams.get('type') as ReportType | null
  const [type, setType] = useState<ReportType>(() =>
    initialType && TYPES.includes(initialType) ? initialType : (TYPES[0] ?? 'PERFORMANCE')
  )
  const [hrPeriod, setHrPeriod] = useState<HrPeriod>('monthly')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [monthly, setMonthly] = useState<MonthlyData>(initMonthly)
  const [annual, setAnnual] = useState<AnnualData>(initAnnual)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const imageRef = useRef<HTMLInputElement>(null)

  const handleExtractImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const img = e.target.files?.[0]
    if (!img) return
    setExtracting(true)
    try {
      const result = await hrReportApi.extractImage(img, hrPeriod)
      if (hrPeriod === 'monthly') {
        setMonthly((prev) => ({
          ...prev,
          ownPlayers: result.ownPlayers != null ? String(result.ownPlayers) : prev.ownPlayers,
          loanIn: result.loanIn != null ? String(result.loanIn) : prev.loanIn,
          onLoanOut: result.onLoanOut != null ? String(result.onLoanOut) : prev.onLoanOut,
          admin: result.admin != null ? String(result.admin) : prev.admin,
          frontOffice: result.frontOffice != null ? String(result.frontOffice) : prev.frontOffice,
          coachingStaff: result.coachingStaff != null ? String(result.coachingStaff) : prev.coachingStaff,
          staffRecords: result.staffRecords != null ? String(result.staffRecords) : prev.staffRecords,
          transfersIn: result.transfersIn != null ? String(result.transfersIn) : prev.transfersIn,
          transfersOut: result.transfersOut != null ? String(result.transfersOut) : prev.transfersOut,
          newContracts: result.newContracts != null ? String(result.newContracts) : prev.newContracts,
          openCoachingRounds: result.openCoachingRounds != null ? String(result.openCoachingRounds) : prev.openCoachingRounds,
          openJobPostings: result.openJobPostings != null ? String(result.openJobPostings) : prev.openJobPostings,
          present: result.present != null ? String(result.present) : prev.present,
          absentUnauthorized: result.absentUnauthorized != null ? String(result.absentUnauthorized) : prev.absentUnauthorized,
          lateUnauthorized: result.lateUnauthorized != null ? String(result.lateUnauthorized) : prev.lateUnauthorized,
          absentAuthorized: result.absentAuthorized != null ? String(result.absentAuthorized) : prev.absentAuthorized,
          totalIncidents: result.totalIncidents != null ? String(result.totalIncidents) : prev.totalIncidents,
          newInjuries: result.newInjuries != null ? String(result.newInjuries) : prev.newInjuries,
          safeguardReports: result.safeguardReports != null ? String(result.safeguardReports) : prev.safeguardReports,
          notes: result.notes != null ? String(result.notes) : prev.notes,
        }))
      } else {
        const mb = Array.isArray(result.monthlyBreakdown) ? result.monthlyBreakdown : []
        setAnnual((prev) => ({
          ...prev,
          avgHeadcount: result.avgHeadcount != null ? String(result.avgHeadcount) : prev.avgHeadcount,
          totalRecruitment: result.totalRecruitment != null ? String(result.totalRecruitment) : prev.totalRecruitment,
          annualTurnoverRate: result.annualTurnoverRate != null ? String(result.annualTurnoverRate) : prev.annualTurnoverRate,
          avgAttendanceRate: result.avgAttendanceRate != null ? String(result.avgAttendanceRate) : prev.avgAttendanceRate,
          totalIncidents: result.totalIncidents != null ? String(result.totalIncidents) : prev.totalIncidents,
          monthlyBreakdown: prev.monthlyBreakdown.map((r, i) => {
            const src = mb.find((m: Record<string, unknown>) => Number(m.month) === i + 1)
            if (!src) return r
            return {
              headcount: src.headcount != null ? String(src.headcount) : r.headcount,
              turnoverRate: src.turnoverRate != null ? String(src.turnoverRate) : r.turnoverRate,
              attendanceRate: src.attendanceRate != null ? String(src.attendanceRate) : r.attendanceRate,
              incidents: src.incidents != null ? String(src.incidents) : r.incidents,
            }
          }),
          totalAnnualWage: result.totalAnnualWage != null ? String(result.totalAnnualWage) : prev.totalAnnualWage,
          avgSalary: result.avgSalary != null ? String(result.avgSalary) : prev.avgSalary,
          minSalary: result.minSalary != null ? String(result.minSalary) : prev.minSalary,
          maxSalary: result.maxSalary != null ? String(result.maxSalary) : prev.maxSalary,
          dist300: result.dist300 != null ? String(result.dist300) : prev.dist300,
          dist300_500: result.dist300_500 != null ? String(result.dist300_500) : prev.dist300_500,
          dist500_1000: result.dist500_1000 != null ? String(result.dist500_1000) : prev.dist500_1000,
          dist1000plus: result.dist1000plus != null ? String(result.dist1000plus) : prev.dist1000plus,
          totalDepartures: result.totalDepartures != null ? String(result.totalDepartures) : prev.totalDepartures,
          peakMonth: result.peakMonth != null ? String(result.peakMonth) : prev.peakMonth,
          annualAttendanceRate: result.annualAttendanceRate != null ? String(result.annualAttendanceRate) : prev.annualAttendanceRate,
          totalAbsences: result.totalAbsences != null ? String(result.totalAbsences) : prev.totalAbsences,
          worstMonth: result.worstMonth != null ? String(result.worstMonth) : prev.worstMonth,
          totalIssues: result.totalIssues != null ? String(result.totalIssues) : prev.totalIssues,
          totalInjuries: result.totalInjuries != null ? String(result.totalInjuries) : prev.totalInjuries,
          issuesByType: result.issuesByType != null ? String(result.issuesByType) : prev.issuesByType,
          summary: result.summary != null ? String(result.summary) : prev.summary,
        }))
      }
      toast.success('이미지에서 데이터를 추출했습니다. 값을 확인 후 수정하세요.')
    } catch {
      toast.error('이미지 추출 실패. ANTHROPIC_API_KEY가 설정되어 있는지 확인하세요.')
    } finally {
      setExtracting(false)
      e.target.value = ''
    }
  }

  const handleSave = async (asDraft: boolean) => {
    if (!title.trim()) { toast.error(t('form.titleRequired')); return }

    const finalContent = type === 'HR'
      ? (hrPeriod === 'monthly' ? serializeMonthly(monthly) : serializeAnnual(annual))
      : content

    if (!finalContent.trim()) { toast.error(t('form.contentRequired')); return }

    setSaving(true)
    try {
      const report = await reportApi.create({ type, title: title.trim(), content: finalContent, file: file ?? undefined })
      if (!asDraft) {
        await reportApi.submit(report.id)
        toast.success(t('form.submitted'))
      } else {
        toast.success(t('form.draftSaved'))
      }
      navigate('/reports')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('form.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">{t('form.title')}</h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-5">
          <div className="flex gap-3 items-end">
            <div className="space-y-1.5">
              <Label>{t('form.typeLabel')} *</Label>
              <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
                <SelectTrigger className="w-48"><SelectValue>{t(`type.${type}`)}</SelectValue></SelectTrigger>
                <SelectContent>
                  {TYPES.map((tp) => <SelectItem key={tp} value={tp}>{t(`type.${tp}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {type === 'HR' && (
              <div className="space-y-1.5">
                <Label>보고서 종류</Label>
                <Select value={hrPeriod} onValueChange={(v) => setHrPeriod(v as HrPeriod)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">월말 보고서</SelectItem>
                    <SelectItem value="annual">연말 보고서</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('form.titleLabel')} *</Label>
            <Input
              placeholder={type === 'HR' ? `예) ${THIS_YEAR}년 ${THIS_MONTH}월 HR 월말 보고서` : t('form.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {type === 'HR' && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed bg-muted/40">
              <ScanLine className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground flex-1">보고서 이미지를 업로드하면 자동으로 입력칸을 채웁니다</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={extracting}
                onClick={() => imageRef.current?.click()}
              >
                {extracting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />분석 중...</> : <><ScanLine className="h-4 w-4 mr-1.5" />이미지 업로드</>}
              </Button>
              <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleExtractImage} />
            </div>
          )}

          {type === 'HR' ? (
            hrPeriod === 'monthly'
              ? <MonthlyForm data={monthly} onChange={setMonthly} />
              : <AnnualForm data={annual} onChange={setAnnual} />
          ) : (
            <div className="space-y-1.5">
              <Label>{t('form.contentLabel')} *</Label>
              <Textarea
                placeholder={t('form.contentPlaceholder')}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t('form.attachLabel')}</Label>
            {file ? (
              <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Paperclip className="h-4 w-4 mr-1.5" />{t('form.attachButton')}
              </Button>
            )}
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate('/reports')} disabled={saving}>{t('form.cancel')}</Button>
            <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>{t('form.saveDraft')}</Button>
            <Button onClick={() => handleSave(false)} disabled={saving}>
              {saving ? t('form.processing') : t('form.submit')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
