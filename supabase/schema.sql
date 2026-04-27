-- ============================================
-- Project Calendar - Supabase Schema
-- Supabase SQL Editor에 이 전체 내용을 붙여넣고 실행하세요
-- ============================================

-- 1. 팀원 테이블
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text not null check (department in ('PM', 'BE', 'FE', 'UXD', 'Design', 'Oth')),
  email text unique,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. 프로젝트 & 태스크 테이블 (계층 구조)
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.projects(id) on delete cascade,
  category text not null default '신규기능',
  name text not null,
  jira_ticket text,
  status text not null default '대기' check (status in ('완료', '진행', '대기', '보류', '예정')),
  department text check (department in ('PM', 'BE', 'FE', 'UXD', 'Design', 'Oth')),
  assignees text[] default '{}',
  start_date date,
  end_date date,
  lts_date date,
  is_archived boolean default false,
  sort_order integer default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. 태스크 진척도 표시 (날짜별 표시)
create table public.task_progress (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  progress_date date not null,
  label text,
  color text default '#3B82F6',
  created_at timestamptz default now(),
  unique(project_id, progress_date)
);

-- 4. NEXT UP 백로그
create table public.next_up (
  id uuid primary key default gen_random_uuid(),
  business_type text check (business_type in ('거래액', '고객경험', '생산성', '기타')),
  initiator text,
  name text not null,
  planned_start text,
  lts_target text,
  assignee text,
  notes text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- 5. UXI LAB 아이디어 대기열
create table public.uxi_lab (
  id uuid primary key default gen_random_uuid(),
  priority integer,
  category text,
  agenda text not null,
  business_impact integer default 0 check (business_impact between 0 and 5),
  ux_impact integer default 0 check (ux_impact between 0 and 5),
  effort text check (effort in ('Low', 'Medium', 'High')),
  notes text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- ============================================
-- updated_at 자동 갱신 트리거
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function update_updated_at();

-- ============================================
-- Row Level Security (팀원만 접근 가능)
-- ============================================
alter table public.team_members enable row level security;
alter table public.projects enable row level security;
alter table public.task_progress enable row level security;
alter table public.next_up enable row level security;
alter table public.uxi_lab enable row level security;

-- 인증된 사용자는 모두 읽기/쓰기 가능
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

-- ============================================
-- 초기 데이터 (현재 엑셀에서 가져온 팀원)
-- ============================================
insert into public.team_members (name, department) values
  ('조용익', 'PM'),
  ('조하영', 'PM'),
  ('심다혜', 'PM'),
  ('강성훈', 'BE'),
  ('이지희', 'BE'),
  ('이진욱', 'BE'),
  ('이동훈', 'BE'),
  ('김재범', 'BE'),
  ('윤영주', 'FE'),
  ('노현주', 'FE'),
  ('주영석', 'FE'),
  ('김민수', 'UXD'),
  ('장주빈', 'Design');
