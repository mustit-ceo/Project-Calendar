-- ============================================================
-- improvement_comments 테이블 생성
-- improvement_requests 게시글에 달리는 코멘트
-- 게시글이 삭제되면 ON DELETE CASCADE로 함께 정리됨
-- ============================================================

CREATE TABLE IF NOT EXISTS public.improvement_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES public.improvement_requests(id) ON DELETE CASCADE,
  user_email  text NOT NULL,
  user_name   text NULL,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- updated_at 자동 갱신
DROP TRIGGER IF EXISTS trg_improvement_comments_updated_at ON public.improvement_comments;
CREATE TRIGGER trg_improvement_comments_updated_at
  BEFORE UPDATE ON public.improvement_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 게시글별 시간순 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_improvement_comments_request_created
  ON public.improvement_comments (request_id, created_at ASC);

-- RLS 활성화
ALTER TABLE public.improvement_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated" ON public.improvement_comments;
CREATE POLICY "allow_authenticated"
  ON public.improvement_comments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
