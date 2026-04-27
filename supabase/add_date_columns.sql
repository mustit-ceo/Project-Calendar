-- ============================================
-- 마이그레이션: projects 테이블에 날짜 컬럼 추가
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- ============================================

-- 컬럼이 없는 경우에만 추가 (이미 있어도 에러 없음)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date   date,
  ADD COLUMN IF NOT EXISTS lts_date   date;

-- 적용 확인 (컬럼 목록 조회)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'projects'
  AND column_name  IN ('start_date', 'end_date', 'lts_date')
ORDER BY column_name;
