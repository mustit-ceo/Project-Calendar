-- ============================================================
-- update_last_seen RPC 함수
-- 실행 위치: Supabase Dashboard → SQL Editor
-- RLS를 우회하여 현재 로그인 유저의 last_login_at을 갱신
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_last_seen(user_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.allowed_users
  SET last_login_at = now()
  WHERE email = user_email;
$$;
