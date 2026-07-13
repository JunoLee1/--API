import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { playerApi } from '@/services/player.service'
import { api } from '@/services/api'
import type {
  Player,
  PlayerDetail,
  Position,
  Foot,
  PlayerLevel,
} from '@/types/player'
import { POSITION_ABBR, POSITION_LABEL, LEVEL_LABEL } from '@/types/player'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Country {
  id: number
  name: string
  code: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  player?: Player | PlayerDetail
  onSaved: () => void
}

const POSITIONS = Object.keys(POSITION_ABBR) as Position[]
const LEVELS = Object.keys(LEVEL_LABEL) as PlayerLevel[]
const FEET: Foot[] = ['LEFT', 'RIGHT']

const FOOT_LABEL: Record<Foot, string> = { LEFT: '왼발', RIGHT: '오른발' }

export function PlayerFormDialog({ open, onOpenChange, player, onSaved }: Props) {
  const isEdit = !!player

  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [foot, setFoot] = useState<Foot>('RIGHT')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [position, setPosition] = useState<Position>('STRIKER')
  const [level, setLevel] = useState<PlayerLevel>('ROOKIE')
  const [nationalityId, setNationalityId] = useState<number | ''>('')
  const [countries, setCountries] = useState<Country[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    api.get<{ data: Country[] } | Country[]>('/countries')
      .then((res) => setCountries(Array.isArray(res) ? res : res.data))
      .catch(() => null)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (player) {
      setName(player.playerName)
      setDob(player.dateOfBirth.slice(0, 10))
      setFoot(player.preferredFoot)
      setHeight(String(player.height))
      setWeight(String(player.weight))
      setPosition(player.position)
      setLevel(player.level)
      setNationalityId(player.nationality.id)
    } else {
      setName('')
      setDob('')
      setFoot('RIGHT')
      setHeight('')
      setWeight('')
      setPosition('STRIKER')
      setLevel('ROOKIE')
      setNationalityId('')
    }
  }, [open, player])

  const handleSave = async () => {
    if (!name.trim() || !dob || !height || !weight || !nationalityId) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      if (isEdit && player) {
        await playerApi.update(player.id, {
          playerName: name.trim(),
          dateOfBirth: dob,
          preferredFoot: foot,
          height: Number(height),
          weight: Number(weight),
          position,
          level,
          nationalityId: Number(nationalityId),
        })
        toast.success('선수 정보가 수정됐습니다.')
      } else {
        await playerApi.create({
          playerName: name.trim(),
          dateOfBirth: dob,
          preferredFoot: foot,
          height: Number(height),
          weight: Number(weight),
          position,
          level,
          nationalityId: Number(nationalityId),
        })
        toast.success('선수가 등록됐습니다.')
      }
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '선수 정보 수정' : '선수 등록'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 이름 */}
          <div className="space-y-1.5">
            <Label htmlFor="playerName">이름 *</Label>
            <Input
              id="playerName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="선수 이름"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 생년월일 */}
            <div className="space-y-1.5">
              <Label htmlFor="dob">생년월일 *</Label>
              <Input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>

            {/* 주발 */}
            <div className="space-y-1.5">
              <Label>주발 *</Label>
              <Select value={foot} onValueChange={(v) => setFoot(v as Foot)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEET.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FOOT_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 신장 */}
            <div className="space-y-1.5">
              <Label htmlFor="height">신장 (cm) *</Label>
              <Input
                id="height"
                type="number"
                min={140}
                max={220}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="예: 180"
              />
            </div>

            {/* 체중 */}
            <div className="space-y-1.5">
              <Label htmlFor="weight">체중 (kg) *</Label>
              <Input
                id="weight"
                type="number"
                min={40}
                max={150}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="예: 75"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 포지션 */}
            <div className="space-y-1.5">
              <Label>포지션 *</Label>
              <Select value={position} onValueChange={(v) => setPosition(v as Position)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="font-mono text-xs">{POSITION_ABBR[p]}</span>
                      <span className="ml-2">{POSITION_LABEL[p]}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 레벨 */}
            <div className="space-y-1.5">
              <Label>레벨 *</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as PlayerLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {LEVEL_LABEL[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 국적 */}
          <div className="space-y-1.5">
            <Label>국적 *</Label>
            <Select
              value={nationalityId === '' ? '' : String(nationalityId)}
              onValueChange={(v) => setNationalityId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="국적 선택" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                    <span className="ml-2">{c.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : isEdit ? '수정' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
