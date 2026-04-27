-- ============================================================
-- 외부 Google 계정 가입 시 관리자 승인 필요
-- 실행 위치: Supabase Dashboard → SQL Editor
--
-- 변경 내용:
--   - 일반 사용자는 본인 row를 반드시
--     is_active=false, role='member'로만 INSERT 가능
--   - 미들웨어가 is_active=true 사용자만 통과시키므로
--     관리자가 admin 화면에서 활성화 토글을 켜야 사용 가능
--   - admin은 기존 admin_insert 정책으로 자유롭게 추가 가능
-- ============================================================

DROP POLICY IF EXISTS "self_insert_on_login" ON public.allowed_users;

CREATE POLICY "self_insert_on_login"
  ON public.allowed_users FOR INSERT
  TO authenticated
  WITH CHECK (
    email = (auth.jwt() ->> 'email')
    AND is_active = false
    AND role = 'member'
  );
