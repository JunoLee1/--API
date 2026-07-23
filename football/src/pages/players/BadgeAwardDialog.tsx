import { useState } from 'react'
import { toast } from 'sonner'
import { growthReportApi } from '@/services/growthReport.service'
import type { BadgeType } from '@/types/growth-report'
import { BADGE_LABEL } from '@/types/growth-report'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  playerId: string
  onSaved: () => void
}

const BADGE_TYPES = Object.keys(BADGE_LABEL) as BadgeType[]

export function BadgeAwardDialog({ open, onOpenChange, playerId, onSaved }: Props) {
  const [badgeType, setBadgeType] = useState<BadgeType>('PASSION_KING')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await growthReportApi.awardBadge({ playerId, badgeType, note: note || undefined })
      toast.success('배지가 수여됐습니다.')
      onSaved()
      onOpenChange(false)
      setNote('')
    } catch {
      toast.error('배지 수여에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>배지 수여</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>배지 종류</Label>
            <div className="grid grid-cols-2 gap-2">
              {BADGE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setBadgeType(type)}
                  className={`rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                    badgeType === type
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted'
                  }`}
                >
                  {BADGE_LABEL[type]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>메모 (선택)</Label>
            <Input
              placeholder="수여 이유 등"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '수여 중...' : '배지 수여'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
