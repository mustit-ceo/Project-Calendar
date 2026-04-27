-- ============================================================
-- Backlog: 중요도(별점) 컬럼 추가
-- 실행 위치: Supabase Dashboard → SQL Editor
--
-- 스케일: 0~5 (0 = 미설정, 1~5 = 별점)
-- ============================================================

ALTER TABLE public.backlog_items
  ADD COLUMN IF NOT EXISTS importance smallint NOT NULL DEFAULT 0
  CHECK (importance >= 0 AND importance <= 5);
