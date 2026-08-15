import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formationSnapshotApi } from '@/services/formationSnapshot.service'
import type { FormationSnapshot } from '@/types/formation-snapshot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'

interface Props {
  matchId: number
  snapshots: FormationSnapshot[]
  canEdit: boolean
  onAdded: (s: FormationSnapshot) => void
  onRemoved: (id: number) => void
}

export function FormationSnapshotCard({ matchId, snapshots, canEdit, onAdded, onRemoved }: Props) {
  const { t } = useTranslation('match')
  const [adding, setAdding] = useState(false)
  const [minute, setMinute] = useState('')
  const [formation, setFormation] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const handleRemove = async (id: number) => {
    setRemovingId(id)
    try {
      await formationSnapshotApi.remove(id)
      onRemoved(id)
    } catch {
      toast.error(t('formationSnapshot.removeError', 'Failed to delete'))
    } finally {
      setRemovingId(null)
    }
  }

  const handleSubmit = async () => {
    if (!formation.trim()) return
    setSaving(true)
    try {
      const snapshot = await formationSnapshotApi.create({
        matchId,
        ...(minute ? { minute: Number(minute) } : {}),
        formation: formation.trim(),
        ...(changeReason.trim() ? { changeReason: changeReason.trim() } : {}),
      })
      onAdded(snapshot)
      setAdding(false)
      setMinute('')
      setFormation('')
      setChangeReason('')
    } catch {
      toast.error(t('formationSnapshot.submitError', 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t('formationSnapshot.title')}</h4>
        {canEdit && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t('formationSnapshot.addSnapshot')}
          </Button>
        )}
      </div>

      {adding && (
        <div className="border rounded-md p-3 space-y-2 bg-muted/30">
          <div className="flex gap-2">
            <div className="w-20">
              <Label className="text-xs">{t('formationSnapshot.minute')}</Label>
              <Input
                type="number"
                className="h-8 text-sm"
                placeholder="45"
                value={minute}
                onChange={e => setMinute(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">{t('formationSnapshot.formation')}</Label>
              <Input
                className="h-8 text-sm"
                placeholder="4-3-3"
                value={formation}
                onChange={e => setFormation(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t('formationSnapshot.changeReason')}</Label>
            <Input
              className="h-8 text-sm"
              placeholder={t('formationSnapshot.changeReasonPlaceholder')}
              value={changeReason}
              onChange={e => setChangeReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
              {t('formationSnapshot.cancel')}
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving || !formation.trim()}>
              {t('formationSnapshot.submit')}
            </Button>
          </div>
        </div>
      )}

      {snapshots.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">{t('formationSnapshot.empty')}</p>
      ) : (
        <div className="space-y-1">
          {snapshots.map(s => (
            <div key={s.id} className="flex items-center gap-3 text-sm py-1 border-b last:border-0">
              <span className="w-12 text-muted-foreground text-xs shrink-0">
                {s.minute != null ? `${s.minute}${t('formationSnapshot.minute')}` : '—'}
              </span>
              <span className="font-mono font-medium">{s.formation}</span>
              {s.changeReason && (
                <span className="text-muted-foreground text-xs flex-1">{s.changeReason}</span>
              )}
              <span className="text-xs text-muted-foreground shrink-0">
                {t('formationSnapshot.by')} {s.createdBy.nickname}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemove(s.id)}
                  disabled={removingId === s.id}
                  className="ml-auto text-muted-foreground hover:text-destructive disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
