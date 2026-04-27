'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Project, TaskProgress, TeamMember, Department } from '@/lib/types'
import { useRouter } from 'next/navigation'
import {
  format, addDays, addWeeks, addMonths,
  startOfMonth, endOfMonth, getDay, getISOWeek,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  RefreshCw, ChevronLeft, ChevronRight,
  Settings, Plus, X, Check, Pencil, Trash2,
} from 'lucide-react'
import { DEPARTMENTS, DR_CATEGORIES } from '@/lib/utils'
import { DeptBadge } from '@/components/ui/DeptBadge'

/* ── 타입 ──────────────────────────────────────── */
type ViewMode = 'day' | 'week' | 'month'

interface Period {
  key:       string
  label:     string
  sublabel:  string
  start:     Date
  end:       Date
  isCurrent: boolean
}

/* ── 부서 정렬 순서 ────────────────────────────── */
const DEPT_ORDER: Record<string, number> = { PM: 0, BE: 1, FE: 2, Design: 3, Oth: 4 }
function sortMembers(members: TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) => {
    // 비활성은 항상 맨 아래
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    // 부서 순서
    const deptDiff = (DEPT_ORDER[a.department] ?? 99) - (DEPT_ORDER[b.department] ?? 99)
    if (deptDiff !== 0) return deptDiff
    // 같은 부서 내 리더 우선
    if (a.is_leader !== b.is_leader) return a.is_leader ? -1 : 1
    return a.name.localeCompare(b.name, 'ko')
  })
}

/* ── 컬러 상수 ─────────────────────────────────── */
const DEPT_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  PM:     { bg: '#dae9f8', border: '#aed0ef', text: '#1d4ed8' },
  BE:     { bg: '#fbe2d5', border: '#f5c4a8', text: '#c2410c' },
  FE:     { bg: '#daf2d0', border: '#ade59a', text: '#15803d' },
  Design: { bg: '#f2ceef', border: '#e4a0df', text: '#a21caf' },
  Oth:    { bg: '#d9d9d9', border: '#b8b8b8', text: '#374151' },
}
// MemberAvatar 용
const DEPT_BG = DEPT_STYLE
const DEPT_DEFAULT = { bg: '#d9d9d9', border: '#b8b8b8', text: '#374151' }

/* ── 날짜 유틸 ─────────────────────────────────── */
function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getMondayOfWeek(d: Date): Date {
  const date = new Date(d)
  const dow  = getDay(date)
  date.setDate(date.getDate() + (dow === 0 ? -6 : 1 - dow))
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
}

/** 주말이면 가장 가까운 평일(과거 방향)로 이동 */
function toWeekday(d: Date): Date {
  const result = new Date(d)
  while (getDay(result) === 0 || getDay(result) === 6) {
    result.setDate(result.getDate() - 1)
  }
  return result
}

/** 평일 기준으로 n일 이동 (음수 가능) */
function addWeekdays(d: Date, n: number): Date {
  if (n === 0) return new Date(d)
  let result = new Date(d)
  const step = n > 0 ? 1 : -1
  let remaining = Math.abs(n)
  while (remaining > 0) {
    result = addDays(result, step)
    if (getDay(result) !== 0 && getDay(result) !== 6) remaining--
  }
  return result
}

/* ── 기간 생성 ─────────────────────────────────── */
function generatePeriods(mode: ViewMode, offset: number): Period[] {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  if (mode === 'week') {
    // 기본(offset=0): 지난주부터 4주 표시. 버튼 클릭 시 1주씩 이동
    const baseMonday = addWeeks(getMondayOfWeek(today), -1 + offset)
    return Array.from({ length: 8 }, (_, i) => {
      const mon = addWeeks(baseMonday, i)
      const fri = addDays(mon, 4)
      const isCurrent = mon <= today && today <= addDays(mon, 6)
      return {
        key:      format(mon, 'yyyy-Iw'),
        label:    `${getISOWeek(mon)}w`,
        sublabel: `${format(mon, 'M/d', { locale: ko })}–${format(fri, 'M/d', { locale: ko })}`,
        start:    mon,
        end:      endOfDay(fri),
        isCurrent,
      }
    })
  }

  if (mode === 'month') {
    // 기본(offset=0): 지난달부터 3개월 표시. 버튼 클릭 시 1달씩 이동
    const baseMonth = addMonths(startOfMonth(today), -1 + offset)
    return Array.from({ length: 8 }, (_, i) => {
      const m    = addMonths(baseMonth, i)
      const mEnd = endOfMonth(m)
      return {
        key:      format(m, 'yyyy-MM'),
        label:    format(m, 'yyyy년 M월', { locale: ko }),
        sublabel: format(m, 'M월', { locale: ko }),
        start:    m,
        end:      endOfDay(mEnd),
        isCurrent: format(m, 'yyyy-MM') === format(today, 'yyyy-MM'),
      }
    })
  }

  // day: 기본(offset=0): 어제부터 8 평일 표시. 토/일 제외. 버튼 클릭 시 1 평일씩 이동
  const baseDayRaw = toWeekday(addDays(today, -1))
  const baseDay    = addWeekdays(baseDayRaw, offset)

  const weekdays: Date[] = []
  let cur = new Date(baseDay)
  while (weekdays.length < 8) {
    if (getDay(cur) !== 0 && getDay(cur) !== 6) weekdays.push(new Date(cur))
    cur = addDays(cur, 1)
  }

  return weekdays.map(d => ({
    key:      format(d, 'yyyy-MM-dd'),
    label:    format(d, 'M/d', { locale: ko }),
    sublabel: format(d, 'EEE', { locale: ko }),
    start:    d,
    end:      endOfDay(d),
    isCurrent: format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'),
  }))
}

