-- ============================================================
-- task_progress RLS 정책 보장
-- 실행 위치: Supabase Dashboard → SQL Editor
--
-- 증상: 일정 추가 후 변경 이력에는 기록되지만 간트에는 안 보임 →
-- INSERT는 통과하지만 SELECT 정책이 row를 가려 fetchAll에 안 잡힘.
-- 모든 인증 사용자에게 ALL 권한 명시 (SELECT/INSERT/UPDATE/DELETE).
-- ============================================================

ALTER TABLE public.task_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_progress_authenticated_all" ON public.task_progress;
CREATE POLICY "task_progress_authenticated_all"
  ON public.task_progress
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 검증: 정책 확인
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'task_progress';
