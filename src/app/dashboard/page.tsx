'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Project, TeamMember, Department } from '@/lib/types'
import { format, addDays, getDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { RefreshCw, AlertTriangle, Clock, CalendarX, Pause } from 'lucide-react'
import { DeptBadge } from '@/components/ui/DeptBadge'
import {
  getDelayedProjects, DELAY_REASON_LABEL, DelayedProject, DelayReason,
} from '@/lib/utils'
import Link from 'next/link'

/* ── 임계치 (1~3 녹색 / 4~5 노랑 / 6~7 빨강 / 8+ 짙은빨강) ─────────── */
const TH_GREEN = 3
const TH_YELLOW = 5
const TH_RED = 7

const NUM_WEEKS = 8

const DEPT_ORDER: Record<string, number> = { PM: 0, BE: 1, FE: 2, Design: 3, Oth: 4 }

interface Week {
  key: string
  label: string       // "M/d"
  sublabel: string    // "W##"
  start: Date         // Monday 00:00
  end: Date           // Sunday 23:59
  isCurrent: boolean
}

interface CellInfo {
  count: number
  projects: { id: string; name: string; parentName: string | null }[]
}

/* ── 유틸 ──────────────────────────────────────── */
function getMondayOfWeek(d: Date): Date {
  const date = new Date(d)
  const dow = getDay(date)
  date.setDate(date.getDate() + (dow === 0 ? -6 : 1 - dow))
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
}

function parseYMD(s: string | null): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function normalizeAssignees(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch { return [] }
  }
  return []
}

function buildWeeks(today: Date, n: number): Week[] {
  const monday = getMondayOfWeek(today)
  const todayKey = format(today, 'yyyy-MM-dd')
  return Array.from({ length: n }, (_, i) => {
    const start = addDays(monday, i * 7)
    const end = endOfDay(addDays(start, 6))
    const isCurrent =
      format(start, 'yyyy-MM-dd') <= todayKey &&
      todayKey <= format(end, 'yyyy-MM-dd')
    return {
      key: format(start, 'yyyy-MM-dd'),
      label: `${format(start, 'M/d', { locale: ko })}~${format(end, 'M/d', { locale: ko })}`,
      sublabel: `W${format(start, 'w', { locale: ko })}`,
      start,
      end,
      isCurrent,
    }
  })
}

/** 주 범위 [ws, we]와 프로젝트 기간이 겹치는가? */
function overlapsWeek(p: Project, weekStart: Date, weekEnd: Date): boolean {
  const s = parseYMD(p.start_date)
  const e = parseYMD(p.lts_date) ?? parseYMD(p.end_date)
  if (!s && !e) return false
  const start = s ?? e!
  const end = e ?? s!
  return start <= weekEnd && end >= weekStart
}

/** 셀 색상 결정 */
function getCellStyle(count: number): { bg: string; text: string; border: string } {
  if (count === 0) return { bg: '#f9fafb', text: '#d1d5db', border: '#f3f4f6' }
  if (count <= TH_GREEN) return { bg: '#bbf7d0', text: '#166534', border: '#86efac' }
  if (count <= TH_YELLOW) return { bg: '#fef08a', text: '#854d0e', border: '#fde047' }
  if (count <= TH_RED) return { bg: '#fecaca', text: '#991b1b', border: '#fca5a5' }
  return { bg: '#dc2626', text: '#ffffff', border: '#b91c1c' }
}

function sortMembers(members: TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    const dd = (DEPT_ORDER[a.department] ?? 99) - (DEPT_ORDER[b.department] ?? 99)
    if (dd !== 0) return dd
    if (a.is_leader !== b.is_leader) return a.is_leader ? -1 : 1
    return a.name.localeCompare(b.name, 'ko')
  })
}

