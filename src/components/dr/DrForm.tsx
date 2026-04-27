'use client'

import { useState, useEffect } from 'react'
import { DrItem, Status, Department, TeamMember } from '@/lib/types'
import { STATUSES, DR_DEPARTMENTS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { X, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const days: (Date | null)[] = []
  for (let i = 0; i < first.getDay(); i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  return days
}
function toYMD(d: Date): string { return format(d, 'yyyy-MM-dd') }
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const PROGRESS_COLOR = '#3B82F6'

interface DrFormProps {
  item?: Partial<DrItem>
  initialDates?: string[]
  onClose: () => void
  onSave: (item: DrItem, dates: string[]) => void
}

export function DrForm({ item, initialDates = [], onClose, onSave }: DrFormProps) {
  const supabase = createClient()
  const isEdit   = !!item?.id
  const today    = new Date()

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [saving, setSaving]           = useState(false)

  const [form, setForm] = useState({
    name:        item?.name        ?? '',
    jira_ticket: item?.jira_ticket ?? '',
    status:      (item?.status     ?? '대기') as Status,
    department:  (item?.department ?? 'BE')   as Department,
    assignees:   (item?.assignees  ?? [])     as string[],
  })

  const [calYear,  setCalYear]  = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(initialDates))

  const calDays     = buildCalendarDays(calYear, calMonth)
  const sortedDates = Array.from(selectedDates).sort()

  function toggleDate(ymd: string) {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(ymd)) next.delete(ymd); else next.add(ymd)
      return next
    })
  }
  function prevCal() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextCal() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  useEffect(() => {
    supabase
      .from('team_members')
      .select('*')
      .eq('is_active', true)
      .in('department', DR_DEPARTMENTS)
      .order('department').order('name')
      .then(({ data }) => {
        const members = (data ?? []) as TeamMember[]
        setTeamMembers(members)
        if (item?.assignees?.length) {
          setForm(f => ({
            ...f,
            assignees: item.assignees!.map(idOrName => {
              const m = members.find(m => m.id === idOrName || m.name === idOrName)
              return m ? m.id : idOrName
            }),
          }))
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)

    const payload = {
      category:    'DR',
      name:        form.name.trim(),
      jira_ticket: form.jira_ticket.trim() || null,
      status:      form.status,
      department:  form.department,
      assignees:   form.assignees,
      notes:       null,
    }

    const dates = Array.from(selectedDates)

    try {
      if (isEdit) {
        const { data } = await supabase
          .from('dr_items').update(payload).eq('id', item!.id!).select('*').single()
        if (data) {
          await supabase.from('dr_progress').delete().eq('dr_id', item!.id!)
          if (dates.length > 0) {
            await supabase.from('dr_progress').insert(
              dates.map(d => ({ dr_id: item!.id!, progress_date: d }))
            )
          }
          onSave(data as DrItem, dates)
        }
      } else {
        const { data } = await supabase
          .from('dr_items').insert({ ...payload, sort_order: 9999 }).select('*').single()
        if (data) {
          if (dates.length > 0) {
            await supabase.from('dr_progress').insert(
              dates.map(d => ({ dr_id: (data as DrItem).id, progress_date: d }))
            )
          }
          onSave(data as DrItem, dates)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'DR 수정' : 'DR 추가'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="DR 제목 입력"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* JIRA / 상태 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">JIRA 티켓</label>
              <input
                type="text"
                value={form.jira_ticket}
                onChange={e => setForm(f => ({ ...f, jira_ticket: e.target.value }))}
                placeholder="PROJ-0000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* 부서 / 담당자 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">부서</label>
              <div className="flex gap-2">
                {DR_DEPARTMENTS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setForm(f => ({
                        ...f,
                        department: d as Department,
                        assignees: f.assignees.filter(id =>
                          teamMembers.find(m => m.id === id && m.department === d)
                        ),
                      }))
                    }}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                      form.department === d
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'text-gray-600 border-gray-300 hover:border-indigo-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">담당자</label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                {teamMembers.filter(m => m.department === form.department).length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400">해당 부서 멤버 없음</div>
                ) : (
                  teamMembers.filter(m => m.department === form.department).map((m, i, arr) => {
                    const selected = form.assignees.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          assignees: selected
                            ? f.assignees.filter(id => id !== m.id)
                            : [...f.assignees, m.id],
                        }))}
                        className={[
                          'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left',
                          i < arr.length - 1 ? 'border-b border-gray-100' : '',
                          selected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700',
                        ].join(' ')}
                      >
                        <span>{m.name}</span>
                        {selected && <Check size={13} className="text-indigo-500 flex-shrink-0" />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* 작업일자 캘린더 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">작업일자</label>
            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={prevCal} className="p-1 rounded hover:bg-gray-200 text-gray-500 cursor-pointer">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-sm font-semibold text-gray-700">{calYear}년 {calMonth + 1}월</span>
                <button type="button" onClick={nextCal} className="p-1 rounded hover:bg-gray-200 text-gray-500 cursor-pointer">
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map(d => (
                  <div key={d} className="text-center text-[11px] font-medium text-gray-400">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {calDays.map((day, i) => {
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
                        'mx-auto flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-all cursor-pointer',
                        isSelected ? 'text-white shadow-sm'
                          : isTd   ? 'ring-2 ring-indigo-400 text-indigo-600'
                          : isSun  ? 'text-red-400 hover:bg-red-50'
                          : isSat  ? 'text-blue-400 hover:bg-blue-50'
                          : 'text-gray-700 hover:bg-gray-200',
                      ].join(' ')}
                      style={isSelected ? { backgroundColor: PROGRESS_COLOR } : undefined}
                    >
                      {day.getDate()}
                    </button>
                  )
                })}
              </div>
              {sortedDates.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 border-t border-gray-200 pt-2 max-h-16 overflow-y-auto">
                  {sortedDates.map(d => {
                    const dt = new Date(d)
                    return (
                      <span
                        key={d}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium text-white cursor-pointer"
                        style={{ backgroundColor: PROGRESS_COLOR }}
                        onClick={() => toggleDate(d)}
                      >
                        {dt.getMonth() + 1}/{dt.getDate()}
                        <X size={9} />
                      </span>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setSelectedDates(new Set())}
                    className="text-[11px] text-gray-400 hover:text-gray-600 px-1 cursor-pointer"
                  >
                    전체삭제
                  </button>
                </div>
              )}
            </div>
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
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
