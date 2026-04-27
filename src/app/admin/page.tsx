'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AllowedUser, UserRole } from '@/lib/types'
import {
  RefreshCw, Plus, Trash2, Shield, User,
  ToggleLeft, ToggleRight, X, Check,
} from 'lucide-react'

/* ── 날짜 포맷 ─────────────────────────────────── */
function fmtDate(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/* ── 역할 배지 ─────────────────────────────────── */
function RoleBadge({ role }: { role: UserRole }) {
  return role === 'admin' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
      <Shield size={10} /> 관리자
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      <User size={10} /> 멤버
    </span>
  )
}

/* ── 추가 모달 ─────────────────────────────────── */
function AddUserModal({
  onAdd, onClose,
}: {
  onAdd: (email: string, name: string, role: UserRole) => Promise<void>
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName]   = useState('')
  const [role, setRole]   = useState<UserRole>('member')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('이메일을 입력해주세요.'); return }
    if (!email.includes('@mustit.co.kr')) { setError('mustit.co.kr 이메일만 등록할 수 있습니다.'); return }
    setSaving(true)
    setError(null)
    try {
      await onAdd(email.trim(), name.trim(), role)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '등록 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-gray-900">사용자 추가</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={18} /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">이메일 *</label>
              <input
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@mustit.co.kr"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">이름</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">권한</label>
              <div className="flex gap-2">
                {(['member', 'admin'] as UserRole[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                      role === r
                        ? r === 'admin'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {r === 'admin' ? '관리자' : '멤버'}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                취소
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                {saving ? '등록 중...' : '등록'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

/* ── 메인 페이지 ────────────────────────────────── */
export default function AdminPage() {
  const supabase = createClient()
  const [users, setUsers]       = useState<AllowedUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [myEmail, setMyEmail]   = useState<string | null>(null)
  const [isAdmin, setIsAdmin]   = useState(false)
  const [showAdd, setShowAdd]   = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  /* 현재 로그인 유저 확인 */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setMyEmail(user?.email ?? null)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('allowed_users')
      .select('*')
      .order('created_at', { ascending: true })
    const list = (data ?? []) as AllowedUser[]
    setUsers(list)
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchUsers() }, [fetchUsers])

  /* admin 여부 */
  useEffect(() => {
    if (!myEmail || users.length === 0) return
    const me = users.find(u => u.email === myEmail)
    setIsAdmin(me?.role === 'admin' && me?.is_active === true)
  }, [myEmail, users])

  /* 사용자 추가 */
  async function handleAdd(email: string, name: string, role: UserRole) {
    const { data, error } = await supabase
      .from('allowed_users')
      .insert({ email, name, role })
      .select().single()
    if (error) throw new Error(error.message)
    setUsers(prev => [...prev, data as AllowedUser])
  }

  /* 활성화 토글 */
  async function toggleActive(user: AllowedUser) {
    if (user.email === myEmail) return // 본인 비활성화 방지
    setSavingId(user.id)
    await supabase.from('allowed_users').update({ is_active: !user.is_active }).eq('id', user.id)
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
    setSavingId(null)
  }

  /* 역할 변경 */
  async function toggleRole(user: AllowedUser) {
    if (user.email === myEmail) return // 본인 역할 변경 방지
    const newRole: UserRole = user.role === 'admin' ? 'member' : 'admin'
    setSavingId(user.id)
    await supabase.from('allowed_users').update({ role: newRole }).eq('id', user.id)
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u))
    setSavingId(null)
  }

  /* 삭제 */
  async function handleDelete(user: AllowedUser) {
    if (user.email === myEmail) return
    if (!confirm(`${user.name ?? user.email} 사용자를 삭제하시겠습니까?`)) return
    await supabase.from('allowed_users').delete().eq('id', user.id)
    setUsers(prev => prev.filter(u => u.id !== user.id))
  }

  /* 통계 */
  const total    = users.length
  const active   = users.filter(u => u.is_active).length
  const adminCnt = users.filter(u => u.role === 'admin').length
  const recentLogin = users.filter(u => u.last_login_at).sort(
    (a, b) => new Date(b.last_login_at!).getTime() - new Date(a.last_login_at!).getTime()
  )[0]

  if (!isAdmin && !loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-gray-400 text-sm">
        관리자 권한이 필요합니다.
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🛡️ 관리자</h1>
          <p className="text-sm text-gray-500 mt-1">접근 허용 사용자 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchUsers}
            className="p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer">
            <Plus size={16} /> 사용자 추가
          </button>
        </div>
      </div>

      {/* 현황 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '전체 등록', value: total,    color: 'text-gray-800',   bg: 'bg-gray-50',    border: 'border-gray-200'  },
          { label: '활성',     value: active,   color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200' },
          { label: '비활성',   value: total - active, color: 'text-red-600', bg: 'bg-red-50',  border: 'border-red-200'   },
          { label: '관리자',   value: adminCnt, color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-200'},
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg} ${border}`}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* 최근 로그인 배너 */}
      {recentLogin && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
          최근 접속:&nbsp;
          <span className="font-medium text-gray-700">{recentLogin.name ?? recentLogin.email}</span>
          &nbsp;—&nbsp;{fmtDate(recentLogin.last_login_at)}
        </div>
      )}

      {/* 사용자 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" />불러오는 중...
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">이름</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">이메일</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">권한</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">활성화</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">마지막 접속일</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">등록일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">등록된 사용자가 없습니다.</td>
                </tr>
              ) : users.map(user => {
                const isSelf    = user.email === myEmail
                const isSaving  = savingId === user.id
                return (
                  <tr key={user.id}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors ${!user.is_active ? 'opacity-50' : ''}`}
                  >
                    {/* 이름 */}
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {user.name ?? <span className="text-gray-400 text-xs">미입력</span>}
                      {isSelf && <span className="ml-1.5 text-[10px] text-blue-500 font-semibold">(나)</span>}
                    </td>

                    {/* 이메일 */}
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>

                    {/* 권한 */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleRole(user)}
                        disabled={isSelf || isSaving}
                        className={`disabled:cursor-default ${isSelf ? '' : 'cursor-pointer hover:opacity-80'}`}
                        title={isSelf ? '본인 권한은 변경할 수 없습니다' : '클릭하여 역할 변경'}
                      >
                        <RoleBadge role={user.role} />
                      </button>
                    </td>

                    {/* 활성화 토글 */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(user)}
                        disabled={isSelf || isSaving}
                        className={`transition-colors ${isSelf ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
                        title={isSelf ? '본인 계정은 비활성화할 수 없습니다' : user.is_active ? '비활성화' : '활성화'}
                      >
                        {isSaving ? (
                          <RefreshCw size={18} className="animate-spin text-gray-400 mx-auto" />
                        ) : user.is_active ? (
                          <ToggleRight size={22} className="text-green-500 mx-auto" />
                        ) : (
                          <ToggleLeft size={22} className="text-gray-300 mx-auto" />
                        )}
                      </button>
                    </td>

                    {/* 마지막 로그인 */}
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(user.last_login_at)}</td>

                    {/* 등록일 */}
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(user.created_at)}</td>

                    {/* 삭제 */}
                    <td className="px-4 py-3 text-center">
                      {!isSelf && (
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 비활성 안내 */}
      {users.some(u => !u.is_active) && (
        <p className="mt-3 text-xs text-gray-400 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
          비활성화된 사용자는 로그인 시 접근이 차단됩니다. (미들웨어 연동 필요 시 별도 설정)
        </p>
      )}

      {/* 추가 모달 */}
      {showAdd && (
        <AddUserModal
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}
