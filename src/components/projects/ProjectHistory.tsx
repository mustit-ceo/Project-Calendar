'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProjectHistoryEntry, HistoryField } from '@/lib/types'
import {
  Plus, Trash2, Pencil, Clock, Calendar as CalendarIcon, Flag,
} from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Props {
  projectId: string
}

const FIELD_LABEL: Record<HistoryField, string> = {
  status:     '상태',
  start_date: '시작일',
  end_date:   '종료일',
  lts_date:   'LTS 일자',
  progress:   '작업일자',
}

const FIELD_ICON: Record<HistoryField, React.ElementType> = {
  status:     Flag,
  start_date: CalendarIcon,
  end_date:   CalendarIcon,
  lts_date:   CalendarIcon,
  progress:   CalendarIcon,
}

function formatValue(field: HistoryField | null, v: string | null): string {
  if (v === null || v === '') return '없음'
  return v
}

function formatRelative(iso: string): string {
  const then = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return format(then, 'yyyy-MM-dd', { locale: ko })
}

export function ProjectHistory({ projectId }: Props) {
  const supabase = createClient()
  const [entries, setEntries] = useState<ProjectHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('project_history')
        .select('*')
        .eq('project_id', projectId)
        .order('changed_at', { ascending: false })
        .limit(200)
      if (cancelled) return
      if (error) {
        setError(error.message)
        setEntries([])
      } else {
        setEntries((data ?? []) as ProjectHistoryEntry[])
        setError(null)
      }
      setLoading(false)
    }
    run()
    return () => { cancelled = true }
  }, [projectId])

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">불러오는 중...</div>
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
        이력 조회 실패: {error}
        <div className="text-xs text-red-500 mt-1">
          (마이그레이션 SQL 미적용일 수 있습니다)
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return <div className="text-sm text-gray-400 py-8 text-center">변경 이력이 없습니다.</div>
  }

  // 30초 이내에 일어난 같은 종류의 progress 추가/삭제는 한 카드로 묶음
  const items = groupProgressEntries(entries)

  return (
    <div className="space-y-2">
      {items.map(item => {
        if (item.kind === 'group') return <GroupCard key={item.key} item={item} />
        return <SingleCard key={item.entry.id} entry={item.entry} />
      })}
    </div>
  )
}

/* ── 그룹화 ────────────────────────────────────────── */

const GROUP_WINDOW_MS = 30_000  // 30초 이내 + 같은 사용자 + 같은 액션 → 한 그룹

type GroupItem = {
  kind: 'group'
  key: string
  type: 'progress_add' | 'progress_remove'
  dates: string[]
  who: string
  changedAt: string  // 그룹 내 가장 최근 시각
}

type SingleItem = {
  kind: 'single'
  entry: ProjectHistoryEntry
}

type RenderItem = GroupItem | SingleItem

function progressType(e: ProjectHistoryEntry): 'progress_add' | 'progress_remove' | null {
  if (e.action !== 'update' || e.field_name !== 'progress') return null
  if (e.old_value === null && e.new_value !== null) return 'progress_add'
  if (e.new_value === null && e.old_value !== null) return 'progress_remove'
  return null
}

function groupProgressEntries(entries: ProjectHistoryEntry[]): RenderItem[] {
  // entries 는 changed_at DESC (최신 → 과거)
  const out: RenderItem[] = []
  let i = 0
  while (i < entries.length) {
    const e = entries[i]
    const t = progressType(e)
    if (!t) {
      out.push({ kind: 'single', entry: e })
      i++
      continue
    }

    // 인접한 같은 종류·같은 사용자 묶기
    const dates: string[] = []
    const ids: string[] = []
    let lastTs = new Date(e.changed_at).getTime()

    let j = i
    while (j < entries.length) {
      const f = entries[j]
      const ft = progressType(f)
      if (ft !== t) break
      if (f.changed_by_email !== e.changed_by_email) break
      const ts = new Date(f.changed_at).getTime()
      if (lastTs - ts > GROUP_WINDOW_MS) break
      const date = t === 'progress_add' ? f.new_value : f.old_value
      if (date) dates.push(date)
      ids.push(f.id)
      lastTs = ts
      j++
    }

    if (ids.length === 1) {
      out.push({ kind: 'single', entry: e })
      i++
    } else {
      out.push({
        kind: 'group',
        key: ids.join(','),
        type: t,
        dates: [...new Set(dates)].sort(),
        who: e.changed_by_name ?? e.changed_by_email ?? '알 수 없음',
        changedAt: e.changed_at,
      })
      i = j
    }
  }
  return out
}

