import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { clubApi, type CreateClubPayload } from '@/services/club.service'
import { countryApi } from '@/services/country.service'
import type { Club } from '@/types/team'
import type { CountryItem } from '@/types/country'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, ChevronDown, Search } from 'lucide-react'

// ─── 국가 선택 컴포넌트 ───────────────────────────────────────────────────────

interface CountrySelectProps {
  countries: CountryItem[]
  value: CountryItem | null
  onChange: (c: CountryItem | null) => void
  disabled?: boolean
}

function CountrySelect({ countries, value, onChange, disabled }: CountrySelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? countries.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.code.toLowerCase().includes(query.toLowerCase()),
      )
    : countries

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((v) => !v); setQuery('') }}
        className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/30 transition-colors"
      >
        <span className={value ? '' : 'text-muted-foreground'}>
          {value ? `${value.name} (${value.code})` : '국가 선택'}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="국가 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ScrollArea className="h-48">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">검색 결과 없음</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${value?.id === c.id ? 'bg-accent font-medium' : ''}`}
                  onClick={() => { onChange(c); setOpen(false) }}
                >
                  {c.name} <span className="text-muted-foreground text-xs">({c.code})</span>
                </button>
              ))
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

// ─── Club 생성 폼 다이얼로그 ──────────────────────────────────────────────────

const API_ERROR_MAP: Record<string, string> = {
  INVALID_CLUB_NAME: '구단명이 올바르지 않습니다.',
  CLUB_NAME_ALREADY_EXISTS: '이미 존재하는 구단명입니다.',
  COUNTRY_REQUIRED: '국가를 선택해 주세요.',
  COUNTRY_NOT_FOUND: '등록된 국가를 찾을 수 없습니다.',
  OWNER_EMAIL_ALREADY_EXISTS: '이미 사용 중인 구단주 이메일입니다.',
  INVALID_BUSINESS_REG_NUMBER: '유효하지 않은 사업자등록번호입니다.',
  BUSINESS_REG_NUMBER_REQUIRED: '한국 구단은 사업자등록번호가 필요합니다.',
  INVALID_COMPANY_NUMBER: '유효하지 않은 Companies House 번호입니다.',
  COMPANY_NUMBER_REQUIRED: '영국 구단은 Companies House 번호가 필요합니다.',
  INVALID_VAT_NUMBER: '유효하지 않은 VAT 번호입니다. (형식: ATUxxxxxxxx)',
  VAT_NUMBER_REQUIRED: '오스트리아 구단은 VAT 번호가 필요합니다.',
}

interface ClubFormDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function ClubFormDialog({ open, onOpenChange, onSaved }: ClubFormDialogProps) {
  const [name, setName] = useState('')
  const [countries, setCountries] = useState<CountryItem[]>([])
  const [selectedCountry, setSelectedCountry] = useState<CountryItem | null>(null)
  const [ownerEmail, setOwnerEmail] = useState('')
  const [businessRegNumber, setBusinessRegNumber] = useState('')
  const [companyNumber, setCompanyNumber] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [loadingCountries, setLoadingCountries] = useState(false)
  const [saving, setSaving] = useState(false)

  const countryCode = selectedCountry?.code?.toUpperCase() ?? ''
  const isKR = countryCode === 'KR'
  const isGB = countryCode === 'GB'
  const isAT = countryCode === 'AT'

  useEffect(() => {
    if (!open) return
    setLoadingCountries(true)
    countryApi.list()
      .then((list) => setCountries([...list].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => toast.error('국가 목록을 불러오지 못했습니다.'))
      .finally(() => setLoadingCountries(false))
  }, [open])

  const reset = () => {
    setName('')
    setSelectedCountry(null)
    setOwnerEmail('')
    setBusinessRegNumber('')
    setCompanyNumber('')
    setVatNumber('')
  }

  const handleClose = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('구단명을 입력해 주세요.'); return }
    if (!selectedCountry) { toast.error('국가를 선택해 주세요.'); return }
    if (isKR && !businessRegNumber.trim()) { toast.error('한국 구단은 사업자등록번호가 필요합니다.'); return }
    if (isGB && !companyNumber.trim()) { toast.error('영국 구단은 Companies House 번호가 필요합니다.'); return }
    if (isAT && !vatNumber.trim()) { toast.error('오스트리아 구단은 VAT 번호가 필요합니다.'); return }

    setSaving(true)
    const payload: CreateClubPayload = { name: name.trim(), countryId: selectedCountry.id }
    if (ownerEmail.trim()) payload.ownerEmail = ownerEmail.trim()
    if (isKR && businessRegNumber.trim()) payload.businessRegNumber = businessRegNumber.trim()
    if (isGB && companyNumber.trim()) payload.companyNumber = companyNumber.trim().toUpperCase()
    if (isAT && vatNumber.trim()) payload.vatNumber = vatNumber.trim().toUpperCase()

    try {
      await clubApi.create(payload)
      toast.success('구단이 생성되었습니다.')
      onSaved()
      handleClose(false)
    } catch (err: any) {
      const code = err?.response?.data?.code as string | undefined
      toast.error(code && API_ERROR_MAP[code] ? API_ERROR_MAP[code] : '구단 생성에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>구단 등록</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 구단명 */}
          <div className="space-y-1.5">
            <Label>
              구단명 <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: FC 서울"
            />
          </div>

          {/* 국가 */}
          <div className="space-y-1.5">
            <Label>
              국가 <span className="text-destructive">*</span>
            </Label>
            <CountrySelect
              countries={countries}
              value={selectedCountry}
              onChange={(c) => {
                setSelectedCountry(c)
                setBusinessRegNumber('')
                setCompanyNumber('')
                setVatNumber('')
              }}
              disabled={loadingCountries}
            />
            {loadingCountries && (
              <p className="text-xs text-muted-foreground">국가 목록 로딩 중...</p>
            )}
          </div>

          {/* 구단주 이메일 */}
          <div className="space-y-1.5">
            <Label>구단주 이메일</Label>
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </div>

          {/* KR: 사업자등록번호 */}
          {isKR && (
            <div className="space-y-1.5">
              <Label>
                사업자등록번호 <span className="text-destructive">*</span>
              </Label>
              <Input
                value={businessRegNumber}
                onChange={(e) => setBusinessRegNumber(e.target.value)}
                placeholder="000-00-00000"
                maxLength={12}
              />
              <p className="text-xs text-muted-foreground">형식: 000-00-00000 또는 0000000000 (10자리)</p>
            </div>
          )}

          {/* GB: Companies House 번호 */}
          {isGB && (
            <div className="space-y-1.5">
              <Label>
                Companies House 번호 <span className="text-destructive">*</span>
              </Label>
              <Input
                value={companyNumber}
                onChange={(e) => setCompanyNumber(e.target.value.toUpperCase())}
                placeholder="12345678"
                maxLength={8}
              />
              <p className="text-xs text-muted-foreground">8자리 영숫자 (예: 12345678, SC123456)</p>
            </div>
          )}

          {/* AT: VAT 번호 */}
          {isAT && (
            <div className="space-y-1.5">
              <Label>
                VAT 번호 (부가가치세 등록번호) <span className="text-destructive">*</span>
              </Label>
              <Input
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value.toUpperCase())}
                placeholder="ATU12345678"
                maxLength={11}
              />
              <p className="text-xs text-muted-foreground">형식: ATU + 8자리 숫자 (예: ATU12345678)</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            취소
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || loadingCountries}>
            {saving ? '저장 중...' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function TeamSettingsPage() {
  const { t } = useTranslation('admin')
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      navigate('/dashboard')
      return
    }
    clubApi.list().then(setClubs).finally(() => setLoading(false))
  }, [user])

  const toggleLite = async (club: Club) => {
    const updated = await clubApi.update(club.id, { isLite: !club.isLite })
    setClubs((prev) => prev.map((c) => (c.id === club.id ? updated : c)))
  }

  const reload = () => {
    setLoading(true)
    clubApi.list().then(setClubs).finally(() => setLoading(false))
  }

  if (loading) return <p className="p-6 text-muted-foreground">{t('teamSettingsPage.loading')}</p>

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('teamSettingsPage.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('teamSettingsPage.description')}</p>
        </div>
        {isSuperAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            구단 등록
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {clubs.length === 0 && (
          <p className="text-muted-foreground">{t('teamSettingsPage.noTeams')}</p>
        )}
        {clubs.map((club) => (
          <div key={club.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{club.name}</p>
                  {club.country && (
                    <Badge variant="outline" className="text-xs">
                      {club.country.name} ({club.country.code})
                    </Badge>
                  )}
                  <Badge variant={club.isActive ? 'default' : 'secondary'} className="text-xs">
                    {club.isActive ? '활성' : '비활성'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
                  {club.ownerEmail && <span>이메일: {club.ownerEmail}</span>}
                  {club.businessRegNumber && <span>사업자: {club.businessRegNumber}</span>}
                  {club.companyNumber && <span>Companies House: {club.companyNumber}</span>}
                  {club.vatNumber && <span>VAT: {club.vatNumber}</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {club.isLite ? t('teamSettingsPage.liteActive') : t('teamSettingsPage.liteInactive')}
                </p>
              </div>
              <Button
                size="sm"
                variant={club.isLite ? 'default' : 'outline'}
                onClick={() => void toggleLite(club)}
                className="shrink-0"
              >
                {club.isLite ? t('teamSettingsPage.disableLite') : t('teamSettingsPage.enableLite')}
              </Button>
            </div>

            {club.teams.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {club.teams.map((team) => (
                  <span key={team.id} className="text-xs bg-muted px-2 py-1 rounded">
                    {team.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <ClubFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={reload}
      />
    </div>
  )
}