/* ── 페이지 ─────────────────────────────────────── */
export default function DashboardPage() {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  // null = 확인 중 / true = 관리자 / false = 권한 없음
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  // 관리자 권한 체크 (URL 직접 접근 차단)
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) { setIsAdmin(false); return }
      const { data } = await supabase
        .from('allowed_users')
        .select('role, is_active')
        .eq('email', user.email)
        .maybeSingle()
      setIsAdmin(data?.role === 'admin' && data?.is_active === true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const today = useMemo(() => new Date(), [])
  const weeks = useMemo(() => buildWeeks(today, NUM_WEEKS), [today])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: projData }, { data: memData }] = await Promise.all([
      supabase.from('projects').select('*').eq('is_archived', false),
      supabase.from('team_members').select('*').eq('is_active', true),
    ])
    setProjects((projData ?? []) as Project[])
    setMembers((memData ?? []) as TeamMember[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  /* ── 워크로드 매트릭스 계산 ──────────────────── */
  const matrix = useMemo(() => {
    const projectMap = new Map(projects.map(p => [p.id, p]))
    // 자기 자신/조상 체인에 멤버가 담당자인지
    const isAssigned = (p: Project, member: TeamMember): boolean => {
      let cur: Project | undefined = p
      let depth = 0
      while (cur && depth < 10) {
        const ids = normalizeAssignees(cur.assignees)
        if (ids.includes(member.id) || ids.includes(member.name)) return true
        cur = cur.parent_id ? projectMap.get(cur.parent_id) : undefined
        depth++
      }
      return false
    }

    // 진행 가능 상태만 (완료/보류 제외)
    const activeProjects = projects.filter(p => p.status !== '완료' && p.status !== '보류')

    // leaf 판정: 자식이 없는 프로젝트
    const parentIds = new Set(projects.filter(p => p.parent_id).map(p => p.parent_id))
    const leafProjects = activeProjects.filter(p => !parentIds.has(p.id))

    // 부모 경로 표시 헬퍼
    const parentPath = (p: Project): string | null => {
      if (!p.parent_id) return null
      const parent = projectMap.get(p.parent_id)
      if (!parent) return null
      if (parent.parent_id) {
        const gp = projectMap.get(parent.parent_id)
        return gp ? `${gp.name} > ${parent.name}` : parent.name
      }
      return parent.name
    }

    const sortedMembers = sortMembers(members)
    const result = new Map<string, Map<string, CellInfo>>()

    for (const member of sortedMembers) {
      const memMap = new Map<string, CellInfo>()
      for (const w of weeks) {
        const list: CellInfo['projects'] = []
        for (const p of leafProjects) {
          if (!isAssigned(p, member)) continue
          if (!overlapsWeek(p, w.start, w.end)) continue
          list.push({ id: p.id, name: p.name, parentName: parentPath(p) })
        }
        memMap.set(w.key, { count: list.length, projects: list })
      }
      result.set(member.id, memMap)
    }
    return { sortedMembers, matrix: result }
  }, [projects, members, weeks])

  /* ── 지연 감지 ───────────────────────────────── */
  const delayed = useMemo(() => {
    const list = getDelayedProjects(projects)
    // 더 오래 지연된 것이 위로
    return [...list].sort((a, b) => b.daysOver - a.daysOver)
  }, [projects])

  // 부모 경로 헬퍼 (지연 패널용)
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])
  const parentPath = (p: Project): string | null => {
    if (!p.parent_id) return null
    const parent = projectMap.get(p.parent_id)
    if (!parent) return null
    if (parent.parent_id) {
      const gp = projectMap.get(parent.parent_id)
      return gp ? `${gp.name} > ${parent.name}` : parent.name
    }
    return parent.name
  }

  // 관리자 가드 — hook 호출 다음에 early return (rules of hooks 준수)
  if (isAdmin === false) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-gray-400 text-sm">
        관리자 권한이 필요합니다.
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 대시보드</h1>
          <p className="text-sm text-gray-500 mt-1">
            팀 워크로드와 일정 위험을 한눈에
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          title="새로고침"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 지연 감지 패널 */}
      <DelayPanel
        delayed={delayed}
        loading={loading}
        parentPath={parentPath}
      />

      {/* 멤버 워크로드 히트맵 */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">멤버별 워크로드</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              향후 {NUM_WEEKS}주간 동시에 진행되는 프로젝트 수
            </p>
          </div>
          {/* 범례 */}
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <LegendDot color="#f9fafb" border="#e5e7eb" label="0" />
            <LegendDot color="#bbf7d0" border="#86efac" label={`1~${TH_GREEN}`} />
            <LegendDot color="#fef08a" border="#fde047" label={`${TH_GREEN + 1}~${TH_YELLOW}`} />
            <LegendDot color="#fecaca" border="#fca5a5" label={`${TH_YELLOW + 1}~${TH_RED}`} />
            <LegendDot color="#dc2626" border="#b91c1c" label={`${TH_RED + 1}+`} textColor="#fff" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" />
            불러오는 중...
          </div>
        ) : matrix.sortedMembers.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">활성 멤버가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white text-left px-3 py-2 border-b border-gray-200 font-medium text-gray-700 z-10 min-w-[180px]">
                    멤버
                  </th>
                  {weeks.map(w => (
                    <th
                      key={w.key}
                      className={`px-2 py-2 border-b border-gray-200 font-medium text-center text-xs ${
                        w.isCurrent ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                      }`}
                      style={{ minWidth: 92 }}
                    >
                      <div>{w.label}</div>
                      <div className="text-[10px] text-gray-400 font-normal">{w.sublabel}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.sortedMembers.map(m => {
                  const memMap = matrix.matrix.get(m.id)
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="sticky left-0 bg-white px-3 py-2 border-b border-gray-100 z-10">
                        <div className="flex items-center gap-2">
                          <DeptBadge dept={m.department} />
                          <span className="font-medium text-gray-900">{m.name}</span>
                          {m.is_leader && (
                            <span className="text-[10px] text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
                              리더
                            </span>
                          )}
                        </div>
                      </td>
                      {weeks.map(w => {
                        const cell = memMap?.get(w.key) ?? { count: 0, projects: [] }
                        const s = getCellStyle(cell.count)
                        return (
                          <td
                            key={w.key}
                            className="px-2 py-2 border-b border-gray-100 text-center"
                          >
                            <div
                              className="group relative inline-flex items-center justify-center rounded-md font-semibold text-sm cursor-default"
                              style={{
                                width: 56,
                                height: 32,
                                backgroundColor: s.bg,
                                color: s.text,
                                border: `1px solid ${s.border}`,
                              }}
                            >
                              {cell.count}
                              {cell.count > 0 && (
                                <div
                                  className="absolute z-20 hidden group-hover:block top-full mt-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap text-left"
                                  style={{ minWidth: 220 }}
                                >
                                  <div className="font-semibold mb-1 border-b border-gray-700 pb-1">
                                    {cell.count}개 프로젝트
                                  </div>
                                  {cell.projects.slice(0, 8).map(pr => (
                                    <div key={pr.id} className="py-0.5">
                                      {pr.parentName && (
                                        <span className="text-gray-400">{pr.parentName} &gt; </span>
                                      )}
                                      {pr.name}
                                    </div>
                                  ))}
                                  {cell.projects.length > 8 && (
                                    <div className="text-gray-400 mt-1">
                                      외 {cell.projects.length - 8}개 ...
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/* ── 지연 감지 패널 ─────────────────────────── */
function DelayPanel({
  delayed, loading, parentPath,
}: {
  delayed: DelayedProject[]
  loading: boolean
  parentPath: (p: Project) => string | null
}) {
  const buckets: Record<DelayReason, DelayedProject[]> = {
    lts: [],
    notStarted: [],
    stale: [],
  }
  for (const d of delayed) buckets[d.reason].push(d)

  const cardConfig: { reason: DelayReason; icon: React.ElementType; bg: string; border: string; text: string; iconBg: string }[] = [
    { reason: 'lts',         icon: AlertTriangle, bg: '#fef2f2', border: '#fecaca', text: '#991b1b', iconBg: '#fee2e2' },
    { reason: 'notStarted',  icon: CalendarX,     bg: '#fffbeb', border: '#fde68a', text: '#92400e', iconBg: '#fef3c7' },
    { reason: 'stale',       icon: Pause,         bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6', iconBg: '#ede9fe' },
  ]

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            주의 필요
            {!loading && (
              <span className={`ml-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                delayed.length > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {delayed.length}건
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            LTS 초과 / 시작일 초과 미착수 / 7일+ 무변동 항목
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : delayed.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-8">
          ✅ 지연 항목이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {cardConfig.map(cfg => {
            const items = buckets[cfg.reason]
            const Icon = cfg.icon
            return (
              <div
                key={cfg.reason}
                className="rounded-lg border p-3"
                style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded"
                      style={{ backgroundColor: cfg.iconBg, color: cfg.text }}
                    >
                      <Icon size={13} />
                    </span>
                    <span className="text-sm font-semibold" style={{ color: cfg.text }}>
                      {DELAY_REASON_LABEL[cfg.reason]}
                    </span>
                  </div>
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: cfg.iconBg, color: cfg.text }}
                  >
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2">없음</div>
                ) : (
                  <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                    {items.map(d => {
                      const path = parentPath(d.project)
                      return (
                        <li key={d.project.id} className="text-xs">
                          <Link
                            href="/projects"
                            className="block bg-white rounded px-2 py-1.5 hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-gray-900 truncate" title={d.project.name}>
                                {d.project.name}
                              </span>
                              <span
                                className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: cfg.iconBg, color: cfg.text }}
                              >
                                +{d.daysOver}일
                              </span>
                            </div>
                            {path && (
                              <div className="text-[10px] text-gray-400 truncate mt-0.5" title={path}>
                                {path}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 mt-1">
                              {d.project.department && (
                                <DeptBadge dept={d.project.department} />
                              )}
                              <span className="text-[10px] text-gray-500">
                                {d.project.status}
                              </span>
                            </div>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ── 작은 컴포넌트 ───────────────────────────── */
function LegendDot({
  color, border, label, textColor = '#374151',
}: { color: string; border: string; label: string; textColor?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block w-4 h-4 rounded"
        style={{ backgroundColor: color, border: `1px solid ${border}` }}
      />
      <span style={{ color: textColor === '#fff' ? '#374151' : textColor }}>{label}</span>
    </div>
  )
}
