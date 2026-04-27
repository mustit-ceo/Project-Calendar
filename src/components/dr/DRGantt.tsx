'use client'

import { useState, useMemo, useRef, useCallback, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DrItem, DrProgress, Status, Department, TeamMember } from '@/lib/types'
import { STATUSES, DR_DEPARTMENTS, getJiraUrl } from '@/lib/utils'
import {
  addWeeks, addDays, format, differenceInCalendarWeeks,
  isSameDay,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  X, ChevronLeft, ChevronRight, Plus, MoreHorizontal, Check,
  GripVertical, Trash2, Pencil,
} from 'lucide-react'

/* ─ 타임라인 상수 ──────────────────────────────────────────── */
const TIMELINE_START = new Date(2025, 11, 1)   // 2025-12-01
const TOTAL_WEEKS    = 78
const DAY_W          = 28
const BAR_H          = 20
const ROW_PY         = 6
const DEFAULT_PROGRESS_COLOR = '#3B82F6'
const WEEK_BG = `repeating-linear-gradient(90deg,transparent,transparent ${DAY_W * 5 - 1}px,#e5e7eb ${DAY_W * 5 - 1}px,#e5e7eb ${DAY_W * 5}px)`
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/* ─ 부서 색상 ──────────────────────────────────────────────── */
const DEPT_GANTT: Record<string, { bg: string; border: string }> = {
  'PM':     { bg: '#dae9f8', border: '#aed0ef' },
  'BE':     { bg: '#fbe2d5', border: '#f5c4a8' },
  'FE':     { bg: '#daf2d0', border: '#ade59a' },
  'UXD':    { bg: '#f2ceef', border: '#e4a0df' },
  'Design': { bg: '#f2ceef', border: '#e4a0df' },
}
const DEPT_GANTT_DEFAULT = { bg: '#d9d9d9', border: '#b8b8b8' }
function getDeptGanttColor(dept?: string | null) {
  if (!dept) return DEPT_GANTT_DEFAULT
  return DEPT_GANTT[dept] ?? DEPT_GANTT_DEFAULT
}

/* ─ 날짜 유틸 ──────────────────────────────────────────────── */
function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))
}
function toYMD(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}
function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const days: (Date | null)[] = []
  for (let i = 0; i < first.getDay(); i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  return days
}

/* ─ 진척 세그먼트 계산 ─────────────────────────────────────── */
function getProgressSegments(
  drId: string,
  progressMap: Map<string, { indices: number[] }>,
): { s: number; e: number }[] {
  const entry = progressMap.get(drId)
  if (!entry || entry.indices.length === 0) return []
  const sorted = [...entry.indices].sort((a, b) => a - b)
  const segs: { s: number; e: number }[] = []
  let start = sorted[0], end = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) end = sorted[i]
    else { segs.push({ s: start, e: end }); start = sorted[i]; end = sorted[i] }
  }
  segs.push({ s: start, e: end })
  return segs
}

/* ─ 상태 뱃지 ──────────────────────────────────────────────── */
const STATUS_STYLE: Record<Status, string> = {
  '완료': 'bg-green-100 text-green-700',
  '진행': 'bg-blue-100 text-blue-700',
  '대기': 'bg-gray-100 text-gray-500',
  '보류': 'bg-red-100 text-red-600',
  '예정': 'bg-yellow-100 text-yellow-700',
}
function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  )
}

