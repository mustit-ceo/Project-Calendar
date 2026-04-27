import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/config'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const isAuthCallback = pathname.startsWith('/auth/')

  // 콜백 라우트는 자체적으로 세션 처리 — 미들웨어 검사 생략
  if (isAuthCallback) {
    supabaseResponse.headers.set('x-pathname', pathname)
    return supabaseResponse
  }

  const { data: { user } } = await supabase.auth.getUser()

  // 인증 안 됨 — 로그인 페이지만 허용
  if (!user) {
    if (isLoginPage) return supabaseResponse
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 등록·활성화 여부 확인
  const { data: allowedUser } = await supabase
    .from('allowed_users')
    .select('is_active')
    .eq('email', user.email ?? '')
    .maybeSingle()

  const isActive = !!allowedUser?.is_active

  // 비활성/미등록 — 로그인 페이지에서 안내, 그 외는 차단
  if (!isActive) {
    if (isLoginPage) return supabaseResponse
    await supabase.auth.signOut()
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'pending')
    return NextResponse.redirect(url)
  }

  // 활성 사용자가 로그인 페이지 접근 → 캘린더로
  if (isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/calendar'
    return NextResponse.redirect(url)
  }

  supabaseResponse.headers.set('x-pathname', pathname)
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
