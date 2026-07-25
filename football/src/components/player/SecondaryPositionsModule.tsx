import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { secondaryPositionApi } from '@/services/secondary-position.service'
import type { SecondaryPosition } from '@/types/secondary-position'
import type { Position } from '@/types/player'
import { POSITION_LABEL, POSITION_ABBR } from '@/types/player'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'

const ALL_POSITIONS: Position[] = [
  'GOALKEEPER', 'STRIKER', 'SHADOW_STRIKER', 'WINGER',
  'CENTRAL_ATTACK_MIDFIELDER', 'RIGHT_ATTACK_MIDFIELDER', 'LEFT_ATTACK_MIDFIELDER',
  'CENTRAL_DEFENSIVE_MIDFIELDER', 'LEFT_DEFENSIVE_MIDFIELDER', 'RIGHT_DEFENSIVE_MIDFIELDER',
  'CENTER_BACK', 'LEFT_WING_BACK', 'LEFT_FULL_BACK', 'RIGHT_WING_BACK', 'RIGHT_FULL_BACK',
]

interface Props {
  playerId: string
  primaryPosition: Position
  canEdit: boolean
}

export function SecondaryPositionsModule({ playerId, primaryPosition, canEdit }: Props) {
  const [rows, setRows] = useState<SecondaryPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newPos, setNewPos] = useState<Position | ''>('')
  const [newTarget, setNewTarget] = useState('')
  const [saving, setSaving] = useState(false)

  const fetch = () => {
    setLoading(true)
    secondaryPositionApi.list(playerId)
      .then(setRows)
      .catch(() => toast.error('부 포지션을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [playerId])

  const handleSave = async () => {
    if (!newPos || !newTarget) return
    const target = parseFloat(newTarget)
    if (isNaN(target) || target < 0 || target > 100) {
      toast.error('체력 요구치는 0~100 사이로 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await secondaryPositionApi.upsert(playerId, newPos, target)
      toast.success('부 포지션이 저장됐습니다.')
      setAdding(false)
      setNewPos('')
      setNewTarget('')
      fetch()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (pos: Position) => {
    try {
      await secondaryPositionApi.delete(playerId, pos)
      toast.success('삭제됐습니다.')
      fetch()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const usedPositions = new Set([primaryPosition, ...rows.map((r) => r.position)])
  const availablePositions = ALL_POSITIONS.filter((p) => !usedPositions.has(p))

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">부 포지션</h3>
        {canEdit && !adding && (
          <Button
            variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
            onClick={() => setAdding(true)}
            disabled={availablePositions.length === 0}
          >
            <Plus className="h-3.5 w-3.5" /> 추가
          </Button>
        )}
      </div>
      <Separator className="mb-3" />

      {loading ? (
        <p className="text-xs text-muted-foreground">불러오는 중...</p>
      ) : rows.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground text-center py-3">등록된 부 포지션이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                  {POSITION_ABBR[r.position]}
                </span>
                <span className="text-sm">{POSITION_LABEL[r.position]}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {r.fitnessTarget}%
                </span>
                {canEdit && (
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6 text-destructive/60 hover:text-destructive"
                    onClick={() => void handleDelete(r.position)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-3 pt-3 border-t space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">포지션</Label>
              <Select value={newPos} onValueChange={(v) => setNewPos(v as Position)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {availablePositions.map((p) => (
                    <SelectItem key={p} value={p}>
                      {POSITION_ABBR[p]} · {POSITION_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">체력 요구치 (%)</Label>
              <Input
                type="number" min={0} max={100} step={1}
                placeholder="0–100"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setAdding(false); setNewPos(''); setNewTarget('') }}
              disabled={saving}
            >
              취소
            </Button>
            <Button
              size="sm" className="h-7 text-xs"
              onClick={() => void handleSave()}
              disabled={saving || !newPos || !newTarget}
            >
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
