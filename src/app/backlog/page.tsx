'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BacklogItem, TeamMember, Status, Department } from '@/lib/types'
import {
  PROJECT_CATEGORIES, DR_CATEGORIES, STATUSES, DEPARTMENTS, getJiraUrl,
} from '@/lib/utils'
import {
  Plus, RefreshCw, Check, X, Star, MoreVertical,
  CalendarPlus, Wrench, Trash2,
} from 'lucide-react'

const ALL_CATEGORIES = [...PROJECT_CATEGORIES, ...DR_CATEGORIES]
const DR_DEPTS = ['BE', 'FE'] as const

/* ── ISO timestamp → YYYY-MM-DD (로컬 시간 기준) ─ */
function fmtIsoDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/* ── 상태 뱃지 색상 ───────────────────────────── */
const STATUS_STYLE: Record<Status, { bg: string; text: string; border: string }> = {
  '완료': { bg: '#dcfce7', text: '#14532d', border: '#86efac' },
  '진행': { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' },
  '예정': { bg: '#fef9c3', text: '#713f12', border: '#fde047' },
  '대기': { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
  '보류': { bg: '#fee2e2', text: '#7f1d1d', border: '#fca5a5' },
}

/* ── 별점 입력 (0~5, 0=미설정) ──────────────────── */
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  const display = hover || value
  return (
    <div
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? 0 : n)}
          onMouseEnter={() => setHover(n)}
          className="cursor-pointer p-0.5 leading-none"
          title={`${n}점`}
        >
          <Star
            size={14}
            className={
              display >= n
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }
          />
        </button>
      ))}
    </div>
  )
}

/* ── 액션 메뉴 (⋮ → 프로젝트로 이동 / DR로 이동 / 삭제) ── */
function ItemActionMenu({
  onMoveToProject, onMoveToDr, onDelete,
}: {
  onMoveToProject: () => void
  onMoveToDr:      () => void
  onDelete:        () => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [open])

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`p-1 rounded hover:bg-gray-100 cursor-pointer transition-colors ${
          open ? 'text-gray-700 bg-gray-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'
        }`}
        title="메뉴"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[150px]">
          <button
            type="button"
            onClick={() => { setOpen(false); onMoveToProject() }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
          >
            <CalendarPlus size={12} /> 프로젝트로 이동
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onMoveToDr() }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-red-50 cursor-pointer flex items-center gap-2"
          >
            <Wrench size={12} /> DR로 이동
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete() }}
            className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 cursor-pointer flex items-center gap-2"
          >
            <Trash2 size={12} /> 삭제
          </button>
        </div>
      )}
    </div>
  )
}

/* ── 부서/담당자 팝업 ─────────────────────────── */
function DeptAssigneePopup({
  anchor, initialDept, initialIds, members, onCommit, onCancel,
}: {
  anchor: DOMRect
  initialDept: string
  initialIds: string[]
  members: TeamMember[]
  onCommit: (dept: string, ids: string[]) => void
  onCancel: () => void
}) {
  const [dept, setDept] = useState(initialDept)
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>()
    initialIds.forEach(v => {
      const m = members.find(m => m.id === v || m.name === v)
      s.add(m ? m.id : v)
    })
    return s
  })
  const dropRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ dept, selected })
  stateRef.current = { dept, selected }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        onCommit(stateRef.current.dept, [...stateRef.current.selected])
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeptChange = (d: string) => {
    setDept(d)
    if (d) setSelected(prev => {
      const next = new Set<string>()
      prev.forEach(id => {
        const m = members.find(m => m.id === id)
        if (m && m.department === d) next.add(id)
      })
      return next
    })
  }

  const filteredMembers = dept ? members.filter(m => m.department === dept) : members
  const estimatedH = 40 + DEPARTMENTS.length * 30 + 8 + filteredMembers.length * 34 + 20
  const dropH = Math.min(estimatedH, 380)
  const spaceBelow = window.innerHeight - anchor.bottom
  const top = spaceBelow >= dropH + 8 ? anchor.bottom + 4 : anchor.top - dropH - 4
  const left = Math.min(anchor.left, window.innerWidth - 210)

  return (
    <div
      ref={dropRef}
      onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
      style={{
        position: 'fixed', top, left, zIndex: 9999, width: 200,
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.14)', overflow: 'hidden',
      }}
    >
      <div className="px-3 pt-2.5 pb-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">부서</p>
        <div className="flex flex-wrap gap-1">
          {(['', ...DEPARTMENTS] as string[]).map(d => (
            <button
              key={d || '__none__'}
              type="button"
              onMouseDown={e => e.stopPropagation()}
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
      <div className="px-3 pb-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
          담당자 {dept && <span className="text-blue-400 normal-case">({dept})</span>}
        </p>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {filteredMembers.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400 text-center">멤버 없음</div>
        )}
        {filteredMembers.map(m => (
          <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.has(m.id)}
              onChange={() => {
                const wasSelected = selected.has(m.id)
                setSelected(prev => {
                  const n = new Set(prev)
                  n.has(m.id) ? n.delete(m.id) : n.add(m.id)
                  return n
                })
                // 부서가 비어 있고 새로 추가하는 경우 → 멤버의 부서 자동 입력
                if (!wasSelected && !dept && m.department) setDept(m.department)
              }}
              className="w-3.5 h-3.5 accent-blue-500 flex-shrink-0"
            />
            <span className="text-xs font-medium text-gray-800 flex-1">{m.name}</span>
          </label>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-gray-100 flex gap-2">
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onCancel}
          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 cursor-pointer"
        >취소</button>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onCommit(dept, [...selected])}
          className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
        >확인</button>
      </div>
    </div>
  )
}

