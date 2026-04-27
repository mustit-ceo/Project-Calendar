# Project Calendar

mustit 팀 전용 프로젝트 캘린더 (Next.js + Supabase)

---

## 로컬 개발

```bash
npm install
npm run dev
```

`.env.local` 파일 필요:
```
NEXT_PUBLIC_SUPABASE_URL=https://xkuavynkjudofdvsyziy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_QWD9YCS7Nix6jLqhXy4i0Q_Ep3NgyjD
```

---

## Railway 배포

### 구성
- **플랫폼**: Railway (railway.app)
- **GitHub 레포**: mustit-ceo/Project-Calendar (브랜치: master)
- **DB**: Supabase (별도 서버 없이 기존 인스턴스 사용)
- **포트**: 8080 (Railway 자동 지정)

### 배포 방법
`master` 브랜치에 push하면 Railway가 자동으로 감지해서 재빌드/배포해요.

```bash
git add .
git commit -m "커밋 메시지"
git push origin master
```

### 주의사항

**Supabase 설정 위치**
환경변수 문제를 피하기 위해 Supabase URL과 키는 `src/lib/supabase/config.ts`에 직접 정의되어 있어요.
Railway 환경변수(`NEXT_PUBLIC_SUPABASE_URL` 등)가 있으면 그걸 우선 사용하고, 없으면 파일 내 기본값을 사용해요.

**Railway 환경변수 (Variables 탭)**
| 변수명 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 |
| `SUPABASE_URL` | 서버/미들웨어용 URL |
| `SUPABASE_ANON_KEY` | 서버/미들웨어용 키 |

**Networking 포트**: 도메인 생성 시 포트 `8080` 사용

**Railway 빌드 캐시 문제**
빌드 캐시로 인해 코드 변경이 반영 안 될 경우, 빈 커밋으로 재빌드 트리거:
```bash
git commit --allow-empty -m "trigger redeploy"
git push origin master
```

### TypeScript 빌드 에러 발생 시
Railway는 `npm run build` 시 TypeScript 타입 체크를 실행해요.
타입 에러가 있으면 배포가 실패하므로 로컬에서 먼저 확인:
```bash
npm run build
```
