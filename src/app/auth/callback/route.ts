import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin: requestOrigin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/calendar'

  // 프록시(Railway) 뒤에서 실제 외부 호스트 복원
  const forwardedHost  = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : requestOrigin

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const email = sessionData?.user?.email
      if (email) {
        const meta = sessionData?.user?.user_metadata as
          { full_name?: string; name?: string } | undefined
        const name = meta?.full_name ?? meta?.name ?? null
        const now = new Date().toISOString()

        // 신규 사용자면 자동 등록 (이미 있으면 무시 — name 덮어쓰기 방지)
        await supabase
          .from('allowed_users')
          .upsert(
            { email, name, last_login_at: now },
            { onConflict: 'email', ignoreDuplicates: true }
          )

        // 마지막 로그인 시각 갱신 (기존 사용자도 포함)
        await supabase
          .from('allowed_users')
          .update({ last_login_at: now })
          .eq('email', email)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback`)
}