/* ── 셀 편집 유형 ─────────────────────────────── */
type EditField = 'name' | 'jira' | 'status' | 'category' | 'team' | 'date'
interface EditCell { id: string; field: EditField }

/* ── 메인 페이지 ──────────────────────────────── */
export default function BacklogPage() {
  const supabase = createClient()
  const [items, setItems] = useState<BacklogItem[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [editCell, setEditCell] = useState<EditCell | null>(null)
  const [teamAnchor, setTeamAnchor] = useState<DOMRect | null>(null)
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState({ category: '신규기능', name: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const { data: pData, error: pErr } = await supabase
        .from('backlog_items')
        .select('*')
        .eq('is_archived', false)
        .order('sort_order', { ascending: true })

      const { data: mData } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .order('department')
        .order('name')

      if (pErr) {
        console.error('[Backlog] fetch error:', pErr)
        setFetchError(`${pErr.message} (code: ${pErr.code})`)
        setItems([])
      } else {
        setItems(pData ?? [])
      }
      setMembers(mData ?? [])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setFetchError(`예상치 못한 오류: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])

  /* ── 옵티미스틱 업데이트 ──────────────────────── */
  function updateLocal(id: string, updates: Partial<BacklogItem>) {
    setItems(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  /* ── DB 저장 ─────────────────────────────────── */
  async function saveField(id: string, payload: Partial<BacklogItem>) {
    await supabase.from('backlog_items').update(payload).eq('id', id)
  }

  /* ── 셀 커밋 ──────────────────────────────────── */
  function commitText(id: string, field: 'name' | 'jira', raw: string) {
    if (field === 'name') {
      const name = raw.trim()
      if (!name) { setEditCell(null); return }
      updateLocal(id, { name })
      saveField(id, { name })
    } else {
      const jira_ticket = raw.trim() || null
      updateLocal(id, { jira_ticket })
      saveField(id, { jira_ticket })
    }
    setEditCell(null)
  }

  function commitStatus(id: string, status: Status) {
    updateLocal(id, { status })
    saveField(id, { status })
    setEditCell(null)
  }

  function commitCategory(id: string, category: string) {
    updateLocal(id, { category })
    saveField(id, { category })
    setEditCell(null)
  }

  function commitTeam(id: string, dept: string, ids: string[]) {
    const updates = { department: (dept || null) as Department | null, assignees: ids }
    updateLocal(id, updates)
    saveField(id, updates)
    setEditCell(null)
    setTeamAnchor(null)
  }

  function commitImportance(id: string, importance: number) {
    updateLocal(id, { importance })
    saveField(id, { importance })
  }

  function commitDate(id: string, ymd: string) {
    if (!ymd) { setEditCell(null); return }
    // 로컬 자정 기준으로 ISO 변환 (UI 표시도 로컬 기준이라 round-trip 일치)
    const iso = new Date(ymd + 'T00:00:00').toISOString()
    updateLocal(id, { created_at: iso })
    saveField(id, { created_at: iso })
    setEditCell(null)
  }

  /* ── 추가 ──────────────────────────────────────── */
  async function handleAdd() {
    if (!addForm.name.trim()) return
    const nextOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0
    const { data, error } = await supabase
      .from('backlog_items')
      .insert({
        category: addForm.category,
        name: addForm.name.trim(),
        status: '대기' as Status,
        department: null,
        assignees: [],
        jira_ticket: null,
        sort_order: nextOrder,
        importance: 0,
        is_archived: false,
      })
      .select('*')
      .single()
    if (!error && data) {
      setItems(prev => [...prev, data as BacklogItem])
      setAddForm({ category: '신규기능', name: '' })
      setAdding(false)
    }
  }

  /* ── 삭제 ─────────────────────────────────────── */
  async function handleDelete(id: string) {
    if (!confirm('이 항목을 삭제할까요?')) return
    setItems(prev => prev.filter(p => p.id !== id))
    await supabase.from('backlog_items').delete().eq('id', id)
  }

  /* ── 프로젝트로 이동 ─────────────────────────── */
  async function moveToProject(item: BacklogItem) {
    if (!confirm(`"${item.name}"을(를) 프로젝트로 이동할까요?`)) return
    const category = PROJECT_CATEGORIES.includes(item.category) ? item.category : '신규기능'
    const { error } = await supabase.from('projects').insert({
      category,
      name: item.name,
      status: item.status,
      department: item.department,
      assignees: item.assignees ?? [],
      jira_ticket: item.jira_ticket,
      parent_id: null,
      sort_order: 9999,
      is_archived: false,
    })
    if (error) {
      alert(`이동 실패: ${error.message}`)
      return
    }
    await supabase.from('backlog_items').delete().eq('id', item.id)
    setItems(prev => prev.filter(p => p.id !== item.id))
  }

  /* ── DR로 이동 ───────────────────────────────── */
  async function moveToDr(item: BacklogItem) {
    if (!confirm(`"${item.name}"을(를) DR로 이동할까요?`)) return
    const category = DR_CATEGORIES.includes(item.category) ? item.category : 'DR'
    // DR은 BE/FE만 허용
    const dept = (item.department && (DR_DEPTS as readonly string[]).includes(item.department))
      ? item.department
      : null
    const { error } = await supabase.from('dr_items').insert({
      category,
      name: item.name,
      status: item.status,
      department: dept,
      assignees: item.assignees ?? [],
      jira_ticket: item.jira_ticket,
      sort_order: 9999,
      is_archived: false,
    })
    if (error) {
      alert(`이동 실패: ${error.message}`)
      return
    }
    await supabase.from('backlog_items').delete().eq('id', item.id)
    setItems(prev => prev.filter(p => p.id !== item.id))
  }

  /* ── 멤버 이름 ───────────────────────────────── */
  const memberName = (id: string) => members.find(m => m.id === id)?.name ?? id

  /* ── 렌더 ──────────────────────────────────────── */
  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 Backlog</h1>
          <p className="text-sm text-gray-500 mt-1">
            전체 <span className="font-semibold text-gray-700">{items.length}건</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setAdding(true); setEditCell(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer"
          >
            <Plus size={16} /> Backlog 추가
          </button>
        </div>
      </div>

      {fetchError ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="text-red-500 text-sm font-medium">⚠️ 데이터를 불러오지 못했습니다</div>
          <div className="text-red-400 text-xs bg-red-50 border border-red-200 rounded px-4 py-2 max-w-lg text-center">
            {fetchError}
          </div>
          <div className="text-gray-500 text-xs text-center mt-1">
            Supabase SQL Editor에서{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded">create_backlog_items.sql</code>과{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded">migration_backlog_importance.sql</code>을 실행하세요
          </div>
          <button
            onClick={fetchData}
            className="mt-2 px-4 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
          >
            다시 시도
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCw size={24} className="animate-spin mr-2" /> 불러오는 중...
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-visible">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: 110 }} />
              <col style={{ width: 130 }} />
              <col />
              <col style={{ width: 150 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 50 }} />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['생성일', '카테고리', '프로젝트', '중요도', 'JIRA', '상태', '부서', '담당자', ''].map((h, i) => (
                  <th key={i} className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 추가 행 */}
              {adding && (
                <tr className="border-b border-blue-100 bg-blue-50/40">
                  <td className="py-2 px-3 text-center text-xs text-gray-400">자동</td>
                  <td className="py-2 px-3">
                    <select
                      value={addForm.category}
                      onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                      autoFocus
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {ALL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={addForm.name}
                        onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAdd()
                          else if (e.key === 'Escape') { setAdding(false); setAddForm({ category: '신규기능', name: '' }) }
                        }}
                        placeholder="프로젝트명 입력"
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <button onClick={handleAdd} className="w-6 h-6 bg-blue-500 text-white rounded flex items-center justify-center hover:bg-blue-600 cursor-pointer flex-shrink-0">
                        <Check size={12} />
                      </button>
                      <button onClick={() => { setAdding(false); setAddForm({ category: '신규기능', name: '' }) }}
                        className="w-6 h-6 text-gray-400 hover:text-gray-600 rounded flex items-center justify-center cursor-pointer flex-shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  </td>
                  <td colSpan={6} className="py-2 px-3 text-xs text-gray-400">저장 후 나머지 항목을 편집하세요</td>
                </tr>
              )}

              {/* 데이터 없음 */}
              {items.length === 0 && !adding && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400 text-sm">
                    Backlog 항목이 없습니다. 위 버튼으로 추가하세요.
                  </td>
                </tr>
              )}

              {/* 데이터 행 */}
              {items.map(item => {
                const st = STATUS_STYLE[item.status] ?? STATUS_STYLE['대기']
                const jiraUrl = getJiraUrl(item.jira_ticket)
                const assigneeNames = (item.assignees ?? []).map(memberName).join(', ')

                return (
                  <tr
                    key={item.id}
                    className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50/50 group"
                  >
                    {/* 생성일 */}
                    <td
                      className="py-3 px-3 text-center cursor-pointer"
                      onClick={() => setEditCell({ id: item.id, field: 'date' })}
                    >
                      {editCell?.id === item.id && editCell?.field === 'date' ? (
                        <input
                          type="date"
                          autoFocus
                          defaultValue={fmtIsoDate(item.created_at)}
                          onChange={e => commitDate(item.id, e.target.value)}
                          onBlur={e => commitDate(item.id, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Escape') setEditCell(null) }}
                          className="w-full border border-blue-400 rounded px-1.5 py-0.5 text-[13px] focus:outline-none"
                        />
                      ) : (
                        <span className="text-[13px] text-gray-500">{fmtIsoDate(item.created_at) || '-'}</span>
                      )}
                    </td>

                    {/* 카테고리 */}
                    <td
                      className="py-3 px-3 text-center cursor-pointer"
                      onClick={() => setEditCell({ id: item.id, field: 'category' })}
                    >
                      {editCell?.id === item.id && editCell?.field === 'category' ? (
                        <select
                          autoFocus
                          defaultValue={item.category}
                          onChange={e => commitCategory(item.id, e.target.value)}
                          onBlur={e => commitCategory(item.id, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Escape') setEditCell(null) }}
                          className="w-full border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                        >
                          {ALL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {item.category}
                        </span>
                      )}
                    </td>

                    {/* 프로젝트명 */}
                    <td
                      className="py-3 px-3 cursor-pointer"
                      onClick={() => setEditCell({ id: item.id, field: 'name' })}
                    >
                      {editCell?.id === item.id && editCell?.field === 'name' ? (
                        <InlineText
                          initial={item.name}
                          onCommit={v => commitText(item.id, 'name', v)}
                          onCancel={() => setEditCell(null)}
                          className="w-full border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none"
                          placeholder="프로젝트명"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      )}
                    </td>

                    {/* 중요도 (별점) */}
                    <td className="py-3 px-3 text-center">
                      <StarRating
                        value={item.importance ?? 0}
                        onChange={v => commitImportance(item.id, v)}
                      />
                    </td>

                    {/* JIRA — 클릭=편집, Ctrl/Cmd+클릭=링크 */}
                    <td className="py-3 px-3 text-center">
                      {editCell?.id === item.id && editCell?.field === 'jira' ? (
                        <InlineText
                          initial={item.jira_ticket ?? ''}
                          onCommit={v => commitText(item.id, 'jira', v)}
                          onCancel={() => setEditCell(null)}
                          className="w-full border border-blue-400 rounded px-2 py-1 text-xs focus:outline-none"
                          placeholder="PROJ-0000"
                        />
                      ) : (
                        <span
                          className={`inline-block cursor-pointer rounded px-1.5 py-0.5 hover:bg-blue-50 transition-colors ${
                            item.jira_ticket ? 'text-xs text-blue-600' : 'text-xs text-gray-300'
                          }`}
                          onClick={e => {
                            if ((e.ctrlKey || e.metaKey) && jiraUrl) {
                              window.open(jiraUrl, '_blank', 'noopener,noreferrer')
                            } else {
                              setEditCell({ id: item.id, field: 'jira' })
                            }
                          }}
                          title={jiraUrl ? 'Ctrl+클릭으로 링크 열기' : '클릭하여 입력'}
                        >
                          {item.jira_ticket || '-'}
                        </span>
                      )}
                    </td>

                    {/* 상태 */}
                    <td
                      className="py-3 px-3 text-center cursor-pointer"
                      onClick={() => setEditCell({ id: item.id, field: 'status' })}
                    >
                      {editCell?.id === item.id && editCell?.field === 'status' ? (
                        <select
                          autoFocus
                          defaultValue={item.status}
                          onChange={e => commitStatus(item.id, e.target.value as Status)}
                          onBlur={e => commitStatus(item.id, e.target.value as Status)}
                          onKeyDown={e => { if (e.key === 'Escape') setEditCell(null) }}
                          className="w-full border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                        >
                          {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span
                          className="inline-block text-xs px-2 py-0.5 rounded border font-medium"
                          style={{ background: st.bg, color: st.text, borderColor: st.border }}
                        >
                          {item.status}
                        </span>
                      )}
                    </td>

                    {/* 부서 */}
                    <td className="py-3 px-3 text-center">
                      {item.department ? (
                        <span
                          className="inline-block text-[13px] px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80"
                          style={{ background: '#e0e7ff', color: '#3730a3' }}
                          onClick={e => {
                            setEditCell({ id: item.id, field: 'team' })
                            setTeamAnchor((e.currentTarget as HTMLElement).getBoundingClientRect())
                          }}
                        >
                          {item.department}
                        </span>
                      ) : (
                        <span
                          className="text-[13px] text-gray-300 cursor-pointer hover:text-blue-400"
                          onClick={e => {
                            setEditCell({ id: item.id, field: 'team' })
                            setTeamAnchor((e.currentTarget as HTMLElement).getBoundingClientRect())
                          }}
                        >
                          -
                        </span>
                      )}
                    </td>

                    {/* 담당자 */}
                    <td
                      className="py-3 px-3 text-center cursor-pointer"
                      onClick={e => {
                        setEditCell({ id: item.id, field: 'team' })
                        setTeamAnchor((e.currentTarget as HTMLElement).getBoundingClientRect())
                      }}
                    >
                      {assigneeNames ? (
                        <span className="text-[13px] text-gray-700">{assigneeNames}</span>
                      ) : (
                        <span className="text-[13px] text-gray-300 hover:text-blue-400">-</span>
                      )}
                    </td>

                    {/* 액션 메뉴 */}
                    <td className="py-3 px-2 text-center">
                      <ItemActionMenu
                        onMoveToProject={() => moveToProject(item)}
                        onMoveToDr={() => moveToDr(item)}
                        onDelete={() => handleDelete(item.id)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 부서/담당자 팝업 */}
      {editCell?.field === 'team' && teamAnchor && (() => {
        const item = items.find(p => p.id === editCell.id)
        if (!item) return null
        return (
          <DeptAssigneePopup
            anchor={teamAnchor}
            initialDept={item.department ?? ''}
            initialIds={item.assignees ?? []}
            members={members}
            onCommit={(dept, ids) => commitTeam(item.id, dept, ids)}
            onCancel={() => { setEditCell(null); setTeamAnchor(null) }}
          />
        )
      })()}
    </div>
  )
}

/* ── 인라인 텍스트 입력 ── */
function InlineText({
  initial, onCommit, onCancel, className, placeholder,
}: {
  initial: string
  onCommit: (v: string) => void
  onCancel: () => void
  className: string
  placeholder?: string
}) {
  const [val, setVal] = useState(initial)
  return (
    <input
      autoFocus
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onCommit(val)
        else if (e.key === 'Escape') onCancel()
      }}
      onBlur={() => onCommit(val)}
      placeholder={placeholder}
      className={className}
    />
  )
}
