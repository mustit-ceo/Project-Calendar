-- team_members 테이블에 is_leader 컬럼 추가
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS is_leader BOOLEAN NOT NULL DEFAULT FALSE;
