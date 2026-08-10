import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { reportApi } from '@/services/report.service'
import type { ReviewRuleSet } from '@/types/report'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const REPORT_TYPES = ['PERFORMANCE', 'MEDICAL', 'TRAINING', 'HR', 'FINANCIAL', 'ASSET']
const DEPT_CATEGORIES = ['COMPLIANCE', 'PERFORMANCE', 'FINANCE', 'OPERATIONS', 'HR', 'MARKETING', 'LEGAL', 'MEDIA']

const REPORT_TYPE_LABEL: Record<string, string> = {
  PERFORMANCE: '퍼포먼스', MEDICAL: '의무', TRAINING: '훈련', HR: '인사', FINANCIAL: '재무', ASSET: '자산',
}
const CATEGORY_LABEL: Record<string, string> = {
  COMPLIANCE: '컴플라이언스', PERFORMANCE: '퍼포먼스', FINANCE: '재무', OPERATIONS: '운영',
  HR: '인사', MARKETING: '마케팅', LEGAL: '법무', MEDIA: '미디어',
}

export function ReviewRuleSetPage() {
  const [rules, setRules] = useState<ReviewRuleSet[]>([])
  const [reportType, setReportType] = useState<string>('')
  const [reviewerCategory, setReviewerCategory] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    reportApi.listRuleSets().then(setRules).catch(() => toast.error('룰셋을 불러오지 못했습니다'))
  }, [])

  const handleAdd = async () => {
    if (!reportType || !reviewerCategory) { toast.error('보고서 타입과 검토 부서 카테고리를 선택하세요'); return }
    setSaving(true)
    try {
      const created = await reportApi.createRuleSet(reportType, reviewerCategory)
      setRules((prev) => [...prev, created])
      setReportType('')
      setReviewerCategory('')
      toast.success('룰이 추가됐습니다')
    } catch {
      toast.error('이미 존재하는 룰이거나 추가에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await reportApi.deleteRuleSet(id)
      setRules((prev) => prev.filter((r) => r.id !== id))
      toast.success('삭제됐습니다')
    } catch {
      toast.error('삭제에 실패했습니다')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">보고서 검토 룰셋</h1>
        <p className="text-sm text-muted-foreground mt-0.5">보고서 타입별 자동 검토 부서 카테고리를 설정합니다</p>
      </div>

      <div className="rounded border p-4 space-y-3">
        <p className="text-sm font-medium">새 룰 추가</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">보고서 타입</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{REPORT_TYPE_LABEL[t] ?? t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">검토 부서 카테고리</Label>
            <Select value={reviewerCategory} onValueChange={setReviewerCategory}>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {DEPT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" onClick={handleAdd} disabled={saving || !reportType || !reviewerCategory}>
          <Plus className="h-3.5 w-3.5 mr-1" />추가
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>보고서 타입</TableHead>
            <TableHead>검토 부서 카테고리</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-8">
                등록된 룰이 없습니다
              </TableCell>
            </TableRow>
          )}
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell className="font-medium">{REPORT_TYPE_LABEL[rule.reportType] ?? rule.reportType}</TableCell>
              <TableCell>{CATEGORY_LABEL[rule.reviewerCategory] ?? rule.reviewerCategory}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDelete(rule.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
