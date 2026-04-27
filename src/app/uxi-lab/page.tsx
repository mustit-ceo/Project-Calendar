'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UxiLab } from '@/lib/types'
import { RefreshCw, Plus, Trash2, ExternalLink, Upload, Link, Pencil, ImageIcon, ChevronLeft, ChevronRight, Search, X, List } from 'lucide-react'

/* ── 월 유틸 ─────────────────────────────────────── */
function toYearMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function addMonths(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return toYearMonth(d)
}
function formatYearMonth(ym: string) {
  const [y, m] = ym.split('-')
  return `${y}년 ${parseInt(m)}월`
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url) || url.startsWith('data:image/')
}

function isDataUrl(url: string): boolean {
  return url.startsWith('data:')
}

/* ── 초기 컬럼 너비 ─────────────────────────────── */
// index 5 (Outcome) 는 0 = auto (나머지 너비 전부)
const INIT_COL_WIDTHS = [110, 180, 700, 120, 70, 0, 44]

/* ── 참조 팝업 ──────────────────────────────────── */
function RefPopup({
  anchor, current, onSave, onClose,
}: {
  anchor: DOMRect; current: string | null
  onSave: (url: string) => void; onClose: () => void
}) {
  const [tab, setTab] = useState<'link' | 'image'>(
    current && isImageUrl(current) ? 'image' : 'link'
  )
  const [url, setUrl] = useState(current ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const preview = url.trim()
  const top = Math.min(anchor.bottom + 4, window.innerHeight - 360)
  const left = Math.min(anchor.left, window.innerWidth - 300)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)

    const reader = new FileReader()
    reader.onload = () => {
      setUrl(reader.result as string)
      setUploading(false)
    }
    reader.onerror = () => {
      setUploadError('파일 읽기 실패')
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-[280px]" style={{ top, left }}>

        {/* 탭 */}
        <div className="flex gap-1 mb-3 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setTab('link')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${tab === 'link' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Link size={11} />링크
          </button>
          <button
            onClick={() => setTab('image')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${tab === 'image' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Upload size={11} />이미지
          </button>
        </div>

        {/* 링크 탭 */}
        {tab === 'link' && (
          <>
            <input
              autoFocus value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyDown={e => {
                if (e.key === 'Enter') { onSave(url.trim()); onClose() }
                if (e.key === 'Escape') onClose()
              }}
            />
            {preview && !isImageUrl(preview) && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 truncate">
                <ExternalLink size={11} className="flex-shrink-0" />
                <span className="truncate">{preview}</span>
              </div>
            )}
            {preview && isImageUrl(preview) && (
              <div className="mt-2 rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                <img src={preview} alt="preview" className="w-full max-h-28 object-contain" />
              </div>
            )}
          </>
        )}

        {/* 이미지 탭 */}
        {tab === 'image' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {preview && isImageUrl(preview) ? (
              <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 mb-2">
                <img src={preview} alt="preview" className="w-full max-h-36 object-contain" />
                <button
                  onClick={() => { setUrl(''); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="absolute top-1 right-1 bg-white/80 hover:bg-white rounded-full p-0.5 text-gray-500 hover:text-red-500 border border-gray-200 cursor-pointer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg py-5 flex flex-col items-center gap-2 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors cursor-pointer mb-2 disabled:opacity-50"
              >
                {uploading ? (
                  <><RefreshCw size={18} className="animate-spin" />업로드 중...</>
                ) : (
                  <><Upload size={18} />클릭하여 이미지 선택</>
                )}
              </button>
            )}
            {!preview && (
              <p className="text-[10px] text-gray-400 text-center mb-2">또는 URL 직접 입력</p>
            )}
            {(!preview || !isImageUrl(preview)) && (
              <input
                value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://...image.png"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                onKeyDown={e => {
                  if (e.key === 'Enter') { onSave(url.trim()); onClose() }
                  if (e.key === 'Escape') onClose()
                }}
              />
            )}
            {uploadError && (
              <p className="mt-1 text-[10px] text-red-500">{uploadError}</p>
            )}
          </>
        )}

        {/* 버튼 */}
        <div className="flex gap-2 mt-3">
          {current && (
            <button onClick={() => { onSave(''); onClose() }}
              className="px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg border border-red-200 cursor-pointer">
              삭제
            </button>
          )}
          <button
            onClick={() => { onSave(url.trim()); onClose() }}
            disabled={uploading}
            className="flex-1 px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer disabled:opacity-50">
            저장
          </button>
        </div>
      </div>
    </>
  )
}

