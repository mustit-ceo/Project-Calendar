'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Project, TaskProgress, Status } from '@/lib/types'
import { PROJECT_CATEGORIES } from '@/lib/utils'
import { RefreshCw, ZoomIn, ZoomOut } from 'lucide-react'
import { DragHint } from '@/components/ui/DragHint'

const STATUS_COLOR: Record<Status, { line: string; bg: string; text: string; dot: string }> = {
  '완료': { line: '#1a1a1a', bg: '#f0f0f0', text: '#1a1a1a', dot: '#1a1a1a' },
  '진행': { line: '#16a34a', bg: '#dcfce7', text: '#14532d', dot: '#16a34a' },
  '예정': { line: '#ca8a04', bg: '#fef9c3', text: '#713f12', dot: '#ca8a04' },
  '대기': { line: '#dc2626', bg: '#fee2e2', text: '#7f1d1d', dot: '#dc2626' },
  '보류': { line: '#9ca3af', bg: '#f3f4f6', text: '#4b5563', dot: '#9ca3af' },
}

// ─── 날짜 helpers ──────────────────────────────────────────────────────────────
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
function monthLabel(d: Date): string { return `${d.getMonth() + 1}월` }


function dateRange(ids: string[], progressMap: Map<string, string[]>): { start: Date | null; end: Date | null } {
  const dates: string[] = []
  ids.forEach(id => dates.push(...(progressMap.get(id) ?? [])))
  if (!dates.length) return { start: null, end: null }
  const sorted = [...new Set(dates)].sort()
  return { start: parseDate(sorted[0]), end: parseDate(sorted[sorted.length - 1]) }
}

