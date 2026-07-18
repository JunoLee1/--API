import { useState, useEffect } from 'react'
import { authApi } from '@/services/auth.service'
import type { LoginHistoryEntry } from '@/services/auth.service'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, XCircle } from 'lucide-react'

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export function LoginHistoryPage() {
  const [history, setHistory] = useState<LoginHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi.getLoginHistory()
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">로그인 이력</h1>
        <p className="text-sm text-muted-foreground mt-0.5">최근 100건</p>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : history.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            로그인 이력이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20 text-center">결과</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>닉네임</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>User-Agent</TableHead>
                <TableHead className="w-44 text-right">시간</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-center">
                    {h.success
                      ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                      : <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                    }
                  </TableCell>
                  <TableCell className="text-sm">{h.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{h.user?.nickname ?? '—'}</TableCell>
                  <TableCell className="text-xs tabular-nums">{h.ip}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{h.userAgent}</TableCell>
                  <TableCell className="text-xs tabular-nums text-right">{formatDateTime(h.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