/* ── 인라인 텍스트 셀 ────────────────────────────── */
interface TextCellProps {
  id: string; field: string; value: string | null
  multiline?: boolean; placeholder?: string; align?: 'left' | 'center'
  editingCell: { id: string; field: string } | null; editValue: string
  inputRef: React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>
  onStartEdit: (id: string, field: string, value: string) => void
  onChangeValue: (v: string) => void
  onCommit: (id: string, field: string, value: string) => void
  onCancel: () => void
}

function TextCell({
  id, field, value, multiline, placeholder, align = 'left',
  editingCell, editValue, inputRef,
  onStartEdit, onChangeValue, onCommit, onCancel,
}: TextCellProps) {
  const isEditing = editingCell?.id === id && editingCell.field === field
  const centerClass = align === 'center' ? 'text-center' : ''

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={el => {
            inputRef.current = el
            // 마운트 시 content 높이로 즉시 맞추기
            if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
          }}
          value={editValue}
          onChange={e => {
            onChangeValue(e.target.value)
            // 입력할 때마다 높이 재계산
            const el = e.target
            el.style.height = 'auto'
            el.style.height = el.scrollHeight + 'px'
          }}
          onBlur={() => onCommit(id, field, editValue)}
          onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
          rows={1}
          className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none overflow-hidden"
        />
      )
    }
    return (
      <input
        ref={el => { inputRef.current = el }}
        value={editValue}
        onChange={e => onChangeValue(e.target.value)}
        onBlur={() => onCommit(id, field, editValue)}
        onKeyDown={e => {
          if (e.key === 'Enter') onCommit(id, field, editValue)
          if (e.key === 'Escape') onCancel()
        }}
        className={`w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${centerClass}`}
      />
    )
  }

  return (
    <div
      onClick={() => onStartEdit(id, field, value ?? '')}
      className={`cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 min-h-[22px] text-sm leading-relaxed whitespace-pre-wrap ${
        value ? 'text-gray-700' : 'text-gray-300'
      } ${centerClass}`}
    >
      {value || placeholder || ''}
    </div>
  )
}

