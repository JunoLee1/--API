/**
 * 카테고리 스코프 (schema.prisma enum CategoryScope).
 * TEAM = 팀장이 편성 요청 가능, DEPARTMENT = 부서장이 편성 요청 가능.
 */
export type CategoryScope = 'TEAM' | 'DEPARTMENT'

export interface ExpenseCategory {
  id: number
  code: string
  label: string
  sortOrder: number
  isActive: boolean
  /**
   * ADR 0019 편성 워크플로우 도입. 서버가 늘 내려주지만 legacy 캐시 안전상 optional.
   */
  scope?: CategoryScope
}

// 카테고리 code 는 이제 컴파일 타임에 고정할 수 없음.
// 좁은 타입이 꼭 필요한 곳은 string literal 대신 string.
export type ExpenseCategoryCode = string
