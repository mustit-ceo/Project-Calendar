'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Project, TaskProgress, TeamMember, DrItem, DrProgress } from '@/lib/types'
import { WeeklyGantt, type SortMode } from '@/components/calendar/WeeklyGantt'
import { DRGantt } from '@/components/dr/DRGantt'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { DrForm } from '@/components/dr/DrForm'
import {
  STATUSES, DEPARTMENTS, DR_DEPARTMENTS, PROJECT_CATEGORIES,
  getCompletedProjectDescendants,
} from '@/lib/utils'
import { Plus, RefreshCw } from 'lucide-react'

type Tab = 'project' | 'dr'

export default function CalendarPage() {
  const supabase      = createClient()
  const searchParams  = useSearchParams()
  const highlightId   = searchParams.get('task') ?? undefined
  const tabParam      = searchParams.get('tab')

  const [tab, setTab] = useState<Tab>(tabParam === 'dr' ? 'dr' : 'project')

  /* ─ 프로젝트 탭 상태 ─────────────────────────────────────── */
  const [projects,        setProjects]        = useState<Project[]>([])
  const [progressRecords, setProgressRecords] = useState<TaskProgress[]>([])

  /* ─ DR 탭 상태 ───────────────────────────────────────────── */
  const [drItems,        setDrItems]        = useState<DrItem[]>([])
  const [drProgressRecs, setDrProgressRecs] = useState<DrProgress[]>([])

  /* ─ 공통 상태 ────────────────────────────────────────────── */
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [editDrItem,  setEditDrItem]  = useState<DrItem | null>(null)

  /* ─ 프로젝트 탭 필터 ─────────────────────────────────────── */
  const [filterStatus,       setFilterStatus]       = useState('all')
  const [filterDept,         setFilterDept]         = useState('all')
  const [filterCategory,     setFilterCategory]     = useState('all')
  const [hideCompleted,      setHideCompleted]      = useState(true)
  const [hideCompletedTasks, setHideCompletedTasks] = useState(false)
  const [sortMode,           setSortMode]           = useState<SortMode>('manual')

  /* ─ DR 탭 필터 ───────────────────────────────────────────── */
  const [drFilterStatus,  setDrFilterStatus]  = useState('all')
  const [drFilterDept,    setDrFilterDept]    = useState('all')
  const [drHideCompleted, setDrHideCompleted] = useState(true)

  /* ─ Fetch ────────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [
      { data: projectData },
      { data: progressData },
      { data: drData },
      { data: drProgressData },
      { data: memberData },
    ] = await Promise.all([
      supabase.from('projects').select('*').eq('is_archived', false)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('task_progress').select('*'),
      supabase.from('dr_items').select('*').eq('is_archived', false)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('dr_progress').select('*'),
      supabase.from('team_members').select('*').eq('is_active', true)
        .order('name', { ascending: true }),
    ])
    setProjects(projectData ?? [])
    setProgressRecords(progressData ?? [])
    setDrItems(drData ?? [])
    setDrProgressRecs(drProgressData ?? [])
    setTeamMembers(memberData ?? [])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll() }, [fetchAll])

  /* ─ task 파라미터로 진입 시 완료 필터 자동 해제 ─────────── */
  /* (멤버별 작업현황·완료 아카이브 등에서 좌표 이동 시 완료 항목도 보이도록) */
  useEffect(() => {
    if (!highlightId) return
    setHideCompleted(false)
    setDrHideCompleted(false)
  }, [highlightId])

  /* ─ 프로젝트 핸들러 ──────────────────────────────────────── */
  const handleUpdateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...updates } : p)
      if ('sort_order' in updates) {
        return [...updated].sort((a, b) =>
          a.sort_order !== b.sort_order
            ? a.sort_order - b.sort_order
            : a.created_at.localeCompare(b.created_at)
        )
      }
      return updated
    })
  }, [])

  const handleAddProject = useCallback((project: Project) => {
    setProjects(prev => [...prev, project])
  }, [])

  const handleDeleteProjects = useCallback((ids: string[]) => {
    setProjects(prev => prev.filter(p => !ids.includes(p.id)))
  }, [])

  const handleUpdateProgress = useCallback((projectId: string, dates: string[]) => {
    setProgressRecords(prev => {
      const filtered = prev.filter(r => r.project_id !== projectId)
      return [...filtered, ...dates.map((d, i) => ({
        id: `opt-${projectId}-${i}`,
        project_id: projectId,
        progress_date: d,
        label: null,
      }))]
    })
  }, [])

  /* ─ DR 핸들러 ────────────────────────────────────────────── */
  const handleUpdateDrItem = useCallback((id: string, updates: Partial<DrItem>) => {
    setDrItems(prev => {
      const updated = prev.map(it => it.id === id ? { ...it, ...updates } : it)
      if ('sort_order' in updates) {
        return [...updated].sort((a, b) =>
          a.sort_order !== b.sort_order
            ? a.sort_order - b.sort_order
            : a.created_at.localeCompare(b.created_at)
        )
      }
      return updated
    })
  }, [])

  const handleAddDrItem = useCallback((item: DrItem) => {
    setDrItems(prev => [...prev, item])
  }, [])

  const handleDeleteDrItems = useCallback((ids: string[]) => {
    setDrItems(prev => prev.filter(it => !ids.includes(it.id)))
  }, [])

  const handleUpdateDrProgress = useCallback((drId: string, dates: string[]) => {
    setDrProgressRecs(prev => {
      const filtered = prev.filter(r => r.dr_id !== drId)
      return [...filtered, ...dates.map((d, i) => ({
        id: `opt-${drId}-${i}`,
        dr_id: drId,
        progress_date: d,
      }))]
    })
  }, [])

  /* ─ 프로젝트 필터링 ──────────────────────────────────────── */
  const excludedIds = hideCompleted ? getCompletedProjectDescendants(projects) : new Set<string>()

  const excludedTaskIds: Set<string> = (() => {
    if (!hideCompletedTasks) return new Set<string>()
    const excluded = new Set<string>(
      projects.filter(p => p.parent_id !== null && p.status === '완료').map(p => p.id)
    )
    let changed = true
    while (changed) {
      changed = false
      for (const p of projects) {
        if (!excluded.has(p.id) && p.parent_id && excluded.has(p.parent_id)) {
          excluded.add(p.id); changed = true
        }
      }
    }
    return excluded
  })()

  const projectMap = new Map(projects.map(p => [p.id, p]))
  function getRootStatus(p: { parent_id: string | null; id: string; status: string }): string {
    let cur: typeof p = p
    while (cur.parent_id && projectMap.has(cur.parent_id)) cur = projectMap.get(cur.parent_id)!
    return cur.status
  }

  const filteredProjects = projects.filter(p => {
    if (filterStatus   !== 'all' && getRootStatus(p) !== filterStatus) return false
    if (filterDept     !== 'all' && p.department !== filterDept)       return false
    if (filterCategory !== 'all' && p.category   !== filterCategory)   return false
    if (hideCompleted      && excludedIds.has(p.id))     return false
    if (hideCompletedTasks && excludedTaskIds.has(p.id)) return false
    return true
  })

  /* ─ DR 필터링 + 정렬 (progress_date 빠른 순) ───────────────── */
  const drMinDate = new Map<string, string>()
  for (const r of drProgressRecs) {
    const cur = drMinDate.get(r.dr_id)
    if (!cur || r.progress_date < cur) drMinDate.set(r.dr_id, r.progress_date)
  }

  const filteredDrItems = drItems
    .filter(it => {
      if (drFilterStatus !== 'all' && it.status     !== drFilterStatus) return false
      if (drFilterDept   !== 'all' && it.department !== drFilterDept)   return false
      if (drHideCompleted && it.status === '완료')                      return false
      return true
    })
    .sort((a, b) => {
      const aMin = drMinDate.get(a.id) ?? ''
      const bMin = drMinDate.get(b.id) ?? ''
      if (!aMin && !bMin) return 0
      if (!aMin) return 1
      if (!bMin) return -1
      return aMin.localeCompare(bMin)
    })

  const resetFilters   = () => { setFilterStatus('all'); setFilterDept('all'); setFilterCategory('all'); setSortMode('manual') }
  const resetDrFilters = () => { setDrFilterStatus('all'); setDrFilterDept('all') }

  const isDirty   = filterStatus !== 'all' || filterDept !== 'all' || filterCategory !== 'all' || sortMode !== 'manual'
  const isDrDirty = drFilterStatus !== 'all' || drFilterDept !== 'all'

  /* ─ 렌더 ─────────────────────────────────────────────────── */
  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">📅 캘린더</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {tab === 'project' && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer"
            >
              <Plus size={16} /> 프로젝트 추가
            </button>
          )}
          {tab === 'dr' && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer"
            >
              <Plus size={16} /> DR 추가
            </button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-0 mb-5 border-b border-gray-200">
        {([
          { key: 'project', label: '프로젝트' },
          { key: 'dr',      label: 'DR' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); resetFilters(); resetDrFilters() }}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 간트 */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCw size={24} className="animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : tab === 'project' ? (
        <WeeklyGantt
          projects={filteredProjects}
          progressRecords={progressRecords}
          teamMembers={teamMembers}
          rootCount={filteredProjects.filter(p => !p.parent_id).length}
          highlightId={highlightId}
          sortMode={sortMode}
          onUpdateProject={handleUpdateProject}
          onUpdateProgress={handleUpdateProgress}
          onAddProject={handleAddProject}
          onDeleteProjects={handleDeleteProjects}
          filterBar={
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              >
                <option value="all">전체 카테고리</option>
                {PROJECT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              >
                <option value="all">전체 상태</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              >
                <option value="all">전체 부서</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <div className="w-px h-4 bg-gray-200 mx-0.5" />

              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as SortMode)}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                title={sortMode === 'manual' ? '드래그로 순서 변경 가능' : '드래그 순서 변경은 기본 정렬에서만 가능'}
              >
                <option value="manual">기본 (수동 순서)</option>
                <option value="startAsc">시작일 오래된순</option>
                <option value="ltsDesc">LTS 최근일순</option>
              </select>

              <div className="w-px h-4 bg-gray-200 mx-0.5" />

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <div
                  onClick={() => setHideCompleted(v => !v)}
                  className={`w-7 h-3.5 rounded-full transition-colors relative flex-shrink-0 ${hideCompleted ? 'bg-blue-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-transform ${hideCompleted ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs text-gray-600 whitespace-nowrap">완료 프로젝트 제외</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <div
                  onClick={() => setHideCompletedTasks(v => !v)}
                  className={`w-7 h-3.5 rounded-full transition-colors relative flex-shrink-0 ${hideCompletedTasks ? 'bg-blue-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-transform ${hideCompletedTasks ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs text-gray-600 whitespace-nowrap">완료 Task 제외</span>
              </label>

              {isDirty && (
                <button onClick={resetFilters} className="text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer whitespace-nowrap">
                  초기화
                </button>
              )}
            </div>
          }
        />
      ) : (
        <DRGantt
          items={filteredDrItems}
          progressRecords={drProgressRecs}
          teamMembers={teamMembers}
          onUpdateItem={handleUpdateDrItem}
          onUpdateProgress={handleUpdateDrProgress}
          onAddItem={handleAddDrItem}
          onDeleteItems={handleDeleteDrItems}
          filterBar={
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={drFilterStatus}
                onChange={e => setDrFilterStatus(e.target.value)}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
              >
                <option value="all">전체 상태</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={drFilterDept}
                onChange={e => setDrFilterDept(e.target.value)}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
              >
                <option value="all">전체 부서</option>
                {DR_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <div className="w-px h-4 bg-gray-200 mx-0.5" />

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <div
                  onClick={() => setDrHideCompleted(v => !v)}
                  className={`w-7 h-3.5 rounded-full transition-colors relative flex-shrink-0 ${drHideCompleted ? 'bg-indigo-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-transform ${drHideCompleted ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs text-gray-600 whitespace-nowrap">완료 DR 제외</span>
              </label>

              {isDrDirty && (
                <button onClick={resetDrFilters} className="text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer whitespace-nowrap">
                  초기화
                </button>
              )}
            </div>
          }
        />
      )}

      {/* 프로젝트 추가 폼 */}
      {showForm && tab === 'project' && (
        <ProjectForm
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); fetchAll() }}
        />
      )}

      {/* DR 추가 폼 */}
      {showForm && tab === 'dr' && (
        <DrForm
          onClose={() => setShowForm(false)}
          onSave={(item, dates) => {
            setShowForm(false)
            handleAddDrItem(item)
            handleUpdateDrProgress(item.id, dates)
          }}
        />
      )}

      {/* DR 수정 폼 */}
      {editDrItem && (
        <DrForm
          item={editDrItem}
          initialDates={drProgressRecs.filter(r => r.dr_id === editDrItem.id).map(r => r.progress_date)}
          onClose={() => setEditDrItem(null)}
          onSave={(updated, dates) => {
            setEditDrItem(null)
            handleUpdateDrItem(updated.id, updated)
            handleUpdateDrProgress(updated.id, dates)
          }}
        />
      )}
    </div>
  )
}
