import type { ReactNode } from 'react'

const GRID_COL_LABELS = ['LC', 'LHS', 'CTR', 'RHS', 'RC']
const GRID_ROW_LABELS = ['ATT', 'MID', 'DEF']

interface FootballPitchProps {
  viewMode: 'formation' | 'grid'
  children: ReactNode
}

export function FootballPitch({ viewMode, children }: FootballPitchProps) {
  return (
    <div
      className="relative w-full rounded-lg overflow-hidden select-none"
      style={{ aspectRatio: '2/3', background: 'linear-gradient(180deg, #1a6b2e 0%, #1e7a34 50%, #1a6b2e 100%)' }}
    >
      {/* 피치 라인 */}
      <div className="absolute inset-0 pointer-events-none">
        {/* 외곽 */}
        <div className="absolute inset-[3%] border border-white/40 rounded-sm" />
        {/* 센터라인 */}
        <div className="absolute left-[3%] right-[3%] border-t border-white/40" style={{ top: '50%' }} />
        {/* 센터서클 */}
        <div
          className="absolute border border-white/40 rounded-full"
          style={{ width: '22%', height: '14%', top: '43%', left: '39%' }}
        />
        {/* 페널티 에어리어 (상단) */}
        <div
          className="absolute border border-white/40 border-t-0"
          style={{ width: '52%', height: '17%', top: '3%', left: '24%' }}
        />
        {/* 페널티 에어리어 (하단) */}
        <div
          className="absolute border border-white/40 border-b-0"
          style={{ width: '52%', height: '17%', bottom: '3%', left: '24%' }}
        />
      </div>

      {/* 스페인 그리드 오버레이 */}
      {viewMode === 'grid' && (
        <div className="absolute inset-0 pointer-events-none">
          {/* 세로 구분선 (5열) */}
          {[20, 40, 60, 80].map((pct) => (
            <div
              key={pct}
              className="absolute top-0 bottom-0 border-l border-white/20"
              style={{ left: `${pct}%` }}
            />
          ))}
          {/* 가로 구분선 (3행) */}
          {[33.3, 66.6].map((pct) => (
            <div
              key={pct}
              className="absolute left-0 right-0 border-t border-white/20"
              style={{ top: `${pct}%` }}
            />
          ))}
          {/* 열 레이블 (상단) */}
          {GRID_COL_LABELS.map((label, i) => (
            <div
              key={label}
              className="absolute top-1 text-[9px] font-bold text-white/50 text-center"
              style={{ left: `${i * 20}%`, width: '20%' }}
            >
              {label}
            </div>
          ))}
          {/* 행 레이블 (우측) */}
          {GRID_ROW_LABELS.map((label, i) => (
            <div
              key={label}
              className="absolute right-1 text-[9px] font-bold text-white/50"
              style={{ top: `${i * 33.3 + 13}%` }}
            >
              {label}
            </div>
          ))}
        </div>
      )}

      {/* 슬롯들 */}
      {children}
    </div>
  )
}
