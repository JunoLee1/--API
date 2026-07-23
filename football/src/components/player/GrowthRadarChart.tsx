interface RadarAxis {
  label: string
  value: number
}

interface GrowthRadarChartProps {
  attitudeScore: number
  fundamentalsScore: number
  spatialScore: number
  physicalScore: number
  size?: number
}

const MAX = 10
const AXES: { key: keyof Omit<GrowthRadarChartProps, 'size'>; label: string }[] = [
  { key: 'attitudeScore', label: '태도' },
  { key: 'fundamentalsScore', label: '기본기' },
  { key: 'spatialScore', label: '공간인식' },
  { key: 'physicalScore', label: '체력' },
]

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  }
}

export function GrowthRadarChart({
  attitudeScore,
  fundamentalsScore,
  spatialScore,
  physicalScore,
  size = 220,
}: GrowthRadarChartProps) {
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.35
  const n = AXES.length
  const values: RadarAxis[] = [
    { label: '태도', value: attitudeScore },
    { label: '기본기', value: fundamentalsScore },
    { label: '공간인식', value: spatialScore },
    { label: '체력', value: physicalScore },
  ]

  const angleOffset = -Math.PI / 2

  const getPoint = (i: number, r: number) => {
    const angle = angleOffset + (2 * Math.PI * i) / n
    return polarToCartesian(cx, cy, r, angle)
  }

  const gridLevels = [0.25, 0.5, 0.75, 1]
  const dataPoints = values.map((v, i) => getPoint(i, (v.value / MAX) * radius))
  const dataPath =
    dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + ' Z'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* grid */}
      {gridLevels.map((level) => {
        const pts = Array.from({ length: n }, (_, i) => getPoint(i, radius * level))
        const path =
          pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + ' Z'
        return <path key={level} d={path} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
      })}

      {/* axis lines */}
      {values.map((_, i) => {
        const outer = getPoint(i, radius)
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={outer.x.toFixed(2)}
            y2={outer.y.toFixed(2)}
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={1}
          />
        )
      })}

      {/* data polygon */}
      <path d={dataPath} fill="hsl(var(--primary))" fillOpacity={0.2} stroke="hsl(var(--primary))" strokeWidth={2} />

      {/* data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="hsl(var(--primary))" />
      ))}

      {/* labels */}
      {values.map((v, i) => {
        const labelR = radius + 22
        const pt = getPoint(i, labelR)
        return (
          <text
            key={i}
            x={pt.x.toFixed(2)}
            y={pt.y.toFixed(2)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fill="currentColor"
            fillOpacity={0.8}
          >
            {v.label}
          </text>
        )
      })}

      {/* score labels */}
      {dataPoints.map((p, i) => (
        <text
          key={`score-${i}`}
          x={(p.x + (p.x - cx) * 0.15).toFixed(2)}
          y={(p.y + (p.y - cy) * 0.15).toFixed(2)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fontWeight="600"
          fill="hsl(var(--primary))"
        >
          {values[i]!.value}
        </text>
      ))}
    </svg>
  )
}
