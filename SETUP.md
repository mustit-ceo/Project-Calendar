# 프로젝트 캘린더 웹 — 로컬 실행 가이드

## 1단계: Supabase 프로젝트 생성

1. https://supabase.com 접속 → 무료 계정 생성
2. **New Project** 클릭 → 프로젝트명 입력 (예: `project-calendar`)
3. 프로젝트 생성 후 **SQL Editor** 메뉴 클릭
4. `supabase/schema.sql` 파일 내용을 전체 복사 → SQL Editor에 붙여넣기 → **Run** 실행
5. 왼쪽 사이드바 **Settings → API** 에서 두 가지 값을 복사:
   - `Project URL` (예: `https://abcdef.supabase.co`)
   - `anon / public` 키

## 2단계: 환경변수 설정

```bash
# 이 폴더에서 실행
cp .env.local.example .env.local
```

`.env.local` 파일을 열고 값 입력:
```
NEXT_PUBLIC_SUPABASE_URL=https://여러분의-프로젝트.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...여러분의_anon_key...
```

## 3단계: 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속 → 자동으로 /calendar 로 이동

## 4단계: Vercel 배포 (팀원과 공유)

1. https://github.com 에서 새 레포지토리 생성
2. 이 폴더를 GitHub에 push:
   ```bash
   git init
   git add .
   git commit -m "초기 셋업"
   git remote add origin https://github.com/여러분/project-calendar.git
   git push -u origin main
   ```
3. https://vercel.com 접속 → **Import Project** → GitHub 레포 선택
4. **Environment Variables** 에서 `.env.local`의 두 값 입력
5. **Deploy** 클릭 → 팀원에게 URL 공유!

## 주요 기능

| 메뉴 | 설명 |
|------|------|
| 📅 캘린더 | 주간 Gantt 뷰 (엑셀 대체 핵심 화면) |
| 📋 프로젝트 목록 | 전체 프로젝트 CRUD + 검색/필터 |
| ✅ 완료 아카이브 | LTS 완료된 프로젝트 보관 |
| 🚀 NEXT UP | 착수 예정 프로젝트 백로그 |
| 💡 UXI LAB | 아이디어 우선순위 평가 |

## 다음 개발 (Phase 2)

바이브 코딩으로 추가할 기능들:
- Google 로그인 (팀원 인증)
- 실시간 동시 편집
- Slack 알림
- 완료 아카이브로 바로 이동 버튼
