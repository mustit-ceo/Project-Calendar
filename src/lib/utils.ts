import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Status } from './types'

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
export const DR_DEPARTMENTS = ['BE', 'FE']

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
