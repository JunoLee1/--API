import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { playerApi } from '@/services/player.service'
import type { Player, PlayerDetail, PlayerStatus } from '@/types/player'
import { STATUS_LABEL } from '@/types/player'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const STATUSES = Object.keys(STATUS_LABEL) as PlayerStatus[]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: Player | PlayerDetail
  onSaved: () => void
}

export function PlayerStatusDialog({ open, onOpenChange, player, onSaved }: Props) {
  const { t } = useTranslation('player')
  const [status, setStatus] = useState<PlayerStatus>(player.status)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (status === player.status) {
      onOpenChange(false)
      return
    }
    setSaving(true)
    try {
      await playerApi.updateStatus(player.id, status)
      toast.success(t('statusDialog.saved'))
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('statusDialog.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('statusDialog.title')}</DialogTitle>
          <DialogDescription>{t('statusDialog.description', { name: player.playerName })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label>{t('statusDialog.statusLabel')}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as PlayerStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('statusDialog.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('statusDialog.confirming') : t('statusDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
