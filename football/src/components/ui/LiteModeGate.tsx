import type { ReactNode } from 'react'
import { useLiteMode } from '@/hooks/useLiteMode'

interface Props {
  blocked: boolean
  children: ReactNode
}

export function LiteModeGate({ blocked, children }: Props) {
  const isLite = useLiteMode()

  if (blocked && isLite) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
        이 기능은 Lite Mode 구단에서 사용할 수 없습니다.
      </div>
    )
  }

  return <>{children}</>
}
