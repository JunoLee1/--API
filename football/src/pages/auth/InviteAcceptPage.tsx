import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { api } from '@/services/api'
import type { Role, CoachingRole, FrontOfficeRole } from '@/types/auth'
import { ROLE_LABEL, COACHING_ROLE_LABEL, FRONT_OFFICE_ROLE_LABEL } from '@/types/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface InviteInfo {
  email: string
  role: Role
  coachingRole: CoachingRole | null
  frontOfficeRole: FrontOfficeRole | null
}

interface Country {
  id: number
  name: string
  code: string
}

function roleDisplay(info: InviteInfo) {
  if (info.role === 'COACHING_STAFF' && info.coachingRole) return `${ROLE_LABEL[info.role]} - ${COACHING_ROLE_LABEL[info.coachingRole]}`
  if (info.role === 'FRONT_OFFICE' && info.frontOfficeRole) return `${ROLE_LABEL[info.role]} - ${FRONT_OFFICE_ROLE_LABEL[info.frontOfficeRole]}`
  return ROLE_LABEL[info.role]
}

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('youth')

  const [lang, setLang] = React.useState<'ko' | 'en'>(
    (localStorage.getItem('app_lang') as 'ko' | 'en') ?? 'ko'
  )
  const toggleLang = () => {
    const next = lang === 'ko' ? 'en' : 'ko';
    setLang(next);
    localStorage.setItem('app_lang', next);
    i18n.changeLanguage(next);
  };

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [error, setError] = useState<'not_found' | 'expired' | 'used' | null>(null)
  const [countries, setCountries] = useState<Country[]>([])

  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [nationalityId, setNationalityId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmedPassword, setConfirmedPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    void api.get<InviteInfo>(`/auth/invites/${token}`)
      .then(setInvite)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('INVITE_EXPIRED') || msg.includes('410')) setError('expired')
        else if (msg.includes('INVITE_ALREADY_USED')) setError('used')
        else setError('not_found')
      })
    void api.get<Country[] | { data: Country[] }>('/countries')
      .then((res) => setCountries(Array.isArray(res) ? res : res.data))
      .catch(() => {})
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmedPassword) { toast.error(t('inviteAccept.errors.passwordMismatch')); return }
    if (!nationalityId) { toast.error(t('inviteAccept.errors.nationalityRequired')); return }
    setSubmitting(true)
    try {
      await api.post(`/auth/invites/${token}/accept`, {
        username, nickname, phoneNumber, dateOfBirth,
        nationalityId: Number(nationalityId),
        password, confirmedPassword,
      })
      toast.success(t('inviteAccept.success'))
      navigate('/login')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('NICKNAME_TAKEN')) toast.error(t('inviteAccept.errors.nicknameTaken'))
      else if (msg.includes('PASSWORD_MISMATCH')) toast.error(t('inviteAccept.errors.passwordMismatch'))
      else if (msg.includes('INVALID_PHONE_NUMBER')) toast.error(t('inviteAccept.errors.invalidPhone'))
      else if (msg.includes('INVITE_EXPIRED')) { setError('expired'); toast.error(t('inviteAccept.errors.expired')) }
      else if (msg.includes('INVITE_ALREADY_USED')) { setError('used'); toast.error(t('inviteAccept.errors.invalidToken')) }
      else toast.error(t('inviteAccept.errors.failed'))
    } finally { setSubmitting(false) }
  }

  if (error) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <button
          onClick={toggleLang}
          className="absolute top-4 right-4 text-sm text-gray-500 hover:text-gray-800"
        >
          {lang === 'ko' ? 'EN' : '한국어'}
        </button>
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>{t(`inviteAccept.states.${error}.title`)}</CardTitle>
            <CardDescription>{t(`inviteAccept.states.${error}.description`)}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate('/login')}>{t('inviteAccept.toLogin')}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-muted/30">
        <button
          onClick={toggleLang}
          className="absolute top-4 right-4 text-sm text-gray-500 hover:text-gray-800"
        >
          {lang === 'ko' ? 'EN' : '한국어'}
        </button>
        <p className="text-sm text-muted-foreground animate-pulse">{t('inviteAccept.loading')}</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-muted/30 px-4 py-8">
      <button
        onClick={toggleLang}
        className="absolute top-4 right-4 text-sm text-gray-500 hover:text-gray-800"
      >
        {lang === 'ko' ? 'EN' : '한국어'}
      </button>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t('inviteAccept.title')}</CardTitle>
          <CardDescription>
            <span className="font-medium text-foreground">{invite.email}</span>{t('inviteAccept.invitedTo')}
          </CardDescription>
          <Badge variant="secondary" className="w-fit">{roleDisplay(invite)}</Badge>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('inviteAccept.name')} *</Label>
                <Input placeholder={t('inviteAccept.namePlaceholder')} value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t('inviteAccept.nickname')} *</Label>
                <Input placeholder="hong_gd" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('inviteAccept.phone')} *</Label>
                <Input placeholder="010-0000-0000" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t('inviteAccept.birthDate')} *</Label>
                <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('inviteAccept.nationality')} *</Label>
              <Select value={nationalityId} onValueChange={setNationalityId}>
                <SelectTrigger><SelectValue placeholder={t('inviteAccept.nationalityPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('inviteAccept.password')} *</Label>
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t('inviteAccept.passwordConfirm')} *</Label>
                <Input type="password" placeholder="••••••••" value={confirmedPassword} onChange={(e) => setConfirmedPassword(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? t('inviteAccept.submitting') : t('inviteAccept.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
