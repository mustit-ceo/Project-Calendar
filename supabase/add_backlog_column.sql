-- ============================================
-- 마이그레이션: projects 테이블에 is_backlog 컬럼 추가
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- ============================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_backlog boolean NOT NULL DEFAULT false;

-- 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'projects'
  AND column_name  = 'is_backlog';
