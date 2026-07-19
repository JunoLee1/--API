import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MiniCalendarProps {
  sessionDates: string[]        // 'YYYY-MM-DD' 배열
  selectedDate: string | null   // 'YYYY-MM-DD' 또는 null
  onSelect: (date: string | null) => void
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function MiniCalendar({ sessionDates, selectedDate, onSelect }: MiniCalendarProps) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-indexed

  const sessionSet = new Set(sessionDates)

  const firstDay = new Date(viewYear, viewMonth, 1)
  const lastDay = new Date(viewYear, viewMonth + 1, 0)
  const startDow = firstDay.getDay() // 0=일

  const cells: (number | null)[] = [
    ...Array.from({ length: startDow }, () => null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
  ]

  const toDateStr = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return `${viewYear}-${mm}-${dd}`
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long',
  })

  return (
    <div className="w-44 shrink-0 border-r pr-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={prevMonth}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-medium">{monthLabel}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={nextMonth}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {DAY_LABELS.map(d => (
          <span key={d} className="text-center text-[10px] text-muted-foreground py-0.5">{d}</span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`empty-${i}`} />
          const dateStr = toDateStr(day)
          const hasSession = sessionSet.has(dateStr)
          const isSelected = selectedDate === dateStr
          return (
            <button
              key={dateStr}
              onClick={() => onSelect(isSelected ? null : dateStr)}
              className={cn(
                'flex flex-col items-center justify-start rounded text-[11px] py-0.5 leading-none transition-colors',
                isSelected ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted',
              )}
            >
              <span>{day}</span>
              {hasSession && (
                <span className={cn('mt-0.5 h-1 w-1 rounded-full', isSelected ? 'bg-primary-foreground' : 'bg-primary')} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
