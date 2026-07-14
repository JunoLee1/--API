import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface FeedItem {
  id: string | number
  label: string
  sub?: string
  date: string
}

interface Props {
  title: string
  items: FeedItem[]
  loading: boolean
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export function RecentFeedCard({ title, items, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">최근 항목이 없습니다</p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 5).map((item) => (
              <li key={item.id} className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-sm truncate">{item.label}</p>
                  {item.sub && (
                    <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDate(item.date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
