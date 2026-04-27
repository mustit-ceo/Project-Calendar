'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Project, TeamMember, DrItem, DrProgress } from '@/lib/types'
import { format, addDays, getDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { RefreshCw, AlertTriangle, Clock, CalendarX, Pause, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { DeptBadge } from '@/components/ui/DeptBadge'
import {
  getDelayedProjects, DELAY_REASON_LABEL, DelayedProject, DelayReason,
} from '@/lib/utils'
import Link from 'next/link'

/* ── 임계치 (1~3 녹색 / 4~5 노랑 / 6~7 빨강 / 8+ 짙은빨강) ─────────── */
const TH_GREEN = 3
const TH_YELLOW = 5
const TH_RED = 7

const DEPT_ORDER: Record<string, number> = { PM: 0, BE: 1, FE: 2, Design: 3, Oth: 4 }

interface MemberWorkload {
  member: TeamMember
  projects: { id: string; name: string; parentName: string | null }[]
  drs: { id: string; name: string }[]
  total: number
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

/** 주 범위 [ws, we]와 프로젝트 기간이 겹치는가? */
function overlapsWeek(p: Project, weekStart: Date, weekEnd: Date): boolean {
  const s = parseYMD(p.start_date)
  const e = parseYMD(p.lts_date) ?? parseYMD(p.end_date)
  if (!s && !e) return false
  const start = s ?? e!
  const end = e ?? s!
  return start <= weekEnd && end >= weekStart
}

/** 임계치별 막대 색상 (프로젝트 짙은색, DR 옅은색) */
function getBarColors(count: number): { p: string; dr: string } {
  if (count <= TH_GREEN)  return { p: '#16a34a', dr: '#bbf7d0' }
  if (count <= TH_YELLOW) return { p: '#ca8a04', dr: '#fef08a' }
  if (count <= TH_RED)    return { p: '#dc2626', dr: '#fecaca' }
  return { p: '#7f1d1d', dr: '#fca5a5' }
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
  const [drItems,   setDrItems]   = useState<DrItem[]>([])
  const [drProgress, setDrProgress] = useState<DrProgress[]>([])
  const [loading,   setLoading]   = useState(true)
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
      { data: drData },
      { data: drProgData },
    ] = await Promise.all([
      supabase.from('projects').select('*').eq('is_archived', false),
      supabase.from('team_members').select('*').eq('is_active', true),
      supabase.from('dr_items').select('*').eq('is_archived', false),
      supabase.from('dr_progress').select('*'),
    ])
    setProjects((projData ?? []) as Project[])
    setMembers((memData ?? []) as TeamMember[])
    setDrItems((drData ?? []) as DrItem[])
    setDrProgress((drProgData ?? []) as DrProgress[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

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

    // 진행 가능한 leaf 프로젝트 (완료/보류 제외, 자식 없는 것만)
    const activeProjects = projects.filter(p => p.status !== '완료' && p.status !== '보류')
    const parentIds = new Set(projects.filter(p => p.parent_id).map(p => p.parent_id))
    const leafProjects = activeProjects.filter(p => !parentIds.has(p.id))

    // 이번주 작업 있는 DR (dr_progress.progress_date 기준)
    const periodStart = format(weekRange.start, 'yyyy-MM-dd')
    const periodEnd   = format(weekRange.end,   'yyyy-MM-dd')
    const drInWeek = new Set(
      drProgress
        .filter(dp => dp.progress_date >= periodStart && dp.progress_date <= periodEnd)
        .map(dp => dp.dr_id)
    )
    const activeDr = drItems.filter(d =>
      d.status !== '완료' && d.status !== '보류' && drInWeek.has(d.id)
    )

    const sortedMembers = sortMembers(members)
    const list: MemberWorkload[] = sortedMembers.map(m => {
      const projItems = leafProjects
        .filter(p => isAssigned(p, m) && overlapsWeek(p, weekRange.start, weekRange.end))
        .map(p => ({ id: p.id, name: p.name, parentName: parentPathOf(p) }))

      const drForMember = activeDr
        .filter(d => normalizeAssignees(d.assignees).some(x => x === m.id || x === m.name))
        .map(d => ({ id: d.id, name: d.name }))

      return {
        member: m,
        projects: projItems,
        drs: drForMember,
        total: projItems.length + drForMember.length,
      }
    })

    const withLoad = list.filter(r => r.total > 0).sort((a, b) => b.total - a.total)
    const empty    = list.filter(r => r.total === 0)

    // 임계치별 카운트
    const counts = { overload: 0, red: 0, yellow: 0, green: 0, empty: empty.length }
    for (const r of withLoad) {
      if (r.total > TH_RED)         counts.overload++
      else if (r.total > TH_YELLOW) counts.red++
      else if (r.total > TH_GREEN)  counts.yellow++
      else                          counts.green++
    }

    return { withLoad, empty, counts }
  }, [projects, members, drItems, drProgress, weekRange])

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

      {/* 이번주 멤버별 워크로드 — 부하 랭킹 */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">이번주 멤버별 워크로드</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {format(weekRange.start, 'M/d(EEE)', { locale: ko })} ~ {format(weekRange.end, 'M/d(EEE)', { locale: ko })}
              <span className="text-gray-300"> · </span>
              누가 일이 몰려있나
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#1f2937' }} />
              프로젝트
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#cbd5e1' }} />
              DR
            </span>
          </div>
        </div>

        {/* 임계치별 요약 */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <SummaryChip bg="#7f1d1d" fg="#ffffff" label={`과부하 ${TH_RED + 1}+`}            value={workload.counts.overload} />
          <SummaryChip bg="#fecaca" fg="#991b1b" label={`주의 ${TH_YELLOW + 1}~${TH_RED}`}    value={workload.counts.red}      />
          <SummaryChip bg="#fef08a" fg="#854d0e" label={`노란 ${TH_GREEN + 1}~${TH_YELLOW}`}  value={workload.counts.yellow}   />
          <SummaryChip bg="#bbf7d0" fg="#166534" label={`정상 1~${TH_GREEN}`}                value={workload.counts.green}    />
          <SummaryChip bg="#f3f4f6" fg="#6b7280" label="비어있음"                            value={workload.counts.empty}    />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" />
            불러오는 중...
          </div>
        ) : workload.withLoad.length === 0 && workload.empty.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">활성 멤버가 없습니다.</div>
        ) : (
          <div className="space-y-1">
            {workload.withLoad.length === 0 && (
              <div className="text-sm text-gray-400 text-center py-6">
                이번주 배정된 작업이 없습니다.
              </div>
            )}
            {workload.withLoad.map(row => (
              <WorkloadRow
                key={row.member.id}
                row={row}
                maxLoad={Math.max(8, workload.withLoad[0]?.total ?? 0)}
              />
            ))}
            {workload.empty.length > 0 && (
              <EmptyMembersBlock empties={workload.empty} />
            )}
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

/* ── 워크로드 행 (멤버별 stacked bar + 펼침) ─── */
function WorkloadRow({ row, maxLoad }: { row: MemberWorkload; maxLoad: number }) {
  const [open, setOpen] = useState(false)
  const colors = getBarColors(row.total)
  const projWidth = (row.projects.length / maxLoad) * 100
  const drWidth   = (row.drs.length     / maxLoad) * 100

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden hover:border-gray-200 transition-colors">
      <div
        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        {/* 펼침 인디케이터 */}
        <span className="text-gray-400 flex-shrink-0">
          {open ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
        </span>

        {/* 부서 + 이름 */}
        <div className="flex items-center gap-2 w-44 flex-shrink-0">
          <DeptBadge dept={row.member.department} />
          <span className="text-sm font-medium text-gray-800 truncate">{row.member.name}</span>
          {row.member.is_leader && (
            <span className="text-[10px] text-amber-700 bg-amber-100 border border-amber-200 px-1 py-0.5 rounded flex-shrink-0">
              리더
            </span>
          )}
        </div>

        {/* stacked bar */}
        <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden flex">
          {row.projects.length > 0 && (
            <div style={{ width: `${projWidth}%`, background: colors.p }} title={`프로젝트 ${row.projects.length}건`} />
          )}
          {row.drs.length > 0 && (
            <div style={{ width: `${drWidth}%`, background: colors.dr }} title={`DR ${row.drs.length}건`} />
          )}
        </div>

        {/* 숫자 */}
        <div className="text-xs flex items-center gap-1 w-36 justify-end flex-shrink-0">
          <span className="font-semibold" style={{ color: colors.p }}>P {row.projects.length}</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-600">DR {row.drs.length}</span>
          <span className="text-gray-300">·</span>
          <span className="font-bold text-gray-900 tabular-nums">{row.total}</span>
        </div>
      </div>

      {/* 펼침 영역 — 항목 칩 */}
      {open && (row.projects.length > 0 || row.drs.length > 0) && (
        <div className="px-3 pb-3 pt-2 bg-gray-50/60 border-t border-gray-100">
          <div className="flex flex-wrap gap-1.5">
            {row.projects.map(p => (
              <Link
                key={p.id}
                href={`/calendar?task=${p.id}`}
                className="text-xs bg-white border border-gray-200 rounded px-2 py-1 hover:border-blue-300 hover:bg-blue-50 transition-colors text-gray-700"
                title={p.parentName ? `${p.parentName} > ${p.name}` : p.name}
              >
                {p.parentName && <span className="text-gray-400">{p.parentName} &gt; </span>}
                {p.name}
              </Link>
            ))}
            {row.drs.map(d => (
              <Link
                key={d.id}
                href={`/calendar?task=${d.id}&tab=dr`}
                className="text-xs bg-red-50 border border-red-200 text-red-700 rounded px-2 py-1 hover:bg-red-100 transition-colors flex items-center gap-1"
              >
                <span className="text-[10px] font-bold">DR</span>
                {d.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 작업 없는 멤버 블록 ────────────────────── */
function EmptyMembersBlock({ empties }: { empties: MemberWorkload[] }) {
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
          {empties.map(({ member }) => (
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

