'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Holiday } from '@/lib/types'
import { RefreshCw, Plus, Trash2, X, Check } from 'lucide-react'

const DAY_LABELS_KO = ['일', '월', '화', '수', '목', '금', '토']

function dayOfWeek(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00')
  return DAY_LABELS_KO[d.getDay()]
}

export default function HolidaysPage() {
  const supabase = createClient()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading]   = useState(true)
  const [isAdmin, setIsAdmin]   = useState<boolean | null>(null)
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState({ date: '', name: '' })
  const [error, setError]       = useState<string | null>(null)

  // 관리자 가드
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) { setIsAdmin(false); return }
      const { data } = await supabase
        .from('allowed_users')
        .select('role, is_active')
        .eq('email', user.email)
        .maybeSingle()
      setIsAdmin(data?.role === 'admin' && data?.is_active === true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('holidays').select('*').order('date', { ascending: true })
    setHolidays((data ?? []) as Holiday[])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleAdd() {
    setError(null)
    const ymd = form.date.trim()
    const nm  = form.name.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) { setError('날짜 형식: YYYY-MM-DD'); return }
    if (!nm) { setError('공휴일 이름을 입력해주세요.'); return }
    const { data, error: e } = await supabase
      .from('holidays')
      .insert({ date: ymd, name: nm })
      .select().single()
    if (e) { setError(e.message); return }
    if (data) {
      setHolidays(prev => [...prev, data as Holiday].sort((a, b) => a.date.localeCompare(b.date)))
      setForm({ date: '', name: '' })
      setAdding(false)
    }
  }

  async function handleDelete(h: Holiday) {
    if (!confirm(`${h.date} ${h.name}을(를) 삭제할까요?`)) return
    const { error: e } = await supabase.from('holidays').delete().eq('id', h.id)
    if (e) { alert(`삭제 실패: ${e.message}`); return }
    setHolidays(prev => prev.filter(x => x.id !== h.id))
  }

  // 권한 가드
  if (isAdmin === false) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-gray-400 text-sm">
        관리자 권한이 필요합니다.
      </div>
    )
  }

  // 연도별 그룹화
  const grouped = holidays.reduce<Record<string, Holiday[]>>((acc, h) => {
    const year = h.date.slice(0, 4)
    if (!acc[year]) acc[year] = []
    acc[year].push(h)
    return acc
  }, {})
  const years = Object.keys(grouped).sort()

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📆 공휴일 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            등록된 공휴일은 캘린더·멤버별 작업 현황 간트에서 시각적으로 구분됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setAdding(true); setError(null); setForm({ date: '', name: '' }) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer"
          >
            <Plus size={16} /> 공휴일 추가
          </button>
        </div>
      </div>

      {/* 추가 폼 */}
      {adding && (
        <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">날짜 *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">이름 *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAdd()
                  if (e.key === 'Escape') { setAdding(false); setError(null) }
                }}
                placeholder="예: 신정, 어린이날"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleAdd}
                className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer"
              >
                <Check size={14} /> 저장
              </button>
              <button
                onClick={() => { setAdding(false); setError(null) }}
                className="flex items-center gap-1 px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer"
              >
                <X size={14} /> 취소
              </button>
            </div>
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-1.5">
              {error}
            </p>
          )}
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> 불러오는 중...
        </div>
      ) : holidays.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-12 bg-white border border-gray-200 rounded-xl">
          등록된 공휴일이 없습니다. SQL 마이그레이션을 실행하거나 위 버튼으로 추가하세요.
        </div>
      ) : (
        <div className="space-y-6">
          {years.map(year => (
            <div key={year} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-700">{year}년</h2>
                <span className="text-xs text-gray-400">{grouped[year].length}건</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="text-left px-5 py-2 w-32">날짜</th>
                    <th className="text-center px-3 py-2 w-12">요일</th>
                    <th className="text-left px-3 py-2">이름</th>
                    <th className="px-5 py-2 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {grouped[year].map(h => {
                    const dow = dayOfWeek(h.date)
                    const isWeekend = dow === '일' || dow === '토'
                    return (
                      <tr key={h.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-2.5 text-gray-700 font-mono tabular-nums">{h.date}</td>
                        <td className={`px-3 py-2.5 text-center text-xs font-semibold ${
                          dow === '일' ? 'text-red-500' : dow === '토' ? 'text-blue-500' : 'text-gray-400'
                        }`}>
                          {dow}
                        </td>
                        <td className="px-3 py-2.5 text-gray-800">
                          {h.name}
                          {isWeekend && (
                            <span className="ml-2 text-[10px] text-gray-400">(주말)</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          <button
                            onClick={() => handleDelete(h)}
                            className="p-1 text-gray-300 hover:text-red-500 rounded cursor-pointer"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        주말(토·일)에 해당하는 공휴일은 자동으로 구분 표시됩니다. 음력 공휴일(설날·부처님오신날·추석)은 매년 정확한 양력 날짜를 직접 추가/수정해주세요.
      </p>
    </div>
  )
}
