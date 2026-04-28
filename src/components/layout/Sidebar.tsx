'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Calendar, Users, CheckSquare, Rocket, Lightbulb, LogOut, ChevronLeft, ChevronRight, ShieldCheck, BarChart2, ClipboardList, MessageSquarePlus, LayoutDashboard } from 'lucide-react'
import { cn, getDelayedProjects } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'
import { Project } from '@/lib/types'

const navItems = [
  { href: '/calendar',  label: '캘린더',          icon: Calendar       },
  { href: '/members',   label: '멤버별 작업 현황', icon: Users          },
  { href: '/dashboard', label: '운영 모니터링',    icon: LayoutDashboard },
  { href: '/timeline',  label: '타임라인',         icon: BarChart2      },
  { href: '/archive',   label: '완료 아카이브',    icon: CheckSquare    },
  { href: '/backlog',   label: 'Backlog',          icon: ClipboardList  },
  { href: '/uxi-lab',   label: 'UXI LAB',          icon: Lightbulb      },
  { href: '/next-up',   label: 'NEXT UP',          icon: Rocket         },
  { href: '/feedback',  label: '개선사항 요청',     icon: MessageSquarePlus },
]

export function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [userEmail,  setUserEmail]  = useState<string | null>(null)
  const [userName,   setUserName]   = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [delayedCount,        setDelayedCount]        = useState(0)
  const [pendingNewCount,     setPendingNewCount]     = useState(0)
  const [recentUxiCount,      setRecentUxiCount]      = useState(0)
  const [recentFeedbackCount, setRecentFeedbackCount] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? null)
        setUserName(user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? null)
        setUserAvatar(user.user_metadata?.avatar_url ?? null)
        // admin 여부 확인 + 최근 접속일 업데이트
        const { data } = await supabase
          .from('allowed_users')
          .select('role, is_active')
          .eq('email', user.email ?? '')
          .single()
        setIsAdmin(data?.role === 'admin' && data?.is_active === true)
        // 접속할 때마다 last_login_at 갱신 (RPC로 RLS 우회)
        await supabase.rpc('update_last_seen', { user_email: user.email })
      }
    })
  }, [])

  // 배지 fetch 함수들 (5분 interval + 탭 활성화/포커스 시 즉시 재조회)
  // last_seen 이후 변경된 것만 카운트 → 페이지를 한번 열면 기존은 dismiss
  const fetchDelayCount = useCallback(async () => {
    const { data: projData } = await supabase
      .from('projects')
      .select('id, parent_id, status, start_date, end_date, lts_date, is_archived, updated_at')
      .eq('is_archived', false)
    const delayed = getDelayedProjects((projData ?? []) as Project[])

    if (!userEmail || delayed.length === 0) {
      setDelayedCount(delayed.length)
      return
    }
    const { data: au } = await supabase
      .from('allowed_users')
      .select('last_seen_dashboard')
      .eq('email', userEmail)
      .maybeSingle()
    const lastSeen = au?.last_seen_dashboard ?? null
    if (!lastSeen) {
      setDelayedCount(delayed.length)
      return
    }
    // last_seen 이후 updated_at이 변경된 지연 프로젝트만 카운트
    const count = delayed.filter(d => {
      const u = d.project?.updated_at
      return !!u && u > lastSeen
    }).length
    setDelayedCount(count)
  }, [userEmail]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPendingNewCount = useCallback(async () => {
    if (!isAdmin) return
    const cutoff3d = new Date()
    cutoff3d.setDate(cutoff3d.getDate() - 3)
    let cutoffISO = cutoff3d.toISOString()
    if (userEmail) {
      const { data: au } = await supabase
        .from('allowed_users')
        .select('last_seen_admin')
        .eq('email', userEmail)
        .maybeSingle()
      if (au?.last_seen_admin && au.last_seen_admin > cutoffISO) {
        cutoffISO = au.last_seen_admin
      }
    }
    const { data } = await supabase
      .from('allowed_users')
      .select('id')
      .eq('is_active', false)
      .gt('created_at', cutoffISO)
    setPendingNewCount((data ?? []).length)
  }, [isAdmin, userEmail]) // eslint-disable-line react-hooks/exhaustive-deps

  // 최근 3일 + last_seen 이후 신규 글 수
  const fetchRecentUxiCount = useCallback(async () => {
    const cutoff3d = new Date()
    cutoff3d.setDate(cutoff3d.getDate() - 3)
    let cutoffISO = cutoff3d.toISOString()
    if (userEmail) {
      const { data: au } = await supabase
        .from('allowed_users')
        .select('last_seen_uxi_lab')
        .eq('email', userEmail)
        .maybeSingle()
      if (au?.last_seen_uxi_lab && au.last_seen_uxi_lab > cutoffISO) {
        cutoffISO = au.last_seen_uxi_lab
      }
    }
    const { data } = await supabase
      .from('uxi_lab')
      .select('id')
      .gt('created_at', cutoffISO)
    setRecentUxiCount((data ?? []).length)
  }, [userEmail]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecentFeedbackCount = useCallback(async () => {
    const cutoff3d = new Date()
    cutoff3d.setDate(cutoff3d.getDate() - 3)
    let cutoffISO = cutoff3d.toISOString()
    if (userEmail) {
      const { data: au } = await supabase
        .from('allowed_users')
        .select('last_seen_feedback')
        .eq('email', userEmail)
        .maybeSingle()
      if (au?.last_seen_feedback && au.last_seen_feedback > cutoffISO) {
        cutoffISO = au.last_seen_feedback
      }
    }
    const { data } = await supabase
      .from('improvement_requests')
      .select('id')
      .gt('created_at', cutoffISO)
    setRecentFeedbackCount((data ?? []).length)
  }, [userEmail]) // eslint-disable-line react-hooks/exhaustive-deps

  // 5분마다 재조회 (백그라운드 안전망)
  useEffect(() => {
    fetchDelayCount()
    const t = setInterval(fetchDelayCount, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchDelayCount])

  useEffect(() => {
    if (!isAdmin) { setPendingNewCount(0); return }
    fetchPendingNewCount()
    const t = setInterval(fetchPendingNewCount, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchPendingNewCount, isAdmin])

  useEffect(() => {
    fetchRecentUxiCount()
    const t = setInterval(fetchRecentUxiCount, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchRecentUxiCount])

  useEffect(() => {
    fetchRecentFeedbackCount()
    const t = setInterval(fetchRecentFeedbackCount, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchRecentFeedbackCount])

  // 탭 활성화·창 포커스 시 즉시 재조회 (서버 부하 거의 없음, 즉각 반영)
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      fetchDelayCount()
      fetchPendingNewCount()
      fetchRecentUxiCount()
      fetchRecentFeedbackCount()
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [fetchDelayCount, fetchPendingNewCount, fetchRecentUxiCount, fetchRecentFeedbackCount])

  // 페이지 이동 시 last_seen 갱신이 끝나는 시간을 기다린 뒤 재조회
  // (모든 배지가 페이지 진입 직후 dismiss 되도록)
  useEffect(() => {
    const t = setTimeout(() => {
      fetchDelayCount()
      fetchPendingNewCount()
      fetchRecentUxiCount()
      fetchRecentFeedbackCount()
    }, 800)
    return () => clearTimeout(t)
  }, [pathname, fetchDelayCount, fetchPendingNewCount, fetchRecentUxiCount, fetchRecentFeedbackCount])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={cn(
        // sticky + h-screen: 페이지 컨텐츠가 길어져도 viewport 높이에 고정,
        // 하단 로그인 정보가 항상 보이도록
        'sticky top-0 self-start h-screen flex flex-col bg-gray-900 text-white transition-all duration-200 ease-in-out flex-shrink-0',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* 로고 */}
      <div className={cn(
        'border-b border-gray-700 flex items-center',
        collapsed ? 'px-0 py-5 justify-center' : 'px-5 py-6'
      )}>
        {collapsed ? (
          <span className="text-xl">📅</span>
        ) : (
          <div>
            <h1 className="text-lg font-bold text-white">📅 Project Calendar</h1>
            <p className="text-xs text-gray-400 mt-1">mustit</p>
          </div>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className={cn('flex-1 py-4 space-y-1 overflow-y-auto', collapsed ? 'px-1' : 'px-3')}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          // 메뉴별 배지 카운트
          let badgeCount = 0
          let badgeLabel = ''
          if (href === '/dashboard')      { badgeCount = delayedCount;        badgeLabel = '주의' }
          else if (href === '/uxi-lab')   { badgeCount = recentUxiCount;      badgeLabel = '신규' }
          else if (href === '/feedback')  { badgeCount = recentFeedbackCount; badgeLabel = '신규' }
          const showBadge = badgeCount > 0
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? `${label}${showBadge ? ` · ${badgeLabel} ${badgeCount}` : ''}` : undefined}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-colors relative',
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{label}</span>
                  {showBadge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                      {badgeCount}
                    </span>
                  )}
                </>
              )}
              {collapsed && showBadge && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
              )}
            </Link>
          )
        })}

        {/* 관리자 메뉴 — admin만 표시 */}
        {isAdmin && (
          <>
            {!collapsed && (
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">관리</p>
              </div>
            )}
            {collapsed && <div className="my-2 border-t border-gray-700" />}
            <Link
              href="/admin"
              title={collapsed ? `관리자${pendingNewCount > 0 ? ` · 신규 ${pendingNewCount}` : ''}` : undefined}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-colors relative',
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                pathname === '/admin' || pathname.startsWith('/admin/')
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <ShieldCheck size={18} className="flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">관리자</span>
                  {pendingNewCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                      {pendingNewCount}
                    </span>
                  )}
                </>
              )}
              {collapsed && pendingNewCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
              )}
            </Link>
          </>
        )}
      </nav>

      {/* 유저 정보 + 로그아웃 */}
      <div className={cn('border-t border-gray-700', collapsed ? 'px-1 py-3' : 'px-4 py-4')}>
        {!collapsed && (
          <div className="flex items-center gap-3 mb-3">
            {userAvatar ? (
              <img src={userAvatar} alt={userName ?? ''}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {userName?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-200 truncate">{userName ?? '...'}</p>
              <p className="text-xs text-gray-500 truncate">{userEmail ?? ''}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          title={collapsed ? '로그아웃' : undefined}
          className={cn(
            'w-full flex items-center text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer',
            collapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2'
          )}
        >
          <LogOut size={14} className="flex-shrink-0" />
          {!collapsed && '로그아웃'}
        </button>
      </div>

      {/* 접기/펼치기 버튼 */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-7 z-50 w-6 h-6 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-gray-300 hover:bg-gray-600 hover:text-white transition-colors shadow-md cursor-pointer"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
