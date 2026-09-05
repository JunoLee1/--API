import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { playerApi } from '@/services/player.service'
import { api } from '@/services/api'
import type { Player, PlayerDetail, Position, PlayerLevel, PlayStyle } from '@/types/player'
import { POSITION_ABBR, LEVEL_LABEL, PLAY_STYLE_LABEL, POSITION_PLAY_STYLES } from '@/types/player'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
const FEET = ['LEFT', 'RIGHT', 'BOTH'] as const

function calcAge(dob: string): number | null {
  if (!dob) return null
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function inferLevel(dob: string): PlayerLevel | null {
  const age = calcAge(dob)
  if (age === null) return null
  if (age >= 8 && age <= 18) return 'YOUTH'
  if (age > 18) return null
  return null
}

export function PlayerFormDialog({ open, onOpenChange, player, onSaved }: Props) {
  const { t } = useTranslation('player')
  const isEdit = !!player

  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [foot, setFoot] = useState<string>('RIGHT')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [position, setPosition] = useState<Position>('STRIKER')
  const [playStyle, setPlayStyle] = useState<PlayStyle | ''>('')
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
      setPlayStyle((player as any).playStyle ?? '')
      setLevel(player.level)
      setNationalityId(player.nationality.id)
    } else {
      setName('')
      setDob('')
      setFoot('RIGHT')
      setHeight('')
      setWeight('')
      setPosition('STRIKER')
      setPlayStyle('')
      setLevel('ROOKIE')
      setNationalityId('')
    }
  }, [open, player])

  const handleDobChange = (value: string) => {
    setDob(value)
    const suggested = inferLevel(value)
    if (suggested) {
      setLevel(suggested)
    } else if (level === 'YOUTH') {
      const age = calcAge(value)
      if (age !== null && age > 18) setLevel('ROOKIE')
    }
  }

  const handleSave = async () => {
    if (!name.trim() || !dob || !height || !weight || !nationalityId) {
      toast.error(t('form.required'))
      return
    }
    const age = calcAge(dob)
    if (level === 'YOUTH' && (age === null || age < 8 || age > 18)) {
      toast.error(t('form.youthAgeError'))
      return
    }
    if (age !== null && age >= 8 && age <= 18 && level !== 'YOUTH') {
      toast.error(t('form.youthLevelError'))
      return
    }
    setSaving(true)
    try {
      const payload = {
        playerName: name.trim(),
        dateOfBirth: dob,
        preferredFoot: foot as 'LEFT' | 'RIGHT',
        height: Number(height),
        weight: Number(weight),
        position,
        level,
        nationalityId: Number(nationalityId),
        playStyle: playStyle || null,
      }
      if (isEdit && player) {
        await playerApi.update(player.id, payload)
        toast.success(t('form.savedEdit'))
      } else {
        await playerApi.create(payload)
        toast.success(t('form.savedCreate'))
      }
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('form.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle>{isEdit ? t('form.titleEdit') : t('form.titleCreate')}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 이름 */}
          <div className="space-y-1.5">
            <Label htmlFor="playerName">{t('form.name')} *</Label>
            <Input
              id="playerName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('form.namePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 생년월일 */}
            <div className="space-y-1.5">
              <Label htmlFor="dob">{t('form.dob')} *</Label>
              <Input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => handleDobChange(e.target.value)}
              />
              {dob && (() => {
                const age = calcAge(dob)
                return age !== null ? (
                  <p className="text-xs text-muted-foreground">{t('form.ageHint', { age })}</p>
                ) : null
              })()}
            </div>

            {/* 주발 */}
            <div className="space-y-1.5">
              <Label>{t('form.foot')} *</Label>
              <Select value={foot} onValueChange={setFoot}>
                <SelectTrigger>
                  {foot
                    ? <span>{t(`foot.${foot}`)}</span>
                    : <span className="text-muted-foreground">{t('form.footPlaceholder')}</span>}
                </SelectTrigger>
                <SelectContent>
                  {FEET.map((f) => (
                    <SelectItem key={f} value={f}>
                      {t(`foot.${f}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 신장 */}
            <div className="space-y-1.5">
              <Label htmlFor="height">{t('form.height')} *</Label>
              <Input
                id="height"
                type="number"
                min={140}
                max={220}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder={t('form.heightPlaceholder')}
              />
            </div>

            {/* 체중 */}
            <div className="space-y-1.5">
              <Label htmlFor="weight">{t('form.weight')} *</Label>
              <Input
                id="weight"
                type="number"
                min={40}
                max={150}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={t('form.weightPlaceholder')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 포지션 */}
            <div className="space-y-1.5">
              <Label>{t('form.position')} *</Label>
              <Select value={position} onValueChange={(v) => { setPosition(v as Position); setPlayStyle('') }}>
                <SelectTrigger>
                  {position
                    ? <span>{POSITION_ABBR[position]} · {t(`position.${position}`)}</span>
                    : <span className="text-muted-foreground">{t('form.positionPlaceholder')}</span>}
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {POSITION_ABBR[p]} · {t(`position.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 플레이스타일 */}
            <div className="space-y-1.5">
              <Label>플레이스타일</Label>
              <Select value={playStyle} onValueChange={(v) => setPlayStyle(v as PlayStyle)}>
                <SelectTrigger>
                  <SelectValue placeholder="선택">
                    {playStyle ? PLAY_STYLE_LABEL[playStyle as PlayStyle] : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {POSITION_PLAY_STYLES[position].map(ps => (
                    <SelectItem key={ps} value={ps}>{PLAY_STYLE_LABEL[ps]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 레벨 */}
            <div className="space-y-1.5">
              <Label>{t('form.level')} *</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as PlayerLevel)}>
                <SelectTrigger>
                  {level
                    ? <span>{t(`level.${level}`)}{level === 'YOUTH' ? t('form.youthHint') : ''}</span>
                    : <span className="text-muted-foreground">{t('form.levelPlaceholder')}</span>}
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {t(`level.${l}`)}{l === 'YOUTH' ? t('form.youthHint') : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 국적 */}
          <div className="space-y-1.5">
            <Label>{t('form.nationality')} *</Label>
            <Select
              value={nationalityId === '' ? '' : String(nationalityId)}
              onValueChange={(v) => setNationalityId(Number(v))}
            >
              <SelectTrigger>
                {nationalityId !== ''
                  ? (() => {
                      const c = countries.find((c) => c.id === nationalityId)
                      return c
                        ? <span>{c.code} · {c.name}</span>
                        : <span className="text-muted-foreground">{t('form.nationalityPlaceholder')}</span>
                    })()
                  : <span className="text-muted-foreground">{t('form.nationalityPlaceholder')}</span>}
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.code} · {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-4 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('form.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('form.saving') : isEdit ? t('form.submitEdit') : t('form.submit')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
