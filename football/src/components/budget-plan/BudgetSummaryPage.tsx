import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DraftBudgetPlan } from './types'

interface Props {
  draft: DraftBudgetPlan
  onChange: (next: DraftBudgetPlan) => void
}

export function BudgetSummaryPage({ draft, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>예산 요약</CardTitle>
        <p className="text-sm text-muted-foreground">
          시즌 전체 운영 예산과 예비비, 선수 급여 예산을 설정합니다
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>총 운영 예산 (원)</Label>
          <Input
            type="number"
            placeholder="1000000000"
            value={draft.totalBudget}
            onChange={(e) => onChange({ ...draft, totalBudget: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>예비비 (원)</Label>
          <Input
            type="number"
            placeholder="0"
            value={draft.contingency}
            onChange={(e) => onChange({ ...draft, contingency: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>선수 급여 예산 (원) — 선택</Label>
          <Input
            type="number"
            placeholder="선택 입력"
            value={draft.playerSalaryBudget}
            onChange={(e) => onChange({ ...draft, playerSalaryBudget: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  )
}
