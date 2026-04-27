'use client'
// ──────────────────────────────────────────────────
//  멤버 현황 페이지 UI 목업 (정적 데모)
// ──────────────────────────────────────────────────
import { useState } from 'react'

/* ── 더미 데이터 ─────────────────────────────── */
const DEPT_COLOR = {
  PM:     { bg: '#ede9fe', text: '#7c3aed', dot: '#7c3aed' },
  BE:     { bg: '#fff7ed', text: '#c2410c', dot: '#f97316' },
  FE:     { bg: '#ecfdf5', text: '#065f46', dot: '#10b981' },
  UXD:    { bg: '#fdf4ff', text: '#86198f', dot: '#d946ef' },
  Design: { bg: '#fdf4ff', text: '#86198f', dot: '#d946ef' },
  Oth:    { bg: '#f3f4f6', text: '#374151', dot: '#9ca3af' },
}

const STATUS_COLOR = {
  '진행': { bg: '#dcfce7', text: '#166534' },
  '완료': { bg: '#f0fdf4', text: '#15803d' },
  '대기': { bg: '#f3f4f6', text: '#374151' },
  '보류': { bg: '#fee2e2', text: '#991b1b' },
  '예정': { bg: '#fefce8', text: '#854d0e' },
}

const MEMBERS = [
  { id: '1', name: '박지민', dept: 'PM',     email: 'jimin@mustit.co.kr',   active: true },
  { id: '2', name: '이준혁', dept: 'BE',     email: 'junhyuk@mustit.co.kr', active: true },
  { id: '3', name: '최수진', dept: 'FE',     email: 'sujin@mustit.co.kr',   active: true },
  { id: '4', name: '정민아', dept: 'UXD',    email: 'mina@mustit.co.kr',    active: true },
  { id: '5', name: '한동우', dept: 'BE',     email: 'dongwoo@mustit.co.kr', active: true },
  { id: '6', name: '김서연', dept: 'Design', email: 'seoyeon@mustit.co.kr', active: false },
]

