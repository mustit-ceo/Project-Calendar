-- ============================================================
-- 첫 로그인 시 allowed_users 자동 등록 허용
-- 실행 위치: Supabase Dashboard → SQL Editor
--
-- 효과:
--   - 인증된 사용자가 본인 이메일로만 INSERT 가능
--   - 미들웨어가 이미 @mustit.co.kr 도메인만 허용하므로 외부인 차단 유지
--   - admin_insert 정책과 OR로 결합되어 관리자는 여전히 다른 이메일도 추가 가능
-- ============================================================

DROP POLICY IF EXISTS "self_insert_on_login" ON public.allowed_users;

CREATE POLICY "self_insert_on_login"
  ON public.allowed_users FOR INSERT
  TO authenticated
  WITH CHECK (
    email = (auth.jwt() ->> 'email')
  );