/* ── 해당 기간 프로젝트 계산 ────────────────────── */
function getProjectsForMember(
  member:      TeamMember,
  period:      Period,
  allProjects: Project[],
  progress:    TaskProgress[],
): { project: Project; parentName: string | null; kind: 'project' | 'dr' }[] {
  // 1. 기간 내 task_progress 가 있는 project_id 집합
  const periodStart = format(period.start, 'yyyy-MM-dd')
  const periodEnd   = format(period.end,   'yyyy-MM-dd')

  const progressIds = new Set(
    progress
      .filter(pr => pr.progress_date >= periodStart && pr.progress_date <= periodEnd)
      .map(pr => pr.project_id)
  )

  // 2. 멤버가 담당자이고 해당 기간 progress 가 있는 태스크
  const projectMap = new Map(allProjects.map(p => [p.id, p]))

  return allProjects
    .filter(p => {
      const isAssigned =
        Array.isArray(p.assignees) &&
        (p.assignees.includes(member.id) || p.assignees.includes(member.name))
      return isAssigned && progressIds.has(p.id)
    })
    .map(p => {
      // 부모 경로 조합 (최대 grandparent > parent)
      let parentName: string | null = null
      if (p.parent_id) {
        const parent = projectMap.get(p.parent_id)
        if (parent) {
          if (parent.parent_id) {
            const grandParent = projectMap.get(parent.parent_id)
            parentName = grandParent ? `${grandParent.name} > ${parent.name}` : parent.name
          } else {
            parentName = parent.name
          }
        }
      }
      const kind: 'project' | 'dr' = DR_CATEGORIES.includes(p.category) ? 'dr' : 'project'
      return { project: p, parentName, kind }
    })
}

/* ── MemberAvatar ──────────────────────────────── */
function MemberAvatar({ member, size = 36 }: { member: TeamMember; size?: number }) {
  const c = DEPT_BG[member.department] ?? DEPT_DEFAULT
  return (
    <div
      style={{
        width: size, height: size,
        background: c.bg, color: c.text,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 700,
        flexShrink: 0, border: '2px solid #fff',
        boxShadow: '0 1px 4px rgba(0,0,0,.1)',
      }}
    >
      {member.name.slice(0, 1)}
    </div>
  )
}

/* ── ProjectChip ───────────────────────────────── */
function ProjectChip({
  project, parentName, kind,
}: {
  project: Project; parentName?: string | null; kind?: 'project' | 'dr'
}) {
  const router = useRouter()
  const isDR = kind === 'dr'
  return (
    <div
      className="flex flex-col px-2 py-1 mb-1 bg-white border border-gray-100 rounded-lg shadow-sm min-w-0 cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
      onClick={() => router.push(`/calendar?task=${project.id}${isDR ? '&tab=dr' : ''}`)}
      title="캘린더에서 보기"
    >
      {parentName && (
        <span className="text-[11px] text-gray-400 truncate leading-tight" title={parentName}>
          {parentName}
        </span>
      )}
      <div className="flex items-center gap-1 min-w-0">
        {isDR && (
          <span className="flex-shrink-0 text-[10px] font-bold px-1 py-0.5 rounded leading-none"
            style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
            DR
          </span>
        )}
        <span className="text-[13px] truncate leading-tight font-medium text-gray-700" title={project.name}>
          {project.name}
        </span>
      </div>
    </div>
  )
}