/* ─ 부서 뱃지 ──────────────────────────────────────────────── */
const DEPT_COLORS: Record<string, string> = {
  PM: 'bg-purple-100 text-purple-700',
  BE: 'bg-orange-100 text-orange-700',
  FE: 'bg-cyan-100 text-cyan-700',
  Design: 'bg-rose-100 text-rose-700',
  UXD: 'bg-rose-100 text-rose-700',
  Oth: 'bg-gray-100 text-gray-600',
}
function DeptBadge({ dept }: { dept: string }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${DEPT_COLORS[dept] ?? 'bg-gray-100 text-gray-600'}`}>
      {dept}
    </span>
  )
}

/* ─ 날짜 팝업 ──────────────────────────────────────────────── */
interface DrDatePopupProps {
  drId: string
  initialDates: string[]
  onClose: () => void
  onSaved: (dates: string[]) => void
}

function DrDatePopup({ drId, initialDates, onClose, onSaved }: DrDatePopupProps) {
  const supabase = createClient()
  const today = new Date()
  const [viewYear, setViewYear]     = useState(today.getFullYear())
  const [viewMonth, setViewMonth]   = useState(today.getMonth())
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(initialDates))
  const [saving, setSaving]         = useState(false)

  const calendarDays = buildCalendarDays(viewYear, viewMonth)
  const sortedDates  = Array.from(selectedDates).sort()

  function toggleDate(ymd: string) {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(ymd)) next.delete(ymd); else next.add(ymd)
      return next
    })
  }
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      const dates = Array.from(selectedDates)
      const { error: delErr } = await supabase
        .from('dr_progress').delete().eq('dr_id', drId)
      if (delErr) { console.error('[DrPopup] delete error:', delErr); return }
      if (dates.length > 0) {
        const { error: insErr } = await supabase.from('dr_progress').insert(
          dates.map(d => ({ dr_id: drId, progress_date: d }))
        )
        if (insErr) { console.error('[DrPopup] insert error:', insErr); return }
      }
      onSaved(dates)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-72 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <span className="text-sm font-semibold text-gray-700">작업일자 수정</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500 cursor-pointer">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-gray-800">{viewYear}년 {viewMonth + 1}월</span>
            <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500 cursor-pointer">
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-0.5">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} />
              const ymd = toYMD(day)
              const isSelected = selectedDates.has(ymd)
              const isTd  = ymd === toYMD(today)
              const isSun = day.getDay() === 0
              const isSat = day.getDay() === 6
              return (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => toggleDate(ymd)}
                  className={[
                    'mx-auto flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-all',
                    isSelected ? 'text-white shadow-sm'
                      : isTd   ? 'ring-2 ring-blue-400 text-blue-600'
                      : isSun  ? 'text-red-400 hover:bg-red-50'
                      : isSat  ? 'text-blue-400 hover:bg-blue-50'
                      : 'text-gray-700 hover:bg-gray-100',
                  ].join(' ')}
                  style={isSelected ? { backgroundColor: DEFAULT_PROGRESS_COLOR } : undefined}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
          {sortedDates.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1 border-t border-gray-100 pt-3 max-h-20 overflow-y-auto">
              {sortedDates.map(d => (
                <span
                  key={d}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium text-white"
                  style={{ backgroundColor: DEFAULT_PROGRESS_COLOR }}
                >
                  {parseYMD(d).getMonth() + 1}/{parseYMD(d).getDate()}
                  <button type="button" onClick={() => toggleDate(d)} className="hover:opacity-70"><X size={9} /></button>
                </span>
              ))}
              <button type="button" onClick={() => setSelectedDates(new Set())} className="text-[11px] text-gray-400 hover:text-gray-600 px-1">
                전체삭제
              </button>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 cursor-pointer disabled:opacity-60"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─ 부서/담당자 팝업 ────────────────────────────────────────── */
interface DeptAssigneePopupProps {
  anchor: DOMRect | null
  initialDept: string
  initialIds: string[]
  members: TeamMember[]
  onCommit: (dept: string, ids: string[]) => void
  onCancel: () => void
}
function DeptAssigneePopup({ anchor, initialDept, initialIds, members, onCommit, onCancel }: DeptAssigneePopupProps) {
  const [dept, setDept]   = useState(initialDept || 'BE')
  const [ids, setIds]     = useState<string[]>(initialIds)
  const deptMembers       = members.filter(m => m.department === dept)

  const style = anchor
    ? { position: 'fixed' as const, top: anchor.bottom + 4, left: anchor.left, zIndex: 9999 }
    : { display: 'none' }

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onCancel} />
      <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-44" style={style}>
        <div className="mb-2">
          <label className="text-[11px] font-semibold text-gray-500 mb-1 block">부서</label>
          <div className="flex gap-2">
            {DR_DEPARTMENTS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => { setDept(d); setIds([]) }}
                className={`flex-1 text-xs py-1 rounded border transition-colors ${dept === d ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-200 hover:border-blue-300'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-500 mb-1 block">담당자</label>
          {deptMembers.length === 0
            ? <p className="text-xs text-gray-400 py-1">해당 부서 멤버 없음</p>
            : deptMembers.map((m, i, arr) => {
              const sel = ids.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setIds(prev => sel ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                  className={`w-full flex items-center justify-between px-2 py-1.5 text-sm transition-colors text-left ${i < arr.length - 1 ? 'border-b border-gray-50' : ''} ${sel ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  <span>{m.name}</span>
                  {sel && <Check size={12} className="text-blue-500" />}
                </button>
              )
            })
          }
        </div>
        <button
          type="button"
          onClick={() => onCommit(dept, ids)}
          className="mt-2 w-full py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 cursor-pointer"
        >
          확인
        </button>
      </div>
    </>
  )
}

/* ─ 컬럼 설정 ───────────────────────────────────────────────── */
const DEFAULT_WIDTHS = { name: 350, jira: 96, status: 90, team: 160 }
type ColKey = keyof typeof DEFAULT_WIDTHS
const COL_KEYS: ColKey[] = ['name', 'jira', 'status', 'team']

/* ─ DRGantt Props ───────────────────────────────────────────── */
interface DRGanttProps {
  items: DrItem[]
  progressRecords: DrProgress[]
  teamMembers: TeamMember[]
  onUpdateItem: (id: string, updates: Partial<DrItem>) => void
  onUpdateProgress: (drId: string, dates: string[]) => void
  onAddItem: (item: DrItem) => void
  onDeleteItems: (ids: string[]) => void
  filterBar?: ReactNode
}

/* ─ 메인 컴포넌트 ───────────────────────────────────────────── */
export function DRGantt({
  items, progressRecords, teamMembers,
  onUpdateItem, onUpdateProgress, onAddItem, onDeleteItems,
  filterBar,
}: DRGanttProps) {
  const supabase = createClient()
  const today    = new Date()

  /* ─ 타임라인 ─────────────────────────────────────────────── */
  const yearWeeks = useMemo(() =>
    Array.from({ length: TOTAL_WEEKS }, (_, i) => addWeeks(TIMELINE_START, i)), [])
  const yearDays  = useMemo(() => yearWeeks.flatMap(w => getWeekDays(w)), [yearWeeks])
  const todayIdx  = useMemo(() => yearDays.findIndex(d => isSameDay(d, today)), [yearDays])

  const [widths, setWidths] = useState(DEFAULT_WIDTHS)
  const resizeCol = (col: ColKey, delta: number) =>
    setWidths(w => ({ ...w, [col]: Math.max(60, w[col] + delta) }))

  /* ─ 날짜 인덱스 맵 ───────────────────────────────────────── */
  const dateIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    yearDays.forEach((d, i) => map.set(format(d, 'yyyy-MM-dd'), i))
    return map
  }, [yearDays])

  /* ─ 진척 맵 ──────────────────────────────────────────────── */
  const progressMap = useMemo(() => {
    const map = new Map<string, { indices: number[] }>()
    for (const rec of progressRecords) {
      const idx = dateIndexMap.get(rec.progress_date)
      if (idx === undefined) continue
      const entry = map.get(rec.dr_id)
      if (entry) entry.indices.push(idx)
      else map.set(rec.dr_id, { indices: [idx] })
    }
    return map
  }, [progressRecords, dateIndexMap])

  /* ─ 세그먼트 맵 ──────────────────────────────────────────── */
  const segmentsMap = useMemo(() => {
    const map = new Map<string, { s: number; e: number }[]>()
    for (const item of items) {
      map.set(item.id, getProgressSegments(item.id, progressMap))
    }
    return map
  }, [items, progressMap])

  /* ─ 월 스팬 ──────────────────────────────────────────────── */
  const monthSpans = useMemo(() => {
    const spans: { label: string; left: number; width: number }[] = []
    let i = 0
    while (i < yearDays.length) {
      const start    = i
      const monthKey = format(yearDays[i], 'yyyy-MM')
      while (i < yearDays.length && format(yearDays[i], 'yyyy-MM') === monthKey) i++
      spans.push({ label: format(yearDays[start], 'M월'), left: start * DAY_W, width: (i - start) * DAY_W })
    }
    return spans
  }, [yearDays])

  const totalFixedW = useMemo(() => COL_KEYS.reduce((s, k) => s + widths[k], 0), [widths])
  const dateAreaW   = yearDays.length * DAY_W
  const tableWidth  = totalFixedW + dateAreaW

  const stickyLeft = useMemo(() => {
    const o: Record<ColKey, number> = { name: 0, jira: 0, status: 0, team: 0 }
    let acc = 0
    for (const k of COL_KEYS) { o[k] = acc; acc += widths[k] }
    return o
  }, [widths])

  /* ─ 스크롤 ───────────────────────────────────────────────── */
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const monthTextRef   = useRef<HTMLSpanElement>(null)
  const isDraggingRef  = useRef(false)

  /* ─ 마우스 드래그 팬 ─────────────────────────────────────── */
  const panStartRef  = useRef<{ x: number; scrollLeft: number } | null>(null)
  const didPanRef    = useRef(false)
  const [isPanning,  setIsPanning] = useState(false)

  // 오늘로 스크롤
  useEffect(() => {
    if (tableScrollRef.current && todayIdx >= 0) {
      const targetLeft = todayIdx * DAY_W - 300
      tableScrollRef.current.scrollLeft = Math.max(0, targetLeft)
    }
  }, [todayIdx])

  const handleTableScroll = useCallback(() => {
    const el = tableScrollRef.current
    if (!el || !monthTextRef.current) return
    const i = Math.max(0, Math.min(yearDays.length - 1, Math.floor(el.scrollLeft / DAY_W)))
    monthTextRef.current.textContent = format(yearDays[i], 'yyyy년 M월', { locale: ko })
  }, [yearDays])

  /* ─ 팝업 상태 ────────────────────────────────────────────── */
  const [ganttPopup, setGanttPopup] = useState<{ id: string; dates: string[] } | null>(null)
  const [actionMenu, setActionMenu] = useState<{ rect: DOMRect; item: DrItem } | null>(null)
  const [teamAnchor, setTeamAnchor] = useState<DOMRect | null>(null)
  const [editTeamId, setEditTeamId] = useState<string | null>(null)

  /* ─ 인라인 편집 ──────────────────────────────────────────── */
  const [editCell, setEditCell] = useState<{ id: string; field: 'name' | 'jira' | 'status' } | null>(null)
  const [editValue, setEditValue] = useState('')

  function startEdit(item: DrItem, field: 'name' | 'jira' | 'status') {
    let v = ''
    if (field === 'name')   v = item.name
    if (field === 'jira')   v = item.jira_ticket ?? ''
    if (field === 'status') v = item.status
    setEditCell({ id: item.id, field })
    setEditValue(v)
  }

  async function commitEdit(id: string, field: 'name' | 'jira' | 'status', value: string) {
    setEditCell(null)
    if (field === 'name' && !value.trim()) return
    const update: Partial<DrItem> =
      field === 'name'   ? { name: value.trim() } :
      field === 'jira'   ? { jira_ticket: value.trim() || null } :
      { status: value as Status }
    onUpdateItem(id, update)
    await supabase.from('dr_items').update(update).eq('id', id)
  }

  async function commitTeam(id: string, dept: string, memberIds: string[]) {
    setEditTeamId(null); setTeamAnchor(null)
    const update = { department: dept as Department, assignees: memberIds }
    onUpdateItem(id, update)
    await supabase.from('dr_items').update(update).eq('id', id)
  }

  /* ─ 간트 팝업 열기 ───────────────────────────────────────── */
  function openGanttPopup(drId: string) {
    const dates = progressRecords.filter(r => r.dr_id === drId).map(r => r.progress_date)
    setGanttPopup({ id: drId, dates })
  }

  /* ─ 삭제 ─────────────────────────────────────────────────── */
  async function handleDelete(id: string) {
    setActionMenu(null)
    onDeleteItems([id])
    await supabase.from('dr_items').delete().eq('id', id)
  }

  /* ─ Drag & Drop 재정렬 ───────────────────────────────────── */
  const [dragId, setDragId]       = useState<string | null>(null)
  const dragIdRef                  = useRef<string | null>(null)
  const dropLineRef                = useRef<HTMLDivElement>(null)
  const overPosRef                 = useRef<'above' | 'below'>('above')
  const dragHandleDownRef          = useRef(false)
  const autoScrollRef              = useRef<number | null>(null)

  function showDropLine(tr: HTMLElement, clientY: number) {
    const rect = tr.getBoundingClientRect()
    const pos: 'above' | 'below' = clientY < rect.top + rect.height / 2 ? 'above' : 'below'
    overPosRef.current = pos
    const line = dropLineRef.current
    if (!line) return
    line.style.top     = pos === 'above' ? `${rect.top}px` : `${rect.bottom}px`
    line.style.left    = `${rect.left}px`
    line.style.width   = `${rect.width}px`
    line.style.opacity = '1'
  }
  function hideDropLine() {
    if (dropLineRef.current) dropLineRef.current.style.opacity = '0'
  }
  function startDragScroll(clientY: number) {
    if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current)
    const scroll = () => {
      const el = tableScrollRef.current
      if (!el) return
      const speed = 8
      if (clientY < 80)              el.scrollTop -= speed
      else if (clientY > window.innerHeight - 80) el.scrollTop += speed
      autoScrollRef.current = requestAnimationFrame(scroll)
    }
    autoScrollRef.current = requestAnimationFrame(scroll)
  }
  function stopDragScroll() {
    if (autoScrollRef.current) { cancelAnimationFrame(autoScrollRef.current); autoScrollRef.current = null }
  }

  async function handleReorder(draggedId: string, targetId: string, pos: 'above' | 'below') {
    const rest = items.filter(it => it.id !== draggedId)
    const targetIdx = rest.findIndex(it => it.id === targetId)
    if (targetIdx === -1) return
    const insertAt = pos === 'above' ? targetIdx : targetIdx + 1
    rest.splice(insertAt, 0, items.find(it => it.id === draggedId)!)
    rest.forEach((it, i) => {
      const so = i * 10
      onUpdateItem(it.id, { sort_order: so })
      supabase.from('dr_items').update({ sort_order: so }).eq('id', it.id).then() // eslint-disable-line
    })
  }

  /* ─ 주 번호 헤더 ─────────────────────────────────────────── */
  const weekNumbers = useMemo(() =>
    yearWeeks.map((w, i) => {
      const weekOfYear = differenceInCalendarWeeks(w, new Date(w.getFullYear(), 0, 1)) + 1
      return { label: `${weekOfYear}W`, left: i * 5 * DAY_W }
    }), [yearWeeks])

  /* ─ 렌더 ─────────────────────────────────────────────────── */
  return (
    <div className="relative">
      {/* 드롭 라인 */}
      <div
        ref={dropLineRef}
        className="fixed h-0.5 bg-blue-500 pointer-events-none z-[9999] opacity-0 transition-opacity"
        style={{ transform: 'translateY(-50%)' }}
      />

      {/* 필터 바 + 현재 월 표시 */}
      <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
        {filterBar}
        <span ref={monthTextRef} className="text-xs font-medium text-gray-400 whitespace-nowrap ml-auto" />
      </div>

      {/* 테이블 */}
      <div
        ref={tableScrollRef}
        className="overflow-x-auto select-none border border-gray-200 rounded-xl"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          cursor: isPanning ? 'grabbing' : 'default',
          userSelect: isPanning ? 'none' : 'auto',
          WebkitOverflowScrolling: 'touch',
          willChange: 'scroll-position',
        } as React.CSSProperties}
        onScroll={handleTableScroll}
        onMouseDown={e => {
          if (dragHandleDownRef.current) return
          if ((e.target as HTMLElement).closest('button, a, input, select')) return
          panStartRef.current = { x: e.clientX, scrollLeft: tableScrollRef.current?.scrollLeft ?? 0 }
          didPanRef.current = false
        }}
        onMouseMove={e => {
          if (!panStartRef.current || !tableScrollRef.current) return
          const dx = e.clientX - panStartRef.current.x
          if (!didPanRef.current && Math.abs(dx) > 5) {
            didPanRef.current = true
            setIsPanning(true)
          }
          if (didPanRef.current) {
            tableScrollRef.current.scrollLeft = panStartRef.current.scrollLeft - dx
          }
        }}
        onMouseUp={() => {
          panStartRef.current = null
          setIsPanning(false)
        }}
        onMouseLeave={() => {
          panStartRef.current = null
          setIsPanning(false)
        }}
      >
        <table className="border-collapse" style={{ width: tableWidth, tableLayout: 'fixed' }}>
          {/* ── 헤더 ── */}
          <thead>
            {/* 월 행 */}
            <tr className="border-b border-gray-200">
              {COL_KEYS.map(k => (
                <th
                  key={k}
                  className="sticky top-0 z-20 bg-gray-50 border-r border-gray-200 text-left px-3 py-2 text-xs font-semibold text-gray-500"
                  style={{ left: stickyLeft[k], width: widths[k] }}
                >
                  {k === 'name' ? 'DR' : k === 'jira' ? 'JIRA' : k === 'status' ? '상태' : '부서 / 담당자'}
                </th>
              ))}
              <th className="sticky top-0 z-10 bg-gray-50 p-0" style={{ width: dateAreaW }}>
                <div className="relative" style={{ height: 28 }}>
                  {monthSpans.map(s => (
                    <span
                      key={s.label + s.left}
                      className="absolute text-[11px] font-semibold text-gray-500 px-2"
                      style={{ left: s.left, width: s.width, top: '50%', transform: 'translateY(-50%)' }}
                    >
                      {s.label}
                    </span>
                  ))}
                </div>
              </th>
            </tr>
            {/* 주차 행 */}
            <tr className="border-b-2 border-gray-300">
              {COL_KEYS.map(k => (
                <th
                  key={k}
                  className="sticky z-20 bg-white border-r border-gray-200 p-0"
                  style={{ top: 28, left: stickyLeft[k], width: widths[k] }}
                />
              ))}
              <th className="sticky z-10 bg-white p-0" style={{ top: 28, width: dateAreaW }}>
                <div className="relative" style={{ height: 20 }}>
                  {weekNumbers.map(w => (
                    <span
                      key={w.left}
                      className="absolute text-[9px] text-gray-400 font-medium"
                      style={{ left: w.left + 2, top: '50%', transform: 'translateY(-50%)', width: DAY_W * 5 }}
                    >
                      {w.label}
                    </span>
                  ))}
                </div>
              </th>
            </tr>
          </thead>

          {/* ── 바디 ── */}
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={COL_KEYS.length + 1} className="py-16 text-center text-sm text-gray-400">
                  항목이 없습니다
                </td>
              </tr>
            )}
            {items.map((item, ri) => {
              const jiraUrl    = getJiraUrl(item.jira_ticket)
              const ganttColor = getDeptGanttColor(item.department)
              const segments   = segmentsMap.get(item.id) ?? []
              const isEditingName   = editCell?.id === item.id && editCell.field === 'name'
              const isEditingStatus = editCell?.id === item.id && editCell.field === 'status'

              return (
                <tr
                  key={item.id}
                  data-id={item.id}
                  className={`group border-t border-gray-100`}
                  style={{ background: '#ffffff', opacity: dragId === item.id ? 0.35 : 1 }}
                  draggable
                  onDragStart={e => {
                    if (!dragHandleDownRef.current) { e.preventDefault(); return }
                    dragHandleDownRef.current = false
                    dragIdRef.current = item.id
                    setDragId(item.id)
                    e.dataTransfer.effectAllowed = 'move'
                    const ghost = document.createElement('div')
                    ghost.style.cssText = 'position:fixed;top:-9999px'
                    document.body.appendChild(ghost)
                    e.dataTransfer.setDragImage(ghost, 0, 0)
                    setTimeout(() => document.body.removeChild(ghost), 0)
                  }}
                  onDragOver={e => {
                    if (!dragIdRef.current) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    showDropLine(e.currentTarget, e.clientY)
                    startDragScroll(e.clientY)
                  }}
                  onDrop={e => {
                    e.preventDefault()
                    const did = dragIdRef.current
                    if (did && did !== item.id) handleReorder(did, item.id, overPosRef.current)
                    dragIdRef.current = null; dragHandleDownRef.current = false
                    setDragId(null); hideDropLine(); stopDragScroll()
                  }}
                  onDragEnd={() => {
                    dragIdRef.current = null; dragHandleDownRef.current = false
                    setDragId(null); hideDropLine(); stopDragScroll()
                  }}
                >
                  {/* ── 이름 ── */}
                  <td
                    className="sticky z-10 border-r border-gray-200 px-2"
                    style={{ left: stickyLeft.name, width: widths.name, background: 'inherit', paddingTop: ROW_PY, paddingBottom: ROW_PY }}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <div
                        className="flex-shrink-0 opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing text-gray-400"
                        onMouseDown={() => { dragHandleDownRef.current = true; isDraggingRef.current = true }}
                        onMouseUp={() => { isDraggingRef.current = false }}
                      >
                        <GripVertical size={14} />
                      </div>
                      {isEditingName ? (
                        <input
                          autoFocus
                          className="flex-1 text-sm border-b border-blue-400 outline-none bg-transparent"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(item.id, 'name', editValue)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitEdit(item.id, 'name', editValue)
                            if (e.key === 'Escape') setEditCell(null)
                          }}
                        />
                      ) : (
                        <span
                          className="flex-1 text-sm text-gray-800 truncate cursor-pointer hover:text-blue-600"
                          onDoubleClick={() => startEdit(item, 'name')}
                          title={item.name}
                        >
                          {item.name}
                        </span>
                      )}
                      <button
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-100 text-gray-400 cursor-pointer"
                        onClick={e => {
                          e.stopPropagation()
                          setActionMenu({ rect: e.currentTarget.getBoundingClientRect(), item })
                        }}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  </td>

                  {/* ── JIRA ── */}
                  <td
                    className="sticky z-10 border-r border-gray-200 px-2 text-center"
                    style={{ left: stickyLeft.jira, width: widths.jira, background: 'inherit', paddingTop: ROW_PY, paddingBottom: ROW_PY }}
                  >
                    {jiraUrl ? (
                      <a
                        href={jiraUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] text-blue-500 hover:underline truncate block text-center"
                        onClick={e => e.stopPropagation()}
                      >
                        {item.jira_ticket}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-300">-</span>
                    )}
                  </td>

                  {/* ── 상태 ── */}
                  <td
                    className="sticky z-10 border-r border-gray-200 px-2 text-center"
                    style={{ left: stickyLeft.status, width: widths.status, background: 'inherit', paddingTop: ROW_PY, paddingBottom: ROW_PY }}
                  >
                    {isEditingStatus ? (
                      <select
                        autoFocus
                        className="text-xs border border-gray-200 rounded px-1 py-0.5"
                        value={editValue}
                        onChange={e => { setEditValue(e.target.value); commitEdit(item.id, 'status', e.target.value) }}
                        onBlur={() => setEditCell(null)}
                      >
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    ) : (
                      <div
                        className="cursor-pointer hover:opacity-80 flex justify-center"
                        onClick={() => { setEditCell({ id: item.id, field: 'status' }); setEditValue(item.status) }}
                      >
                        <StatusBadge status={item.status} />
                      </div>
                    )}
                  </td>

                  {/* ── 부서/담당자 ── */}
                  <td
                    className="sticky z-10 border-r border-gray-200 p-0"
                    style={{ left: stickyLeft.team, width: widths.team, background: 'inherit' }}
                  >
                    <div
                      className="flex h-full cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{ paddingTop: ROW_PY, paddingBottom: ROW_PY }}
                      onClick={e => {
                        setTeamAnchor(e.currentTarget.getBoundingClientRect())
                        setEditTeamId(item.id)
                      }}
                    >
                      <div className="flex items-center justify-center flex-shrink-0" style={{ width: 56 }}>
                        {item.department ? <DeptBadge dept={item.department} /> : <span className="text-gray-300 text-xs">-</span>}
                      </div>
                      <div className="flex items-center min-w-0 flex-1 px-1">
                        {(() => {
                          const names = (item.assignees ?? []).map(id => {
                            const m = teamMembers.find(t => t.id === id || t.name === id)
                            return m ? m.name : id
                          })
                          if (!names.length) return <span className="text-gray-300 text-xs">-</span>
                          return (
                            <span className="text-xs text-gray-600 truncate">
                              {names[0]}{names.length > 1 && <span className="text-gray-400"> +{names.length - 1}</span>}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  </td>

                  {/* ── 간트 영역 ── */}
                  <td
                    className="p-0 relative"
                    style={{ width: dateAreaW, height: BAR_H + ROW_PY * 2, backgroundImage: WEEK_BG }}
                  >
                    {segments.length > 0 ? (
                      segments.map((seg, si) => (
                        <div
                          key={si}
                          className="absolute rounded cursor-pointer hover:brightness-95 transition-all"
                          style={{
                            left: seg.s * DAY_W + 1,
                            width: Math.max(DAY_W - 2, (seg.e - seg.s + 1) * DAY_W - 2),
                            top: '50%', height: BAR_H, transform: 'translateY(-50%)',
                            backgroundColor: ganttColor.bg,
                            border: `1px solid ${ganttColor.border}`,
                          }}
                          onClick={e => {
                            e.stopPropagation()
                            if (!isDraggingRef.current && !didPanRef.current) openGanttPopup(item.id)
                            didPanRef.current = false
                          }}
                          title="클릭하여 일정 수정"
                        />
                      ))
                    ) : (
                      <div
                        className="absolute inset-0 cursor-pointer group/gantt"
                        onClick={() => {
                          if (!isDraggingRef.current && !didPanRef.current) openGanttPopup(item.id)
                          didPanRef.current = false
                        }}
                        title="클릭하여 일정 추가"
                      >
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center opacity-0 group-hover/gantt:opacity-100 transition-opacity pointer-events-none">
                          <span className="text-[10px] text-gray-400 bg-white/80 px-1.5 py-0.5 rounded whitespace-nowrap">+ 일정 추가</span>
                        </div>
                      </div>
                    )}
                    {/* 오늘 강조 */}
                    {todayIdx >= 0 && (
                      <div className="absolute inset-y-0 pointer-events-none"
                        style={{ left: todayIdx * DAY_W, width: DAY_W, background: 'rgba(239,68,68,0.10)', zIndex: 1 }}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── 간트 날짜 팝업 ── */}
      {ganttPopup && (
        <DrDatePopup
          drId={ganttPopup.id}
          initialDates={ganttPopup.dates}
          onClose={() => setGanttPopup(null)}
          onSaved={dates => {
            setGanttPopup(null)
            onUpdateProgress(ganttPopup.id, dates)
          }}
        />
      )}

      {/* ── 부서/담당자 팝업 ── */}
      {editTeamId && (() => {
        const item = items.find(it => it.id === editTeamId)
        if (!item) return null
        return (
          <DeptAssigneePopup
            anchor={teamAnchor}
            initialDept={item.department ?? 'BE'}
            initialIds={item.assignees ?? []}
            members={teamMembers}
            onCommit={(dept, ids) => commitTeam(editTeamId, dept, ids)}
            onCancel={() => { setEditTeamId(null); setTeamAnchor(null) }}
          />
        )
      })()}

      {/* ── 액션 메뉴 ── */}
      {actionMenu && (() => {
        const { rect, item } = actionMenu
        const top  = Math.min(rect.bottom + 4, window.innerHeight - 100)
        const left = Math.max(rect.left - 100, 8)
        return (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setActionMenu(null)} />
            <div
              className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-36"
              style={{ top, left }}
              onClick={e => e.stopPropagation()}
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setActionMenu(null)
                  startEdit(item, 'name')
                }}
              >
                <Pencil size={13} className="text-gray-400" />
                이름 수정
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                onClick={() => handleDelete(item.id)}
              >
                <Trash2 size={13} />
                삭제
              </button>
            </div>
          </>
        )
      })()}
    </div>
  )
}
