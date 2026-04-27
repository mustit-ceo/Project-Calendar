-- ============================================
-- 변경 이력 v2 — 캘린더 작업일자(task_progress) 변경 기록 추가
-- 적용: Supabase SQL Editor 에 전체 붙여넣고 실행
-- ============================================

CREATE OR REPLACE FUNCTION public.log_task_progress_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_name  text;
  v_jwt   jsonb;
  v_pname text;
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
    SELECT name INTO v_pname FROM public.projects WHERE id = NEW.project_id;
    INSERT INTO public.project_history
      (project_id, project_name, changed_by_email, changed_by_name, action,
       field_name, old_value, new_value)
    VALUES (NEW.project_id, COALESCE(v_pname, '?'), v_email, v_name, 'update',
            'progress', NULL, NEW.progress_date::text);
    RETURN NEW;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    SELECT name INTO v_pname FROM public.projects WHERE id = OLD.project_id;
    INSERT INTO public.project_history
      (project_id, project_name, changed_by_email, changed_by_name, action,
       field_name, old_value, new_value)
    VALUES (OLD.project_id, COALESCE(v_pname, '?'), v_email, v_name, 'update',
            'progress', OLD.progress_date::text, NULL);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS task_progress_history_trigger ON public.task_progress;
CREATE TRIGGER task_progress_history_trigger
  AFTER INSERT OR DELETE ON public.task_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.log_task_progress_change();
