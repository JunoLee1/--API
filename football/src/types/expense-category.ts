export interface ExpenseCategory {
  id: number
  code: string
  label: string
  sortOrder: number
  isActive: boolean
}

// 카테고리 code 는 이제 컴파일 타임에 고정할 수 없음.
// 좁은 타입이 꼭 필요한 곳은 string literal 대신 string.
export type ExpenseCategoryCode = string
