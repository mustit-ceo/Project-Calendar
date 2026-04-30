-- ============================================================
-- 공휴일 관리 테이블 + 한국 법정 공휴일 기본 데이터
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.holidays (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  date       date        NOT NULL UNIQUE,
  name       text        NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read" ON public.holidays;
CREATE POLICY "authenticated_read"
  ON public.holidays FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_all" ON public.holidays;
CREATE POLICY "admin_all"
  ON public.holidays FOR ALL
  TO authenticated
  USING  (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- 2026년 한국 법정 공휴일 (대체공휴일은 검토 후 별도 추가)
INSERT INTO public.holidays (date, name) VALUES
  ('2026-01-01', '신정'),
  ('2026-02-16', '설날 연휴'),
  ('2026-02-17', '설날'),
  ('2026-02-18', '설날 연휴'),
  ('2026-03-01', '삼일절'),
  ('2026-05-05', '어린이날'),
  ('2026-05-24', '부처님오신날'),
  ('2026-06-06', '현충일'),
  ('2026-08-15', '광복절'),
  ('2026-09-24', '추석 연휴'),
  ('2026-09-25', '추석'),
  ('2026-09-26', '추석 연휴'),
  ('2026-10-03', '개천절'),
  ('2026-10-09', '한글날'),
  ('2026-12-25', '크리스마스')
ON CONFLICT (date) DO NOTHING;

-- 2027년 (음력 공휴일 정확한 날짜는 추후 검토 필요)
INSERT INTO public.holidays (date, name) VALUES
  ('2027-01-01', '신정'),
  ('2027-02-06', '설날 연휴'),
  ('2027-02-07', '설날'),
  ('2027-02-08', '설날 연휴'),
  ('2027-03-01', '삼일절'),
  ('2027-05-05', '어린이날'),
  ('2027-05-13', '부처님오신날'),
  ('2027-06-06', '현충일'),
  ('2027-08-15', '광복절'),
  ('2027-09-14', '추석 연휴'),
  ('2027-09-15', '추석'),
  ('2027-09-16', '추석 연휴'),
  ('2027-10-03', '개천절'),
  ('2027-10-09', '한글날'),
  ('2027-12-25', '크리스마스')
ON CONFLICT (date) DO NOTHING;
