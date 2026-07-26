import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiteMode } from '@/hooks/useLiteMode'

interface Props {
  blocked: boolean
  children: ReactNode
}

export function LiteModeGate({ blocked, children }: Props) {
  const { t } = useTranslation('common')
  const isLite = useLiteMode()

  if (blocked && isLite) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
        {t('liteMode.blocked')}
      </div>
    )
  }

  return <>{children}</>
}
