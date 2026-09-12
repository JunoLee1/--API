import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { authApi } from '@/services/auth.service'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { COACHING_ROLE_LABEL, ROLE_LABEL } from '@/types/auth'
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, Pencil } from 'lucide-react'

const PW_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/

function passwordStrengthIssues(pw: string): string[] {
  const issues: string[] = []
  if (pw.length < 8) issues.push('8자 이상')
  if (!/[a-z]/.test(pw)) issues.push('소문자 포함')
  if (!/[A-Z]/.test(pw)) issues.push('대문자 포함')
  if (!/\d/.test(pw)) issues.push('숫자 포함')
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) issues.push('특수문자 포함')
  return issues
}

function isPasswordExpired(passwordChangedAt: string | null): boolean {
  if (!passwordChangedAt) return true
  const changed = new Date(passwordChangedAt)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  return changed < threeMonthsAgo
}

export function MePage() {
  const { t } = useTranslation('common')
  const { user, loading, refetch } = useCurrentUser()

  const [editing, setEditing] = useState(false)

  // 프로필 폼
  const [email, setEmail] = useState('')
  const [homeAddress, setHomeAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // 비밀번호 폼
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    if (user) {
      setEmail(user.email)
      setHomeAddress(user.homeAddress ?? '')
    }
  }, [user])

  const handleCancelEdit = () => {
    if (user) {
      setEmail(user.email)
      setHomeAddress(user.homeAddress ?? '')
      setPhone('')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
    setEditing(false)
  }

  if (loading) {
    return (
      <div className="p-8 max-w-lg space-y-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  }

  if (!user) return null

  const roleLabel =
    user.role === 'COACHING_STAFF' && user.coachingRole
      ? `${ROLE_LABEL[user.role]} · ${COACHING_ROLE_LABEL[user.coachingRole]}`
      : ROLE_LABEL[user.role]

  const pwIssues = newPw ? passwordStrengthIssues(newPw) : []
  const pwExpired = isPasswordExpired(user.passwordChangedAt)

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      await authApi.updateProfile({
        email: email !== user.email ? email : undefined,
        homeAddress: homeAddress || null,
        phoneNumber: phone || undefined,
      })
      toast.success(t('mePage.profileSaved'))
      setPhone('')
      setEditing(false)
      await refetch()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('EMAIL_TAKEN')) toast.error(t('mePage.errors.emailTaken'))
      else if (msg.includes('PHONE_TAKEN')) toast.error(t('mePage.errors.phoneTaken'))
      else if (msg.includes('INVALID_PHONE_NUMBER')) toast.error(t('mePage.errors.invalidPhone'))
      else toast.error(t('mePage.errors.saveFailed'))
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { toast.error(t('mePage.errors.passwordMismatch')); return }
    if (!PW_REGEX.test(newPw)) { toast.error(t('mePage.errors.invalidPasswordFormat')); return }
    setSavingPw(true)
    try {
      await authApi.updatePassword({ currentPassword: currentPw, newPassword: newPw, confirmedPassword: confirmPw })
      toast.success(t('mePage.passwordChanged'))
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setEditing(false)
      await refetch()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('INVALID_CURRENT_PASSWORD')) toast.error(t('mePage.errors.wrongCurrentPassword'))
      else if (msg.includes('SAME_AS_CURRENT_PASSWORD')) toast.error(t('mePage.errors.samePassword'))
      else if (msg.includes('INVALID_PASSWORD_FORMAT')) toast.error(t('mePage.errors.invalidPasswordFormat'))
      else toast.error(t('mePage.errors.saveFailed'))
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0 flex items-center gap-3">
        {editing && (
          <button type="button" onClick={handleCancelEdit} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">
            {editing ? t('mePage.editProfileTitle') : t('mePage.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {editing ? t('mePage.editDescription') : t('mePage.description')}
          </p>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            {t('mePage.editBtn')}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-lg mx-auto space-y-6">

          {/* ── 조회 뷰 ── */}
          {!editing && (
            <>
              {pwExpired && (
                <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-700 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{t('mePage.passwordExpiredWarning')}</span>
                </div>
              )}

              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center gap-4 mb-6">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="text-lg">{user.nickname.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-base font-semibold">{user.nickname}</p>
                    <Badge variant="outline" className="text-xs mt-1">{roleLabel}</Badge>
                  </div>
                </div>
                <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t('mePage.usernameLabel')}</dt>
                    <dd className="mt-1 font-medium">{user.username}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t('mePage.emailLabel')}</dt>
                    <dd className="mt-1 font-medium">{user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t('mePage.roleLabel')}</dt>
                    <dd className="mt-1 font-medium">{roleLabel}</dd>
                  </div>
                  {user.team && (
                    <div>
                      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t('mePage.teamLabel')}</dt>
                      <dd className="mt-1 font-medium">{user.team.type}</dd>
                    </div>
                  )}
                  {user.departments.length > 0 && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">{t('mePage.departmentsLabel')}</dt>
                      <dd className="flex flex-wrap gap-2">
                        {user.departments.map(d => (
                          <span key={d.department.id} className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium bg-muted">
                            {d.department.name}
                            <span className="text-muted-foreground">· {d.role}</span>
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                  {user.homeAddress && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t('mePage.homeAddressLabel')}</dt>
                      <dd className="mt-1 font-medium">{user.homeAddress}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </>
          )}

          {/* ── 수정 뷰 ── */}
          {editing && (
            <>
              {/* 개인정보 수정 */}
              <div className="rounded-lg border bg-card p-6 space-y-4">
                <h2 className="text-sm font-semibold">{t('mePage.editProfileTitle')}</h2>

                <div className="space-y-1.5">
                  <Label>{t('mePage.emailLabel')}</Label>
                  <Input value={email} onChange={e => setEmail(e.target.value)} type="email" />
                </div>

                <div className="space-y-1.5">
                  <Label>{t('mePage.homeAddressLabel')}</Label>
                  <Input value={homeAddress} onChange={e => setHomeAddress(e.target.value)} placeholder={t('mePage.homeAddressPlaceholder')} />
                </div>

                <div className="space-y-1.5">
                  <Label>{t('mePage.phoneLabel')}</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" />
                  <p className="text-xs text-muted-foreground">{t('mePage.phoneHint')}</p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCancelEdit} className="flex-1">{t('mePage.cancel')}</Button>
                  <Button onClick={() => void handleSaveProfile()} disabled={savingProfile} className="flex-1">
                    {savingProfile ? t('mePage.saving') : t('mePage.saveProfile')}
                  </Button>
                </div>
              </div>

              {/* 비밀번호 변경 */}
              <div className="rounded-lg border bg-card p-6 space-y-4">
                <h2 className="text-sm font-semibold">{t('mePage.changePasswordTitle')}</h2>

                {pwExpired && (
                  <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {t('mePage.passwordExpiredWarning')}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>{t('mePage.currentPassword')}</Label>
                  <div className="relative">
                    <Input type={showCurrent ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="pr-10" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCurrent(v => !v)}>
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('mePage.newPassword')}</Label>
                  <div className="relative">
                    <Input type={showNew ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} className="pr-10" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNew(v => !v)}>
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newPw && (
                    <div className="space-y-1 mt-1">
                      {pwIssues.length === 0 ? (
                        <p className="flex items-center gap-1.5 text-xs text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t('mePage.passwordStrong')}
                        </p>
                      ) : pwIssues.map(issue => (
                        <p key={issue} className="flex items-center gap-1.5 text-xs text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" /> {issue}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>{t('mePage.confirmPassword')}</Label>
                  <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
                  {confirmPw && newPw !== confirmPw && (
                    <p className="text-xs text-destructive">{t('mePage.errors.passwordMismatch')}</p>
                  )}
                </div>

                <Button
                  onClick={() => void handleChangePassword()}
                  disabled={savingPw || !currentPw || !newPw || !confirmPw || pwIssues.length > 0}
                  variant="outline"
                  className="w-full"
                >
                  {savingPw ? t('mePage.saving') : t('mePage.changePassword')}
                </Button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
