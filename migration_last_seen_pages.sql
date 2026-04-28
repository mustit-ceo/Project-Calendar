-- ============================================================
-- 사용자별 페이지 마지막 방문 시각 (배지 dismiss 용)
-- 실행 위치: Supabase Dashboard → SQL Editor
--
-- 효과:
--   - 사용자가 UXI LAB / 개선사항 요청 페이지를 열면 해당 컬럼이 갱신됨
--   - Sidebar 배지는 (created_at > MAX(last_seen, now - 3일)) 인 row만 카운트
--   - 즉 페이지를 열어본 이후로는 새 글이 올라오기 전까지 배지 0
--
-- RLS는 update_own_last_login 정책이 본인 row UPDATE를 허용하므로
-- 별도 정책 추가 필요 없음.
-- ============================================================

ALTER TABLE public.allowed_users
  ADD COLUMN IF NOT EXISTS last_seen_uxi_lab  timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_feedback timestamptz;
