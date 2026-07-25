import { useTranslation } from 'react-i18next'
import type { PositionDiversityEntry } from '@/services/playerPdi.service'

const COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
]

interface Props {
  data: PositionDiversityEntry[]
}

export function PositionDiversityChart({ data }: Props) {
  const { t } = useTranslation('player')
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('positionDiversity.empty')}</p>
  }

  const cx = 80
  const cy = 80
  const r = 60
  let startAngle = -Math.PI / 2

  const slices = data.map((entry, i) => {
    const angle = (entry.percentage / 100) * 2 * Math.PI
    const endAngle = startAngle + angle
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = angle > Math.PI ? 1 : 0
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
    const result = { path, color: COLORS[i % COLORS.length]!, entry, endAngle }
    startAngle = endAngle
    return result
  })

  return (
    <div className="flex items-start gap-6">
      <svg width={160} height={160} viewBox="0 0 160 160">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth={1} />
        ))}
      </svg>
      <div className="space-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-muted-foreground w-24">{s.entry.position}</span>
            <span className="font-medium">{s.entry.percentage}%</span>
            <span className="text-muted-foreground text-xs">({t('positionDiversity.minutes', { count: s.entry.minutes })})</span>
          </div>
        ))}
      </div>
    </div>
  )
}
