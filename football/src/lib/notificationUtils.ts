export function formatNotificationDateRelative(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export function formatNotificationDateAbsolute(d: string): string {
  return new Date(d).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getUnreadDotClass(type: string): string {
  if (type === 'CONTRACT_EXPIRY_30D') return 'bg-destructive'
  if (type === 'CONTRACT_EXPIRY_60D') return 'bg-amber-500'
  if (type === 'CONTRACT_EXPIRY_90D') return 'bg-blue-500'
  return 'bg-destructive'
}
