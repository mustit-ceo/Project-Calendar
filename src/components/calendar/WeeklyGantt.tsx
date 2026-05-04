'use client'

import { useRef, useState, useMemo, useEffect, useCallback } from 'react'
import { Project, TaskProgress, Status, Department, TeamMember, Holiday } from '@/lib/types'
import { DeptBadge } from '@/components/ui/DeptBadge'
import { DragHint } from '@/components/ui/DragHint'
import { getJiraUrl, buildProjectTree, STATUSES, DEPARTMENTS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  format, startOfMonth, addMonths, subMonths,
  addDays, addWeeks, getDay,
  isSameDay,
  differenceInCalendarWeeks, getISOWeek,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, ExternalLink, Check, X, Plus, GripVertical, MoreHorizontal, Copy, Trash2, ListPlus, MessageSquare, History } from 'lucide-react'

/* ─ 상태 텍스트 컬러 ────────────────────────────── */
function StatusText({ status }: { status: string }) {
  const color =
    status === '진행' ? '#00B050' :
    status === '예정' ? '#A6A6A6' : '#000000'
  return (
    <span style={{ color, fontSize: 13, fontWeight: 400, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

/* ─ 상태 선택 팝업 ───────────────────────────────── */
function StatusPickerPopup({
  anchor, current, onSelect, onClose,
}: {
  anchor: DOMRect
  current: string
  onSelect: (status: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const estimatedH = 5 * 34 + 8
  const spaceBelow = window.innerHeight - anchor.bottom
  const top  = spaceBelow >= estimatedH + 8 ? anchor.bottom + 4 : anchor.top - estimatedH - 4
  const left = Math.min(anchor.left, window.innerWidth - 120)

  const STATUS_COLORS_POPUP: Record<string, string> = {
    '진행': '#00B050', '예정': '#A6A6A6',
    '완료': '#000000', '대기': '#000000', '보류': '#000000',
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', top, left, zIndex: 9998,
        width: 110, background: '#fff',
        border: '1px solid #e5e7eb', borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.14)', overflow: 'hidden',
      }}
    >
      {['진행', '대기', '완료', '보류', '예정'].map(s => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          className={`w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-1.5 ${s === current ? 'bg-blue-50' : ''}`}
        >
          {s === current && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
          <span style={{ color: STATUS_COLORS_POPUP[s] ?? '#000' }}>{s}</span>
        </button>
      ))}
    </div>
  )
}

/* ─ 상수 ───────────────────────────────────────── */
const DAY_W          = 32
const BAR_H          = 20
const ROW_PY         = 6
const ROW_PY_CHILD   = 2
const TIMELINE_START = new Date(2025, 11, 1) // 2025년 12월 1일부터
const TOTAL_WEEKS    = 78 // 2025-12 ~ 2027-05 (약 1년 6개월)
const ROW1_H         = 30
const ROW_MONTH_H    = 30

/* ─ 부서별 간트 컬러 ──────────────────────────── */
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


const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/* ─ 날짜 유틸 ─────────────────────────────────── */
function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startPad = first.getDay()
  const days: (Date | null)[] = []
  for (let i = 0; i < startPad; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  return days
}

function firstMondayOnOrAfter(d: Date): Date {
  const day = new Date(d)
  const dow = getDay(day)
  if (dow === 1) return day
  return addDays(day, dow === 0 ? 1 : 8 - dow)
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))
}

function getProgressSegments(
  projectId: string,
  progressMap: Map<string, { indices: number[] }>,
): { s: number; e: number }[] {
  const entry = progressMap.get(projectId)
  if (!entry || entry.indices.length === 0) return []
  const sorted = [...entry.indices].sort((a, b) => a - b)
  const segments: { s: number; e: number }[] = []
  let start = sorted[0], end = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) { end = sorted[i] }
    else { segments.push({ s: start, e: end }); start = sorted[i]; end = sorted[i] }
  }
  segments.push({ s: start, e: end })
  return segments
}

/* ─ ResizeHandle ──────────────────────────────── */
function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const startX = useRef(0)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startX.current = e.clientX
    const onMove = (ev: MouseEvent) => { onResize(ev.clientX - startX.current); startX.current = ev.clientX }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 z-10"
    />
  )
}

const DEFAULT_PROGRESS_COLOR = '#3B82F6'

/* ─ 간트 날짜 팝업 ────────────────────────────── */
interface GanttDatePopupProps {
  projectId: string
  rootProjectId: string
  allProjects: Project[]
  initialDates: string[]
  initialLts: string | null
  startDate: string | null
  onClose: () => void
  /** 저장 완료 시 새 날짜 목록을 전달 → 부모에서 즉시 state 반영 */
  onSaved: (dates: string[], updates: { lts_date: string | null; start_date: string | null; end_date: string | null }) => void
}

