-- ============================================
-- RLS 정책 패치 — 로그인 기능 추가 후 실행
-- 기존 anon 허용 정책을 authenticated 전용으로 복구
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 기존 정책 모두 삭제
drop policy if exists "all users can do everything" on public.projects;
drop policy if exists "all users can do everything" on public.task_progress;
drop policy if exists "all users can do everything" on public.next_up;
drop policy if exists "all users can do everything" on public.uxi_lab;
drop policy if exists "all users can do everything" on public.team_members;

drop policy if exists "authenticated users can do everything" on public.projects;
drop policy if exists "authenticated users can do everything" on public.task_progress;
drop policy if exists "authenticated users can do everything" on public.next_up;
drop policy if exists "authenticated users can do everything" on public.uxi_lab;
drop policy if exists "authenticated users can do everything" on public.team_members;

-- 로그인한 사용자(authenticated)만 허용
create policy "authenticated users can do everything" on public.projects
  for all to authenticated using (true) with check (true);

create policy "authenticated users can do everything" on public.task_progress
  for all to authenticated using (true) with check (true);

create policy "authenticated users can do everything" on public.next_up
  for all to authenticated using (true) with check (true);

create policy "authenticated users can do everything" on public.uxi_lab
  for all to authenticated using (true) with check (true);

create policy "authenticated users can do everything" on public.team_members
  for all to authenticated using (true) with check (true);
