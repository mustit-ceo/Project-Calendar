import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Status, Project } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STATUS_COLORS: Record<Status, { bg: string; text: string; border: string }> = {
  '완료': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  '진행': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  '대기': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
  '보류': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  '예정': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
}

export const DEPT_COLORS: Record<string, string> = {
  'PM': 'bg-purple-100 text-purple-800',
  'BE': 'bg-orange-100 text-orange-800',
  'FE': 'bg-cyan-100 text-cyan-800',
  'Design': 'bg-rose-100 text-rose-800',
  'Oth': 'bg-gray-100 text-gray-700',
}

export const PROJECT_CATEGORIES = [
  '신규기능', '고도화', '리뉴얼', '레거시', 'DevOps', 'Search', '셀러', '기타',
]
export const DR_CATEGORIES = ['DR', '유지보수']
/** 전체 카테고리 (프로젝트 + DR) */
export const CATEGORIES = [...PROJECT_CATEGORIES, ...DR_CATEGORIES]

export const STATUSES: Status[] = ['진행', '대기', '완료', '보류', '예정']
export const DEPARTMENTS = ['PM', 'BE', 'FE', 'Design', 'Oth']
export const DR_DEPARTMENTS = ['PM', 'BE', 'FE']

export function getJiraUrl(ticket: string | null): string | null {
  if (!ticket || ticket === '-') return null
  return `https://jira.mustit.xyz/browse/${ticket}`
}

/** 완료 프로젝트(최상위) 및 그 모든 하위 항목 ID 집합 반환 */
export function getCompletedProjectDescendants(projects: import('./types').Project[]): Set<string> {
  const excluded = new Set<string>(
    projects.filter(p => !p.parent_id && p.status === '완료').map(p => p.id)
  )
  let changed = true
  while (changed) {
    changed = false
    for (const p of projects) {
      if (!excluded.has(p.id) && p.parent_id && excluded.has(p.parent_id)) {
        excluded.add(p.id)
        changed = true
      }
    }
  }
  return excluded
}

/* ── 지연 자동 감지 ─────────────────────────────────────────────
   조건 3가지 — 우선순위 순 (LTS 초과 > 미착수 > 정체)
   1) lts: lts_date 가 오늘 이전 + 상태 != 완료/보류
   2) notStarted: 상태 = 대기 + start_date 가 오늘 이전
   3) stale: 상태 = 진행 + updated_at 가 7일 이상 무변동
   같은 프로젝트는 가장 심각한 사유 1건으로만 분류된다. */
export type DelayReason = 'lts' | 'notStarted' | 'stale'

export interface DelayedProject {
  project: Project
  reason: DelayReason
  daysOver: number
}

export const DELAY_REASON_LABEL: Record<DelayReason, string> = {
  lts: 'LTS 초과',
  notStarted: '시작일 초과 미착수',
  stale: '7일+ 무변동',
}

export function getDelayedProjects(projects: Project[]): DelayedProject[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const out: DelayedProject[] = []
  for (const p of projects) {
    if (p.is_archived) continue
    if (p.status === '완료' || p.status === '보류') continue

    // 1) LTS 초과
    if (p.lts_date && p.lts_date < todayKey) {
      const lts = new Date(p.lts_date)
      const days = Math.floor((today.getTime() - lts.getTime()) / 86_400_000)
      out.push({ project: p, reason: 'lts', daysOver: days })
      continue
    }

    // 2) 시작일 초과 미착수
    if (p.status === '대기' && p.start_date && p.start_date < todayKey) {
      const sd = new Date(p.start_date)
      const days = Math.floor((today.getTime() - sd.getTime()) / 86_400_000)
      out.push({ project: p, reason: 'notStarted', daysOver: days })
      continue
    }

    // 3) 정체 (진행 중인데 7일+ 변경 없음)
    if (p.status === '진행' && p.updated_at) {
      const upd = new Date(p.updated_at)
      if (upd < sevenDaysAgo) {
        const days = Math.floor((today.getTime() - upd.getTime()) / 86_400_000)
        out.push({ project: p, reason: 'stale', daysOver: days })
      }
    }
  }
  return out
}

export function buildProjectTree(projects: import('./types').Project[]): import('./types').Project[] {
  const map = new Map<string, import('./types').Project>()
  const roots: import('./types').Project[] = []

  projects.forEach(p => {
    map.set(p.id, { ...p, children: [] })
  })

  projects.forEach(p => {
    const node = map.get(p.id)!
    if (p.parent_id && map.has(p.parent_id)) {
      map.get(p.parent_id)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}
