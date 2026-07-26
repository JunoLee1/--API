import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Skeleton } from '@/components/ui/skeleton'
import { COACHING_ROLE_LABEL, ROLE_LABEL } from '@/types/auth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  )
}

export function MePage() {
  const { t } = useTranslation('common')
  const { user, loading } = useCurrentUser()

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

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">{t('mePage.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('mePage.description')}</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="text-lg">{user.nickname.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-semibold">{user.nickname}</p>
                <p className="text-sm text-muted-foreground">{roleLabel}</p>
              </div>
            </div>

            <dl className="grid sm:grid-cols-2 gap-4">
              <Field label={t('mePage.usernameLabel')} value={user.username} />
              <Field label={t('mePage.emailLabel')} value={user.email} />
              <Field label={t('mePage.roleLabel')} value={roleLabel} />
              {user.isOutOfOffice && (
                <Field label={t('mePage.statusLabel')} value={t('mePage.outOfOffice')} />
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
