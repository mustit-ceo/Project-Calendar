-- ============================================================
-- 사용자별 운영 모니터링·관리자 페이지 마지막 방문 시각
-- 실행 위치: Supabase Dashboard → SQL Editor
--
-- 효과:
--   - 운영 모니터링 / 관리자 페이지를 열면 해당 컬럼이 갱신됨
--   - 운영 모니터링 배지: 지연 프로젝트 중 updated_at > last_seen_dashboard 인 것만
--   - 관리자 배지: 신규 가입(is_active=false) 중 created_at > MAX(last_seen_admin, now-3일)
--   - 즉 페이지를 한번 열어보면 기존 알림은 dismiss되고, 그 후 새 발생만 카운트
-- ============================================================

ALTER TABLE public.allowed_users
  ADD COLUMN IF NOT EXISTS last_seen_dashboard timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_admin     timestamptz;
