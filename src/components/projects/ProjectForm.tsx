'use client'

import { useState, useEffect } from 'react'
import { Project, Status, Department, TeamMember } from '@/lib/types'
import { PROJECT_CATEGORIES, STATUSES, DEPARTMENTS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { X, Check } from 'lucide-react'
import { ProjectHistory } from './ProjectHistory'
import { ProjectComments } from './ProjectComments'

type FormTab = 'edit' | 'comments' | 'history'

interface ProjectFormProps {
  project?: Partial<Project>
  parentId?: string
  defaultCategory?: string
  isDR?: boolean
  initialTab?: FormTab
  onClose: () => void
  onSave: () => void
}




export function ProjectForm({ project, parentId, defaultCategory, isDR = false, initialTab = 'edit', onClose, onSave }: ProjectFormProps) {
  const supabase = createClient()
  const isEdit = !!project?.id

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  const [form, setForm] = useState({
    category: isDR ? 'DR' : (project?.category ?? defaultCategory ?? '신규기능'),
    name: project?.name ?? '',
    jira_ticket: project?.jira_ticket ?? '',
    status: project?.status ?? '대기' as Status,
    department: (project?.department ?? 'PM') as Department,
    assignees: (project?.assignees ?? []) as string[],
    lts_date: project?.lts_date ?? '',
  })

  // 팀 멤버 로드
  useEffect(() => {
    supabase
      .from('team_members')
      .select('*')
      .eq('is_active', true)
      .order('department')
      .order('name')
      .then(({ data }) => {
        const members = (data ?? []) as TeamMember[]
        setTeamMembers(members)
        // 레거시 이름→ID 변환
        if (project?.assignees?.length) {
          setForm(f => ({
            ...f,
            assignees: project.assignees!.map(idOrName => {
              const m = members.find(m => m.id === idOrName || m.name === idOrName)
              return m ? m.id : idOrName
            }),
          }))
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<FormTab>(initialTab)

  // ── 저장 ─────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)

    const payload = {
      category: form.category,
      name: form.name.trim(),
      jira_ticket: form.jira_ticket.trim() || null,
      status: form.status,
      department: form.department,
      assignees: form.assignees,
      lts_date: form.lts_date || null,
      parent_id: parentId ?? project?.parent_id ?? null,
    }

    if (isEdit) {
      await supabase.from('projects').update(payload).eq('id', project!.id!)
    } else {
      const { data, error } = await supabase
        .from('projects')
        .insert(payload)
        .select('id')
        .single()
      if (error || !data) { setSaving(false); return }
    }

    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-4 pb-0 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? '프로젝트 수정' : parentId ? '하위 태스크 추가' : '프로젝트 추가'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
              <X size={20} />
            </button>
          </div>
          {/* 탭 (편집 모드일 때만) */}
          {isEdit && project?.id && (
            <div className="flex gap-1 -mb-px">
              {([
                { key: 'edit',     label: '수정' },
                { key: 'comments', label: '코멘트' },
                { key: 'history',  label: '변경 이력' },
              ] as const).map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                    activeTab === t.key
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {isEdit && project?.id && activeTab === 'history' && (
          <div className="p-6">
            <ProjectHistory projectId={project.id} />
          </div>
        )}

        {isEdit && project?.id && activeTab === 'comments' && (
          <div className="p-6">
            <ProjectComments projectId={project.id} />
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5"
          style={{ display: (!isEdit || activeTab === 'edit') ? 'block' : 'none' }}
        >
          {/* 카테고리 — 프로젝트 모드에서만 표시 (DR 모드는 자동 'DR' 고정) */}
          {!parentId && !isDR && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PROJECT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* 프로젝트명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              프로젝트명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="프로젝트명 입력"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* JIRA / 상태 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">JIRA 티켓</label>
              <input
                type="text"
                value={form.jira_ticket}
                onChange={e => setForm(f => ({ ...f, jira_ticket: e.target.value }))}
                placeholder="PROJ-0000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* 부서 / 담당자 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">부서</label>
              <select
                value={form.department}
                onChange={e => {
                  const dept = e.target.value as Department
                  // 부서 변경 시 해당 부서 멤버만 남김
                  setForm(f => ({
                    ...f,
                    department: dept,
                    assignees: f.assignees.filter(id =>
                      teamMembers.find(m => m.id === id && m.department === dept)
                    ),
                  }))
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">담당자</label>
              {/* 멀티셀렉트 체크박스 */}
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                {teamMembers
                  .filter(m => m.department === form.department)
                  .length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400">해당 부서 멤버 없음</div>
                ) : (
                  teamMembers
                    .filter(m => m.department === form.department)
                    .map((m, i, arr) => {
                      const selected = form.assignees.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            setForm(f => ({
                              ...f,
                              assignees: selected
                                ? f.assignees.filter(id => id !== m.id)
                                : [...f.assignees, m.id],
                            }))
                          }
                          className={[
                            'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left',
                            i < arr.length - 1 ? 'border-b border-gray-100' : '',
                            selected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700',
                          ].join(' ')}
                        >
                          <span>{m.name}</span>
                          {selected && <Check size={13} className="text-blue-500 flex-shrink-0" />}
                        </button>
                      )
                    })
                )}
              </div>
            </div>
          </div>

          {/* LTS 일자 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LTS 일자</label>
            <input
              type="date"
              value={form.lts_date}
              onChange={e => setForm(f => ({ ...f, lts_date: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
