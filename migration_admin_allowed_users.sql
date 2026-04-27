-- ============================================================
-- allowed_users 테이블 생성
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.allowed_users (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email         text        UNIQUE NOT NULL,
  name          text,
  role          text        DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  is_active     boolean     DEFAULT true,
  last_login_at timestamptz,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- 2. CEO 초기 admin 등록
INSERT INTO public.allowed_users (email, name, role)
VALUES ('ceo@mustit.co.kr', '조용민', 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- 3. RLS 활성화
ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;

-- 4. admin 여부 확인 함수 (순환참조 방지를 위해 SECURITY DEFINER 사용)
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_users
    WHERE email     = (auth.jwt() ->> 'email')
      AND role      = 'admin'
      AND is_active = true
  )
$$;

-- 5. RLS 정책
-- 인증된 사용자는 전체 목록 조회 가능 (사이드바 admin 체크용)
CREATE POLICY "authenticated_read"
  ON public.allowed_users FOR SELECT
  TO authenticated
  USING (true);

-- 본인 last_login_at만 업데이트 가능
CREATE POLICY "update_own_last_login"
  ON public.allowed_users FOR UPDATE
  TO authenticated
  USING  (email = (auth.jwt() ->> 'email'))
  WITH CHECK (email = (auth.jwt() ->> 'email'));

-- admin은 INSERT / DELETE / 전체 UPDATE 가능
CREATE POLICY "admin_insert"
  ON public.allowed_users FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_is_admin());

CREATE POLICY "admin_delete"
  ON public.allowed_users FOR DELETE
  TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY "admin_update_all"
  ON public.allowed_users FOR UPDATE
  TO authenticated
  USING  (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());