/* ── MemberSettingModal ────────────────────────── */
interface SettingModalProps {
  members:   TeamMember[]
  onChange:  (next: TeamMember[]) => void
  onClose:   () => void
}

function MemberSettingModal({ members, onChange, onClose }: SettingModalProps) {
  const supabase = createClient()
  const [adding,  setAdding]  = useState(false)
  const [editId,  setEditId]  = useState<string | null>(null)
  const [form,    setForm]    = useState({ name: '', department: 'PM' as Department, email: '' })

  /* 활성/비활성 토글 */
  const handleToggle = async (m: TeamMember) => {
    const next = { ...m, is_active: !m.is_active }
    onChange(members.map(x => x.id === m.id ? next : x))
    await supabase.from('team_members').update({ is_active: next.is_active }).eq('id', m.id)
  }

  /* 리더 토글 */
  const handleLeaderToggle = async (m: TeamMember) => {
    const next = { ...m, is_leader: !m.is_leader }
    onChange(members.map(x => x.id === m.id ? next : x))
    await supabase.from('team_members').update({ is_leader: next.is_leader }).eq('id', m.id)
  }

  /* 편집 시작 */
  const startEdit = (m: TeamMember) => {
    setEditId(m.id)
    setForm({ name: m.name, department: m.department, email: m.email ?? '' })
    setAdding(false)
  }

  /* 편집 저장 */
  const saveEdit = async () => {
    if (!editId || !form.name.trim()) return
    const updates = { name: form.name.trim(), department: form.department, email: form.email.trim() || null }
    onChange(members.map(m => m.id === editId ? { ...m, ...updates } : m))
    setEditId(null)
    await supabase.from('team_members').update(updates).eq('id', editId)
  }

  /* 삭제 */
  const handleDelete = async (id: string) => {
    if (!confirm('멤버를 삭제할까요? 프로젝트 담당자 정보는 유지됩니다.')) return
    onChange(members.filter(m => m.id !== id))
    await supabase.from('team_members').delete().eq('id', id)
  }

  /* 추가 */
  const handleAdd = async () => {
    if (!form.name.trim()) return
    const payload = {
      name:       form.name.trim(),
      department: form.department,
      email:      form.email.trim() || null,
      is_active:  true,
    }
    const { data } = await supabase.from('team_members').insert(payload).select('*').single()
    if (data) onChange([...members, data as TeamMember])
    setAdding(false)
    setForm({ name: '', department: 'PM', email: '' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-[500px] max-h-[82vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">멤버 관리</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              팀 멤버를 추가하거나 활성/비활성 상태를 관리합니다
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* 리스트 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {members.map(m => (
            <div key={m.id}>
              {editId === m.id ? (
                <div className="space-y-2 p-3 border-2 border-blue-200 border-dashed rounded-xl bg-blue-50/50">
                  <p className="text-xs font-semibold text-blue-600">멤버 수정</p>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null) }}
                      placeholder="이름"
                      className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    />
                    <select
                      value={form.department}
                      onChange={e => setForm(f => ({ ...f, department: e.target.value as Department }))}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    >
                      {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <input
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null) }}
                    placeholder="이메일 (선택)"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditId(null)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">취소</button>
                    <button onClick={saveEdit} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-1 cursor-pointer">
                      <Check size={11} /> 저장
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all ${
                    m.is_active
                      ? 'bg-white border-gray-200'
                      : 'bg-gray-50 border-gray-100 opacity-60'
                  }`}
                >
                  <MemberAvatar member={m} size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                      <DeptBadge dept={m.department} />
                      {m.is_leader && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#fef9c3', color: '#854d0e' }}>
                          리더
                        </span>
                      )}
                      {!m.is_active && (
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          비활성
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {m.email || '이메일 미등록'}
                    </p>
                  </div>
                  {/* 액션 */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* 리더 토글 */}
                    <button
                      onClick={() => handleLeaderToggle(m)}
                      title={m.is_leader ? '리더 해제' : '리더 지정'}
                      className={`text-[11px] font-semibold px-2 py-1 rounded-md border transition-colors cursor-pointer ${
                        m.is_leader
                          ? 'bg-yellow-100 border-yellow-300 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                      }`}
                    >
                      리더
                    </button>
                    {/* 활성 토글 */}
                    <button
                      onClick={() => handleToggle(m)}
                      title={m.is_active ? '비활성화' : '활성화'}
                      className="relative cursor-pointer"
                    >
                      <div className={`w-9 h-5 rounded-full transition-colors ${m.is_active ? 'bg-blue-500' : 'bg-gray-300'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${m.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                    </button>
                    <button
                      onClick={() => startEdit(m)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="수정"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {adding && (
            <div className="space-y-2 p-3 border-2 border-blue-200 border-dashed rounded-xl bg-blue-50/50">
              <p className="text-xs font-semibold text-blue-600">새 멤버 추가</p>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setForm({ name: '', department: 'PM', email: '' }) } }}
                  placeholder="이름"
                  className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                />
                <select
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value as Department }))}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                >
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setForm({ name: '', department: 'PM', email: '' }) } }}
                placeholder="이메일 (선택)"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setAdding(false); setForm({ name: '', department: 'PM', email: '' }) }} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">취소</button>
                <button onClick={handleAdd} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-1 cursor-pointer">
                  <Check size={11} /> 추가
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => { setAdding(true); setEditId(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium cursor-pointer"
          >
            <Plus size={14} /> 멤버 추가
          </button>
          <div className="text-xs text-gray-400">
            총 {members.length}명 · 활성 {members.filter(m => m.is_active).length}명
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── 메인 페이지 ────────────────────────────────── */
export default function MembersPage() {
  const supabase = createClient()

  const [members,  setMembers]  = useState<TeamMember[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [progress, setProgress] = useState<TaskProgress[]>([])
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [viewMode,    setViewMode]    = useState<ViewMode>('day')
  const [offset,      setOffset]      = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [filterDept,  setFilterDept]  = useState<string>('all')

  /* ─ 데이터 패치 ─────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const [
        { data: mData, error: mErr },
        { data: pData, error: pErr },
        { data: prData, error: prErr },
      ] = await Promise.all([
        supabase.from('team_members').select('*').order('name'),
        supabase.from('projects').select('*').eq('is_archived', false),
        supabase.from('task_progress').select('*'),
      ])
      const err = mErr || pErr || prErr
      if (err) {
        console.error('[Members] fetch error:', err)
        setFetchError(`${err.message} (code: ${err.code})`)
      }
      setMembers(sortMembers(mData ?? []))
      setProjects(pData ?? [])
      setProgress(prData ?? [])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[Members] unexpected error:', e)
      setFetchError(`예상치 못한 오류: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll() }, [fetchAll])

  /* ─ Computed ────────────────────────────────── */
  const periods       = useMemo(() => generatePeriods(viewMode, offset), [viewMode, offset])
  const activeMembers = useMemo(() =>
    members.filter(m => m.is_active && (filterDept === 'all' || m.department === filterDept)),
    [members, filterDept]
  )
  const activeDepts = useMemo(() => {
    const depts = [...new Set(members.filter(m => m.is_active).map(m => m.department))]
    return depts.sort()
  }, [members])

  /** 뷰 전환 시 offset 초기화 */
  const switchView = (mode: ViewMode) => { setViewMode(mode); setOffset(0) }

  /* ─ 헤더-바디 수평 스크롤 동기화 ── */
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef   = useRef<HTMLDivElement>(null)

  const syncHeaderScroll = useCallback(() => {
    if (headerScrollRef.current && bodyScrollRef.current) {
      headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft
    }
  }, [])

  /* ─ 헤더 기간 라벨 ──────────────────────────── */
  const periodRangeLabel = useMemo(() => {
    if (!periods.length) return ''
    const first = periods[0], last = periods[periods.length - 1]
    if (viewMode === 'day')   return format(first.start, 'yyyy년 M월 d일', { locale: ko }) + ' 주'
    if (viewMode === 'week')  return `${format(first.start, 'M월', { locale: ko })} – ${format(last.end, 'M월', { locale: ko })}`
    return `${format(first.start, 'yyyy년 M월', { locale: ko })} – ${format(last.end, 'yyyy년 M월', { locale: ko })}`
  }, [periods, viewMode])

  /* ─ Render ──────────────────────────────────── */
  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-5">
        {/* 타이틀 + 우측 컨트롤 한 줄 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">👥 멤버별 작업 현황</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              활성 멤버 {activeMembers.length}명
              {filterDept !== 'all' && ` (${filterDept})`}
              {periodRangeLabel && ` · ${periodRangeLabel}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* 부서 필터 — DeptBadge 스타일, 고정 순서 */}
            {(['all', 'PM', 'BE', 'FE', 'Design', 'Oth'] as string[])
              .filter(d => d === 'all' || activeDepts.includes(d as Department))
              .map(d => {
                const s = DEPT_STYLE[d]
                const isActive = filterDept === d
                return (
                  <button
                    key={d}
                    onClick={() => setFilterDept(d)}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-all cursor-pointer"
                    style={
                      d === 'all'
                        ? isActive
                          ? { backgroundColor: '#3b82f6', border: '1px solid #3b82f6', color: '#fff' }
                          : { backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', color: '#374151' }
                        : isActive
                          ? { backgroundColor: s.bg, border: `2px solid ${s.border}`, color: s.text, fontWeight: 700 }
                          : { backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.text }
                    }
                  >
                    {d === 'all' ? '전체' : d}
                  </button>
                )
              })}
            {/* 뷰 토글 */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5 ml-[10px]">
              {(['day', 'week', 'month'] as ViewMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => switchView(m)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    viewMode === m
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m === 'day' ? '일' : m === 'week' ? '주' : '월'}
                </button>
              ))}
            </div>
            {/* 기간 네비 */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setOffset(o => o - 1)}
                className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 cursor-pointer"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setOffset(0)}
                className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 cursor-pointer"
              >
                현재
              </button>
              <button
                onClick={() => setOffset(o => o + 1)}
                className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 cursor-pointer"
              >
                <ChevronRight size={15} />
              </button>
            </div>
            {/* 새로고침 */}
            <button
              onClick={fetchAll}
              className="p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            {/* 멤버 설정 */}
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 font-medium cursor-pointer"
            >
              <Settings size={14} /> 멤버 설정
            </button>
          </div>
        </div>
      </div>

      {/* 진단 바 */}
      <div className="mb-4 text-xs bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-4 text-gray-500">
        <span>상태: <b className={loading ? 'text-yellow-600' : fetchError ? 'text-red-600' : 'text-green-600'}>{loading ? '로딩중' : fetchError ? '오류' : '완료'}</b></span>
        <span>멤버: <b className="text-gray-700">{members.length}</b></span>
        <span>프로젝트: <b className="text-gray-700">{projects.length}</b></span>
        <span>진행기록: <b className="text-gray-700">{progress.length}</b></span>
        {fetchError && <span className="text-red-500 flex-1 truncate">오류: {fetchError}</span>}
      </div>

      {/* 로딩 / 에러 */}
      {fetchError ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="text-red-500 text-sm font-medium">⚠️ 데이터를 불러오지 못했습니다</div>
          <div className="text-red-400 text-xs bg-red-50 border border-red-200 rounded px-4 py-2 max-w-lg text-center">
            {fetchError}
          </div>
          <button
            onClick={fetchAll}
            className="mt-2 px-4 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
          >
            다시 시도
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCw size={22} className="animate-spin mr-2" /> 불러오는 중...
        </div>
      ) : activeMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
          <span className="text-4xl">👥</span>
          <p className="text-sm">등록된 활성 멤버가 없습니다.</p>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer"
          >
            <Plus size={14} /> 멤버 추가
          </button>
        </div>
      ) : (
        /* ── 그리드 ── */
        <div
          className="bg-white rounded-2xl border border-gray-300 shadow-sm"
          style={{ overflow: 'clip' }}
        >
          {/* ── 고정 헤더 (sticky) ── */}
          <div className="sticky top-0 z-30">
            <div ref={headerScrollRef} style={{ overflowX: 'hidden' }}>
              <div style={{ minWidth: 200 + periods.length * 250 }}>
                <div className="flex border-b border-gray-300 bg-gray-50">
                  <div
                    className="sticky left-0 z-20 bg-gray-50 border-r border-gray-300 px-4 py-3 flex-shrink-0"
                    style={{ width: 200 }}
                  >
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">멤버</span>
                  </div>
                  {periods.map(p => (
                    <div
                      key={p.key}
                      className={`flex-shrink-0 px-4 py-3 border-r border-gray-300 last:border-r-0 ${
                        p.isCurrent ? 'bg-blue-50' : ''
                      }`}
                      style={{ width: 250 }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-bold ${p.isCurrent ? 'text-blue-600' : 'text-gray-700'}`}>
                          {p.label}
                        </span>
                        {p.isCurrent && (
                          <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-semibold">
                            현재
                          </span>
                        )}
                      </div>
                      <div className={`text-xs mt-0.5 ${p.isCurrent ? 'text-blue-400' : 'text-gray-400'}`}>
                        {p.sublabel}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── 스크롤 바디 ── */}
          <div
            ref={bodyScrollRef}
            style={{ overflowX: 'auto' }}
            onScroll={syncHeaderScroll}
          >
          <div style={{ minWidth: 200 + periods.length * 250 }}>

            {/* 멤버 행들 */}
            {activeMembers.map((member, mi) => {
              const rowProjects = periods.map(p =>
                getProjectsForMember(member, p, projects, progress)
              )
              const totalProjects = rowProjects.reduce((s, arr) => s + arr.filter(i => i.kind === 'project').length, 0)
              const totalDR       = rowProjects.reduce((s, arr) => s + arr.filter(i => i.kind === 'dr').length, 0)
              const totalTasks    = totalProjects + totalDR

              return (
                <div
                  key={member.id}
                  className={`flex border-b border-gray-200 last:border-b-0 hover:bg-gray-50/40 transition-colors ${
                    mi % 2 === 1 ? 'bg-gray-50/20' : ''
                  }`}
                >
                  {/* 멤버 정보 고정 열 */}
                  <div
                    className="sticky left-0 z-10 bg-inherit border-r border-gray-300 px-4 py-3 flex items-start gap-3 flex-shrink-0"
                    style={{ width: 200, background: mi % 2 === 1 ? '#fafafa' : '#fff' }}
                  >
                    <MemberAvatar member={member} size={38} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-sm font-bold text-gray-800">{member.name}</span>
                      </div>
                      <DeptBadge dept={member.department} />
                      <div className={`mt-1.5 text-[11px] ${totalTasks > 0 ? 'text-gray-400' : 'text-gray-300'}`}>
                        {totalTasks > 0 ? `작업 ${totalTasks}건` : '이 기간 작업 없음'}
                      </div>
                    </div>
                  </div>

                  {/* 기간별 태스크 셀 */}
                  {periods.map((p, pi) => {
                    const tasks = rowProjects[pi]
                    const projectItems = tasks.filter(i => i.kind === 'project')
                    const drItems      = tasks.filter(i => i.kind === 'dr')
                    return (
                      <div
                        key={p.key}
                        className={`flex-shrink-0 px-3 py-2.5 border-r border-gray-200 last:border-r-0 align-top ${
                          p.isCurrent ? 'bg-blue-50/30' : ''
                        }`}
                        style={{ width: 250, minHeight: 52 }}
                      >
                        {tasks.length > 0 ? (
                          <>
                            {/* 카운트 요약 */}
                            <div className="flex items-center justify-end gap-1.5 mb-1.5">
                              {projectItems.length > 0 && (
                                <span className="text-[11px] font-semibold text-gray-500">
                                  Proj. {projectItems.length}
                                </span>
                              )}
                              {projectItems.length > 0 && drItems.length > 0 && (
                                <span className="text-[10px] text-gray-300">/</span>
                              )}
                              {drItems.length > 0 && (
                                <span className="text-[11px] font-semibold text-gray-500">
                                  DR {drItems.length}
                                </span>
                              )}
                            </div>
                            {projectItems.map((item) => (
                              <ProjectChip
                                key={item.project.id}
                                project={item.project}
                                parentName={item.parentName}
                                kind="project"
                              />
                            ))}
                            {drItems.length > 0 && projectItems.length > 0 && (
                              <div className="border-t border-dashed border-gray-100 my-1" />
                            )}
                            {drItems.map((item) => (
                              <ProjectChip
                                key={item.project.id}
                                project={item.project}
                                parentName={item.parentName}
                                kind="dr"
                              />
                            ))}
                          </>
                        ) : (
                          <div className="h-8 flex items-center">
                            <span className="text-xs text-gray-200">—</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* 비활성 멤버 요약 행 */}
            {members.filter(m => !m.is_active).length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center -space-x-1.5">
                  {members.filter(m => !m.is_active).slice(0, 5).map(m => (
                    <MemberAvatar key={m.id} member={m} size={22} />
                  ))}
                </div>
                <span className="text-xs text-gray-400">
                  비활성 멤버 {members.filter(m => !m.is_active).length}명 숨겨짐 ·{' '}
                  <button
                    onClick={() => setShowSettings(true)}
                    className="underline hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    설정에서 관리
                  </button>
                </span>
              </div>
            )}
          </div>
          </div>
        </div>
      )}


      {/* 멤버 설정 모달 */}
      {showSettings && (
        <MemberSettingModal
          members={members}
          onChange={next => setMembers(sortMembers(next))}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
