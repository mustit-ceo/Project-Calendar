'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NextUp, BusinessType } from '@/lib/types'
import { RefreshCw, Plus, Pencil, Trash2, GripVertical } from 'lucide-react'

const BUSINESS_TYPES: BusinessType[] = ['거래액', '고객경험', '생산성', '기타']

const BUSINESS_TYPE_COLORS: Record<string, string> = {
  '거래액': 'bg-blue-100 text-blue-800',
  '고객경험': 'bg-green-100 text-green-800',
  '생산성': 'bg-purple-100 text-purple-800',
  '기타': 'bg-gray-100 text-gray-700',
}

interface NextUpFormProps {
  item?: Partial<NextUp>
  onClose: () => void
  onSave: () => void
}

function NextUpForm({ item, onClose, onSave }: NextUpFormProps) {
  const supabase = createClient()
  const isEdit = !!item?.id
  const [form, setForm] = useState({
    name: item?.name ?? '',
    business_type: item?.business_type ?? '거래액' as BusinessType,
    initiator: item?.initiator ?? '',
    planned_start: item?.planned_start ?? '',
    lts_target: item?.lts_target ?? '',
    assignee: item?.assignee ?? '',
    notes: item?.notes ?? '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEdit) {
      await supabase.from('next_up').update(form).eq('id', item!.id!)
    } else {
      await supabase.from('next_up').insert(form)
    }
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'NEXT UP 수정' : 'NEXT UP 추가'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">프로젝트명 *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">구분</label>
              <select value={form.business_type} onChange={e => setForm(f => ({ ...f, business_type: e.target.value as BusinessType }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {BUSINESS_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">발의</label>
              <input value={form.initiator} onChange={e => setForm(f => ({ ...f, initiator: e.target.value }))}
                placeholder="OMD, PM, CEO..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">착수 예정</label>
              <input value={form.planned_start} onChange={e => setForm(f => ({ ...f, planned_start: e.target.value }))}
                placeholder="4월, 미정..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LTS 목표</label>
              <input value={form.lts_target} onChange={e => setForm(f => ({ ...f, lts_target: e.target.value }))}
                placeholder="1Q, 2Q..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">담당자</label>
            <input value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
              취소
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer">
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function NextUpPage() {
  const supabase = createClient()
  const [items, setItems] = useState<NextUp[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<NextUp | null>(null)

  // 드래그 순서 변경
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overPos, setOverPos] = useState<'above' | 'below'>('above')
  const dragHandleDownRef = useRef(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('next_up').select('*').order('sort_order').order('created_at')
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('next_up').delete().eq('id', id)
    fetchItems()
  }

  async function handleReorder(draggedId: string, targetId: string, position: 'above' | 'below') {
    if (draggedId === targetId) return
    const dragIdx = items.findIndex(i => i.id === draggedId)
    const tgtIdx  = items.findIndex(i => i.id === targetId)
    if (dragIdx < 0 || tgtIdx < 0) return

    const rest = items.filter(i => i.id !== draggedId)
    const targetIdxInRest = rest.findIndex(i => i.id === targetId)
    if (targetIdxInRest < 0) return
    const insertAt = position === 'above' ? targetIdxInRest : targetIdxInRest + 1
    const dragged = items[dragIdx]
    rest.splice(insertAt, 0, dragged)

    // sort_order 재배정
    const reordered = rest.map((it, idx) => ({ ...it, sort_order: idx * 10 }))
    setItems(reordered)
    await Promise.all(
      reordered.map(it => supabase.from('next_up').update({ sort_order: it.sort_order }).eq('id', it.id))
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🚀 NEXT UP</h1>
          <p className="text-sm text-gray-500 mt-1">착수 예정 프로젝트 백로그</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchItems} className="p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer">
            <Plus size={16} /> 추가
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCw size={24} className="animate-spin mr-2" />불러오는 중...
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-center text-xs font-semibold text-gray-400 uppercase py-3 px-2 w-16">#</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-4">구분</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-3">프로젝트</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-3">발의</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-3">착수 예정</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-3">LTS 목표</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-3">담당자</th>
                <th className="py-3 px-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400 text-sm">등록된 항목이 없습니다.</td></tr>
              ) : items.map((item, idx) => {
                const isDragging = dragId === item.id
                const isOver     = overId === item.id && dragId && dragId !== item.id
                return (
                <tr
                  key={item.id}
                  draggable
                  onDragStart={e => {
                    if (!dragHandleDownRef.current) { e.preventDefault(); return }
                    dragHandleDownRef.current = false
                    setDragId(item.id)
                    e.dataTransfer.effectAllowed = 'move'
                    const ghost = document.createElement('div')
                    ghost.style.cssText = 'position:fixed;top:-9999px'
                    document.body.appendChild(ghost)
                    e.dataTransfer.setDragImage(ghost, 0, 0)
                    setTimeout(() => document.body.removeChild(ghost), 0)
                  }}
                  onDragOver={e => {
                    if (!dragId || dragId === item.id) return
                    e.preventDefault()
                    const rect = e.currentTarget.getBoundingClientRect()
                    const above = e.clientY < rect.top + rect.height / 2
                    setOverId(item.id)
                    setOverPos(above ? 'above' : 'below')
                  }}
                  onDrop={() => {
                    if (dragId && dragId !== item.id) {
                      handleReorder(dragId, item.id, overPos)
                    }
                    setDragId(null); setOverId(null)
                  }}
                  onDragEnd={() => { setDragId(null); setOverId(null); dragHandleDownRef.current = false }}
                  className={`border-b border-gray-100 hover:bg-gray-50 group transition-opacity ${isDragging ? 'opacity-40' : ''} ${
                    isOver && overPos === 'above' ? 'border-t-2 border-t-blue-400' : ''
                  } ${isOver && overPos === 'below' ? 'border-b-2 border-b-blue-400' : ''}`}
                >
                  <td className="py-3 px-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={() => { dragHandleDownRef.current = true }}
                        onMouseUp={() => { dragHandleDownRef.current = false }}
                        title="드래그하여 순서 변경"
                      >
                        <GripVertical size={14} />
                      </button>
                      <span className="text-xs text-gray-400 tabular-nums w-5 text-right">{idx + 1}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {item.business_type && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${BUSINESS_TYPE_COLORS[item.business_type] ?? ''}`}>
                        {item.business_type}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="py-3 px-3 text-xs text-gray-600">{item.initiator || '-'}</td>
                  <td className="py-3 px-3 text-xs text-gray-600">{item.planned_start || '-'}</td>
                  <td className="py-3 px-3 text-xs font-medium text-indigo-700">{item.lts_target || '-'}</td>
                  <td className="py-3 px-3 text-xs text-gray-600">{item.assignee || '-'}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => setEditItem(item)} className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-400 hover:text-red-600 rounded cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <NextUpForm onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); fetchItems() }} />}
      {editItem && <NextUpForm item={editItem} onClose={() => setEditItem(null)} onSave={() => { setEditItem(null); fetchItems() }} />}
    </div>
  )
}
