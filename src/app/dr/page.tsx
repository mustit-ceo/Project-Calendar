'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Project, Status } from '@/lib/types'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { DR_CATEGORIES, STATUSES, DEPARTMENTS } from '@/lib/utils'
import { getJiraUrl } from '@/lib/utils'
import { DeptBadge } from '@/components/ui/DeptBadge'
import { Plus, RefreshCw, ExternalLink, Pencil, Trash2, Search } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

function StatusText({ status }: { status: string }) {
  const color =
    status === '진행' ? '#00B050' :
    status === '예정' ? '#A6A6A6' : '#000000'
  return <span style={{ color, fontSize: 13 }}>{status}</span>
}

export default function DrPage() {
  const supabase = createClient()
  const [items, setItems] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Project | null>(null)

  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDept,   setFilterDept]   = useState('all')
  const [filterCat,    setFilterCat]    = useState('all')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('projects')
      .select('*')
      .in('category', DR_CATEGORIES)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function handleDelete(item: Project) {
    if (!confirm(`"${item.name}" 을(를) 삭제하시겠습니까?`)) return
    await supabase.from('projects').delete().eq('id', item.id)
    fetchItems()
  }

  async function handleStatusChange(id: string, status: Status) {
    await supabase.from('projects').update({ status }).eq('id', id)
    fetchItems()
  }

  const filtered = items.filter(p => {
    if (filterStatus !== 'all' && p.status     !== filterStatus) return false
    if (filterDept   !== 'all' && p.department !== filterDept)   return false
    if (filterCat    !== 'all' && p.category   !== filterCat)    return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.jira_ticket?.toLowerCase().includes(search.toLowerCase()) &&
        !p.assignees?.some(a => a.includes(search))) return false
    return true
  })

  const isDirty = filterStatus !== 'all' || filterDept !== 'all' || filterCat !== 'all' || search

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 DR 목록</h1>
          <p className="text-sm text-gray-500 mt-1">DR / 유지보수 항목 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchItems}
            className="p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus size={16} /> DR 추가
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="항목명, JIRA, 담당자 검색"
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-60"
          />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none">
          <option value="all">전체 유형</option>
          {DR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none">
          <option value="all">전체 상태</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none">
          <option value="all">전체 부서</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {isDirty && (
          <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterDept('all'); setFilterCat('all') }}
            className="text-xs text-gray-500 hover:text-gray-700 underline">초기화</button>
        )}
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCw size={24} className="animate-spin mr-2" /> 불러오는 중...
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-300 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-500">전체 <b className="text-gray-700">{filtered.length}</b>건</span>
          </div>
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 64 }} />
              <col />
              <col style={{ width: 120 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 72 }} />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-2.5 text-center">유형</th>
                <th className="px-3 py-2.5 text-left">항목명</th>
                <th className="px-3 py-2.5 text-center">JIRA</th>
                <th className="px-3 py-2.5 text-center">상태</th>
                <th className="px-3 py-2.5 text-center">부서</th>
                <th className="px-3 py-2.5 text-center">담당자</th>
                <th className="px-3 py-2.5 text-center">일정</th>
                <th className="px-3 py-2.5 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">항목이 없습니다.</td>
                </tr>
              ) : filtered.map(item => {
                const jiraUrl = getJiraUrl(item.jira_ticket)
                return (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-blue-50/20 group">
                    <td className="px-3 py-2 text-center">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-sm text-gray-800">{item.name}</span>
                      {item.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{item.notes}</p>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {item.jira_ticket && item.jira_ticket !== '-' ? (
                        jiraUrl ? (
                          <a href={jiraUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[13px] text-blue-500 hover:underline">
                            {item.jira_ticket}<ExternalLink size={9} />
                          </a>
                        ) : <span className="text-[13px] text-gray-500">{item.jira_ticket}</span>
                      ) : <span className="text-gray-300 text-sm">-</span>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <select value={item.status}
                        onChange={e => handleStatusChange(item.id, e.target.value as Status)}
                        className="text-[13px] border-0 bg-transparent cursor-pointer focus:outline-none w-full text-center"
                        style={{
                          color: item.status === '진행' ? '#00B050' : item.status === '예정' ? '#A6A6A6' : '#000000'
                        }}>
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-center">
                      {item.department && <DeptBadge dept={item.department} />}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="text-sm text-gray-600">{item.assignees?.join(', ') || '-'}</span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="text-xs text-gray-500">
                        {item.lts_date || '-'}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-center">
                        <button onClick={() => setEditItem(item)} title="수정"
                          className="p-1 text-gray-400 hover:text-gray-700 rounded"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(item)} title="삭제"
                          className="p-1 text-gray-400 hover:text-red-600 rounded"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ProjectForm defaultCategory="DR"
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); fetchItems() }}
        />
      )}
      {editItem && (
        <ProjectForm project={editItem}
          onClose={() => setEditItem(null)}
          onSave={() => { setEditItem(null); fetchItems() }}
        />
      )}
    </div>
  )
}
