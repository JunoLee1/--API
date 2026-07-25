export interface CoachingStaffEval {
  id: number
  staffUserId: number
  evaluatorId: number
  score: number
  comment: string | null
  evaluatedAt: string
  evaluator: {
    id: number
    nickname: string
    coachingRole: string | null
  }
}
