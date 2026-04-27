'use client'

import { useRef, useState } from 'react'
import { Project, Status } from '@/lib/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DeptBadge } from '@/components/ui/DeptBadge'
import { ProjectForm } from './ProjectForm'
import { getJiraUrl, buildProjectTree, STATUSES } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'

interface ProjectTableProps {
  projects: Project[]
  onRefresh: () => void
}

// ── 드래그 리사이즈 핸들 ──
function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const startX = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startX.current = e.clientX

    const onMove = (ev: MouseEvent) => {
      onResize(ev.clientX - startX.current)
      startX.current = ev.clientX
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
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

// ── 기본 컬럼 너비 ──
const DEFAULT_WIDTHS = {
  name:     240,
  jira:     110,
  status:   80,
  dept:     72,
  assignee: 100,
  schedule: 180,
  action:   80,
}

function ProjectRow({
  project,
  depth,
  colWidths,
  onRefresh,
}: {
  project: Project
  depth: number
  colWidths: typeof DEFAULT_WIDTHS
  onRefresh: () => void
}) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showAddChild, setShowAddChild] = useState(false)
  const hasChildren = project.children && project.children.length > 0
  const jiraUrl = getJiraUrl(project.jira_ticket)

  async function handleDelete() {
    if (!confirm(`"${project.name}" 을(를) 삭제하시겠습니까?`)) return
    await supabase.from('projects').delete().eq('id', project.id)
    onRefresh()
  }

  async function handleStatusChange(status: Status) {
    await supabase.from('projects').update({ status }).eq('id', project.id)
    onRefresh()
  }

  const rowBg = depth === 0 ? 'bg-white' : depth === 1 ? 'bg-gray-50/60' : 'bg-gray-50/30'

  return (
    <>
      <tr className={`border-b border-gray-100 hover:bg-blue-50/30 group ${rowBg}`}>
        {/* 프로젝트명 */}
        <td className="py-1.5 px-3" style={{ width: colWidths.name }}>
          <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 16 }}>
            {hasChildren ? (
              <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 cursor-pointer">
                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            ) : (
              <span className="w-[13px] flex-shrink-0" />
            )}
            {depth === 0 && (
              <span className="text-xs font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                {project.category}
              </span>
            )}
            <span className={`text-sm truncate ${depth === 0 ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
              {depth > 0 && <span className="text-gray-300 mr-1">└</span>}
              {project.name}
            </span>
          </div>
        </td>

        {/* JIRA */}
        <td className="py-1.5 px-2.5 border-l border-gray-100" style={{ width: colWidths.jira }}>
          {project.jira_ticket && project.jira_ticket !== '-' ? (
            jiraUrl ? (
              <a href={jiraUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline truncate max-w-full">
                {project.jira_ticket}<ExternalLink size={9} />
              </a>
            ) : (
              <span className="text-sm text-gray-500 truncate">{project.jira_ticket}</span>
            )
          ) : (
            <span className="text-sm text-gray-300">-</span>
          )}
        </td>

        {/* 상태 */}
        <td className="py-1.5 px-2.5 border-l border-gray-100" style={{ width: colWidths.status }}>
          <select value={project.status} onChange={e => handleStatusChange(e.target.value as Status)}
            className="text-sm border-0 bg-transparent cursor-pointer focus:outline-none w-full">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>

        {/* 부서 */}
        <td className="py-1.5 px-2.5 border-l border-gray-100" style={{ width: colWidths.dept }}>
          {project.department && <DeptBadge dept={project.department} />}
        </td>

        {/* 담당자 */}
        <td className="py-1.5 px-2.5 border-l border-gray-100" style={{ width: colWidths.assignee }}>
          <span className="text-sm text-gray-600 truncate">{project.assignees?.join(', ') || '-'}</span>
        </td>

        {/* LTS 일자 */}
        <td className="py-1.5 px-2.5 border-l border-gray-100" style={{ width: colWidths.schedule }}>
          <span className="text-sm text-gray-500">
            {project.lts_date || '-'}
          </span>
        </td>

        {/* 액션 */}
        <td className="py-1.5 px-2.5 border-l border-gray-100" style={{ width: colWidths.action }}>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setShowAddChild(true)} title="하위 태스크 추가"
              className="p-1 text-gray-400 hover:text-blue-600 rounded cursor-pointer"><Plus size={13} /></button>
            <button onClick={() => setShowForm(true)} title="수정"
              className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"><Pencil size={13} /></button>
            <button onClick={handleDelete} title="삭제"
              className="p-1 text-gray-400 hover:text-red-600 rounded cursor-pointer"><Trash2 size={13} /></button>
          </div>
        </td>
      </tr>

      {showForm && (
        <ProjectForm project={project} onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); onRefresh() }} />
      )}
      {showAddChild && (
        <ProjectForm parentId={project.id} onClose={() => setShowAddChild(false)}
          onSave={() => { setShowAddChild(false); onRefresh() }} />
      )}
      {expanded && hasChildren && project.children!.map(child => (
        <ProjectRow key={child.id} project={child} depth={depth + 1}
          colWidths={colWidths} onRefresh={onRefresh} />
      ))}
    </>
  )
}

export function ProjectTable({ projects, onRefresh }: ProjectTableProps) {
  const [showForm, setShowForm] = useState(false)
  const [widths, setWidths] = useState(DEFAULT_WIDTHS)
  const tree = buildProjectTree(projects)

  function resizeCol(col: keyof typeof DEFAULT_WIDTHS, delta: number) {
    setWidths(w => ({ ...w, [col]: Math.max(60, w[col] + delta) }))
  }

  const cols: { key: keyof typeof DEFAULT_WIDTHS; label: string }[] = [
    { key: 'name',     label: '프로젝트' },
    { key: 'jira',     label: 'JIRA' },
    { key: 'status',   label: '상태' },
    { key: 'dept',     label: '부서' },
    { key: 'assignee', label: '담당자' },
    { key: 'schedule', label: '일정' },
    { key: 'action',   label: '' },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-gray-500">전체 {projects.length}건</p>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer">
          <Plus size={14} /> 프로젝트 추가
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full" style={{ tableLayout: 'fixed', minWidth: Object.values(widths).reduce((a, b) => a + b, 0) }}>
          <colgroup>
            {cols.map(c => <col key={c.key} style={{ width: widths[c.key] }} />)}
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {cols.map(c => (
                <th key={c.key} className="relative text-left text-sm font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-3 select-none">
                  {c.label}
                  {c.key !== 'action' && <ResizeHandle onResize={d => resizeCol(c.key, d)} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tree.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-gray-400 text-sm">
                  프로젝트가 없습니다.
                </td>
              </tr>
            ) : (
              tree.map(project => (
                <ProjectRow key={project.id} project={project} depth={0}
                  colWidths={widths} onRefresh={onRefresh} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ProjectForm onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); onRefresh() }} />
      )}
    </div>
  )
}
