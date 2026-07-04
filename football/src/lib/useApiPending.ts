import { useEffect, useState } from 'react'
import { subscribeApiPending } from '@/services/api'

/**
 * 진행 중 API 호출이 있으면 true 를 반환.
 * 3G 등 느린 환경에서 응답 대기 중 페이지 이동/사이드바 클릭 차단용.
 */
export function useApiPending(): boolean {
  const [pending, setPending] = useState(false)
  useEffect(() => subscribeApiPending(setPending), [])
  return pending
}
