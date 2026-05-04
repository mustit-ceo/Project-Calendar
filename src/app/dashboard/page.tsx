'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Project, TeamMember, TaskProgress, DrItem, DrProgress } from '@/lib/types'
import { format, addDays, getDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { RefreshCw, AlertTriangle, Clock, CalendarX, Pause, ChevronDown, ChevronRight as ChevronRightIcon, UserMinus } from 'lucide-react'
import { DeptBadge } from '@/components/ui/DeptBadge'
import {
  getDelayedProjects, DELAY_REASON_LABEL, DelayedProject, DelayReason,
} from '@/lib/utils'
import Link from 'next/link'

/* ── 임계치 (프로젝트와 DR 별도) ───────────────────────── */
// 프로젝트: 정상 1~2 / 노란 3~4 / 주의 5~6 / 부하 7+
const PROJ_TH = { g: 2, y: 4, r: 6 } as const
// DR: 정상 1~3 / 노란 4~5 / 주의 6~7 / 부하 8+
const DR_TH = { g: 3, y: 5, r: 7 } as const

type LoadBand = 'green' | 'yellow' | 'red' | 'overload'

function classifyLoad(count: number, t: { g: number; y: number; r: number }): LoadBand {
  if (count <= t.g) return 'green'
  if (count <= t.y) return 'yellow'
  if (count <= t.r) return 'red'
  return 'overload'
}

// 임계치 요약 칩 배경색과 동일 (범례 일치)
const BAND_COLOR: Record<LoadBand, string> = {
  green:    '#bbf7d0',
  yellow:   '#fef08a',
  red:      '#fecaca',
  overload: '#7f1d1d',
}

const DEPT_ORDER: Record<string, number> = { PM: 0, BE: 1, FE: 2, Design: 3, Oth: 4 }

interface LoadEntry {
  member: TeamMember
  count: number
  items: { id: string; name: string; parentName?: string | null }[]
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
  const [projects,  setProjects]  = useState<Project[]>([])
  const [members,   setMembers]   = useState<TeamMember[]>([])
  const [progress,  setProgress]  = useState<TaskProgress[]>([])
  const [drItems,   setDrItems]   = useState<DrItem[]>([])
  const [drProgress, setDrProgress] = useState<DrProgress[]>([])
  const [loading,   setLoading]   = useState(true)

  const today = useMemo(() => new Date(), [])
  const weekRange = useMemo(() => {
    const monday = getMondayOfWeek(today)
    const sunday = endOfDay(addDays(monday, 6))
    return { start: monday, end: sunday }
  }, [today])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [
      { data: projData },
      { data: memData },
      { data: progData },
      { data: drData },
      { data: drProgData },
    ] = await Promise.all([
      supabase.from('projects').select('*').eq('is_archived', false),
      supabase.from('team_members').select('*').eq('is_active', true),
      supabase.from('task_progress').select('*').range(0, 99999),
      supabase.from('dr_items').select('*').eq('is_archived', false),
      supabase.from('dr_progress').select('*').range(0, 99999),
    ])
    setProjects((projData ?? []) as Project[])
    setMembers((memData ?? []) as TeamMember[])
    setProgress((progData ?? []) as TaskProgress[])
    setDrItems((drData ?? []) as DrItem[])
    setDrProgress((drProgData ?? []) as DrProgress[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // 페이지 진입 시 last_seen 갱신 (Sidebar 운영 모니터링 배지 dismiss)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.email) return
      supabase.from('allowed_users')
        .update({ last_seen_dashboard: new Date().toISOString() })
        .eq('email', user.email)
        .then()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 이번주 워크로드 계산 (프로젝트 + DR) ─────── */
  const workload = useMemo(() => {
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

    const parentPathOf = (p: Project): string | null => {
      if (!p.parent_id) return null
      const parent = projectMap.get(p.parent_id)
      if (!parent) return null
      if (parent.parent_id) {
        const gp = projectMap.get(parent.parent_id)
        return gp ? `${gp.name} > ${parent.name}` : parent.name
      }
      return parent.name
    }

    // 이번주 범위 (YYYY-MM-DD)
    const periodStart = format(weekRange.start, 'yyyy-MM-dd')
    const periodEnd   = format(weekRange.end,   'yyyy-MM-dd')

    // 이번주 task_progress가 있는 프로젝트
    const projectIdsInWeek = new Set(
      progress
        .filter(pr => pr.progress_date >= periodStart && pr.progress_date <= periodEnd)
        .map(pr => pr.project_id)
    )

    // 이번주 작업 있는 leaf 프로젝트 (완료/보류 제외, 자식 없는 것만)
    const parentIds = new Set(projects.filter(p => p.parent_id).map(p => p.parent_id))
    const leafProjectsInWeek = projects.filter(p =>
      !parentIds.has(p.id) &&
      projectIdsInWeek.has(p.id) &&
      p.status !== '완료' && p.status !== '보류'
    )

    // 이번주 작업 있는 DR (dr_progress.progress_date 기준)
    const drInWeek = new Set(
      drProgress
        .filter(dp => dp.progress_date >= periodStart && dp.progress_date <= periodEnd)
        .map(dp => dp.dr_id)
    )
    const activeDr = drItems.filter(d =>
      d.status !== '완료' && d.status !== '보류' && drInWeek.has(d.id)
    )

    const sortedMembers = sortMembers(members)
    const projectList: LoadEntry[] = []
    const projectEmpty: TeamMember[] = []
    const drList: LoadEntry[] = []
    const drEmpty: TeamMember[] = []

    for (const m of sortedMembers) {
      const projItems = leafProjectsInWeek
        .filter(p => isAssigned(p, m))
        .map(p => ({ id: p.id, name: p.name, parentName: parentPathOf(p) }))
      if (projItems.length > 0) {
        projectList.push({ member: m, count: projItems.length, items: projItems })
      } else {
        projectEmpty.push(m)
      }

      const drForMember = activeDr
        .filter(d => normalizeAssignees(d.assignees).some(x => x === m.id || x === m.name))
        .map(d => ({ id: d.id, name: d.name }))
      if (drForMember.length > 0) {
        drList.push({ member: m, count: drForMember.length, items: drForMember })
      } else {
        drEmpty.push(m)
      }
    }

    projectList.sort((a, b) => b.count - a.count)
    drList.sort((a, b) => b.count - a.count)

    return { projectList, projectEmpty, drList, drEmpty }
  }, [projects, members, progress, drItems, drProgress, weekRange])

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

  /* ── 금일 작업 없는 활성 멤버 (활성 ↔ 오늘 progress 매칭) ── */
  const noWorkTodayMembers = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd')

    // 오늘 진행기록이 있는 leaf 프로젝트
    const projectIdsToday = new Set(
      progress
        .filter(pr => pr.progress_date === todayKey)
        .map(pr => pr.project_id)
    )
    const parentIds = new Set(projects.filter(p => p.parent_id).map(p => p.parent_id))
    const todayLeaves = projects.filter(p =>
      !parentIds.has(p.id) &&
      projectIdsToday.has(p.id) &&
      p.status !== '완료' && p.status !== '보류'
    )

    // 오늘 진행기록이 있는 DR
    const drIdsToday = new Set(
      drProgress
        .filter(dp => dp.progress_date === todayKey)
        .map(dp => dp.dr_id)
    )
    const todayDr = drItems.filter(d =>
      d.status !== '완료' && d.status !== '보류' && drIdsToday.has(d.id)
    )

    const isAssignedSelfOrAncestor = (p: Project, member: TeamMember): boolean => {
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

    return members.filter(m => {
      if (!m.is_active) return false
      if (!['PM', 'BE', 'FE'].includes(m.department ?? '')) return false
      const hasProj = todayLeaves.some(p => isAssignedSelfOrAncestor(p, m))
      if (hasProj) return false
      const hasDr = todayDr.some(d =>
        normalizeAssignees(d.assignees).some(x => x === m.id || x === m.name)
      )
      return !hasDr
    })
  }, [projects, members, progress, drItems, drProgress, projectMap])

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 운영 모니터링</h1>
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
        noWorkMembers={noWorkTodayMembers}
        loading={loading}
        parentPath={parentPath}
      />

      {/* 이번주 멤버별 워크로드 — 좌(프로젝트) / 우(DR) */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">이번주 멤버별 워크로드</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {format(weekRange.start, 'M/d(EEE)', { locale: ko })} ~ {format(weekRange.end, 'M/d(EEE)', { locale: ko })}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" />
            불러오는 중...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
            <WorkloadColumn
              title="프로젝트"
              icon="📂"
              kind="project"
              list={workload.projectList}
              empty={workload.projectEmpty}
              thresholds={PROJ_TH}
            />
            <WorkloadColumn
              title="DR"
              icon="🔧"
              kind="dr"
              list={workload.drList}
              empty={workload.drEmpty}
              thresholds={DR_TH}
            />
          </div>
        )}
      </section>
    </div>
  )
}