// [멤버id, 기간(주/일/월 인덱스), 태스크명, 상태, 카테고리]
const TASKS = {
  // 주 단위
  week: {
    '1': { 0: [{ name: '홈 리뉴얼 기획', status: '진행', cat: '리뉴얼' }, { name: 'NEXT UP 정리', status: '완료', cat: '기타' }],
           1: [{ name: '검색 고도화 PM', status: '진행', cat: '고도화' }],
           2: [{ name: '셀러 어드민 기획', status: '예정', cat: '셀러' }],
           3: [{ name: '셀러 어드민 기획', status: '진행', cat: '셀러' }] },
    '2': { 0: [{ name: '결제 API 개발', status: '진행', cat: 'BE' }, { name: '검색 인덱스 최적화', status: '완료', cat: '고도화' }],
           1: [{ name: '결제 API 개발', status: '진행', cat: 'BE' }],
           2: [{ name: 'Kafka 이벤트 처리', status: '예정', cat: 'DevOps' }],
           3: [{ name: 'Kafka 이벤트 처리', status: '진행', cat: 'DevOps' }] },
    '3': { 0: [{ name: '홈 리뉴얼 FE', status: '진행', cat: '리뉴얼' }],
           1: [{ name: '홈 리뉴얼 FE', status: '진행', cat: '리뉴얼' }, { name: '검색 UI 개선', status: '완료', cat: '고도화' }],
           2: [{ name: '셀러 어드민 FE', status: '예정', cat: '셀러' }],
           3: [] },
    '4': { 0: [{ name: '홈 리뉴얼 UXD', status: '완료', cat: '리뉴얼' }],
           1: [{ name: '검색 UX 개선', status: '진행', cat: '고도화' }],
           2: [{ name: '셀러 어드민 UX', status: '예정', cat: '셀러' }],
           3: [{ name: '셀러 어드민 UX', status: '진행', cat: '셀러' }] },
    '5': { 0: [{ name: 'DR-2041 긴급패치', status: '완료', cat: 'DR' }],
           1: [{ name: 'DR-2055 버그수정', status: '진행', cat: 'DR' }],
           2: [],
           3: [{ name: 'Legacy 리팩토링', status: '예정', cat: '레거시' }] },
    '6': { 0: [], 1: [], 2: [], 3: [] },
  },
  // 월 단위
  month: {
    '1': { 0: [{ name: '홈 리뉴얼 기획', status: '완료', cat: '리뉴얼' }],
           1: [{ name: '검색 고도화 PM', status: '진행', cat: '고도화' }, { name: 'NEXT UP 정리', status: '진행', cat: '기타' }],
           2: [{ name: '셀러 어드민 기획', status: '예정', cat: '셀러' }] },
    '2': { 0: [{ name: '결제 API', status: '완료', cat: 'BE' }],
           1: [{ name: 'Kafka 이벤트', status: '진행', cat: 'DevOps' }, { name: '검색 인덱스', status: '진행', cat: '고도화' }],
           2: [{ name: 'MSA 전환', status: '예정', cat: 'DevOps' }] },
    '3': { 0: [{ name: '홈 리뉴얼 FE', status: '완료', cat: '리뉴얼' }],
           1: [{ name: '검색 UI', status: '진행', cat: '고도화' }, { name: '셀러 FE', status: '예정', cat: '셀러' }],
           2: [] },
    '4': { 0: [{ name: '홈 UXD', status: '완료', cat: '리뉴얼' }],
           1: [{ name: '검색 UX', status: '진행', cat: '고도화' }],
           2: [{ name: '셀러 UX', status: '예정', cat: '셀러' }] },
    '5': { 0: [{ name: 'DR처리 x3', status: '완료', cat: 'DR' }],
           1: [{ name: 'DR처리 x2', status: '진행', cat: 'DR' }],
           2: [{ name: 'Legacy 리팩', status: '예정', cat: '레거시' }] },
    '6': { 0: [], 1: [], 2: [] },
  },
}

const WEEK_LABELS  = ['16w (4/14-18)', '17w (4/21-25)', '18w (4/28-5/2)', '19w (5/5-9)']
const MONTH_LABELS = ['2월', '3월', '4월', '5월']

/* ── 컴포넌트 ────────────────────────────────── */
function DeptBadge({ dept }) {
  const c = DEPT_COLOR[dept] ?? DEPT_COLOR.Oth
  return (
    <span style={{ background: c.bg, color: c.text }}
      className="text-[11px] font-semibold px-1.5 py-0.5 rounded">
      {dept}
    </span>
  )
}

function TaskChip({ task }) {
  const s = STATUS_COLOR[task.status] ?? STATUS_COLOR['대기']
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-gray-100 bg-white shadow-sm mb-1 min-w-0">
      <span style={{ background: s.bg, color: s.text }}
        className="text-[10px] font-medium px-1 rounded flex-shrink-0">
        {task.status}
      </span>
      <span className="text-xs text-gray-700 truncate leading-tight">{task.name}</span>
    </div>
  )
}

function MemberAvatar({ member, size = 32 }) {
  const c = DEPT_COLOR[member.dept] ?? DEPT_COLOR.Oth
  const initials = member.name.slice(0, 1)
  return (
    <div style={{ width: size, height: size, background: c.bg, color: c.text, flexShrink: 0 }}
      className="rounded-full flex items-center justify-center text-sm font-bold border border-white shadow-sm">
      {initials}
    </div>
  )
}

