-- ============================================
-- 프로젝트 변경 이력 (Audit Log)
-- 추적 범위: 생성/삭제 + status, start_date, end_date, lts_date 변경
-- 적용: Supabase SQL Editor에 전체 붙여넣고 실행
-- ============================================

CREATE TABLE IF NOT EXISTS public.project_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL,
  project_name     text NOT NULL,
  changed_by_email text,
  changed_by_name  text,
  changed_at       timestamptz NOT NULL DEFAULT now(),
  action           text NOT NULL CHECK (action IN ('create','update','delete')),
  field_name       text,
  old_value        text,
  new_value        text
);

CREATE INDEX IF NOT EXISTS project_history_project_idx
  ON public.project_history (project_id, changed_at DESC);

ALTER TABLE public.project_history ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 모두 읽기 가능
DROP POLICY IF EXISTS "history_read" ON public.project_history;
CREATE POLICY "history_read" ON public.project_history
  FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE/DELETE 정책은 만들지 않음 → 직접 쓰기 차단
-- 트리거는 SECURITY DEFINER 로 RLS 우회

-- ============================================
-- 변경 이력 자동 기록 트리거
-- ============================================
CREATE OR REPLACE FUNCTION public.log_project_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_name  text;
  v_jwt   jsonb;
BEGIN
  -- JWT 클레임에서 email / 이름 추출 (없으면 NULL)
  BEGIN
    v_jwt := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt := NULL;
  END;
  v_email := v_jwt ->> 'email';
  v_name  := COALESCE(
    v_jwt -> 'user_metadata' ->> 'full_name',
    v_jwt -> 'user_metadata' ->> 'name'
  );

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.project_history
      (project_id, project_name, changed_by_email, changed_by_name, action)
    VALUES (NEW.id, NEW.name, v_email, v_name, 'create');
    RETURN NEW;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.project_history
      (project_id, project_name, changed_by_email, changed_by_name, action)
    VALUES (OLD.id, OLD.name, v_email, v_name, 'delete');
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    -- status
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.project_history
        (project_id, project_name, changed_by_email, changed_by_name, action,
         field_name, old_value, new_value)
      VALUES (NEW.id, NEW.name, v_email, v_name, 'update',
              'status', OLD.status, NEW.status);
    END IF;
    -- start_date
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
      INSERT INTO public.project_history
        (project_id, project_name, changed_by_email, changed_by_name, action,
         field_name, old_value, new_value)
      VALUES (NEW.id, NEW.name, v_email, v_name, 'update',
              'start_date', OLD.start_date::text, NEW.start_date::text);
    END IF;
    -- end_date
    IF NEW.end_date IS DISTINCT FROM OLD.end_date THEN
      INSERT INTO public.project_history
        (project_id, project_name, changed_by_email, changed_by_name, action,
         field_name, old_value, new_value)
      VALUES (NEW.id, NEW.name, v_email, v_name, 'update',
              'end_date', OLD.end_date::text, NEW.end_date::text);
    END IF;
    -- lts_date
    IF NEW.lts_date IS DISTINCT FROM OLD.lts_date THEN
      INSERT INTO public.project_history
        (project_id, project_name, changed_by_email, changed_by_name, action,
         field_name, old_value, new_value)
      VALUES (NEW.id, NEW.name, v_email, v_name, 'update',
              'lts_date', OLD.lts_date::text, NEW.lts_date::text);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS projects_history_trigger ON public.projects;
CREATE TRIGGER projects_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_project_change();
