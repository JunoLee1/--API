import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { departmentApi } from '@/services/department.service'
import type { Department } from '@/services/department.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function DepartmentPage() {
  const { t } = useTranslation('admin')
  const [departments, setDepartments] = useState<Department[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<number | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  const fetchDepartments = async () => {
    try {
      setDepartments(await departmentApi.list())
    } catch {
      toast.error(t('department.loadFailed'))
    }
  }

  useEffect(() => { void fetchDepartments() }, [])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setParentId(undefined)
    setOpen(true)
  }

  const openCreateTeam = (deptId: number) => {
    setEditing(null)
    setName('')
    setParentId(deptId)
    setOpen(true)
  }

  const openEdit = (d: Department) => {
    setEditing(d)
    setName(d.name)
    setParentId(d.parentId ?? undefined)
    setOpen(true)
  }

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error(t('department.nameRequired')); return }
    setSaving(true)
    try {
      if (editing) {
        await departmentApi.update(editing.id, { name: name.trim() })
      } else {
        await departmentApi.create({
          name: name.trim(),
          ...(parentId !== undefined && { parentId }),
        })
      }
      setOpen(false)
      void fetchDepartments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('department.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('department.confirmDelete'))) return
    try {
      await departmentApi.delete(id)
      void fetchDepartments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('department.deleteFailed'))
    }
  }

  const handleToggleActive = async (d: Department, value: boolean) => {
    try {
      await departmentApi.update(d.id, { isActive: value })
      void fetchDepartments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('department.saveFailed'))
    }
  }

  const isTeamDialog = parentId !== undefined && !editing
  const dialogTitle = editing
    ? (editing.parentId !== null ? t('department.editTeam') : t('department.edit'))
    : (isTeamDialog ? t('department.addTeam') : t('department.add'))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('department.title')}</h1>
        <Button onClick={openCreate}>{t('department.add')}</Button>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4">{t('department.name')}</th>
            <th className="py-2 pr-4">{t('department.status')}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {departments.map((d) => (
            <>
              <tr key={d.id} className="border-b hover:bg-muted/30">
                <td className="py-2 pr-4 font-medium">{d.name}</td>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={d.isActive}
                      onCheckedChange={(v) => void handleToggleActive(d, v)}
                    />
                    <Badge variant={d.isActive ? 'default' : 'secondary'}>
                      {d.isActive ? t('department.active') : t('department.inactive')}
                    </Badge>
                  </div>
                </td>
                <td className="py-2 flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => openCreateTeam(d.id)}>
                    {t('department.addTeam')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                    {t('action.edit', { ns: 'common' })}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => void handleDelete(d.id)}
                  >
                    {t('action.delete', { ns: 'common' })}
                  </Button>
                </td>
              </tr>
              {d.children.map((team) => (
                <tr key={team.id} className="border-b bg-muted/10 hover:bg-muted/20">
                  <td className="py-2 pr-4 pl-8 text-muted-foreground">
                    <span className="mr-2 text-muted-foreground/50">└</span>
                    {team.name}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={team.isActive}
                        onCheckedChange={(v) => void handleToggleActive(team as Department, v)}
                      />
                      <Badge variant={team.isActive ? 'default' : 'secondary'}>
                        {team.isActive ? t('department.active') : t('department.inactive')}
                      </Badge>
                    </div>
                  </td>
                  <td className="py-2 flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(team as Department)}>
                      {t('action.edit', { ns: 'common' })}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void handleDelete(team.id)}
                    >
                      {t('action.delete', { ns: 'common' })}
                    </Button>
                  </td>
                </tr>
              ))}
            </>
          ))}
          {departments.length === 0 && (
            <tr>
              <td colSpan={3} className="py-8 text-center text-muted-foreground text-sm">
                {t('department.empty')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('department.name')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isTeamDialog ? t('department.teamNamePlaceholder') : t('department.namePlaceholder')}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
              />
            </div>
            <Button className="w-full" onClick={() => void handleSubmit()} disabled={saving}>
              {t('action.save', { ns: 'common' })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
