import { useState } from 'react'
import { toast } from 'sonner'
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
      toast.success('선수 상태가 변경됐습니다.')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '상태 변경에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>선수 상태 변경</DialogTitle>
          <DialogDescription>{player.playerName}의 상태를 변경합니다.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label>상태</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as PlayerStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '변경 중...' : '변경'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
