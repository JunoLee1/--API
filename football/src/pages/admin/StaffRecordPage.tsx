import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { staffRecordApi } from "@/services/staff-record.service"
import type { StaffRecord } from "@/services/staff-record.service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

export function StaffRecordPage() {
  const { t } = useTranslation("admin")
  const [records, setRecords] = useState<StaffRecord[]>([])
  const [includeInactive, setIncludeInactive] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StaffRecord | null>(null)
  const [form, setForm] = useState({ name: "", role: "", department: "", phone: "", notes: "" })
  const [saving, setSaving] = useState(false)

  const fetchRecords = async () => {
    try {
      setRecords(await staffRecordApi.list(includeInactive))
    } catch {
      toast.error("불러오기 실패")
    }
  }

  useEffect(() => { void fetchRecords() }, [includeInactive])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: "", role: "", department: "", phone: "", notes: "" })
    setOpen(true)
  }

  const openEdit = (r: StaffRecord) => {
    setEditing(r)
    setForm({ name: r.name, role: r.role, department: r.department ?? "", phone: r.phone ?? "", notes: r.notes ?? "" })
    setOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.role.trim()) { toast.error("이름과 역할을 입력하세요"); return }
    setSaving(true)
    try {
      if (editing) {
        await staffRecordApi.update(editing.id, form)
      } else {
        await staffRecordApi.create(form)
      }
      setOpen(false)
      void fetchRecords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 실패")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t("staffRecord.confirmDelete"))) return
    try {
      await staffRecordApi.delete(id)
      void fetchRecords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 실패")
    }
  }

  const handleToggleActive = async (r: StaffRecord, value: boolean) => {
    try {
      await staffRecordApi.update(r.id, { isActive: value })
      void fetchRecords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "수정 실패")
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("staffRecord.title")}</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
            {t("staffRecord.showInactive")}
          </label>
          <Button onClick={openCreate}>{t("staffRecord.add")}</Button>
        </div>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4">{t("staffRecord.name")}</th>
            <th className="py-2 pr-4">{t("staffRecord.role")}</th>
            <th className="py-2 pr-4">{t("staffRecord.department")}</th>
            <th className="py-2 pr-4">{t("staffRecord.phone")}</th>
            <th className="py-2 pr-4">{t("staffRecord.status")}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b hover:bg-muted/30">
              <td className="py-2 pr-4 font-medium">{r.name}</td>
              <td className="py-2 pr-4">{r.role}</td>
              <td className="py-2 pr-4 text-muted-foreground">{r.department ?? "-"}</td>
              <td className="py-2 pr-4 text-muted-foreground">{r.phone ?? "-"}</td>
              <td className="py-2 pr-4">
                <Badge variant={r.isActive ? "default" : "secondary"}>
                  {r.isActive ? t("staffRecord.active") : t("staffRecord.inactive")}
                </Badge>
              </td>
              <td className="py-2 flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                  {t("action.edit", { ns: "common" })}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void handleDelete(r.id)}>
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
            <DialogTitle>{editing ? t("staffRecord.edit") : t("staffRecord.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(["name", "role", "department", "phone", "notes"] as const).map((field) => (
              <div key={field} className="space-y-1">
                <Label>{t(`staffRecord.${field}`)}</Label>
                <Input
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                />
              </div>
            ))}
            {editing && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.isActive}
                  onCheckedChange={(v) => void handleToggleActive(editing, v)}
                />
                <Label>{t("staffRecord.active")}</Label>
              </div>
            )}
            <Button className="w-full" onClick={() => void handleSubmit()} disabled={saving}>
              {t("action.save", { ns: "common" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
