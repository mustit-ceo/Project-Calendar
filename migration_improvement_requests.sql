-- ============================================================
-- improvement_requests 테이블 생성
-- 사용자가 프로그램 관련 개선사항/아이디어를 등록
-- 텍스트, 링크, 이미지 URL 배열, 작성자 이메일/이름, 등록 시점 기록
-- ============================================================

CREATE TABLE IF NOT EXISTS public.improvement_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  text NOT NULL,
  user_name   text NULL,
  content     text NOT NULL,
  link        text NULL,
  image_urls  text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- updated_at 자동 갱신
DROP TRIGGER IF EXISTS trg_improvement_requests_updated_at ON public.improvement_requests;
CREATE TRIGGER trg_improvement_requests_updated_at
  BEFORE UPDATE ON public.improvement_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 정렬용 인덱스 (최신순 조회)
CREATE INDEX IF NOT EXISTS idx_improvement_requests_created_at
  ON public.improvement_requests (created_at DESC);

-- RLS 활성화
ALTER TABLE public.improvement_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated" ON public.improvement_requests;
CREATE POLICY "allow_authenticated"
  ON public.improvement_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Supabase Storage 버킷 생성 (이미지 첨부용)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('improvement-images', 'improvement-images', true)
ON CONFLICT (id) DO NOTHING;

-- 버킷 RLS: 인증된 사용자는 업로드/조회 가능
DROP POLICY IF EXISTS "improvement_images_authenticated_all" ON storage.objects;
CREATE POLICY "improvement_images_authenticated_all"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'improvement-images')
  WITH CHECK (bucket_id = 'improvement-images');

-- 누구나 이미지 조회 가능 (public bucket)
DROP POLICY IF EXISTS "improvement_images_public_read" ON storage.objects;
CREATE POLICY "improvement_images_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'improvement-images');