interface ProjectRow {
  project:   Project
  startDate: Date | null
  endDate:   Date | null
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function TimelinePage() {
  const supabase = createClient()
  const router   = useRouter()

  const [projects,      setProjects]      = useState<Project[]>([])
  const [progress,      setProgress]      = useState<TaskProgress[]>([])
  const [loading,       setLoading]       = useState(true)
  const [filterStatus,  setFilterStatus]  = useState('all')
  const [filterCat,     setFilterCat]     = useState('all')
  const [showCompleted, setShowCompleted] = useState(true)

  // 뷰 상태: 기본값 — 당해연도 1월부터 12개월
  const [visibleMonths, setVisibleMonths] = useState(12)
  const [viewStartDate, setViewStartDate] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), 0, 1)
  })

  // ── 드래그 패닝 ──
  const timelineRef = useRef<HTMLDivElement>(null)
  const dragState   = useRef<{ startX: number; originDate: Date } | null>(null)
  const isDragging  = useRef(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: pData }, { data: tData }] = await Promise.all([
      supabase.from('projects').select('*').eq('is_archived', false).order('sort_order'),
      supabase.from('task_progress').select('*'),
    ])
    setProjects(pData ?? [])
    setProgress(tData ?? [])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])

  const progressMap = useMemo(() => {
    const map = new Map<string, string[]>()
    progress.forEach(r => {
      if (!map.has(r.project_id)) map.set(r.project_id, [])
      map.get(r.project_id)!.push(r.progress_date)
    })
    return map
  }, [progress])

  const projectItems = useMemo(() =>
    projects.filter(p => !['DR', '유지보수'].includes(p.category))
  , [projects])

  const rows = useMemo<ProjectRow[]>(() => {
    // BFS: 루트 프로젝트 + 전체 하위 날짜 범위
    const childrenOf = new Map<string, string[]>()
    for (const p of projectItems) {
      if (p.parent_id) {
        if (!childrenOf.has(p.parent_id)) childrenOf.set(p.parent_id, [])
        childrenOf.get(p.parent_id)!.push(p.id)
      }
    }
    function descendantIds(id: string): string[] {
      const result: string[] = [id]
      const queue = [id]
      while (queue.length) {
        const cur = queue.shift()!
        for (const cid of childrenOf.get(cur) ?? []) {
          result.push(cid); queue.push(cid)
        }
      }
      return result
    }

    return projectItems
      .filter(p => !p.parent_id)
      .map(root => {
        const { start, end } = dateRange(descendantIds(root.id), progressMap)
        return { project: root, startDate: start, endDate: end }
      })
      .filter(r => {
        if (!showCompleted && r.project.status === '완료') return false
        if (filterStatus !== 'all' && r.project.status !== filterStatus) return false
        if (filterCat !== 'all' && r.project.category !== filterCat) return false
        return true
      })
      .sort((a, b) => {
        const as = a.project.start_date
        const bs = b.project.start_date
        if (!as && !bs) return 0
        if (!as) return 1
        if (!bs) return -1
        return as.localeCompare(bs)
      })
  }, [projectItems, progressMap, showCompleted, filterStatus, filterCat])

  // 뷰 창 끝 날짜 (visibleMonths 개월의 마지막 날)
  const viewEndDate = useMemo(() =>
    new Date(viewStartDate.getFullYear(), viewStartDate.getMonth() + visibleMonths, 0)
  , [viewStartDate, visibleMonths])

  const viewTotalDays = useMemo(() =>
    diffDays(viewStartDate, viewEndDate) + 1
  , [viewStartDate, viewEndDate])

  // 월 헤더 (뷰 창 내 월만)
  const monthHeaders = useMemo(() => {
    const headers: { label: string; year: number }[] = []
    let cur = new Date(viewStartDate.getFullYear(), viewStartDate.getMonth(), 1)
    while (cur <= viewEndDate) {
      headers.push({ label: monthLabel(cur), year: cur.getFullYear() })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
    return headers
  }, [viewStartDate, viewEndDate])

  const numMonths = monthHeaders.length

  // 연도 그룹 헤더
  const yearGroups = useMemo(() => {
    const groups: { year: number; count: number }[] = []
    monthHeaders.forEach(h => {
      const last = groups[groups.length - 1]
      if (last && last.year === h.year) last.count++
      else groups.push({ year: h.year, count: 1 })
    })
    return groups
  }, [monthHeaders])

  // 바 위치 (뷰 창 기준 %, 양끝 클램핑)
  function barLeft(s: Date): string {
    const clamped = s < viewStartDate ? viewStartDate : s
    return `${Math.max(0, diffDays(viewStartDate, clamped) / viewTotalDays * 100).toFixed(4)}%`
  }
  function barWidth(s: Date, e: Date): string {
    const cs = s < viewStartDate ? viewStartDate : s
    const ce = e > viewEndDate ? viewEndDate : e
    if (diffDays(cs, ce) < 0) return '0.1%'
    return `${Math.max(0.1, (diffDays(cs, ce) + 1) / viewTotalDays * 100).toFixed(4)}%`
  }
  function barRight(s: Date, e: Date): string {
    const cs = s < viewStartDate ? viewStartDate : s
    const ce = e > viewEndDate ? viewEndDate : e
    if (diffDays(cs, ce) < 0) return barLeft(s)
    const l = Math.max(0, diffDays(viewStartDate, cs) / viewTotalDays * 100)
    const w = Math.max(0.1, (diffDays(cs, ce) + 1) / viewTotalDays * 100)
    return `${(l + w).toFixed(4)}%`
  }
  function isVisible(s: Date | null, e: Date | null): boolean {
    if (!s || !e) return false
    return s <= viewEndDate && e >= viewStartDate
  }

  // 오늘 마커
  const todayLeft = useMemo(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0)
    if (t < viewStartDate || t > viewEndDate) return null
    return `${(diffDays(viewStartDate, t) / viewTotalDays * 100).toFixed(4)}%`
  }, [viewStartDate, viewEndDate, viewTotalDays])

  // 통계 — 현재 뷰 창과 날짜가 겹치는 프로젝트만 카운트
  const stats = useMemo(() => {
    const visible = rows.filter(r =>
      r.startDate && r.endDate &&
      r.startDate <= viewEndDate && r.endDate >= viewStartDate
    )
    const byStatus = (s: Status) => visible.filter(r => r.project.status === s).length
    return {
      total: visible.length,
      진행: byStatus('진행'),
      완료: byStatus('완료'),
      예정: byStatus('예정'),
      대기: byStatus('대기'),
      보류: byStatus('보류'),
    }
  }, [rows, viewStartDate, viewEndDate])

  // 줌 변경 시 뷰 시작 월 재계산
  // 모든 줌 레벨에서 좌측은 당해연도 1월 고정
  function calcViewStart(_months: number): Date {
    const now = new Date()
    return new Date(now.getFullYear(), 0, 1)
  }

  function zoomIn() {
    setVisibleMonths(prev => {
      const next = Math.max(1, prev - 1)
      setViewStartDate(calcViewStart(next))
      return next
    })
  }
  function zoomOut() {
    setVisibleMonths(prev => {
      const next = Math.min(12, prev + 1)
      setViewStartDate(calcViewStart(next))
      return next
    })
  }

  // ── 드래그 패닝 핸들러 ──
  // startX와 originDate는 드래그 시작 시 고정 → 전체 누적 delta로 계산
  function handleDragStart(e: React.MouseEvent) {
    dragState.current = { startX: e.clientX, originDate: new Date(viewStartDate.getTime()) }
    isDragging.current = false
    e.preventDefault()
  }
  function handleDragMove(e: React.MouseEvent) {
    if (!dragState.current || !timelineRef.current) return
    const dx = e.clientX - dragState.current.startX
    if (Math.abs(dx) > 4) isDragging.current = true
    if (!isDragging.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    // 오른쪽 드래그(dx>0) → 과거, 왼쪽 드래그(dx<0) → 미래
    const daysDelta = Math.round((dx / rect.width) * viewTotalDays)
    const newStart  = new Date(dragState.current.originDate.getTime())
    newStart.setDate(newStart.getDate() - daysDelta)
    newStart.setDate(1) // 월 1일로 스냅
    setViewStartDate(newStart)
  }
  function handleDragEnd() {
    dragState.current = null
    setTimeout(() => { isDragging.current = false }, 50)
  }

  // 프로젝트 클릭 → 캘린더로 이동 (완료 프로젝트 제외 OFF)
  function handleProjectClick(projectId: string) {
    if (isDragging.current) return
    router.push(`/calendar?task=${projectId}&hideCompleted=0`)
  }

  // 월 컬럼 너비
  const colPct = `${(100 / numMonths).toFixed(4)}%`

  // ── 날짜 눈금 ──
  // gridTicks : 1~6개월 → 매일 세로선 / 7개월+ → 없음
  // headerTicks: 헤더 날짜 라벨 (≤3개월: 8·15·22일 / 4~6개월: 15일)
  const gridTicks = useMemo(() => {
    if (visibleMonths > 6) return []
    const ticks: { pct: number }[] = []
    let cur = new Date(viewStartDate.getTime() + 86400000) // 2일째부터 (1일은 월 경계선)
    while (cur <= viewEndDate) {
      ticks.push({ pct: diffDays(viewStartDate, cur) / viewTotalDays * 100 })
      cur = new Date(cur.getTime() + 86400000)
    }
    return ticks
  }, [viewStartDate, viewEndDate, viewTotalDays, visibleMonths])

  const headerTicks = useMemo(() => {
    if (visibleMonths > 6) return []
    const dayMarks = visibleMonths <= 3 ? [8, 15, 22] : [15]
    const ticks: { pct: number; day: number }[] = []
    let ms = new Date(viewStartDate.getFullYear(), viewStartDate.getMonth(), 1)
    while (ms <= viewEndDate) {
      for (const dayNum of dayMarks) {
        const d = new Date(ms.getFullYear(), ms.getMonth(), dayNum)
        if (d >= viewStartDate && d <= viewEndDate)
          ticks.push({ pct: diffDays(viewStartDate, d) / viewTotalDays * 100, day: dayNum })
      }
      ms = new Date(ms.getFullYear(), ms.getMonth() + 1, 1)
    }
    return ticks
  }, [viewStartDate, viewEndDate, viewTotalDays, visibleMonths])

  // ── 프로젝트 기간 툴팁 ──
  function fmtDateShort(s: string): string {
    const [, m, d] = s.split('-')
    return `${parseInt(m)}/${parseInt(d)}`
  }
  function getProjectTooltip(p: Project): string | null {
    if (!p.start_date) return null
    const end = p.lts_date ?? p.end_date
    if (!end) return null
    return `${fmtDateShort(p.start_date)} ~ ${fmtDateShort(end)}${p.lts_date ? ' (LTS)' : ''}`
  }

  // ── 현재 뷰 기간 표시 라벨 ──
  const viewLabel = useMemo(() => {
    const sy = viewStartDate.getFullYear(), sm = viewStartDate.getMonth() + 1
    const ey = viewEndDate.getFullYear(),   em = viewEndDate.getMonth() + 1
    if (sy === ey) return `${sy}년 ${sm}월 – ${em}월`
    return `${sy}년 ${sm}월 – ${ey}년 ${em}월`
  }, [viewStartDate, viewEndDate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        <RefreshCw size={24} className="animate-spin mr-2" />불러오는 중...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white">

      {/* ── 헤더 ── */}
      <div className="px-5 pt-5 pb-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-xl font-bold text-gray-900">🗺️ 타임라인</h1>
          <div className="flex-1" />

          {/* 전체 카운트 */}
          <span className="text-xs text-gray-400">전체 <b className="font-semibold text-gray-700">{stats.total}</b></span>
          <div className="w-px h-4 bg-gray-200" />

          {/* 상태별 컬러 인디케이터 + 이름 + 카운트 통합 */}
          {(['진행', '완료', '예정', '대기', '보류'] as Status[]).map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="rounded-full flex-shrink-0" style={{ width: 16, height: 4, background: STATUS_COLOR[s].line }} />
              <span className="text-xs" style={{ color: STATUS_COLOR[s].line }}>
                {s} <b className="font-semibold">{stats[s]}</b>
              </span>
            </div>
          ))}

          <div className="w-px h-4 bg-gray-200" />
          <button onClick={fetchData} className="p-1.5 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg cursor-pointer">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full">
          {/* 필터 */}
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none cursor-pointer">
            <option value="all">전체 카테고리</option>
            {PROJECT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none cursor-pointer">
            <option value="all">전체 상태</option>
            {(['진행','완료','예정','대기','보류'] as Status[]).map(s =>
              <option key={s} value={s}>{s}</option>
            )}
          </select>
          <div className="w-px h-4 bg-gray-200" />
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <div
              onClick={() => setShowCompleted(v => !v)}
              className={`w-7 h-3.5 rounded-full transition-colors relative flex-shrink-0 ${showCompleted ? 'bg-gray-300' : 'bg-blue-500'}`}>
              <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-transform ${showCompleted ? 'translate-x-0.5' : 'translate-x-3.5'}`} />
            </div>
            <span className="text-xs text-gray-600">완료 제외</span>
          </label>
          <div className="w-px h-4 bg-gray-200" />

          {/* 줌 컨트롤 */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={zoomIn}
              disabled={visibleMonths <= 1}
              title="확대"
              className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors border-r border-gray-200"
            >
              <ZoomIn size={13} />
            </button>
            <span className="text-xs text-gray-600 px-3 font-medium tabular-nums">{visibleMonths}개월</span>
            <button
              onClick={zoomOut}
              disabled={visibleMonths >= 12}
              title="축소"
              className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors border-l border-gray-200"
            >
              <ZoomOut size={13} />
            </button>
          </div>

          {/* 우측 고정: 기간 라벨 + 오늘 */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-400">{viewLabel}</span>
            <button
              onClick={() => {
                const now = new Date()
                setViewStartDate(new Date(now.getFullYear(), now.getMonth() - Math.floor(visibleMonths / 2), 1))
              }}
              className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded-lg px-2.5 py-1 cursor-pointer transition-colors"
            >
              오늘
            </button>
          </div>
        </div>
      </div>

      {/* ── 타임라인 ── */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-y-auto overflow-x-hidden select-none timeline-drag-area relative"
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <DragHint style={{ top: '50%', transform: 'translate(-50%, -50%)' }} />
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            표시할 프로젝트가 없습니다
          </div>
        ) : (
          <div style={{ width: '100%' }}>

            {/* 헤더: 연도 행 + 월 행 (sticky) */}
            <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
              {/* 연도 행 */}
              <div className="flex border-b border-gray-100">
                {yearGroups.map((g, i) => (
                  <div key={i}
                    className="flex-shrink-0 text-xs font-semibold text-gray-500 px-3 py-1 border-r border-gray-200 overflow-hidden flex items-center"
                    style={{ width: `${g.count / numMonths * 100}%` }}>
                    {g.year}년
                  </div>
                ))}
              </div>
              {/* 월 행 */}
              <div className="flex">
                {monthHeaders.map((h, i) => (
                  <div key={i}
                    className="flex-shrink-0 text-center text-gray-400 border-r border-gray-100 font-medium overflow-hidden flex items-center justify-center"
                    style={{ width: colPct, height: 24, fontSize: visibleMonths <= 3 ? 11 : 10 }}>
                    {h.label}
                  </div>
                ))}
              </div>

              {/* 날짜 눈금 라벨 행 */}
              {headerTicks.length > 0 && (
                <div className="relative border-t border-gray-100" style={{ height: 14 }}>
                  {headerTicks.map((tick, i) => (
                    <span
                      key={i}
                      className="absolute text-[9px] text-gray-300 leading-none pointer-events-none select-none"
                      style={{ left: `${tick.pct}%`, transform: 'translateX(-50%)', top: 2 }}
                    >
                      {tick.day}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 프로젝트 행 */}
            <div className="relative">

              {/* ── 그리드 선: 컨테이너에서 한 번만 렌더 (각 행에서 제거) ── */}
              <div className="absolute inset-0 pointer-events-none z-0">
                {monthHeaders.map((_, i) => i > 0 && (
                  <div key={`mg-${i}`} className="absolute top-0 bottom-0"
                    style={{ left: `${i / numMonths * 100}%`, width: 1, background: '#e5e7eb' }} />
                ))}
                {gridTicks.map((tick, i) => (
                  <div key={`dg-${i}`} className="absolute top-0 bottom-0"
                    style={{ left: `${tick.pct}%`, width: 0.5, background: '#f0f0f0' }} />
                ))}
              </div>

              {/* 오늘 마커 */}
              {todayLeft && (
                <div className="absolute top-0 bottom-0 z-10 pointer-events-none"
                  style={{ left: todayLeft, width: 1.5, background: '#378ADD', opacity: 0.35 }} />
              )}

              {rows.map(row => {
                const sc  = STATUS_COLOR[row.project.status] ?? STATUS_COLOR['대기']
                const vis = isVisible(row.startDate, row.endDate)

                return (
                  <div
                    key={row.project.id}
                    className="relative border-b border-gray-100 hover:bg-blue-50/40 cursor-pointer transition-colors"
                    style={{ height: 56 }}
                    onClick={() => handleProjectClick(row.project.id)}
                  >
                    {vis ? (
                      <>
                        {/* 기간 선 */}
                        <div className="absolute rounded-full" style={{
                          top: '50%', transform: 'translateY(-50%)',
                          left: barLeft(row.startDate!), width: barWidth(row.startDate!, row.endDate!),
                          height: 5, background: sc.line,
                        }} />
                        {/* 시작 점 */}
                        <div className="absolute rounded-full" style={{
                          top: '50%', left: barLeft(row.startDate!),
                          transform: 'translate(-50%,-50%)',
                          width: 11, height: 11, background: sc.dot, border: '2.5px solid white', zIndex: 4,
                        }} />
                        {/* 종료 점 */}
                        <div className="absolute rounded-full" style={{
                          top: '50%', left: barRight(row.startDate!, row.endDate!),
                          transform: 'translate(-50%,-50%)',
                          width: 11, height: 11, background: sc.dot, border: '2.5px solid white', zIndex: 4,
                        }} />
                        {/* 프로젝트명 */}
                        <div
                          className="absolute flex items-center gap-1 text-xs font-semibold pointer-events-none"
                          style={{ top: 6, left: barLeft(row.startDate!), color: sc.line, whiteSpace: 'nowrap', zIndex: 5 }}
                          title={`${row.project.category} · ${row.project.name}`}
                        >
                          {row.project.name}
                        </div>
                        {/* 우측 기간 라벨 (상시 노출) */}
                        <div
                          className="absolute pointer-events-none text-[11px] text-gray-500"
                          style={{
                            top: '50%',
                            left: `calc(${barRight(row.startDate!, row.endDate!)} + 14px)`,
                            transform: 'translateY(-50%)',
                            whiteSpace: 'nowrap',
                            zIndex: 5,
                          }}
                        >
                          {getProjectTooltip(row.project)}
                        </div>
                      </>
                    ) : !row.startDate ? (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-300 italic">
                        {row.project.name} — 기록 없음
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>


          </div>
        )}
      </div>

    </div>
  )
}
