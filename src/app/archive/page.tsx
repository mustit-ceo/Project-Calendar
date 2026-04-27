'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Project, TaskProgress, RetroEntry } from '@/lib/types'
import { PROJECT_CATEGORIES } from '@/lib/utils'
import { RefreshCw, X } from 'lucide-react'

/* ── 부서 색상 (inline style 방식) ──────────────── */
const DEPT_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  PM:     { bg: '#dae9f8', border: '#aed0ef', text: '#1d4ed8' },
  BE:     { bg: '#fbe2d5', border: '#f5c4a8', text: '#c2410c' },
  FE:     { bg: '#daf2d0', border: '#ade59a', text: '#15803d' },
  Design: { bg: '#f2ceef', border: '#e4a0df', text: '#a21caf' },
  Oth:    { bg: '#d9d9d9', border: '#b8b8b8', text: '#374151' },
}
const DEPT_ORDER = ['PM', 'BE', 'FE', 'Design', 'Oth']

/* ── 날짜 유틸 ──────────────────────────────────── */
function DaysLabel({ days }: { days: number }) {
  return (
    <span>
      <span className="text-sm font-semibold text-gray-700">{days}</span>
      <span className="text-sm font-normal" style={{ color: '#999999' }}> D</span>
    </span>
  )
}

/* ── 프로젝트 트리 전체 ID 수집 ─────────────────── */
function getAllIds(rootId: string, allProjects: Project[]): string[] {
  const result: string[] = [rootId]
  const queue = [rootId]
  while (queue.length) {
    const cur = queue.shift()!
    allProjects
      .filter(p => p.parent_id === cur)
      .forEach(c => { result.push(c.id); queue.push(c.id) })
  }
  return result
}

/* ── 시작일자 계산: 가장 빠른 progress_date ─────── */
function calcStartDate(ids: string[], progress: TaskProgress[]): string | null {
  const dates = progress
    .filter(r => ids.includes(r.project_id))
    .map(r => r.progress_date)
    .sort()
  return dates.length > 0 ? dates[0] : null
}

