import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { medicalExpenseApi } from '@/services/medical-expense.service'
import type { ExpenseCostCategory, ExpensePayerType, MedicalExpense } from '@/types/medical-expense'
import { COST_CATEGORY_LABEL, PAYER_TYPE_LABEL } from '@/types/medical-expense'
import { playerApi } from '@/services/player.service'
import type { Player } from '@/types/player'
import { POSITION_ABBR } from '@/types/player'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'

const COST_CATEGORIES: ExpenseCostCategory[] = ['OUTPATIENT', 'EXAMINATION', 'SURGERY', 'REHABILITATION', 'MEDICATION']
const PAYER_TYPES: ExpensePayerType[] = ['CLUB', 'ASSOCIATION', 'INDIVIDUAL']

export function MedicalExpenseFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])

  const [receiptDate, setReceiptDate] = useState('')
  const [costCategory, setCostCategory] = useState<ExpenseCostCategory>('OUTPATIENT')
  const [totalAmount, setTotalAmount] = useState('')
  const [payerType, setPayerType] = useState<ExpensePayerType>('CLUB')
  const [playerId, setPlayerId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | undefined>()

  useEffect(() => {
    playerApi.list({ status: 'ACTIVE' }).then(setPlayers).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    medicalExpenseApi
      .get(Number(id))
      .then((e: MedicalExpense) => {
        setReceiptDate(e.receiptDate.slice(0, 10))
        setCostCategory(e.costCategory)
        setTotalAmount(String(e.totalAmount))
        setPayerType(e.payerType)
        setPlayerId(e.playerId ?? '')
        setDescription(e.description ?? '')
      })
      .catch(() => { toast.error('불러오지 못했습니다.'); navigate('/medical-expenses') })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleSave = async (andSubmit = false) => {
    if (!receiptDate || !totalAmount) { toast.error('날짜와 금액을 입력해주세요.'); return }
    setSaving(true)
    try {
      const dto = {
        receiptDate,
        costCategory,
        totalAmount: Number(totalAmount),
        payerType,
        ...(playerId && { playerId }),
        description: description || undefined,
        file,
      }
      let saved: MedicalExpense
      if (isEdit && id) {
        saved = await medicalExpenseApi.update(Number(id), dto)
      } else {
        saved = await medicalExpenseApi.create(dto)
      }
      if (andSubmit) {
        await medicalExpenseApi.submit(saved.id)
        toast.success('상신됐습니다.')
      } else {
        toast.success(isEdit ? '저장됐습니다.' : '초안으로 저장됐습니다.')
      }
      navigate(`/medical-expenses/${saved.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/medical-expenses')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">
          {isEdit ? '의료비 수정' : '의료비 등록'}
        </h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-lg space-y-4">
          <div className="space-y-1.5">
            <Label>영수증 날짜 *</Label>
            <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>비용 항목 *</Label>
            <Select value={costCategory} onValueChange={(v) => setCostCategory(v as ExpenseCostCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COST_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{COST_CATEGORY_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>금액 (원) *</Label>
            <Input
              type="number"
              min={0}
              placeholder="예: 50000"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>납부 주체 *</Label>
            <Select value={payerType} onValueChange={(v) => setPayerType(v as ExpensePayerType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYER_TYPES.map((p) => (
                  <SelectItem key={p} value={p}>{PAYER_TYPE_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>대상 선수 (선택)</Label>
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="선수 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">선수 미지정</SelectItem>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.playerName} ({POSITION_ABBR[p.position]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>비고</Label>
            <Textarea
              placeholder="추가 설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>영수증 파일 (선택)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0])} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? '저장 중...' : '임시 저장'}
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving}>
              {saving ? '처리 중...' : '저장 후 상신'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
