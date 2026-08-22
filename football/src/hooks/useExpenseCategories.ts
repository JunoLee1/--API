import { useEffect, useState } from 'react'
import { expenseCategoryApi } from '@/services/expense-category.service'
import type { ExpenseCategory } from '@/types/expense-category'

// Module-level cache so the app fetches /expense-categories at most once per session.
// Categories are low-write, read-hot; refetch is triggered manually via `refresh()` if needed.
let cached: ExpenseCategory[] | null = null
let inflight: Promise<ExpenseCategory[]> | null = null
const subscribers = new Set<(rows: ExpenseCategory[]) => void>()

async function fetchOnce(): Promise<ExpenseCategory[]> {
  if (cached) return cached
  if (!inflight) {
    inflight = expenseCategoryApi
      .list()
      .then((rows) => {
        cached = rows
        inflight = null
        subscribers.forEach((s) => s(rows))
        return rows
      })
      .catch((err) => {
        inflight = null
        throw err
      })
  }
  return inflight
}

export function invalidateExpenseCategoriesCache() {
  cached = null
  inflight = null
}

export function useExpenseCategories() {
  const [rows, setRows] = useState<ExpenseCategory[] | null>(cached)

  useEffect(() => {
    if (rows) return
    let alive = true
    void fetchOnce()
      .then((res) => {
        if (alive) setRows(res)
      })
      .catch(() => {
        if (alive) setRows([])
      })
    subscribers.add(setRows)
    return () => {
      alive = false
      subscribers.delete(setRows)
    }
  }, [rows])

  const labelOf = (code: string) => rows?.find((r) => r.code === code)?.label ?? code

  return {
    rows: rows ?? [],
    loading: rows === null,
    labelOf,
  }
}