/* ── 소요기간 계산: LTS 일자 - 시작일자 (달력일 기준) ── */
function calcDuration(startDate: string | null, ltsDate: string | null): number | null {
  if (!startDate || !ltsDate) return null
  const diff = Math.round(
    (new Date(ltsDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  )
  return diff >= 0 ? diff : null
}

/* ── 부서별 소요기간 계산: 실제 진행일자 수 ───── */
interface DeptDuration {
  dept: string
  days: number
}
function calcDeptDurations(ids: string[], allProjects: Project[], progress: TaskProgress[]): DeptDuration[] {
  const deptDates: Record<string, Set<string>> = {}
  for (const id of ids) {
    const proj = allProjects.find(p => p.id === id)
    const dept = proj?.department
    if (!dept) continue
    const dates = progress.filter(r => r.project_id === id).map(r => r.progress_date)
    if (!dates.length) continue
    if (!deptDates[dept]) deptDates[dept] = new Set()
    dates.forEach(d => deptDates[dept].add(d))
  }
  return DEPT_ORDER
    .filter(d => deptDates[d]?.size > 0)
    .map(d => ({ dept: d, days: deptDates[d].size }))
}

/* ── 회고 모달 ───────────────────────────────────── */
function RetroModal({
  project,
  allProjects,
  onClose,
  onSaved,
}: {
  project: Project
  allProjects: Project[]
  onClose: () => void
  onSaved: (entries: RetroEntry[]) => void
}) {
  const supabase = createClient()

  const ids = getAllIds(project.id, allProjects)
  const involvedDepts = DEPT_ORDER.filter(dept =>
    ids.some(id => allProjects.find(p => p.id === id)?.department === dept)
  )
  const deptList = involvedDepts.length > 0 ? involvedDepts : DEPT_ORDER

  const [entries, setEntries] = useState<RetroEntry[]>(() => {
    const saved = project.retrospective ?? []
    // 기존 저장값 기준으로 초기화, 없는 부서는 빈 comment로 추가
    const map = new Map(saved.map(e => [e.dept, e.comment]))
    return deptList.map(dept => ({ dept, comment: map.get(dept) ?? '' }))
  })

  function updateComment(dept: string, comment: string) {
    setEntries(prev => prev.map(e => e.dept === dept ? { ...e, comment } : e))
  }

  function handleSave() {
    const toSave = entries.filter(e => e.comment.trim())
    supabase.from('projects').update({ retrospective: toSave }).eq('id', project.id).then()
    onSaved(toSave)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-gray-800">회고</span>
            <span className="text-xs text-gray-400 truncate">{project.name}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {entries.map(entry => {
            const s = DEPT_STYLE[entry.dept] ?? DEPT_STYLE.Oth
            return (
              <div key={entry.dept}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
                  >
                    {entry.dept}
                  </span>
                </div>
                <textarea
                  value={entry.comment}
                  onChange={e => updateComment(entry.dept, e.target.value)}
                  placeholder="회고 내용을 입력하세요..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>
            )
          })}
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-2 px-5 py-4 border-t bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────── */
export default function ArchivePage() {
  const supabase = createClient()
  const router = useRouter()
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [progress,    setProgress]    = useState<TaskProgress[]>([])
  const [loading,     setLoading]     = useState(true)
  const [retroProject, setRetroProject] = useState<Project | null>(null)

  function handleRetroSaved(projectId: string, entries: RetroEntry[]) {
    setAllProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, retrospective: entries } : p
    ))
    setRetroProject(null)
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: pData }, { data: prData }] = await Promise.all([
      supabase
        .from('projects')
        .select('*')
        .order('lts_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase.from('task_progress').select('*'),
    ])
    setAllProjects(pData ?? [])
    setProgress(prData ?? [])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll() }, [fetchAll])

  /* ── 완료 루트 프로젝트 (프로젝트 카테고리만) — 시작일자 오름차순 ── */
  const rootCompleted = useMemo(() => {
    const list = allProjects.filter(p =>
      !p.parent_id &&
      p.status === '완료' &&
      PROJECT_CATEGORIES.includes(p.category)
    )
    return list.sort((a, b) => {
      const startA = calcStartDate(getAllIds(a.id, allProjects), progress) ?? ''
      const startB = calcStartDate(getAllIds(b.id, allProjects), progress) ?? ''
      if (!startA && !startB) return 0
      if (!startA) return 1
      if (!startB) return -1
      return startA.localeCompare(startB)
    })
  }, [allProjects, progress])

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">✅ 완료 아카이브</h1>
          <p className="text-sm text-gray-500 mt-1">
            완료된 프로젝트 <span className="font-semibold text-gray-700">{rootCompleted.length}건</span>
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCw size={24} className="animate-spin mr-2" /> 불러오는 중...
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: 400 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 300 }} />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">프로젝트</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3">카테고리</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3">시작일자</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3">LTS 일자</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3">프로젝트 소요기간</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3">실 작업기간</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3">회고</th>
              </tr>
            </thead>
            <tbody>
              {rootCompleted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                    완료된 프로젝트가 없습니다.
                  </td>
                </tr>
              ) : rootCompleted.map(p => {
                const ids       = getAllIds(p.id, allProjects)
                const startDate = calcStartDate(ids, progress)
                const duration  = calcDuration(startDate, p.lts_date ?? null)
                const deptDurs  = calcDeptDurations(ids, allProjects, progress)

                return (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-blue-50/40 transition-colors cursor-pointer"
                    onClick={() => router.push(`/calendar?task=${p.id}`)}
                    title="캘린더에서 보기"
                  >
                    {/* 프로젝트명 */}
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-sm text-gray-900">{p.name}</span>
                      {p.notes && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{p.notes}</p>
                      )}
                    </td>

                    {/* 카테고리 */}
                    <td className="py-3.5 px-3">
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {p.category}
                      </span>
                    </td>

                    {/* 시작일자 */}
                    <td className="py-3.5 px-3 text-center">
                      {startDate ? (
                        <span className="text-xs font-medium text-gray-700">
                          {startDate}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* LTS 일자 */}
                    <td className="py-3.5 px-3 text-center">
                      {p.lts_date ? (
                        <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                          {p.lts_date}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* 프로젝트 소요기간 */}
                    <td className="py-3.5 px-3 text-center">
                      {duration !== null ? (
                        <DaysLabel days={duration} />
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* 실 작업기간 — 부서 위, 작업일수 아래 (가로 배치) */}
                    <td className="py-3.5 px-3">
                      {deptDurs.length === 0 ? (
                        <span className="text-xs text-gray-400">-</span>
                      ) : (
                        <div className="flex items-stretch justify-center divide-x divide-gray-200">
                          {deptDurs.map(dd => {
                            const s = DEPT_STYLE[dd.dept] ?? DEPT_STYLE.Oth
                            return (
                              <div key={dd.dept} className="flex flex-col items-center gap-1 px-2.5">
                                <span
                                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
                                >
                                  {dd.dept}
                                </span>
                                <span className="text-sm font-semibold text-gray-700">{dd.days}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </td>

                    {/* 회고 */}
                    <td
                      className="py-3.5 px-3 cursor-pointer group/retro"
                      onClick={(e) => { e.stopPropagation(); setRetroProject(p) }}
                      title="회고 작성"
                    >
                      {p.retrospective?.filter(e => e.comment).length ? (
                        <div className="flex flex-col gap-1.5">
                          {p.retrospective.filter(e => e.comment).map(e => {
                            const s = DEPT_STYLE[e.dept] ?? DEPT_STYLE.Oth
                            return (
                              <div key={e.dept} className="flex items-start gap-1.5">
                                <span
                                  className="text-[10px] font-semibold px-1 py-0.5 rounded flex-shrink-0 mt-0.5"
                                  style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
                                >
                                  {e.dept}
                                </span>
                                <span className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{e.comment}</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 group-hover/retro:text-blue-400 transition-colors">
                          + 작성
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 회고 모달 */}
      {retroProject && (
        <RetroModal
          project={retroProject}
          allProjects={allProjects}
          onClose={() => setRetroProject(null)}
          onSaved={entries => handleRetroSaved(retroProject.id, entries)}
        />
      )}
    </div>
  )
}