/* ── 요약 칩 ──────────────────────────────────── */
function SummaryChip({ bg, fg, label, value }: { bg: string; fg: string; label: string; value: number }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs"
      style={{ background: bg, color: fg }}
    >
      <span className="font-bold">{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  )
}

/* ── 워크로드 칼럼 (프로젝트 또는 DR 전용) ───── */
function WorkloadColumn({
  title, icon, kind, list, empty, thresholds,
}: {
  title: string
  icon: string
  kind: 'project' | 'dr'
  list: LoadEntry[]
  empty: TeamMember[]
  thresholds: { g: number; y: number; r: number }
}) {
  // 임계치별 인원 수
  const counts = { overload: 0, red: 0, yellow: 0, green: 0 }
  for (const r of list) {
    const band = classifyLoad(r.count, thresholds)
    counts[band]++
  }

  // 막대 길이 기준: 임계치 r+1 또는 최대 부하 중 큰 값
  const maxLoad = Math.max(thresholds.r + 1, list[0]?.count ?? 0)

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <span className="text-xs text-gray-400">· {list.length}명 작업 중</span>
      </div>

      {/* 임계치별 요약 */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <SummaryChip bg="#7f1d1d" fg="#ffffff" label={`부하 ${thresholds.r + 1}+`}                        value={counts.overload} />
        <SummaryChip bg="#fecaca" fg="#991b1b" label={`주의 ${thresholds.y + 1}~${thresholds.r}`}          value={counts.red}      />
        <SummaryChip bg="#fef08a" fg="#854d0e" label={`노란 ${thresholds.g + 1}~${thresholds.y}`}          value={counts.yellow}   />
        <SummaryChip bg="#bbf7d0" fg="#166534" label={`정상 1${thresholds.g > 1 ? `~${thresholds.g}` : ''}`} value={counts.green}    />
        <SummaryChip bg="#f3f4f6" fg="#6b7280" label="없음"                                                value={empty.length}    />
      </div>

      {/* 멤버 행 */}
      <div className="space-y-1 flex-1">
        {list.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-6 bg-gray-50/60 rounded-lg border border-dashed border-gray-200">
            이번주 {kind === 'dr' ? 'DR' : '프로젝트'} 배정 없음
          </div>
        ) : (
          list.map(row => (
            <WorkloadRowSingle
              key={row.member.id}
              row={row}
              maxLoad={maxLoad}
              thresholds={thresholds}
              kind={kind}
            />
          ))
        )}
      </div>

      {empty.length > 0 && <EmptyMembersBlock empties={empty} />}
    </div>
  )
}

