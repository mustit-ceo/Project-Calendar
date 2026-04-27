'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Project } from '@/lib/types'
import { ProjectTable } from '@/components/projects/ProjectTable'
import { STATUSES, DEPARTMENTS, CATEGORIES, getCompletedProjectDescendants } from '@/lib/utils'
import { RefreshCw, Search } from 'lucide-react'

export default function ProjectsPage() {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterDept, setFilterDept] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [hideCompleted, setHideCompleted] = useState<boolean>(false)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    setProjects(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const excludedIds = hideCompleted ? getCompletedProjectDescendants(projects) : new Set<string>()
  const filteredProjects = projects.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (filterDept !== 'all' && p.department !== filterDept) return false
    if (filterCategory !== 'all' && p.category !== filterCategory) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.jira_ticket?.toLowerCase().includes(search.toLowerCase()) &&
        !p.assignees?.some(a => a.includes(search))) return false
    if (hideCompleted && excludedIds.has(p.id)) return false
    return true
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 프로젝트 목록</h1>
          <p className="text-sm text-gray-500 mt-1">전체 프로젝트 및 태스크 관리</p>
        </div>
        <button
          onClick={fetchProjects}
          className="p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 검색 & 필터 */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="프로젝트명, JIRA, 담당자 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-60"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">전체 카테고리</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">전체 상태</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">전체 부서</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {/* 완료 제외 토글 */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none ml-1">
          <div
            onClick={() => setHideCompleted(v => !v)}
            className={`w-8 h-4 rounded-full transition-colors relative ${hideCompleted ? 'bg-blue-500' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${hideCompleted ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs text-gray-600">완료 프로젝트 제외</span>
        </label>

        {(filterStatus !== 'all' || filterDept !== 'all' || filterCategory !== 'all' || search) && (
          <button
            onClick={() => { setFilterStatus('all'); setFilterDept('all'); setFilterCategory('all'); setSearch('') }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            초기화
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCw size={24} className="animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : (
        <ProjectTable projects={filteredProjects} onRefresh={fetchProjects} />
      )}
    </div>
  )
}
