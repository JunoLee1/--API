import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { mealExpenseApi } from "@/services/meal-expense.service"
import type { MealExpense, MealExpenseType } from "@/services/meal-expense.service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const TYPES: MealExpenseType[] = ["TRAINING", "MATCH"]

export function MealExpensePage() {
  const { t } = useTranslation("admin")
  const [expenses, setExpenses] = useState<MealExpense[]>([])
  const [open, setOpen] = useState(false)
  const [filterType, setFilterType] = useState<MealExpenseType | "">("")
  const [filterFrom, setFilterFrom] = useState("")
  const [filterTo, setFilterTo] = useState("")
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: "TRAINING" as MealExpenseType,
    date: "",
    amount: "",
    restaurantName: "",
    note: "",
  })

  const fetchExpenses = async () => {
    try {
      setExpenses(
        await mealExpenseApi.list({
          type: filterType || undefined,
          from: filterFrom || undefined,
          to: filterTo || undefined,
        })
      )
    } catch {
      toast.error("불러오기 실패")
    }
  }

  useEffect(() => { void fetchExpenses() }, [filterType, filterFrom, filterTo])

  const handleSubmit = async () => {
    const amount = parseInt(form.amount, 10)
    if (!form.date || isNaN(amount)) { toast.error("날짜와 금액을 입력하세요"); return }
    setSaving(true)
    try {
      await mealExpenseApi.create({
        type: form.type,
        date: form.date,
        amount,
        restaurantName: form.restaurantName || undefined,
        note: form.note || undefined,
      })
      setOpen(false)
      setForm({ type: "TRAINING", date: "", amount: "", restaurantName: "", note: "" })
      void fetchExpenses()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 실패")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t("mealExpense.confirmDelete"))) return
    try {
      await mealExpenseApi.delete(id)
      void fetchExpenses()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 실패")
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("mealExpense.title")}</h1>
        <Button onClick={() => setOpen(true)}>{t("mealExpense.add")}</Button>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">{t("mealExpense.date")} (from)</Label>
          <Input type="date" className="h-8 text-sm w-36" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("mealExpense.date")} (to)</Label>
          <Input type="date" className="h-8 text-sm w-36" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("mealExpense.type")}</Label>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as MealExpenseType | "")}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              {TYPES.map((tp) => (
                <SelectItem key={tp} value={tp}>{t(`mealExpense.${tp}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4">{t("mealExpense.date")}</th>
            <th className="py-2 pr-4">{t("mealExpense.type")}</th>
            <th className="py-2 pr-4">{t("mealExpense.amount")}</th>
            <th className="py-2 pr-4">{t("mealExpense.restaurantName")}</th>
            <th className="py-2 pr-4">{t("mealExpense.note")}</th>
            <th className="py-2 pr-4">작성자</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id} className="border-b hover:bg-muted/30">
              <td className="py-2 pr-4">{e.date.slice(0, 10)}</td>
              <td className="py-2 pr-4">
                <Badge variant={e.type === "MATCH" ? "default" : "secondary"}>
                  {t(`mealExpense.${e.type}`)}
                </Badge>
              </td>
              <td className="py-2 pr-4">{e.amount.toLocaleString()}</td>
              <td className="py-2 pr-4 text-muted-foreground">{e.restaurantName ?? "-"}</td>
              <td className="py-2 pr-4 text-muted-foreground">{e.note ?? "-"}</td>
              <td className="py-2 pr-4 text-muted-foreground">{e.createdBy.username}</td>
              <td className="py-2 flex gap-2 justify-end">
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void handleDelete(e.id)}>
                  {t("action.delete", { ns: "common" })}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("mealExpense.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("mealExpense.type")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as MealExpenseType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp}>{t(`mealExpense.${tp}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("mealExpense.date")}</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("mealExpense.amount")}</Label>
              <Input type="number" min={0} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("mealExpense.restaurantName")}</Label>
              <Input value={form.restaurantName} onChange={(e) => setForm((f) => ({ ...f, restaurantName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("mealExpense.note")}</Label>
              <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={() => void handleSubmit()} disabled={saving}>
              {t("action.save", { ns: "common" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
