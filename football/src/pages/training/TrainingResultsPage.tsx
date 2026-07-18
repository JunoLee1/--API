import { useState, useEffect } from 'react'
import { trainingApi } from '@/services/training.service'
import type { TrainingResultRow, SessionType, TrainingResultFilters } from '@/types/training'
import { SESSION_TYPE_LABEL } from '@/types/training'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Download } from 'lucide-react'
import Papa from 'papaparse'
import { Pagination } from '@/components/ui/pagination'

const PAGE_SIZE = 10

const ATTENDANCE_LABEL: Record<string, string> = {
  PRESENT: '출석',
  ABSENT_AUTHORIZED: '공결',
  ABSENT_UNAUTHORIZED: '무단결석',
  LATE_AUTHORIZED: '공결지각',
  LATE_UNAUTHORIZED: '무단지각',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function TrainingResultsPage() {
  const [filters, setFilters] = useState<TrainingResultFilters>({ from: '', to: '', sessionType: '' })
  const [rows, setRows] = useState<TrainingResultRow[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const fetchData = async () => {
    setLoading(true)
    setPage(1)
    try {
      const data = await trainingApi.getResults(filters)
      setRows(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const exportCsv = () => {
    const data = rows.map(r => ({
      날짜: formatDate(r.session.date),
      세션유형: SESSION_TYPE_LABEL[r.session.sessionType] ?? r.session.sessionType,
      선수명: r.player.playerName,
      포지션: r.player.position,
      출석: ATTENDANCE_LABEL[r.attendance] ?? r.attendance,
      달성도: r.performanceScore ?? '',
      피드백: r.feedback ?? '',
    }))
    const csv = Papa.unparse(data)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `훈련결과_${filters.from ?? ''}_${filters.to ?? ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">훈련 결과</h1>
          <p className="text-sm text-muted-foreground mt-0.5">전체 {rows.length}건</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="w-4 h-4 mr-1" /> CSV 내보내기
        </Button>
      </div>

      <div className="border-b px-6 py-3 flex flex-wrap gap-4 items-end shrink-0 bg-muted/30">
        <div className="space-y-1">
          <Label className="text-xs">시작일</Label>
          <Input
            type="date"
            value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
            className="w-36 h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">종료일</Label>
          <Input
            type="date"
            value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
            className="w-36 h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">세션 유형</Label>
          <Select
            value={filters.sessionType ?? ''}
            onValueChange={v => setFilters(f => ({ ...f, sessionType: v as SessionType | '' }))}
            items={{ '': '전체', ...SESSION_TYPE_LABEL }}
          >
            <SelectTrigger className="w-44 h-8 text-sm bg-background">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              {(Object.keys(SESSION_TYPE_LABEL) as SessionType[]).map(t => (
                <SelectItem key={t} value={t}>{SESSION_TYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={fetchData} disabled={loading} className="h-8">
          {loading ? '조회 중...' : '조회'}
        </Button>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>날짜</TableHead>
              <TableHead className="w-32">세션 유형</TableHead>
              <TableHead>선수</TableHead>
              <TableHead className="w-24">포지션</TableHead>
              <TableHead className="w-28">출석</TableHead>
              <TableHead className="w-20 text-right">달성도</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">로딩 중...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">데이터가 없습니다.</TableCell></TableRow>
            ) : paged.map(r => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums">{formatDate(r.session.date)}</TableCell>
                <TableCell>{SESSION_TYPE_LABEL[r.session.sessionType] ?? r.session.sessionType}</TableCell>
                <TableCell className="font-medium">{r.player.playerName}</TableCell>
                <TableCell>{r.player.position}</TableCell>
                <TableCell>{ATTENDANCE_LABEL[r.attendance] ?? r.attendance}</TableCell>
                <TableCell className="text-right tabular-nums">{r.performanceScore ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={rows.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