/* ── 카드 컴포넌트 ─────────────────────────────────── */

function SingleCard({ entry: e }: { entry: ProjectHistoryEntry }) {
  let icon: React.ElementType = Clock
  let label = '변경'
  let color = '#6b7280'
  let bg = '#f3f4f6'

  const isProgressAdd = progressType(e) === 'progress_add'
  const isProgressRemove = progressType(e) === 'progress_remove'

  if (e.action === 'create') {
    icon = Plus; label = '생성됨'; color = '#15803d'; bg = '#dcfce7'
  } else if (e.action === 'delete') {
    icon = Trash2; label = '삭제됨'; color = '#991b1b'; bg = '#fee2e2'
  } else if (isProgressAdd) {
    icon = Plus; label = '작업일자 추가'; color = '#15803d'; bg = '#dcfce7'
  } else if (isProgressRemove) {
    icon = Trash2; label = '작업일자 삭제'; color = '#991b1b'; bg = '#fee2e2'
  } else if (e.action === 'update' && e.field_name) {
    icon = FIELD_ICON[e.field_name] ?? Pencil
    label = `${FIELD_LABEL[e.field_name] ?? e.field_name} 변경`
    color = '#1d4ed8'; bg = '#dbeafe'
  }

  const Icon = icon
  const who = e.changed_by_name ?? e.changed_by_email ?? '알 수 없음'

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white">
      <div className="flex items-start gap-3">
        <span
          className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full"
          style={{ backgroundColor: bg, color }}
        >
          <Icon size={14} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{label}</span>
            <span
              className="text-xs text-gray-500"
              title={format(new Date(e.changed_at), 'yyyy-MM-dd HH:mm:ss', { locale: ko })}
            >
              {formatRelative(e.changed_at)}
            </span>
          </div>
          {isProgressAdd ? (
            <div className="text-xs text-gray-600 mt-1">
              <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">
                {e.new_value}
              </span>
            </div>
          ) : isProgressRemove ? (
            <div className="text-xs text-gray-600 mt-1">
              <span className="bg-gray-100 px-1.5 py-0.5 rounded line-through text-gray-500">
                {e.old_value}
              </span>
            </div>
          ) : e.action === 'update' && e.field_name && (
            <div className="text-xs text-gray-600 mt-1">
              <span className="bg-gray-100 px-1.5 py-0.5 rounded line-through text-gray-500">
                {formatValue(e.field_name, e.old_value)}
              </span>
              <span className="mx-1.5 text-gray-400">→</span>
              <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                {formatValue(e.field_name, e.new_value)}
              </span>
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1">{who}</div>
        </div>
      </div>
    </div>
  )
}

function GroupCard({ item }: { item: GroupItem }) {
  const isAdd = item.type === 'progress_add'
  const Icon = isAdd ? Plus : Trash2
  const color = isAdd ? '#15803d' : '#991b1b'
  const bg = isAdd ? '#dcfce7' : '#fee2e2'
  const chipBg = isAdd ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500 line-through'
  const label = `작업일자 ${isAdd ? '추가' : '삭제'} (${item.dates.length}개)`

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white">
      <div className="flex items-start gap-3">
        <span
          className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full"
          style={{ backgroundColor: bg, color }}
        >
          <Icon size={14} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{label}</span>
            <span
              className="text-xs text-gray-500"
              title={format(new Date(item.changedAt), 'yyyy-MM-dd HH:mm:ss', { locale: ko })}
            >
              {formatRelative(item.changedAt)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.dates.map(d => (
              <span
                key={d}
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${chipBg}`}
              >
                {d}
              </span>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-1.5">{item.who}</div>
        </div>
      </div>
    </div>
  )
}
