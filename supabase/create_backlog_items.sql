-- ============================================================
-- backlog_items 테이블 생성
-- projects 테이블과 완전히 분리된 독립 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS public.backlog_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    text NOT NULL DEFAULT '기타',
  name        text NOT NULL,
  jira_ticket text NULL,
  status      text NOT NULL DEFAULT '대기',
  department  text NULL,
  assignees   text[] NOT NULL DEFAULT '{}',
  sort_order  integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- updated_at 자동 갱신 트리거 (projects 테이블과 동일한 방식)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_backlog_items_updated_at ON public.backlog_items;
CREATE TRIGGER trg_backlog_items_updated_at
  BEFORE UPDATE ON public.backlog_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS 활성화 (다른 테이블과 동일)
ALTER TABLE public.backlog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated" ON public.backlog_items;
CREATE POLICY "allow_authenticated"
  ON public.backlog_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