/* ── 단일 막대 행 ──────────────────────────── */
function WorkloadRowSingle({
  row, maxLoad, thresholds, kind,
}: {
  row: LoadEntry
  maxLoad: number
  thresholds: { g: number; y: number; r: number }
  kind: 'project' | 'dr'
}) {
  const [open, setOpen] = useState(false)
  const band  = classifyLoad(row.count, thresholds)
  const color = BAND_COLOR[band]
  const w     = Math.min(100, (row.count / maxLoad) * 100)

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden hover:border-gray-200 transition-colors">
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-gray-400 flex-shrink-0">
          {open ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
        </span>

        <div className="flex items-center gap-1.5 w-32 flex-shrink-0 min-w-0">
          <DeptBadge dept={row.member.department} />
          <span className="text-sm font-medium text-gray-800 truncate">{row.member.name}</span>
        </div>

        <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
          <div style={{ width: `${w}%`, background: color, height: '100%' }} title={`${row.count}건`} />
        </div>

        <span className="text-sm font-bold text-gray-900 tabular-nums w-7 text-right flex-shrink-0">
          {row.count}
        </span>
      </div>

      {open && row.items.length > 0 && (
        <div className="px-3 pb-2.5 pt-2 bg-gray-50/60 border-t border-gray-100">
          <div className="flex flex-wrap gap-1.5">
            {row.items.map(item => (
              <Link
                key={item.id}
                href={kind === 'dr' ? `/calendar?task=${item.id}&tab=dr` : `/calendar?task=${item.id}`}
                className={
                  kind === 'dr'
                    ? 'text-xs bg-red-50 border border-red-200 text-red-700 rounded px-2 py-1 hover:bg-red-100 transition-colors flex items-center gap-1'
                    : 'text-xs bg-white border border-gray-200 rounded px-2 py-1 hover:border-blue-300 hover:bg-blue-50 transition-colors text-gray-700'
                }
                title={item.parentName ? `${item.parentName} > ${item.name}` : item.name}
              >
                {kind === 'dr' && <span className="text-[10px] font-bold">DR</span>}
                {item.parentName && <span className="text-gray-400">{item.parentName} &gt; </span>}
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 작업 없는 멤버 블록 ────────────────────── */
function EmptyMembersBlock({ empties }: { empties: TeamMember[] }) {
  const [open, setOpen] = useState(false)
  if (empties.length === 0) return null
  return (
    <div className="border-t border-dashed border-gray-200 pt-3 mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer flex items-center gap-1"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRightIcon size={12} />}
        작업 없음 ({empties.length}명)
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-2">
          {empties.map(member => (
            <span
              key={member.id}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-1"
            >
              <DeptBadge dept={member.department} />
              {member.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── 지연 감지 패널 ─────────────────────────── */
function DelayPanel({
  delayed, noWorkMembers, loading, parentPath,
}: {
  delayed: DelayedProject[]
  noWorkMembers: TeamMember[]
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
                delayed.length + noWorkMembers.length > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {delayed.length + noWorkMembers.length}건
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            LTS 초과 / 시작일 초과 미착수 / 7일+ 무변동 / 금일 작업 없음
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : delayed.length === 0 && noWorkMembers.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-8">
          ✅ 모두 정상입니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
                            href={`/calendar?task=${d.project.id}`}
                            className="block bg-white rounded px-2 py-1.5 hover:bg-blue-50/50 border border-transparent hover:border-blue-200 transition-colors cursor-pointer"
                            title="캘린더에서 보기"
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

          {/* 4번째 카드 — 금일 작업 없음 (멤버 단위) */}
          <div
            className="rounded-lg border p-3"
            style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded"
                  style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
                >
                  <UserMinus size={13} />
                </span>
                <span className="text-sm font-semibold text-gray-700">
                  금일 작업 없음
                </span>
              </div>
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
              >
                {noWorkMembers.length}
              </span>
            </div>
            {noWorkMembers.length === 0 ? (
              <div className="text-xs text-gray-400 py-2">없음</div>
            ) : (
              <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                {noWorkMembers.map(m => (
                  <li key={m.id} className="text-xs">
                    <div className="flex items-center gap-1.5 bg-white rounded px-2 py-1.5 border border-transparent">
                      <DeptBadge dept={m.department} />
                      <span className="text-gray-800 font-medium">{m.name}</span>
                      {m.is_leader && (
                        <span className="ml-auto text-[10px] text-amber-700 bg-amber-100 border border-amber-200 px-1 py-0.5 rounded">
                          리더
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

