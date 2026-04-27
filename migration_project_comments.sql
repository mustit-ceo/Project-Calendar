-- ============================================
-- 프로젝트 코멘트 스레드
-- 권한: 누구나 작성 / 본인 글만 수정·삭제
-- 적용: Supabase SQL Editor 에 전체 붙여넣고 실행
-- ============================================

CREATE TABLE IF NOT EXISTS public.project_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_email text NOT NULL,
  author_name  text,
  content      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_comments_project_idx
  ON public.project_comments (project_id, created_at DESC);

-- updated_at 자동 갱신
DROP TRIGGER IF EXISTS project_comments_updated_at ON public.project_comments;
CREATE TRIGGER project_comments_updated_at
  BEFORE UPDATE ON public.project_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

-- 모두 읽기
DROP POLICY IF EXISTS "comments_read" ON public.project_comments;
CREATE POLICY "comments_read" ON public.project_comments
  FOR SELECT TO authenticated USING (true);

-- 누구나 작성 (단, author_email 은 자기 이메일이어야 함)
DROP POLICY IF EXISTS "comments_insert" ON public.project_comments;
CREATE POLICY "comments_insert" ON public.project_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_email = (auth.jwt() ->> 'email'));

-- 본인 글만 수정
DROP POLICY IF EXISTS "comments_update_own" ON public.project_comments;
CREATE POLICY "comments_update_own" ON public.project_comments
  FOR UPDATE TO authenticated
  USING (author_email = (auth.jwt() ->> 'email'))
  WITH CHECK (author_email = (auth.jwt() ->> 'email'));

-- 본인 글만 삭제
DROP POLICY IF EXISTS "comments_delete_own" ON public.project_comments;
CREATE POLICY "comments_delete_own" ON public.project_comments
  FOR DELETE TO authenticated
  USING (author_email = (auth.jwt() ->> 'email'));