/* ── 멤버 설정 모달 ──────────────────────────── */
function MemberSettingModal({ members, onClose }) {
  const [list, setList] = useState(members)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', dept: 'PM', email: '' })
  const [editId, setEditId] = useState(null)

  const depts = ['PM', 'BE', 'FE', 'UXD', 'Design', 'Oth']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[480px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-bold text-gray-900">멤버 관리</h2>
            <p className="text-xs text-gray-400 mt-0.5">팀 멤버를 추가하거나 관리합니다</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* 멤버 리스트 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {list.map(m => (
            <div key={m.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                m.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'
              }`}>
              <MemberAvatar member={m} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                  <DeptBadge dept={m.dept} />
                  {!m.active && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">비활성</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">{m.email || '—'}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* 활성/비활성 토글 */}
                <button
                  onClick={() => setList(l => l.map(x => x.id === m.id ? { ...x, active: !x.active } : x))}
                  title={m.active ? '비활성화' : '활성화'}
                  className={`w-9 h-5 rounded-full relative transition-colors ${m.active ? 'bg-blue-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${m.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <button className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors text-xs">✏</button>
                <button
                  onClick={() => setList(l => l.filter(x => x.id !== m.id))}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-xs">🗑</button>
              </div>
            </div>
          ))}

          {/* 추가 폼 */}
          {adding && (
            <div className="border-2 border-blue-200 border-dashed rounded-xl px-3 py-3 bg-blue-50/50 space-y-2">
              <p className="text-xs font-semibold text-blue-600 mb-2">새 멤버 추가</p>
              <div className="flex gap-2">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="이름" className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <select value={form.dept} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                  {depts.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="이메일 (선택)" className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setAdding(false); setForm({ name: '', dept: 'PM', email: '' }) }}
                  className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
                <button onClick={() => {
                  if (!form.name.trim()) return
                  setList(l => [...l, { id: String(Date.now()), name: form.name, dept: form.dept, email: form.email, active: true }])
                  setAdding(false); setForm({ name: '', dept: 'PM', email: '' })
                }} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">추가</button>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t px-6 py-3 flex items-center justify-between">
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            + 멤버 추가
          </button>
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">닫기</button>
        </div>
      </div>
    </div>
  )
}

/* ── 메인 페이지 ─────────────────────────────── */
export default function MembersPage() {
  const [viewMode, setViewMode] = useState('week')   // 'day' | 'week' | 'month'
  const [showSettings, setShowSettings] = useState(false)
  const [periodOffset, setPeriodOffset] = useState(0)
  const [members] = useState(MEMBERS)

  const activeMembers = members.filter(m => m.active)

  // 기간 라벨
  const periodLabels = viewMode === 'month' ? MONTH_LABELS : WEEK_LABELS
  const visiblePeriods = periodLabels.slice(
    Math.max(0, periodOffset),
    Math.min(periodLabels.length, periodOffset + (viewMode === 'month' ? 3 : 4))
  )
  const visibleIndices = Array.from({ length: visiblePeriods.length }, (_, i) => i + Math.max(0, periodOffset))

  const taskData = TASKS[viewMode] ?? TASKS.week

  // 오늘 날짜 기준 현재 기간 표시
  const today = new Date()
  const todayLabel = viewMode === 'month'
    ? `${today.getMonth() + 1}월`
    : (() => {
        const d = new Date(today); d.setDate(d.getDate() - d.getDay() + 1)
        const m = d.getMonth() + 1, dd = d.getDate()
        return `${Math.ceil(dd / 7)}w`
      })()

  return (
    <div className="p-6 min-h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">👥 멤버 현황</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            활성 멤버 {activeMembers.length}명 · {today.getFullYear()}년 {today.getMonth() + 1}월 기준
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 뷰 모드 토글 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
            {['day', 'week', 'month'].map(m => (
              <button key={m}
                onClick={() => { setViewMode(m); setPeriodOffset(0) }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {m === 'day' ? '일' : m === 'week' ? '주' : '월'}
              </button>
            ))}
          </div>
          {/* 기간 네비게이션 */}
          <div className="flex items-center gap-1">
            <button onClick={() => setPeriodOffset(o => Math.max(0, o - 1))}
              disabled={periodOffset === 0}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <button onClick={() => setPeriodOffset(0)}
              className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
              이번 {viewMode === 'day' ? '주' : viewMode === 'week' ? '주' : '월'}
            </button>
            <button onClick={() => setPeriodOffset(o => Math.min(periodLabels.length - 1, o + 1))}
              disabled={periodOffset >= periodLabels.length - 1}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
          {/* 멤버 설정 */}
          <button onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 font-medium">
            ⚙ 멤버 설정
          </button>
        </div>
      </div>

      {/* 일 뷰 안내 (데모) */}
      {viewMode === 'day' && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          📅 일(Day) 뷰: task_progress 작업일자 기준으로 멤버별 당일 작업을 표시합니다.
          <span className="ml-2 text-amber-500 text-xs">(아래는 주 뷰와 동일한 목업 데이터입니다)</span>
        </div>
      )}

      {/* 메인 그리드 */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        {/* 컬럼 헤더 */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {/* 멤버 컬럼 헤더 */}
          <div className="flex-shrink-0 w-48 px-4 py-3 border-r border-gray-200">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">멤버</span>
          </div>
          {/* 기간 컬럼 헤더들 */}
          <div className="flex-1 flex min-w-0 overflow-x-auto">
            {visibleIndices.map((idx, i) => {
              const label = periodLabels[idx] ?? ''
              const isCurrent = label.startsWith(todayLabel) || (viewMode === 'month' && label === todayLabel)
              return (
                <div key={idx} className={`flex-1 min-w-[180px] px-3 py-3 border-r border-gray-200 last:border-r-0 ${isCurrent ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${isCurrent ? 'text-blue-600' : 'text-gray-600'}`}>
                      {label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-medium">현재</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 멤버 행들 */}
        {activeMembers.map((member, mi) => {
          const memberTasks = taskData[member.id] ?? {}
          const totalTasks  = visibleIndices.reduce((s, idx) => s + (memberTasks[idx]?.length ?? 0), 0)

          return (
            <div key={member.id}
              className={`flex border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors ${
                mi % 2 === 1 ? 'bg-gray-50/30' : ''
              }`}>

              {/* 멤버 정보 셀 */}
              <div className="flex-shrink-0 w-48 px-4 py-3 border-r border-gray-200 flex items-start gap-3">
                <MemberAvatar member={member} size={36} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{member.name}</span>
                  </div>
                  <DeptBadge dept={member.dept} />
                  <div className="mt-1.5 flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">
                      {totalTasks > 0 ? `작업 ${totalTasks}건` : '작업 없음'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 기간별 태스크 셀들 */}
              <div className="flex-1 flex min-w-0">
                {visibleIndices.map((idx, ci) => {
                  const tasks = memberTasks[idx] ?? []
                  return (
                    <div key={idx}
                      className="flex-1 min-w-[180px] px-3 py-2.5 border-r border-gray-100 last:border-r-0 align-top">
                      {tasks.length > 0 ? (
                        tasks.map((t, ti) => <TaskChip key={ti} task={t} />)
                      ) : (
                        <div className="h-8 flex items-center">
                          <span className="text-xs text-gray-300">—</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 범례 + 요약 */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {Object.entries(STATUS_COLOR).map(([s, c]) => (
            <div key={s} className="flex items-center gap-1">
              <span style={{ background: c.bg, color: c.text }} className="text-[10px] font-medium px-1.5 py-0.5 rounded">{s}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-400">
          비활성 멤버 {members.filter(m => !m.active).length}명은 현황에서 숨겨집니다 ·{' '}
          <button onClick={() => setShowSettings(true)} className="underline hover:text-gray-600">멤버 설정</button>에서 관리
        </div>
      </div>

      {/* 멤버 설정 모달 */}
      {showSettings && (
        <MemberSettingModal
          members={members}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