/* ── 메인 페이지 ────────────────────────────────── */
export default function UxiLabPage() {
  const supabase = createClient()
  const [items, setItems] = useState<UxiLab[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => toYearMonth(new Date()))
  const [viewAll, setViewAll] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // 인라인 편집 상태
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  // 팝업 상태
  const [refAnchor, setRefAnchor] = useState<{
    rect: DOMRect; id: string; current: string | null
  } | null>(null)

  // 이미지 라이트박스
  const [lightbox, setLightbox] = useState<string | null>(null)

  // 컬럼 너비 상태
  const [colWidths, setColWidths] = useState(INIT_COL_WIDTHS)
  const resizeRef = useRef<{ colIdx: number; startX: number; startW: number } | null>(null)

  function startResize(e: React.MouseEvent, colIdx: number) {
    e.preventDefault()
    resizeRef.current = { colIdx, startX: e.clientX, startW: colWidths[colIdx] }

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const { colIdx: ci, startX, startW } = resizeRef.current
      const newW = Math.max(40, startW + ev.clientX - startX)
      setColWidths(prev => prev.map((w, i) => i === ci ? newW : w))
    }
    const onMouseUp = () => {
      resizeRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const fetchItems = useCallback(async (ym: string, all: boolean) => {
    setLoading(true)
    let query = supabase.from('uxi_lab').select('*')
    if (!all) {
      const monthStart = `${ym}-01`
      const [y, m] = ym.split('-').map(Number)
      const nextMonth = new Date(y, m, 1)
      const monthEnd = `${toYearMonth(nextMonth)}-01`
      query = query.gte('entry_date', monthStart).lt('entry_date', monthEnd)
    }
    const { data } = await query
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchItems(selectedMonth, viewAll) }, [fetchItems, selectedMonth, viewAll])

  // 검색 필터 (클라이언트 사이드)
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return items
    return items.filter(item =>
      [item.agenda, item.category, item.initiator, item.outcome]
        .some(v => v?.toLowerCase().includes(q))
    )
  }, [items, searchQuery])

  function startEdit(id: string, field: string, value: string) {
    setEditingCell({ id, field })
    setEditValue(value)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commitEdit(id: string, field: string, raw: string) {
    setEditingCell(null)
    const val = raw.trim() || null
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item))
    supabase.from('uxi_lab').update({ [field]: val }).eq('id', id).then()
  }

  function commitReference(id: string, url: string) {
    const val = url || null
    setItems(prev => prev.map(item => item.id === id ? { ...item, reference: val } : item))
    supabase.from('uxi_lab').update({ reference: val }).eq('id', id).then()
  }

  async function handleAdd() {
    // 오늘 날짜 (YYYY-MM-DD, 로컬 기준)
    const t = new Date()
    const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    const { data } = await supabase
      .from('uxi_lab')
      .insert({ agenda: '', business_impact: 0, ux_impact: 0, sort_order: items.length, entry_date: today })
      .select().single()
    if (data) {
      setItems(prev => [...prev, data])
      setTimeout(() => startEdit(data.id, 'agenda', ''), 100)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('uxi_lab').delete().eq('id', id)
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const cellProps = {
    editingCell, editValue, inputRef,
    onStartEdit: startEdit,
    onChangeValue: setEditValue,
    onCommit: commitEdit,
    onCancel: () => setEditingCell(null),
  }

  /* ── th 공통 스타일 ── */
  const thBase = "text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3 select-none"

  // 각 th에 직접 sticky 적용 (tr에 적용하면 일부 브라우저에서 borderBottom 미동작)
  const thSticky: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    backgroundColor: '#F9FAFB', // bg-gray-50
    borderBottom: '2px solid #aaaaaa',
  }

  function ResizeHandle({ colIdx }: { colIdx: number }) {
    return (
      <div
        onMouseDown={e => startResize(e, colIdx)}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
        style={{ zIndex: 2 }}
      />
    )
  }

  // Outcome(index 5) = 0 → auto (width 미지정)
  const fixedTotal = colWidths.reduce((a, b) => a + b, 0)

  // th width: 0이면 미지정 (auto)
  function thW(i: number) {
    return colWidths[i] > 0 ? { width: colWidths[i] } : {}
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-5">
        {/* 1행: 타이틀 + 액션 버튼 */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">💡 UXI LAB</h1>
            <p className="text-sm text-gray-500 mt-1">아이디어 우선순위 평가 대기열</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchItems(selectedMonth, viewAll)}
              className="p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer">
              <Plus size={16} /> 추가
            </button>
          </div>
        </div>

        {/* 2행: 검색 + 전체보기 + 월 네비게이터 */}
        <div className="flex items-center gap-2">
          {/* 검색창 */}
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                if (e.target.value) setViewAll(true)
              }}
              placeholder="아젠다·구분·발의·Outcome 검색"
              className="w-full pl-8 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); searchRef.current?.focus() }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* 전체보기 토글 */}
          <button
            onClick={() => setViewAll(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
              viewAll
                ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <List size={14} />
            전체보기
          </button>

          {/* 구분선 */}
          {!viewAll && <div className="h-6 w-px bg-gray-200" />}

          {/* 월 네비게이터 (전체보기 OFF일 때만 활성) */}
          {!viewAll && (
            <>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-1 py-1">
                <button
                  onClick={() => setSelectedMonth(m => addMonths(m, -1))}
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-white rounded-md transition-colors cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold text-gray-700 min-w-[80px] text-center">
                  {formatYearMonth(selectedMonth)}
                </span>
                <button
                  onClick={() => setSelectedMonth(m => addMonths(m, 1))}
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-white rounded-md transition-colors cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              {selectedMonth !== toYearMonth(new Date()) && (
                <button
                  onClick={() => setSelectedMonth(toYearMonth(new Date()))}
                  className="px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 cursor-pointer font-medium"
                >
                  이번달
                </button>
              )}
            </>
          )}

          {/* 검색 결과 건수 */}
          {searchQuery && (
            <span className="ml-auto text-xs text-gray-400">
              {filteredItems.length}건
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCw size={24} className="animate-spin mr-2" />불러오는 중...
        </div>
      ) : (
        /* 컨테이너: overflow auto → 수평+수직 스크롤 모두 처리, thead sticky 가능 */
        <div
          className="bg-white rounded-xl"
          style={{
            border: '1px solid #D9D9D9',
            overflow: 'auto',
            maxHeight: 'calc(100vh - 220px)',
          }}
        >
          <table
            className="table-fixed"
            style={{ width: '100%', minWidth: fixedTotal, borderCollapse: 'separate', borderSpacing: 0 }}
          >
            <colgroup>
              {colWidths.map((w, i) => (
                <col key={i} style={w > 0 ? { width: w } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className={`${thBase} text-center relative`} style={{ ...thSticky, ...thW(0) }}>생성일<ResizeHandle colIdx={0} /></th>
                <th className={`${thBase} text-center relative`} style={{ ...thSticky, ...thW(1) }}>구분<ResizeHandle colIdx={1} /></th>
                <th className={`${thBase} text-left relative`} style={{ ...thSticky, ...thW(2) }}>아젠다<ResizeHandle colIdx={2} /></th>
                <th className={`${thBase} text-center relative`} style={{ ...thSticky, ...thW(3) }}>참조<ResizeHandle colIdx={3} /></th>
                <th className={`${thBase} text-center relative`} style={{ ...thSticky, ...thW(4) }}>발의<ResizeHandle colIdx={4} /></th>
                <th className={`${thBase} text-left relative`} style={{ ...thSticky, ...thW(5) }}>Outcome<ResizeHandle colIdx={5} /></th>
                <th className={`${thBase} relative`} style={{ ...thSticky, ...thW(6) }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                    {searchQuery ? `"${searchQuery}" 검색 결과가 없습니다.` : '등록된 아이디어가 없습니다.'}
                  </td>
                </tr>
              ) : filteredItems.map((item, idx) => (
                <tr
                  key={item.id}
                  className="last:border-b-0 hover:bg-gray-50/50 group align-top"
                  style={{ borderBottom: '1px solid #D9D9D9' }}
                >
                  {/* 기재일 */}
                  <td className="py-2.5 px-3">
                    <TextCell {...cellProps} id={item.id} field="entry_date"
                      value={item.entry_date} placeholder="날짜" align="center" />
                  </td>

                  {/* 구분 */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold text-gray-300 flex-shrink-0 w-4">{idx + 1}</span>
                      <TextCell {...cellProps} id={item.id} field="category"
                        value={item.category} placeholder="구분" />
                    </div>
                  </td>

                  {/* 아젠다 */}
                  <td className="py-2.5 px-3">
                    <TextCell {...cellProps} id={item.id} field="agenda"
                      value={item.agenda} multiline placeholder="아젠다 입력..." />
                  </td>

                  {/* 참조 */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="relative inline-flex items-center justify-center w-full group/ref">
                      {item.reference ? (
                        <>
                          {/* 아이콘: 클릭 시 링크 열기 */}
                          {isImageUrl(item.reference) ? (
                            <button onClick={() => setLightbox(item.reference!)} className="cursor-pointer text-blue-400 hover:text-blue-600 transition-colors">
                              <ImageIcon size={16} />
                            </button>
                          ) : (
                            <a href={item.reference} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                              <ExternalLink size={14} className="text-blue-500 hover:text-blue-700" />
                            </a>
                          )}
                          {/* 수정 버튼: 호버 시 우측에 표시 */}
                          <button
                            onClick={e => setRefAnchor({ rect: e.currentTarget.getBoundingClientRect(), id: item.id, current: item.reference ?? null })}
                            className="absolute -right-1 opacity-0 group-hover/ref:opacity-100 transition-opacity p-0.5 bg-white border border-gray-200 rounded text-gray-400 hover:text-blue-500 hover:border-blue-300 cursor-pointer shadow-sm"
                          >
                            <Pencil size={10} />
                          </button>
                        </>
                      ) : (
                        /* 비어있을 때: 클릭하면 편집 팝업 */
                        <button
                          onClick={e => setRefAnchor({ rect: e.currentTarget.getBoundingClientRect(), id: item.id, current: null })}
                          className="cursor-pointer text-[11px] text-gray-300 hover:text-blue-400 transition-colors"
                        >
                          + 링크
                        </button>
                      )}
                    </div>
                  </td>

                  {/* 발의 */}
                  <td className="py-2.5 px-3">
                    <TextCell {...cellProps} id={item.id} field="initiator"
                      value={item.initiator} placeholder="발의" align="center" />
                  </td>

                  {/* Outcome */}
                  <td className="py-2.5 px-3">
                    <TextCell {...cellProps} id={item.id} field="outcome"
                      value={item.outcome} multiline placeholder="Outcome 입력..." />
                  </td>

                  {/* 삭제 */}
                  <td className="py-2.5 px-2 text-center">
                    <button onClick={() => handleDelete(item.id)}
                      className="p-1 text-gray-300 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 이미지 라이트박스 */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={lightbox} alt="참조 이미지" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            {!isDataUrl(lightbox) && (
              <a
                href={lightbox}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-2 right-10 bg-white/80 hover:bg-white text-gray-700 rounded-full p-1.5 shadow cursor-pointer"
                title="새 탭에서 열기"
              >
                <ExternalLink size={14} />
              </a>
            )}
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-700 rounded-full p-1.5 shadow cursor-pointer font-bold text-sm leading-none"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 참조 팝업 */}
      {refAnchor && (
        <RefPopup
          anchor={refAnchor.rect}
          current={refAnchor.current}
          onSave={url => commitReference(refAnchor.id, url)}
          onClose={() => setRefAnchor(null)}
        />
      )}
    </div>
  )
}
