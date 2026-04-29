export type Department = 'PM' | 'BE' | 'FE' | 'Design' | 'Oth'
export type Status = '완료' | '진행' | '대기' | '보류' | '예정'
export type BusinessType = '거래액' | '고객경험' | '생산성' | '기타'
export type Effort = 'Low' | 'Medium' | 'High'

export interface RetroEntry {
  dept: string
  comment: string
}

export interface Project {
  id: string
  parent_id: string | null
  category: string
  name: string
  jira_ticket: string | null
  status: Status
  department: Department | null
  assignees: string[]
  start_date: string | null
  end_date: string | null
  lts_date: string | null
  is_archived: boolean
  is_backlog: boolean
  sort_order: number
  notes: string | null
  retrospective: RetroEntry[] | null
  created_at: string
  updated_at: string
  children?: Project[]
}

export interface TaskProgress {
  id: string
  project_id: string
  progress_date: string
  label: string | null
}

export interface NextUp {
  id: string
  business_type: BusinessType | null
  initiator: string | null
  name: string
  planned_start: string | null
  lts_target: string | null
  assignee: string | null
  notes: string | null
  sort_order: number
  created_at: string
}

export interface UxiLab {
  id: string
  priority: number | null
  category: string | null
  agenda: string
  business_impact: number
  ux_impact: number
  effort: Effort | null
  notes: string | null
  sort_order: number
  created_at: string
  entry_date: string | null
  reference: string | null
  initiator: string | null
  outcome: string | null
}

export interface TeamMember {
  id: string
  name: string
  department: Department
  email: string | null
  is_active: boolean
  is_leader: boolean
}

// ── Backlog 전용 타입 ────────────────────────────────────────
export interface BacklogItem {
  id: string
  category: string
  name: string
  jira_ticket: string | null
  status: Status
  department: Department | null
  assignees: string[]
  sort_order: number
  /** 0 = 미설정, 1~5 = 별점 */
  importance: number
  is_archived: boolean
  created_at: string
  updated_at: string
}

// ── Admin 전용 타입 ──────────────────────────────────────────
export type UserRole = 'admin' | 'member'

export interface AllowedUser {
  id: string
  email: string
  name: string | null
  role: UserRole
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

// ── DR 전용 타입 ─────────────────────────────────────────────
export interface DrItem {
  id: string
  parent_id: string | null
  category: string
  name: string
  jira_ticket: string | null
  status: Status
  department: Department | null
  assignees: string[]
  notes: string | null
  is_archived: boolean
  sort_order: number
  created_at: string
  updated_at: string
  children?: DrItem[]
}

export interface DrProgress {
  id: string
  dr_id: string
  progress_date: string
}

// ── 개선사항 요청 ────────────────────────────────────────────
export interface ImprovementRequest {
  id: string
  user_email: string
  user_name: string | null
  content: string
  link: string | null
  image_urls: string[]
  created_at: string
  updated_at: string
}

export interface ImprovementComment {
  id: string
  request_id: string
  user_email: string
  user_name: string | null
  content: string
  created_at: string
  updated_at: string
}

// ── 프로젝트 변경 이력 ───────────────────────────────────────
export type HistoryAction = 'create' | 'update' | 'delete'
export type HistoryField = 'status' | 'start_date' | 'end_date' | 'lts_date' | 'progress'

export interface ProjectHistoryEntry {
  id: string
  project_id: string
  project_name: string
  changed_by_email: string | null
  changed_by_name: string | null
  changed_at: string
  action: HistoryAction
  field_name: HistoryField | null
  old_value: string | null
  new_value: string | null
}

// ── 프로젝트 코멘트 ──────────────────────────────────────────
export interface ProjectComment {
  id: string
  project_id: string
  author_email: string
  author_name: string | null
  content: string
  created_at: string
  updated_at: string
}
