export type PlanningStatus = 'todo' | 'doing' | 'done' | 'nostatus'

export type PlanningPriority = 'low' | 'medium' | 'high'

export interface PlanningCard {
  id: string
  title: string
  status: PlanningStatus
  priority: PlanningPriority
  isFinalized?: boolean
  completedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface PlanningCardCreateInput {
  title: string
  status: PlanningStatus
  priority: PlanningPriority
}

export interface PlanningCardUpdateInput {
  title?: string
  status?: PlanningStatus
  priority?: PlanningPriority
  isFinalized?: boolean
  completedAt?: string | null
}