function GanttDatePopup({
  projectId, rootProjectId, allProjects,
  initialDates, initialLts, startDate,
  onClose, onSaved,
}: GanttDatePopupProps) {
  const supabase = createClient()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(initialDates))
  const [lts, setLts] = useState(initialLts ?? '')
  const [saving, setSaving] = useState(false)
  // 자식이 없는 루트(DR 등)는 캘린더로 progress_date 입력 허용
  const hasChildren = allProjects.some(p => p.parent_id === projectId)
  const isRootProject = projectId === rootProjectId && hasChildren

  const calendarDays = buildCalendarDays(viewYear, viewMonth)
  const sortedDates = Array.from(selectedDates).sort()

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

      // 1) task_progress 저장 — 실제 변경된 날짜만 INSERT/DELETE (변경 이력 정확도 위해)
      const { data: existingRows, error: selErr } = await supabase
        .from('task_progress')
        .select('progress_date')
        .eq('project_id', projectId)
      if (selErr) {
        console.error('[GanttPopup] task_progress select error:', selErr)
        alert(`작업일정 조회 실패: ${selErr.message}`)
        return
      }

      const existingSet = new Set((existingRows ?? []).map(r => r.progress_date as string))
      const desiredSet = new Set(dates)
      const toDelete = [...existingSet].filter(d => !desiredSet.has(d))
      const toInsert = [...desiredSet].filter(d => !existingSet.has(d))

      if (toDelete.length > 0) {
        const { error: delErr } = await supabase
          .from('task_progress').delete()
          .eq('project_id', projectId)
          .in('progress_date', toDelete)
        if (delErr) {
          console.error('[GanttPopup] task_progress delete error:', delErr)
          alert(`작업일정 삭제 실패: ${delErr.message}`)
          return
        }
      }

      if (toInsert.length > 0) {
        const { data: insData, error: insErr } = await supabase.from('task_progress').insert(
          toInsert.map(d => ({ project_id: projectId, progress_date: d, label: null }))
        ).select()
        if (insErr) {
          console.error('[GanttPopup] task_progress insert error:', insErr)
          alert(`작업일정 추가 실패: ${insErr.message}`)
          return
        }
        // RLS가 silently 차단해 0행 INSERT되는 경우 감지
        if ((insData ?? []).length !== toInsert.length) {
          console.error('[GanttPopup] insert returned fewer rows than expected', { expected: toInsert.length, got: insData?.length, insData })
          alert(`작업일정 저장 실패: 권한이 없습니다 (RLS). ${insData?.length ?? 0}/${toInsert.length}건만 저장됨.`)
          return
        }
      }

      // ── task_progress 저장 성공 → UI 즉시 반영 (간트 바 표시) ──
      const ltsVal = lts.trim() || null

      // 2) BFS로 루트 프로젝트의 모든 하위 ID 수집
      const childrenOf = new Map<string, string[]>()
      for (const p of allProjects) {
        if (p.parent_id) {
          const list = childrenOf.get(p.parent_id)
          if (list) list.push(p.id)
          else childrenOf.set(p.parent_id, [p.id])
        }
      }
      const allIds: string[] = [rootProjectId]
      const queue = [rootProjectId]
      while (queue.length) {
        const cur = queue.shift()!
        const kids = childrenOf.get(cur) ?? []
        allIds.push(...kids); queue.push(...kids)
      }

      // 3) 루트 및 모든 하위 task_progress → min/max 계산
      const { data: allProgress } = await supabase
        .from('task_progress')
        .select('progress_date')
        .in('project_id', allIds)

      const sorted = (allProgress ?? []).map(r => r.progress_date).sort()
      // DR 항목(자식 없는 루트)은 선택한 dates 기준으로 min/max 직접 계산
      const dateSorted = [...dates].sort()
      const minDate = sorted.length > 0 ? sorted[0] : (dateSorted[0] ?? null)
      const maxDate = sorted.length > 0 ? sorted[sorted.length - 1] : (dateSorted[dateSorted.length - 1] ?? null)

      // 4) lts_date + start_date + end_date 저장 (실패해도 UI는 이미 갱신됨)
      const { error: updErr } = await supabase.from('projects').update({
        lts_date: ltsVal,
        start_date: minDate,
        end_date: maxDate,
      }).eq('id', rootProjectId)
      if (updErr) {
        console.error('[GanttPopup] projects update error:', updErr.message, '| code:', updErr.code, '| details:', updErr.details, '| hint:', updErr.hint)
      }

      // 5) UI 업데이트 (task_progress 저장 성공 기준으로 항상 호출)
      onSaved(dates, { lts_date: ltsVal, start_date: minDate, end_date: maxDate })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-80 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <span className="text-sm font-semibold text-gray-700">작업일자 수정</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="p-4">
          {/* ── 루트 프로젝트: 캘린더 없이 시작일 + LTS만 표시 ── */}
          {isRootProject ? (
            <>
              {/* 시작일 (읽기 전용) */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-semibold text-gray-500 w-20 flex-shrink-0">시작일자</span>
                <span className="flex-1 border border-gray-100 rounded-lg px-2 py-1 text-xs text-gray-400 bg-gray-50">
                  {startDate ?? '—'}
                </span>
              </div>

              {/* Project LTS */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-gray-500 w-20 flex-shrink-0">Project LTS</span>
                <input
                  type="date"
                  value={lts}
                  onChange={e => setLts(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                />
              </div>
            </>
          ) : (
            <>
              {/* ── 태스크: 기존 캘린더 UI ── */}
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
                  const isTd = ymd === toYMD(today)
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
                          : isTd ? 'ring-2 ring-blue-400 text-blue-600'
                          : isSun ? 'text-red-400 hover:bg-red-50'
                          : isSat ? 'text-blue-400 hover:bg-blue-50'
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

              <div className="mt-3 border-t border-gray-100 pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-gray-500 w-20 flex-shrink-0">LTS</span>
                  <input
                    type="date"
                    value={lts}
                    onChange={e => setLts(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                  />
                </div>
              </div>
            </>
          )}

          {/* 저장 버튼 */}
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
              className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─ 컬럼 설정 ──────────────────────────────────── */
const DEFAULT_WIDTHS = { name: 350, jira: 96, status: 90, team: 160 }
type ColKey = keyof typeof DEFAULT_WIDTHS
const COL_KEYS:   ColKey[]               = ['name', 'jira', 'status', 'team']
const COL_LABELS: Record<ColKey, string> = {
  name: '프로젝트', jira: 'JIRA', status: '상태', team: '부서 / 담당자',
}

const WEEK_BG = `repeating-linear-gradient(
  to right,
  #d1d5db 0px, #d1d5db 1px,
  transparent 1px, transparent ${5 * DAY_W}px
)`

/* ─ 편집 상태 타입 ─────────────────────────────── */
type EditField = 'name' | 'jira' | 'status' | 'team'
/** value는 여기서 관리하지 않음 → InlineTextInput 내부에서만 상태 유지 */
interface EditCell { id: string; field: EditField; initialValue: string }

/* ─ InlineTextInput: 로컬 value state로 타이핑 시 테이블 리렌더 차단 ── */
function InlineTextInput({
  initialValue,
  onCommit,
  onCancel,
  inputClassName,
  placeholder,
  checkSize = 12,
  btnSize = 6,
}: {
  initialValue: string
  onCommit: (value: string) => void
  onCancel: () => void
  inputClassName: string
  placeholder?: string
  checkSize?: number
  btnSize?: number
}) {
  const [val, setVal] = useState(initialValue)
  return (
    <>
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onCommit(val)
          else if (e.key === 'Escape') onCancel()
        }}
        onBlur={onCancel}
        placeholder={placeholder}
        className={inputClassName}
      />
      <button
        onMouseDown={e => e.preventDefault()}
        onClick={() => onCommit(val)}
        className={`flex-shrink-0 w-${btnSize} h-${btnSize} bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center justify-center cursor-pointer`}
      >
        <Check size={checkSize} />
      </button>
    </>
  )
}

/* ─ DeptAssigneePopup: 부서 + 담당자 통합 팝업 ── */
function DeptAssigneePopup({
  anchor,
  initialDept,
  initialIds,
  members,
  onCommit,
  onCancel,
}: {
  anchor:      DOMRect
  initialDept: string
  initialIds:  string[]
  members:     TeamMember[]
  onCommit:    (dept: string, ids: string[]) => void
  onCancel:    () => void
}) {
  const [dept,     setDept]     = useState(initialDept)
  // 레거시 데이터(이름 텍스트)도 ID로 변환하여 초기 체크 반영
  const [selected, setSelected] = useState<Set<string>>(() => {
    const resolved = new Set<string>()
    initialIds.forEach(idOrName => {
      const m = members.find(m => m.id === idOrName || m.name === idOrName)
      resolved.add(m ? m.id : idOrName)
    })
    return resolved
  })
  const dropRef   = useRef<HTMLDivElement>(null)
  // 항상 최신 state를 가리키는 ref → useEffect 단 1회 등록에도 최신값 읽기 가능
  const stateRef  = useRef({ dept, selected })
  stateRef.current = { dept, selected }

  // 외부 클릭 → 저장 (마운트 시 1회만 등록, ref로 최신값 읽음)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        onCommit(stateRef.current.dept, [...stateRef.current.selected])
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 부서 변경 시 해당 부서 소속이 아닌 담당자 선택 해제
  const handleDeptChange = (d: string) => {
    setDept(d)
    if (d) {
      setSelected(prev => {
        const next = new Set<string>()
        prev.forEach(id => {
          const m = members.find(m => m.id === id)
          if (m && m.department === d) next.add(id)
        })
        return next
      })
    }
  }

  const toggle = (id: string) => {
    const wasSelected = selected.has(id)
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    // 부서가 비어 있고 새로 추가하는 경우 → 멤버의 부서 자동 입력
    if (!wasSelected && !dept) {
      const m = members.find(m => m.id === id)
      if (m?.department) setDept(m.department)
    }
  }

  // 부서 선택 시 해당 부서 멤버만, 미선택 시 전체 멤버
  const filteredMembers = dept
    ? members.filter(m => m.department === dept)
    : members

  // 뷰포트 아래 공간 부족 시 위로 펼침
  const estimatedH = 40 + DEPARTMENTS.length * 30 + 8 + filteredMembers.length * 34 + 52
  const dropH      = Math.min(estimatedH, 400)
  const spaceBelow = window.innerHeight - anchor.bottom
  const top  = spaceBelow >= dropH + 8 ? anchor.bottom + 4 : anchor.top - dropH - 4
  const left = Math.min(anchor.left, window.innerWidth - 210)

  return (
    <div
      ref={dropRef}
      onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
      style={{
        position: 'fixed', top, left,
        zIndex: 9998,
        width: 200,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
        overflow: 'hidden',
      }}
    >
      {/* 부서 섹션 */}
      <div className="px-3 pt-2.5 pb-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">부서</p>
        <div className="flex flex-wrap gap-1">
          {(['', ...DEPARTMENTS] as string[]).map(d => (
            <button
              key={d || '__none__'}
              type="button"
              onMouseDown={e => e.stopPropagation()} // 외부클릭 �핸들러와 충돌 방지
              onClick={() => handleDeptChange(d)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                dept === d
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {d || '없음'}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 mx-3 my-1.5" />

      {/* 담당자 섹션 */}
      <div className="px-3 pb-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
          담당자 {dept && <span className="text-blue-400 normal-case">({dept})</span>}
        </p>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {filteredMembers.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400 text-center">
            {dept ? `${dept} 멤버 없음` : '멤버 없음'}
          </div>
        )}
        {filteredMembers.map(m => (
          <label
            key={m.id}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={selected.has(m.id)}
              onChange={() => toggle(m.id)}
              className="w-3.5 h-3.5 accent-blue-500 flex-shrink-0"
            />
            <span className="text-xs font-medium text-gray-800 flex-1">{m.name}</span>
          </label>
        ))}
      </div>

      {/* 버튼 */}
      <div className="flex gap-1.5 px-3 py-2 border-t border-gray-100 bg-gray-50">
        <button
          type="button"
          onMouseDown={e => e.stopPropagation()}
          onClick={onCancel}
          className="flex-1 px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-100 transition-colors cursor-pointer"
        >
          취소
        </button>
        <button
          type="button"
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onCommit(dept, [...selected])}
          className="flex-1 px-2 py-1 text-xs text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors cursor-pointer"
        >
          확인
        </button>
      </div>
    </div>
  )
}

/* ─ DisplayRow: 기존 행 + 신규 입력 행 ────────── */
type DisplayRow =
  | { kind: 'existing'; project: Project; depth: number }
  | { kind: 'new';      parentId: string; depth: number }

/* ─ 정렬 모드 ─────────────────────────────────── */
export type SortMode = 'manual' | 'startAsc' | 'ltsDesc'

/* ─ WeeklyGantt Props ──────────────────────────── */
interface WeeklyGanttProps {
  projects: Project[]
  progressRecords: TaskProgress[]
  teamMembers?: TeamMember[]
  holidays?: Holiday[]
  rootCount?: number
  highlightId?: string
  /** 루트 프로젝트 정렬 모드 (기본 'manual' = sort_order 순) */
  sortMode?: SortMode
  onUpdateProject?: (id: string, updates: Partial<Project>) => void
  onUpdateProgress?: (projectId: string, dates: string[]) => void
  /** 신규 task/sub-task 추가 후 부모 state 즉시 반영용 */
  onAddProject?: (project: Project) => void
  /** 삭제된 프로젝트 ID 목록 */
  onDeleteProjects?: (ids: string[]) => void
  /** 액션 메뉴에서 코멘트/변경 이력 클릭 시 부모가 모달 띄우기 */
  onRequestEdit?: (projectId: string, tab: 'comments' | 'history') => void
  /** 프로젝트 ID → 코멘트 수 (배지 표시용) */
  commentCounts?: Record<string, number>
  /** 필터 컨트롤을 헤더 우측에 렌더 */
  filterBar?: React.ReactNode
}

export function WeeklyGantt({
  projects,
  progressRecords,
  teamMembers = [],
  holidays = [],
  highlightId,
  sortMode = 'manual',
  onUpdateProject,
  onRequestEdit,
  commentCounts,
  onUpdateProgress,
  onAddProject,
  onDeleteProjects,
  filterBar,
}: WeeklyGanttProps) {
  const supabase = createClient()
  const today = new Date()

  /* ─ highlightId: 해당 행으로 스크롤 + 깜빡 하이라이트 ── */
  useEffect(() => {
    if (!highlightId) return
    const timer = setTimeout(() => {
      const row = document.querySelector(`tr[data-id="${highlightId}"]`) as HTMLElement | null
      if (!row) return
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      row.animate(
        [{ background: '#fef9c3' }, { background: '#fef9c3' }, { background: '#ffffff' }],
        { duration: 4000, easing: 'ease-out' }
      )
    }, 400)
    return () => clearTimeout(timer)
  }, [highlightId, projects])

  /* ─ 행 액션 메뉴 ── */
  type ActionMenu = { projectId: string; depth: number; canAddChild: boolean; rect: DOMRect }
  const [actionMenu, setActionMenu] = useState<ActionMenu | null>(null)

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!actionMenu) return
    const handler = () => setActionMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [actionMenu])

  /** 프로젝트 + 모든 하위 ID 수집 */
  function collectDescendantIds(rootId: string, allProjects: Project[]): string[] {
    const ids: string[] = [rootId]
    let frontier = [rootId]
    while (frontier.length > 0) {
      const children = allProjects
        .filter(p => frontier.includes(p.parent_id ?? ''))
        .map(p => p.id)
      ids.push(...children)
      frontier = children
    }
    return ids
  }

  /** 삭제 */
  async function handleDelete(projectId: string) {
    const ids = collectDescendantIds(projectId, projects)
    const label = projects.find(p => p.id === projectId)?.name ?? '항목'
    const childCount = ids.length - 1
    const msg = childCount > 0
      ? `"${label}" 및 하위 ${childCount}개 항목을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
      : `"${label}"을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
    if (!confirm(msg)) return
    setActionMenu(null)
    // task_progress 먼저 삭제
    for (const id of ids) {
      await supabase.from('task_progress').delete().eq('project_id', id)
    }
    // 자식 → 부모 순서로 삭제
    for (const id of [...ids].reverse()) {
      await supabase.from('projects').delete().eq('id', id)
    }
    onDeleteProjects?.(ids)
  }

  /** 복제 */
  async function handleDuplicate(projectId: string) {
    setActionMenu(null)
    const original = projects.find(p => p.id === projectId)
    if (!original) return
    const { data } = await supabase
      .from('projects')
      .insert({
        parent_id:   original.parent_id,
        category:    original.category,
        name:        `${original.name} (복사본)`,
        jira_ticket: null,
        status:      original.status,
        department:  original.department,
        assignees:   original.assignees,
        lts_date:    original.lts_date,
        is_archived: false,
        sort_order:  original.sort_order + 0.5,
        notes:       original.notes,
      })
      .select()
      .single()
    if (data) onAddProject?.(data as Project)
  }

  const yearWeeks = useMemo(() =>
    Array.from({ length: TOTAL_WEEKS }, (_, i) => addWeeks(TIMELINE_START, i)), [])
  const yearDays  = useMemo(() => yearWeeks.flatMap(w => getWeekDays(w)), [yearWeeks])
  const todayIdx  = useMemo(() => yearDays.findIndex(d => isSameDay(d, today)), [yearDays])

  const [widths, setWidths] = useState(DEFAULT_WIDTHS)
  const resizeCol = (col: ColKey, delta: number) =>
    setWidths(w => ({ ...w, [col]: Math.max(50, w[col] + delta) }))

  /* ─ 인라인 편집 상태 ──────────────────────────── */
  const [editCell, setEditCell] = useState<EditCell | null>(null)
  const [teamAnchor, setTeamAnchor] = useState<DOMRect | null>(null)
  const [statusAnchor, setStatusAnchor] = useState<{ rect: DOMRect; projectId: string; current: string } | null>(null)
  const [ganttPopup, setGanttPopup] = useState<{
    id: string; dates: string[];
    rootProjectId: string; lts: string | null;
    startDate: string | null;
  } | null>(null)

  /* ─ 자식 추가 상태 ────────────────────────────── */
  const [addingChild, setAddingChild] = useState<{
    parentId: string; depth: number
  } | null>(null)

  async function handleAddChild(parentId: string, name: string) {
    setAddingChild(null) // 입력 행 즉시 닫기
    const parent = projects.find(p => p.id === parentId)
    const { data } = await supabase
      .from('projects')
      .insert({
        parent_id:   parentId,
        category:    parent?.category   ?? '신규기능',
        name,
        status:      '대기'  as Status,
        department:  parent?.department ?? null,
        assignees:   [],
        jira_ticket: null,
        lts_date:    null,
        notes:       null,
        sort_order:  9999,
        is_archived: false,
      })
      .select('*')
      .single()
    if (data) onAddProject?.(data as Project)
  }

  function startEdit(project: Project, field: EditField) {
    let initialValue = ''
    if (field === 'name')   initialValue = project.name
    if (field === 'jira')   initialValue = (project.jira_ticket && project.jira_ticket !== '-') ? project.jira_ticket : ''
    if (field === 'status') initialValue = project.status
    // 'team' 은 initialValue 미사용 (DeptAssigneePopup 이 직접 project 값 받음)
    setEditCell({ id: project.id, field, initialValue })
  }

  function cancelEdit() { setEditCell(null); setTeamAnchor(null); setStatusAnchor(null) }

  /* ─ Row DnD 헬퍼 ──────────────────────────────── */

  /** 같은 parent_id 끼리만 이동 허용 */
  function canDropRow(draggedId: string, targetId: string): boolean {
    if (draggedId === targetId) return false
    const dragged = projects.find(p => p.id === draggedId)
    const target  = projects.find(p => p.id === targetId)
    if (!dragged || !target) return false
    return dragged.parent_id === target.parent_id
  }

  /** 드롭 인디케이터 라인 위치 갱신 (DOM 직접 조작 – re-render 없음) */
  const showDropLine = useCallback((tr: HTMLTableRowElement, clientY: number) => {
    const line = dropLineRef.current
    if (!line) return
    const rect   = tr.getBoundingClientRect()
    const isAbove = clientY < rect.top + rect.height / 2
    overPosRef.current   = isAbove ? 'above' : 'below'
    line.style.top     = `${isAbove ? rect.top : rect.bottom}px`
    line.style.left    = `${rect.left}px`
    line.style.width   = `${rect.width}px`
    line.style.display = 'block'
  }, [])

  const hideDropLine = useCallback(() => {
    const line = dropLineRef.current
    if (line) line.style.display = 'none'
  }, [])

  /* ─ Auto-scroll (드래그 중 화면 상/하단 진입 시 자동 스크롤) ── */
  const stopDragScroll = useCallback(() => {
    dragScrollSpeedRef.current = 0
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current)
      dragRafRef.current = null
    }
  }, [])

  /**
   * clientY 기준으로 스크롤 속도 결정 후 rAF 루프 구동
   * 화면 상/하단 100px 이내에 들어올수록 최대 16px/frame 까지 가속
   */
  const updateDragScroll = useCallback((clientY: number) => {
    const ZONE = 100, MAX_SPEED = 16
    const vh   = window.innerHeight
    let speed  = 0
    if      (clientY < ZONE)      speed = -Math.ceil(MAX_SPEED * (1 - clientY / ZONE))
    else if (clientY > vh - ZONE) speed =  Math.ceil(MAX_SPEED * (1 - (vh - clientY) / ZONE))

    dragScrollSpeedRef.current = speed

    if (speed !== 0 && dragRafRef.current === null) {
      const loop = () => {
        const spd  = dragScrollSpeedRef.current
        const main = document.querySelector<HTMLElement>('main')
        if (spd !== 0 && main) {
          main.scrollTop += spd
          dragRafRef.current = requestAnimationFrame(loop)
        } else {
          dragRafRef.current = null
        }
      }
      dragRafRef.current = requestAnimationFrame(loop)
    } else if (speed === 0) {
      stopDragScroll()
    }
  }, [stopDragScroll])

  /** window 전체 dragover 리스너: 커서가 어디 있든 auto-scroll 속도 갱신 */
  useEffect(() => {
    const onWindowDragOver = (e: DragEvent) => {
      if (!dragIdRef.current) return
      updateDragScroll(e.clientY)
    }
    window.addEventListener('dragover', onWindowDragOver)
    return () => window.removeEventListener('dragover', onWindowDragOver)
  }, [updateDragScroll])

  /** 이름·JIRA·담당자: InlineTextInput의 onCommit 콜백 */
  function commitText(id: string, field: 'name' | 'jira', rawValue: string) {
    let updates: Partial<Project> = {}
    let dbPayload: Record<string, unknown> = {}

    if (field === 'name') {
      const name = rawValue.trim()
      if (!name) { cancelEdit(); return }
      updates = { name }
      dbPayload = { name }
    } else {
      const jira_ticket = rawValue.trim() || null
      updates = { jira_ticket }
      dbPayload = { jira_ticket }
    }

    onUpdateProject?.(id, updates)
    setEditCell(null)
    supabase.from('projects').update(dbPayload).eq('id', id).then()
  }

  /** 부서+담당자 통합 저장 */
  function commitTeam(id: string, dept: string, assigneeIds: string[]) {
    const updates: Partial<Project> = {
      department: (dept || null) as Department | null,
      assignees:  assigneeIds,
    }
    onUpdateProject?.(id, updates)
    setEditCell(null)
    setTeamAnchor(null)
    supabase.from('projects').update({ department: dept || null, assignees: assigneeIds }).eq('id', id).then()
  }

  /** 상태 저장 */
  function commitSelect(id: string, value: string) {
    onUpdateProject?.(id, { status: value as Status })
    supabase.from('projects').update({ status: value }).eq('id', id).then()
  }

  /** 간트 날짜 팝업 열기: 현재 dates·lts 추출 */
  function openGanttPopup(projectId: string) {
    const records = progressRecords.filter(r => r.project_id === projectId)
    const dates = records.map(r => r.progress_date)
    const project = projects.find(p => p.id === projectId)
    let root = project
    while (root?.parent_id) {
      const parent = projects.find(p => p.id === root!.parent_id)
      if (!parent) break
      root = parent
    }
    setGanttPopup({
      id: projectId,
      dates,
      rootProjectId: root?.id ?? projectId,
      lts: project?.lts_date ?? null,
      startDate: root?.start_date ?? null,
    })
  }

  const stickyLeft = useMemo(() => {
    const o: Record<ColKey, number> = { name: 0, jira: 0, status: 0, team: 0 }
    let acc = 0
    for (const k of COL_KEYS) { o[k] = acc; acc += widths[k] }
    return o
  }, [widths])

  const totalFixedW = useMemo(() => COL_KEYS.reduce((s, k) => s + widths[k], 0), [widths])
  const dateAreaW   = yearDays.length * DAY_W
  const tableWidth  = totalFixedW + dateAreaW

  const monthSpans = useMemo(() => {
    const spans: { label: string; left: number; width: number }[] = []
    let i = 0
    while (i < yearDays.length) {
      const monthKey = format(yearDays[i], 'yyyy-MM')
      const start    = i
      while (i < yearDays.length && format(yearDays[i], 'yyyy-MM') === monthKey) i++
      spans.push({ label: format(yearDays[start], 'M월'), left: start * DAY_W, width: (i - start) * DAY_W })
    }
    return spans
  }, [yearDays])

  const tree = useMemo(() => {
    const raw = buildProjectTree(projects.filter(p => !p.is_archived))
    // 루트 프로젝트만 sortMode에 따라 재정렬 (하위 태스크는 buildProjectTree 입력 순서 = sort_order 유지)
    if (sortMode === 'startAsc') {
      return [...raw].sort((a, b) => {
        if (!a.start_date && !b.start_date) return 0
        if (!a.start_date) return 1
        if (!b.start_date) return -1
        return a.start_date.localeCompare(b.start_date)
      })
    }
    if (sortMode === 'ltsDesc') {
      return [...raw].sort((a, b) => {
        if (!a.lts_date && !b.lts_date) return 0
        if (!a.lts_date) return 1
        if (!b.lts_date) return -1
        return b.lts_date.localeCompare(a.lts_date)
      })
    }
    // 'manual' — DB sort_order 순서 그대로 유지 (드래그로 sort_order 갱신)
    return raw
  }, [projects, sortMode])

  const flatRows = useMemo(() => {
    function flatten(nodes: Project[], depth = 0): { project: Project; depth: number }[] {
      return nodes.flatMap(n => [{ project: n, depth }, ...flatten(n.children ?? [], depth + 1)])
    }
    return flatten(tree)
  }, [tree])

  /**
   * 드롭 완료 시 sort_order 재배정
   * 화면에 보이는 siblings 기준으로 0, 10, 20… 부여 후 옵티미스틱 업데이트
   * ※ flatRows 선언 이후에 위치해야 함
   */
  const handleReorder = useCallback((
    draggedId: string,
    targetId:  string,
    position:  'above' | 'below',
  ) => {
    const dragged = projects.find(p => p.id === draggedId)
    if (!dragged) return

    // flatRows: sort_order 순으로 정렬된 트리 flatten → same parent 뽑기
    const siblings = flatRows
      .filter(r => r.project.parent_id === dragged.parent_id)
      .map(r => r.project)

    if (siblings.length < 2) return
    if (!siblings.find(s => s.id === targetId)) return

    const rest      = siblings.filter(s => s.id !== draggedId)
    const targetIdx = rest.findIndex(s => s.id === targetId)
    if (targetIdx === -1) return

    const insertAt = position === 'above' ? targetIdx : targetIdx + 1
    rest.splice(insertAt, 0, dragged)

    // 전체 재배정 (0, 10, 20…) – page.tsx handleUpdateProject 에서 sort_order 기준 re-sort
    rest.forEach((s, i) => {
      const so = i * 10
      onUpdateProject?.(s.id, { sort_order: so })
      supabase.from('projects').update({ sort_order: so }).eq('id', s.id).then() // eslint-disable-line
    })
  }, [projects, flatRows, onUpdateProject]) // eslint-disable-line react-hooks/exhaustive-deps

  /** flatRows + addingChild 새 행을 합산한 렌더용 리스트 */
  const displayRows = useMemo((): DisplayRow[] => {
    const base: DisplayRow[] = flatRows.map(r => ({ kind: 'existing', ...r }))
    if (!addingChild) return base

    // 부모 인덱스 찾기
    const parentIdx = base.findIndex(
      r => r.kind === 'existing' && r.project.id === addingChild.parentId
    )
    if (parentIdx === -1) return base

    // 마지막 자손 인덱스 계산 (depth 기준)
    const parentDepth = base[parentIdx].depth
    let insertAfter = parentIdx
    for (let i = parentIdx + 1; i < base.length; i++) {
      if (base[i].depth > parentDepth) insertAfter = i
      else break
    }

    const result = [...base]
    result.splice(insertAfter + 1, 0, {
      kind: 'new', parentId: addingChild.parentId, depth: addingChild.depth,
    })
    return result
  }, [flatRows, addingChild])

  /* ─ 공휴일 인덱스 + 이름 매핑 ─ */
  const holidayMap = useMemo(() => {
    const m = new Map<string, string>()
    holidays.forEach(h => m.set(h.date, h.name))
    return m
  }, [holidays])

  const holidayIndices = useMemo(() => {
    const out: { idx: number; name: string }[] = []
    yearDays.forEach((d, i) => {
      const key = format(d, 'yyyy-MM-dd')
      const name = holidayMap.get(key)
      if (name) out.push({ idx: i, name })
    })
    return out
  }, [yearDays, holidayMap])

  const dateIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    yearDays.forEach((d, i) => map.set(format(d, 'yyyy-MM-dd'), i))
    return map
  }, [yearDays])

  const progressMap = useMemo(() => {
    const map = new Map<string, { indices: number[] }>()
    for (const rec of progressRecords) {
      const idx = dateIndexMap.get(rec.progress_date)
      if (idx === undefined) continue
      const entry = map.get(rec.project_id)
      if (entry) { entry.indices.push(idx) }
      else { map.set(rec.project_id, { indices: [idx] }) }
    }
    return map
  }, [progressRecords, dateIndexMap])

  /** 'YYYY-MM-DD' → 'M/D' 형식 */
  function fmtDate(d: string): string {
    const [, m, day] = d.split('-')
    return `${parseInt(m)}/${parseInt(day)}`
  }

  const segmentsMap = useMemo(() => {
    const map = new Map<string, { s: number; e: number }[]>()
    for (const { project } of flatRows) {
      map.set(project.id, getProgressSegments(project.id, progressMap))
    }
    return map
  }, [flatRows, progressMap])

  /**
   * 루트 프로젝트 기간 바: start_date ~ end_date (없으면 하위 태스크 최대 progress_date)
   * 반환: Map<rootProjectId, { startIdx: number; endIdx: number }>
   */
  const rootDurationBar = useMemo(() => {
    const result = new Map<string, { startIdx: number; endIdx: number }>()
    for (const p of projects) {
      if (p.parent_id || !p.start_date) continue // 루트이고 start_date 있을 때만

      const startIdx = dateIndexMap.get(p.start_date)
      if (startIdx === undefined) continue

      // 간트 기간: lts_date 우선, 없으면 end_date(태스크 최대 날짜) 사용
      let endDate = p.lts_date ?? p.end_date ?? null

      if (!endDate) continue
      const endIdx = dateIndexMap.get(endDate)
      if (endIdx === undefined) continue

      result.set(p.id, { startIdx, endIdx })
    }
    return result
  }, [projects, dateIndexMap])

  /* ─ Refs / 스크롤 ─────────────────────────────── */
  const tableScrollRef  = useRef<HTMLDivElement>(null)
  const monthTextRef    = useRef<HTMLSpanElement>(null)
  const isDraggingRef   = useRef(false)
  /** JIRA Ctrl+클릭 가이드 툴팁 (fixed 포지션, 리렌더 없이 DOM 직접 조작) */
  const jiraTipRef      = useRef<HTMLDivElement>(null)

  const showJiraTip = useCallback((el: HTMLElement) => {
    const tip = jiraTipRef.current
    if (!tip) return
    const r = el.getBoundingClientRect()
    tip.style.left    = `${r.right + 6}px`
    tip.style.top     = `${r.top + r.height / 2}px`
    tip.style.opacity = '1'
  }, [])

  const hideJiraTip = useCallback(() => {
    if (jiraTipRef.current) jiraTipRef.current.style.opacity = '0'
  }, [])

  /* ─ Row DnD 상태 ──────────────────────────────── */
  /** 현재 드래그 중인 행 id (opacity 적용용 – dragStart/End 시만 setState) */
  const [dragId, setDragId]           = useState<string | null>(null)
  /** 드롭 라인 div ref (DOM 직접 조작 → 드래그 중 re-render 0회) */
  const dropLineRef                    = useRef<HTMLDivElement>(null)
  /** 드래그 중인 id를 이벤트 핸들러에서 동기적으로 참조 */
  const dragIdRef                      = useRef<string | null>(null)
  /** 마지막으로 계산된 드롭 위치 (above / below) */
  const overPosRef                     = useRef<'above' | 'below'>('above')
  /** 드래그 핸들 mousedown 여부 – TR의 onDragStart 에서 핸들 출처 확인용 */
  const dragHandleDownRef              = useRef(false)
  /** auto-scroll: rAF 핸들 */
  const dragRafRef                     = useRef<number | null>(null)
  /** auto-scroll: 현재 스크롤 속도 (px/frame), 0이면 정지 */
  const dragScrollSpeedRef             = useRef(0)

  const headerInnerRef  = useRef<HTMLDivElement>(null)

  const updateMonthText = useCallback((scrollLeft: number) => {
    const i    = Math.max(0, Math.min(yearDays.length - 1, Math.floor(scrollLeft / DAY_W)))
    const text = format(yearDays[i], 'yyyy년 M월', { locale: ko })
    if (monthTextRef.current)   monthTextRef.current.textContent = text
    if (headerInnerRef.current) headerInnerRef.current.style.transform = `translateX(-${scrollLeft}px)`
  }, [yearDays])

  useEffect(() => {
    const el = tableScrollRef.current
    if (!el) return
    const fn = () => updateMonthText(el.scrollLeft)
    el.addEventListener('scroll', fn, { passive: true })
    return () => el.removeEventListener('scroll', fn)
  }, [updateMonthText])

  useEffect(() => {
    const el = tableScrollRef.current
    if (!el) return
    let isDown = false, startX = 0, startScroll = 0
    const THRESHOLD = 4
    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('a, button, select, input')) return
      isDown = true; isDraggingRef.current = false; startX = e.clientX; startScroll = el.scrollLeft
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return
      const dx = e.clientX - startX
      if (!isDraggingRef.current && Math.abs(dx) < THRESHOLD) return
      if (!isDraggingRef.current) {
        isDraggingRef.current = true; el.style.cursor = 'grabbing'; el.style.userSelect = 'none'
        try { el.setPointerCapture(e.pointerId) } catch {}
      }
      el.scrollLeft = startScroll - dx
      updateMonthText(el.scrollLeft)
    }
    const onPointerUp = () => {
      isDown = false
      if (isDraggingRef.current) { isDraggingRef.current = false; el.style.cursor = ''; el.style.userSelect = '' }
    }
    el.addEventListener('pointerdown',   onPointerDown)
    el.addEventListener('pointermove',   onPointerMove)
    el.addEventListener('pointerup',     onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    return () => {
      el.removeEventListener('pointerdown',   onPointerDown)
      el.removeEventListener('pointermove',   onPointerMove)
      el.removeEventListener('pointerup',     onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
    }
  }, [updateMonthText])

  const scrollToMonth = useCallback((targetDate: Date) => {
    const monday  = firstMondayOnOrAfter(startOfMonth(targetDate))
    const weekIdx = Math.max(0, differenceInCalendarWeeks(monday, TIMELINE_START))
    const left    = weekIdx * 5 * DAY_W
    if (tableScrollRef.current) tableScrollRef.current.scrollLeft = left
    updateMonthText(left)
  }, [updateMonthText])

  useEffect(() => { scrollToMonth(today) }, []) // eslint-disable-line

  const currentMonth = () => {
    const sl = tableScrollRef.current?.scrollLeft ?? 0
    const i  = Math.max(0, Math.min(yearDays.length - 1, Math.floor(sl / DAY_W)))
    return startOfMonth(yearDays[i])
  }
  const goToPrev  = () => scrollToMonth(subMonths(currentMonth(), 1))
  const goToNext  = () => scrollToMonth(addMonths(currentMonth(), 1))
  const goToToday = () => scrollToMonth(today)

  /* ─ Render ───────────────────────────────────── */
  return (
    <div className="pb-4">

      {/* 드래그 드롭 인디케이터 라인 — fixed 포지션, DOM 직접 조작으로 re-render 없음 */}
      <div
        ref={dropLineRef}
        style={{
          position: 'fixed', zIndex: 9997, pointerEvents: 'none',
          height: 2, background: '#3B82F6', display: 'none',
          borderRadius: 1, transform: 'translateY(-1px)',
          boxShadow: '0 0 4px rgba(59,130,246,0.5)',
        }}
      />

      {/* JIRA Ctrl+클릭 가이드 툴팁 — fixed 포지션으로 sticky/overflow 제약 없음 */}
      <div
        ref={jiraTipRef}
        style={{
          position: 'fixed', transform: 'translateY(-50%)',
          zIndex: 9999, opacity: 0, pointerEvents: 'none',
          transition: 'opacity 0.12s',
        }}
        className="text-[11px] text-gray-600 bg-white border border-gray-200 rounded-md px-2 py-1 shadow-md whitespace-nowrap"
      >
        Ctrl+클릭으로 열기
      </div>

      {/* 상태 선택 팝업 */}
      {statusAnchor && (
        <StatusPickerPopup
          anchor={statusAnchor.rect}
          current={statusAnchor.current}
          onSelect={s => { commitSelect(statusAnchor.projectId, s); setStatusAnchor(null) }}
          onClose={() => setStatusAnchor(null)}
        />
      )}

      {/* 부서/담당자 팝업 — sticky td 바깥 root 레벨에서 렌더 (stacking context 회피) */}
      {(() => {
        if (!editCell || editCell.field !== 'team' || !teamAnchor) return null
        const editProject = projects.find(p => p.id === editCell.id)
        if (!editProject) return null
        return (
          <DeptAssigneePopup
            anchor={teamAnchor}
            initialDept={editProject.department ?? ''}
            initialIds={editProject.assignees ?? []}
            members={teamMembers}
            onCommit={(dept, ids) => commitTeam(editProject.id, dept, ids)}
            onCancel={() => { setEditCell(null); setTeamAnchor(null) }}
          />
        )
      })()}

      {/* 간트 날짜 팝업 */}
      {ganttPopup && (
        <GanttDatePopup
          projectId={ganttPopup.id}
          rootProjectId={ganttPopup.rootProjectId}
          allProjects={projects}
          initialDates={ganttPopup.dates}
          initialLts={ganttPopup.lts}
          startDate={ganttPopup.startDate}
          onClose={() => setGanttPopup(null)}
          onSaved={(dates, updates) => {
            // DB 저장은 GanttDatePopup.handleSave 에서 이미 완료됨 → UI만 즉시 반영
            setGanttPopup(null)
            onUpdateProgress?.(ganttPopup.id, dates)
            onUpdateProject?.(ganttPopup.rootProjectId, updates)
          }}
        />
      )}

      {/* 행 액션 드롭다운 메뉴 */}
      {actionMenu && (() => {
        const { rect, projectId, depth, canAddChild: canAdd } = actionMenu
        const top  = Math.min(rect.bottom + 4, window.innerHeight - 160)
        const left = Math.max(rect.left - 120, 8)
        return (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setActionMenu(null)} />
            <div
              className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-44"
              style={{ top, left }}
              onClick={e => e.stopPropagation()}
            >
              {canAdd && (
                <button
                  onClick={() => {
                    setActionMenu(null)
                    setAddingChild({ parentId: projectId, depth: depth + 1 })
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <ListPlus size={14} className="text-blue-500 flex-shrink-0" />
                  {depth === 0 ? 'Task 추가' : 'Sub-task 추가'}
                </button>
              )}
              <button
                onClick={() => handleDuplicate(projectId)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <Copy size={14} className="text-gray-400 flex-shrink-0" />
                복제
              </button>
              {onRequestEdit && (
                <>
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    onClick={() => { setActionMenu(null); onRequestEdit(projectId, 'comments') }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <MessageSquare size={14} className="text-blue-500 flex-shrink-0" />
                    코멘트
                  </button>
                  <button
                    onClick={() => { setActionMenu(null); onRequestEdit(projectId, 'history') }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <History size={14} className="text-purple-500 flex-shrink-0" />
                    변경 이력
                  </button>
                </>
              )}
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={() => handleDelete(projectId)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 size={14} className="flex-shrink-0" />
                삭제
              </button>
            </div>
          </>
        )
      })()}

      {/* ── STICKY ZONE ─────────────────────────── */}
      <div
        className="sticky top-0 z-50 bg-gray-50"
        style={{ position: 'sticky', top: 0 }}
      >
        <div className="flex items-center gap-2 py-3 bg-white border-b border-gray-100">
          <button onClick={goToPrev}
            className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            <ChevronLeft size={15} />
          </button>
          <span ref={monthTextRef}
            className="text-sm font-semibold text-gray-700 min-w-[110px] text-center select-none">
            {format(today, 'yyyy년 M월', { locale: ko })}
          </span>
          <button onClick={goToNext}
            className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            <ChevronRight size={15} />
          </button>
          <button onClick={goToToday}
            className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 ml-1 transition-colors cursor-pointer">
            이번 달
          </button>
          {filterBar && (
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {filterBar}
            </div>
          )}
        </div>

        <div className="relative rounded-t-xl border border-gray-300 overflow-hidden"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div className="absolute top-0 left-0 z-30 flex flex-col bg-gray-50"
            style={{ width: totalFixedW }}>
            <div className="flex bg-gray-50" style={{ height: ROW_MONTH_H + ROW1_H + 34, boxShadow: '0 3px 0 #9ca3af' }}>
              {COL_KEYS.map(k => (
                <div key={k}
                  className="relative flex bg-gray-50 select-none border-r border-gray-300"
                  style={{ width: widths[k], flexShrink: 0, cursor: 'default' }}>
                  {k === 'team' ? (
                    /* 부서/담당자 헤더: 두 영역으로 분리 */
                    <div className="flex w-full h-full">
                      <div className="flex items-center justify-center text-xs font-semibold text-gray-500 uppercase tracking-wide flex-shrink-0" style={{ width: 64 }}>
                        부서
                      </div>
                      <div className="flex items-center justify-center flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        담당자
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-full px-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                      {COL_LABELS[k]}
                    </div>
                  )}
                  <ResizeHandle onResize={d => resizeCol(k, d)} />
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden" style={{ marginLeft: totalFixedW } as React.CSSProperties}>
            <div ref={headerInnerRef} style={{ width: dateAreaW }}>
              <div className="relative bg-gray-50 border-b border-gray-200 border-l border-gray-300"
                style={{ height: ROW1_H }}>
                {yearWeeks.map((w, wi) => (
                  <div key={wi}
                    className="absolute top-0 flex items-center justify-center select-none border-l border-gray-300"
                    style={{ left: wi * 5 * DAY_W, width: 5 * DAY_W, height: ROW1_H }}>
                    <span className="text-sm font-bold text-gray-700">{getISOWeek(w)}w</span>
                  </div>
                ))}
              </div>
              <div className="relative bg-gray-50 border-b border-gray-300 border-l border-gray-300"
                style={{ height: ROW_MONTH_H }}>
                {monthSpans.map((span, i) => (
                  <div key={i}
                    className="absolute top-0 flex items-center justify-center select-none border-l-2 border-gray-400"
                    style={{ left: span.left, width: span.width, height: ROW_MONTH_H }}>
                    <span className="text-xs font-bold text-gray-600 tracking-wide">{span.label}</span>
                  </div>
                ))}
              </div>
              <div className="relative bg-white border-l border-gray-300"
                style={{ height: 34, boxShadow: '0 3px 0 #9ca3af' }}>
                {yearDays.map((d, di) => {
                  const isToday      = isSameDay(d, today)
                  const isMonday     = di % 5 === 0
                  const isMonthStart = di > 0 && format(d, 'M') !== format(yearDays[di - 1], 'M')
                  const holidayName  = holidayMap.get(format(d, 'yyyy-MM-dd'))
                  const isHoliday    = !!holidayName
                  return (
                    <div key={di}
                      className={`absolute top-0 flex flex-col items-center justify-center select-none
                        ${isMonthStart ? 'border-l-2 border-gray-400' : isMonday ? 'border-l border-gray-300' : ''}
                        ${isToday ? 'bg-red-50' : isHoliday ? 'bg-gray-100' : ''}`}
                      style={{ left: di * DAY_W, width: DAY_W, height: 34 }}
                      title={holidayName}>
                      <span className={`text-xs font-medium leading-none ${
                        isToday ? 'text-red-500' : isHoliday ? 'text-gray-400' : 'text-gray-400'
                      }`}>
                        {format(d, 'd')}
                      </span>
                      <span className={`text-[10px] leading-none mt-0.5 ${
                        isToday ? 'text-red-300' : 'text-gray-300'
                      }`}>
                        {format(d, 'E', { locale: ko })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="absolute top-0 bottom-0 z-40 pointer-events-none"
            style={{ left: totalFixedW, width: 14, background: 'linear-gradient(to right, rgba(0,0,0,0.07), transparent)' }}
          />
        </div>
      </div>

      {/* ── BODY ────────────────────────────────── */}
      <div className="relative">
        {/* 드래그 힌트 오버레이 — 3초 후 페이드아웃 */}
        <DragHint style={{ left: `calc(50% + ${totalFixedW / 2}px)` }} />
        <div className="absolute top-0 bottom-0 z-40 pointer-events-none"
          style={{ left: totalFixedW, width: 14, background: 'linear-gradient(to right, rgba(0,0,0,0.07), transparent)' }}
        />
        <div
          ref={tableScrollRef}
          className="overflow-x-auto select-none rounded-b-xl border border-t-0 border-gray-300"
          style={{
            scrollbarWidth: 'none', msOverflowStyle: 'none', cursor: 'grab',
            willChange: 'scroll-position', WebkitOverflowScrolling: 'touch',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          } as React.CSSProperties}
        >
          <style>{`.gantt-body::-webkit-scrollbar { display: none; }`}</style>
          <table className="gantt-body border-collapse" style={{ tableLayout: 'fixed', width: tableWidth }}>
            <colgroup>
              {COL_KEYS.map(k => <col key={k} style={{ width: widths[k] }} />)}
              <col style={{ width: dateAreaW }} />
            </colgroup>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={COL_KEYS.length + 1} className="py-12 text-center text-gray-400 text-sm">
                    진행 중인 프로젝트가 없습니다.
                  </td>
                </tr>
              ) : displayRows.map((row, ri) => {

                /* ── 신규 입력 행 ── */
                if (row.kind === 'new') {
                  const py = row.depth === 1 ? ROW_PY_CHILD : ROW_PY_CHILD
                  return (
                    <tr key={`new-${row.parentId}`} style={{ background: '#f0f7ff' }}>
                      <td className="sticky z-10 px-3 border-r border-gray-200"
                        style={{ left: stickyLeft.name, width: widths.name, background: 'inherit', paddingTop: py, paddingBottom: py }}>
                        <div className="flex items-center gap-1" style={{ paddingLeft: row.depth * 14 }}>
                          <InlineTextInput
                            initialValue=""
                            onCommit={v => { if (v.trim()) { handleAddChild(row.parentId, v.trim()) } else { setAddingChild(null) } }}
                            onCancel={() => setAddingChild(null)}
                            inputClassName="flex-1 min-w-0 border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                            placeholder={row.depth === 1 ? 'task 이름 입력 후 Enter' : 'sub-task 이름 입력 후 Enter'}
                            checkSize={12}
                            btnSize={6}
                          />
                        </div>
                      </td>
                      {/* 나머지 컬럼은 빈 셀 */}
                      <td className="sticky z-10 border-r border-gray-200" style={{ left: stickyLeft.jira,   width: widths.jira,   background: 'inherit' }} />
                      <td className="sticky z-10 border-r border-gray-200" style={{ left: stickyLeft.status, width: widths.status, background: 'inherit' }} />
                      <td className="sticky z-10 border-r border-gray-200" style={{ left: stickyLeft.team,   width: widths.team,   background: 'inherit' }} />
                      <td className="p-0" style={{ width: dateAreaW, backgroundImage: WEEK_BG }} />
                    </tr>
                  )
                }

                /* ── 기존 행 ── */
                const { project, depth } = row
                const jiraUrl    = getJiraUrl(project.jira_ticket)
                const ganttColor = getDeptGanttColor(project.department)
                const segments   = segmentsMap.get(project.id) ?? []
                const isRoot     = depth === 0
                const py         = isRoot ? ROW_PY : ROW_PY_CHILD
                // 위쪽이 '새 행'이면 border-t 스킵
                const prevRow    = ri > 0 ? displayRows[ri - 1] : null
                const borderCls  = isRoot && ri > 0 && prevRow?.kind !== 'new'
                  ? 'border-t-2 border-t-gray-300' : ''

                const isEditingName   = editCell?.id === project.id && editCell.field === 'name'
                const isEditingStatus = editCell?.id === project.id && editCell.field === 'status'
                const isEditingTeam   = editCell?.id === project.id && editCell.field === 'team'

                // + 버튼 표시 여부: depth 0(task 추가) / depth 1(sub-task 추가)
                const canAddChild = depth <= 1 && !addingChild

                return (
                  <tr
                    key={project.id}
                    data-id={project.id}
                    className={`group ${borderCls}`}
                    style={{ background: '#ffffff', opacity: dragId === project.id ? 0.35 : 1, transition: 'opacity 0.1s' }}
                    draggable
                    onDragStart={e => {
                      // 기본 정렬에서만 순서 변경 허용 (다른 정렬 모드에선 드래그 차단)
                      if (sortMode !== 'manual') { e.preventDefault(); return }
                      // 드래그 핸들에서만 드래그 허용
                      if (!dragHandleDownRef.current) { e.preventDefault(); return }
                      dragHandleDownRef.current = false
                      dragIdRef.current = project.id
                      setDragId(project.id)
                      e.dataTransfer.effectAllowed = 'move'
                      // 기본 고스트 이미지 숨기기
                      const ghost = document.createElement('div')
                      ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px'
                      document.body.appendChild(ghost)
                      e.dataTransfer.setDragImage(ghost, 0, 0)
                      setTimeout(() => document.body.removeChild(ghost), 0)
                    }}
                    onDragOver={e => {
                      if (!dragIdRef.current) return
                      if (!canDropRow(dragIdRef.current, project.id)) {
                        hideDropLine(); return
                      }
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      showDropLine(e.currentTarget, e.clientY)
                    }}
                    onDrop={e => {
                      e.preventDefault()
                      const did = dragIdRef.current
                      if (did && did !== project.id && canDropRow(did, project.id)) {
                        handleReorder(did, project.id, overPosRef.current)
                      }
                      dragIdRef.current = null
                      dragHandleDownRef.current = false
                      setDragId(null)
                      hideDropLine()
                      stopDragScroll()
                    }}
                    onDragEnd={() => {
                      dragIdRef.current = null
                      dragHandleDownRef.current = false
                      setDragId(null)
                      hideDropLine()
                      stopDragScroll()
                    }}
                  >

                    {/* ── 프로젝트명 ── */}
                    <td className="sticky z-10 px-3 border-r border-gray-200"
                      style={{ left: stickyLeft.name, width: widths.name, background: 'inherit', paddingTop: py, paddingBottom: py }}>
                      {isEditingName ? (
                        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 14 }}>
                          <InlineTextInput
                            initialValue={editCell!.initialValue}
                            onCommit={v => commitText(project.id, 'name', v)}
                            onCancel={cancelEdit}
                            inputClassName="flex-1 min-w-0 border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            checkSize={12}
                            btnSize={6}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 14 }}>
                          {/* 드래그 핸들 — hover 시 표시, 기본 정렬에서만 활성 */}
                          <button
                            type="button"
                            className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded -ml-1 ${
                              sortMode === 'manual'
                                ? 'cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500'
                                : 'cursor-not-allowed text-gray-200'
                            }`}
                            tabIndex={-1}
                            onMouseDown={() => { if (sortMode === 'manual') dragHandleDownRef.current = true }}
                            onMouseUp={() => { dragHandleDownRef.current = false }}
                            onClick={e => e.stopPropagation()}
                            title={sortMode === 'manual' ? '드래그하여 순서 변경' : '기본 정렬에서만 순서 변경 가능합니다'}
                          >
                            <GripVertical size={14} />
                          </button>
                          {/* 텍스트 클릭 → 이름 편집 */}
                          <div
                            className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer hover:bg-blue-50 rounded px-1 transition-colors"
                            onClick={() => !isDraggingRef.current && startEdit(project, 'name')}
                            title="클릭하여 이름 수정"
                          >
                            {isRoot && (
                              <span className="text-xs font-medium text-gray-400 bg-gray-100 px-1 py-0.5 rounded flex-shrink-0 whitespace-nowrap">
                                {project.category}
                              </span>
                            )}
                            <span className={`truncate ${isRoot ? 'text-[15px] font-semibold text-gray-900' : depth === 1 ? 'text-[14px] text-gray-700' : 'text-[13px] text-gray-500'}`}>
                              {depth === 1 && <span className="text-gray-400 mr-1">·</span>}
                              {depth >= 2 && <span className="text-gray-300 mr-0.5">└</span>}
                              {project.name}
                            </span>
                            {isRoot && project.start_date && (() => {
                              const label = project.end_date
                                ? `(${fmtDate(project.start_date)}~${fmtDate(project.end_date)})`
                                : `(${fmtDate(project.start_date)}~)`
                              return (
                                <span className="flex-shrink-0 text-[11px] font-normal text-gray-400 whitespace-nowrap">
                                  {label}
                                </span>
                              )
                            })()}
                          </div>
                          {/* 코멘트 카운트 배지 (있을 때만 항상 노출) */}
                          {commentCounts && commentCounts[project.id] > 0 && onRequestEdit && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); onRequestEdit(project.id, 'comments') }}
                              className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded-full cursor-pointer transition-colors"
                              title={`코멘트 ${commentCounts[project.id]}개`}
                            >
                              <MessageSquare size={10} />
                              {commentCounts[project.id]}
                            </button>
                          )}
                          {/* ⋯ 액션 버튼: 행 hover 시 노출 */}
                          <button
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                            title="더 보기"
                            onClick={e => {
                              e.stopPropagation()
                              const rect = e.currentTarget.getBoundingClientRect()
                              setActionMenu(prev =>
                                prev?.projectId === project.id ? null : {
                                  projectId: project.id,
                                  depth,
                                  canAddChild,
                                  rect,
                                }
                              )
                            }}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* ── JIRA ── */}
                    <td className="sticky z-10 px-2 border-r border-gray-200 text-center"
                      style={{ left: stickyLeft.jira, width: widths.jira, background: 'inherit', paddingTop: py, paddingBottom: py }}>
                      {editCell?.id === project.id && editCell.field === 'jira' ? (
                        <InlineTextInput
                          initialValue={editCell.initialValue}
                          onCommit={v => commitText(project.id, 'jira', v)}
                          onCancel={cancelEdit}
                          inputClassName="w-full border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="PROJ-0000"
                          checkSize={10}
                          btnSize={5}
                        />
                      ) : (
                        <div
                          className="cursor-pointer hover:bg-blue-50 rounded px-1 transition-colors"
                          onMouseEnter={jiraUrl ? e => showJiraTip(e.currentTarget) : undefined}
                          onMouseLeave={jiraUrl ? hideJiraTip : undefined}
                          onClick={e => {
                            if (isDraggingRef.current) return
                            if ((e.ctrlKey || e.metaKey) && jiraUrl) {
                              window.open(jiraUrl, '_blank', 'noopener,noreferrer')
                            } else {
                              startEdit(project, 'jira')
                            }
                          }}
                        >
                          {project.jira_ticket && project.jira_ticket !== '-' ? (
                            <span className="text-[13px] text-blue-500 truncate block text-center">
                              {project.jira_ticket}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-300">-</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* ── 상태 ── */}
                    <td className="sticky z-10 px-2 border-r border-gray-200 text-center"
                      style={{ left: stickyLeft.status, width: widths.status, background: 'inherit', paddingTop: py, paddingBottom: py }}>
                      <div
                        className="cursor-pointer hover:bg-blue-50 rounded px-1 transition-colors"
                        onClick={e => {
                          if (isDraggingRef.current) return
                          setStatusAnchor({ rect: e.currentTarget.getBoundingClientRect(), projectId: project.id, current: project.status })
                        }}
                        title="클릭하여 상태 변경"
                      >
                        <StatusText status={project.status} />
                      </div>
                    </td>

                    {/* ── 부서 / 담당자 (통합 컬럼, 분리 표시) ── */}
                    <td className="sticky z-10 border-r border-gray-200 p-0"
                      style={{ left: stickyLeft.team, width: widths.team, background: 'inherit' }}>
                      <div
                        className="flex h-full cursor-pointer hover:bg-blue-50 transition-colors"
                        style={{ paddingTop: py, paddingBottom: py }}
                        onClick={e => {
                          if (isDraggingRef.current) return
                          setTeamAnchor(e.currentTarget.getBoundingClientRect())
                          startEdit(project, 'team')
                        }}
                        title="클릭하여 부서/담당자 수정"
                      >
                        {/* 부서 영역 */}
                        <div className="flex items-center justify-center flex-shrink-0" style={{ width: 64 }}>
                          {project.department
                            ? <DeptBadge dept={project.department} />
                            : <span className="text-gray-300 text-xs">-</span>
                          }
                        </div>
                        {/* 담당자 영역 */}
                        <div className="flex items-center justify-center min-w-0 flex-1 px-1">
                          {(() => {
                            const names = (project.assignees ?? []).map(id => {
                              const m = teamMembers.find(tm => tm.id === id)
                              return m ? m.name : id
                            })
                            if (names.length === 0) return <span className="text-gray-300 text-xs">-</span>
                            return (
                              <span className="text-xs text-gray-600 truncate leading-snug text-center">
                                {names[0]}
                                {names.length > 1 && <span className="text-gray-400"> +{names.length - 1}</span>}
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                    </td>

                    {/* ── 간트 영역 ── */}
                    <td
                      className="p-0 relative"
                      style={{ width: dateAreaW, height: BAR_H + py * 2, backgroundImage: WEEK_BG }}
                    >
                      {/* 루트 프로젝트 기간 바 (start_date ~ end_date, #cccccc) */}
                      {isRoot && (() => {
                        const bar = rootDurationBar.get(project.id)
                        if (!bar) return null
                        return (
                          <div
                            className="absolute rounded pointer-events-none"
                            style={{
                              left: bar.startIdx * DAY_W,
                              width: (bar.endIdx - bar.startIdx + 1) * DAY_W,
                              top: '50%', height: BAR_H, transform: 'translateY(-50%)',
                              background: '#cccccc',
                              zIndex: 0,
                            }}
                          />
                        )
                      })()}
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
                            onClick={e => { e.stopPropagation(); if (!isDraggingRef.current) openGanttPopup(project.id) }}
                            title="클릭하여 일정 수정"
                          />
                        ))
                      ) : (
                        <div
                          className="absolute inset-0 cursor-pointer group/gantt"
                          onClick={() => !isDraggingRef.current && openGanttPopup(project.id)}
                          title="클릭하여 일정 추가"
                        >
                          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center opacity-0 group-hover/gantt:opacity-100 transition-opacity pointer-events-none">
                            <span className="text-[10px] text-gray-400 bg-white/80 px-1.5 py-0.5 rounded whitespace-nowrap">+ 일정 추가</span>
                          </div>
                        </div>
                      )}
                      {todayIdx >= 0 && (
                        <div className="absolute inset-y-0 pointer-events-none"
                          style={{ left: todayIdx * DAY_W, width: DAY_W, background: 'rgba(239,68,68,0.10)', zIndex: 1 }}
                        />
                      )}
                      {/* 공휴일 — 회색 톤으로 작업 색 약화 */}
                      {holidayIndices.map(({ idx, name }) => (
                        <div
                          key={`hol-${idx}`}
                          className="absolute inset-y-0 pointer-events-none"
                          style={{
                            left: idx * DAY_W,
                            width: DAY_W,
                            background: 'rgba(229,231,235,0.65)',
                            zIndex: 3,
                          }}
                          title={name}
                        />
                      ))}
                      {/* LTS 뱃지 */}
                      {project.lts_date && (() => {
                        const ltsIdx = dateIndexMap.get(project.lts_date)
                        if (ltsIdx === undefined) return null
                        return (
                          <div
                            className="absolute flex items-center justify-center pointer-events-none"
                            style={{
                              left: ltsIdx * DAY_W,
                              width: DAY_W,
                              top: '50%',
                              height: BAR_H,
                              transform: 'translateY(-50%)',
                              zIndex: 5,
                            }}
                          >
                            <span
                              className="text-[8px] font-bold leading-none px-0.5 py-px rounded-sm"
                              style={{
                                color: '#dc2626',
                                background: 'rgba(255,255,255,0.88)',
                                border: '1px solid rgba(239,68,68,0.4)',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                              }}
                            >
                              LTS
                            </span>
                          </div>
                        )
                      })()}
                      {/* 일자 구분선 — 흰색 1px (LTS·이름 영역 침범 방지 위해 zIndex=2) */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${DAY_W - 1}px, #fff ${DAY_W - 1}px, #fff ${DAY_W}px)`,
                          zIndex: 2,
                        }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
