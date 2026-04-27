-- ============================================================
-- Backlog 초기 데이터 마이그레이션
-- add_backlog_column.sql 실행 후 이 파일을 실행하세요
-- ============================================================

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'Search', 'Search 가격 계산 > 품절/판매중지 상품 제외', 'PROJ-9113', '예정', 'BE', '{"강성훈"}',
   NULL, 0, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'Order', 'toss payments로 결제시 partner_id 누락되는 이슈', NULL, '보류', 'BE', '{"강성훈"}',
   NULL, 1, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'Item', 'EP > search_tag 개선', 'PROJ-9000', '예정', 'PM', '{"조용익"}',
   NULL, 2, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'Web', '도메인 별 auth 관련 로직 통일 (only cookie 기반으로 SSoT)', NULL, '예정', 'FE', '{"윤영주"}',
   NULL, 3, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'Web', 'google search console SEO 도입', NULL, '완료', 'FE', '{"윤영주"}',
   NULL, 4, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'All', '마수동 동기화 이슈', NULL, '예정', NULL, '{}',
   NULL, 5, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'All', '도메인간, 부서간 네이밍 컨벤션 이슈 DD', NULL, '예정', NULL, '{}',
   NULL, 6, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'DevOps', '[Biz-Api] JDK 버전 업그레이드 (JDK 11 -> JDK17)', 'TECH-25306', '완료', 'BE', '{"심지영"}',
   NULL, 7, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'FE', '3rd party log system 일원화', NULL, '예정', 'FE', '{"윤영주"}',
   NULL, 8, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'DevOps', 'Jenkins -> Github Action 전환', NULL, '예정', 'BE', '{"심지영"}',
   NULL, 9, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'Admin', '어드민 > 마켓관리 > 상품관리 조회 성능 개선', NULL, '예정', 'BE', '{"강성훈"}',
   NULL, 10, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'Web', 'PHP의 session 및 utm handle 관련 node 서버로 분리 이전', NULL, '예정', NULL, '{}',
   NULL, 11, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'Web', '기획전 배너 모듈에 영상 관련 확장자 추가 (video ai 생성 기반 영상을 보여주자는 취지)', NULL, '예정', NULL, '{}',
   NULL, 12, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'DevOps', 'HTTP 1.1 -> HTTP 2', NULL, '대기', NULL, '{}',
   NULL, 13, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'DevOps', 'AWS ElastiCache for Redis OSS 업그레이드 (~2026/1/31)', NULL, '완료', 'BE', '{"심지영"}',
   NULL, 14, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'DevOps', 'AWS IAM 권한 정리', NULL, '예정', 'BE', '{"심지영"}',
   NULL, 15, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'DevOps', 'AWS EKS1.33 버전 업그레이드(~2026/3/23) - Blue-Green 방식 사전 준비 포함', NULL, '완료', 'BE', '{"심지영"}',
   NULL, 16, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', 'AWS MSK 장애 감지 및 Teams 알림 구성', NULL, '예정', 'BE', '{"김재범"}',
   NULL, 17, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', 'main, dev 브랜치 코드 동기화 작업', NULL, '예정', 'BE', '{"김재범"}',
   NULL, 18, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', '어드민 > 회원관리 > 판매회원 접속 느린 이슈 확인', NULL, '예정', 'BE', '{"강성훈"}',
   NULL, 19, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', '네이버 EP > 제품코드(manufacture_define_number) 전송', 'PROJ-9057', '예정', 'BE', '{"강성훈"}',
   NULL, 20, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', 'n8n 머스트잇 서비스 장애 분석 자동화(코드, 쿼리, 데이터분석) (AI 에이전트, 워크플로우)', NULL, '예정', 'BE', '{"이동훈"}',
   NULL, 21, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', 'QA 자동화 MCP 개발(PRD를 통한 QA리스트 분석, 웹브라우져 크롤링 QA)', NULL, '예정', 'BE', '{"이동훈"}',
   NULL, 22, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', '판매자 신용등급에 따른 무료 상품등록개수 제한 로직 제거 필요(없어진 기능이지만 여전히 상품등록/수정 등등 여러 곳곳에서 체크 로직이 수행되고 있음)', NULL, '예정', 'BE', '{"김재범"}',
   NULL, 23, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', '팀즈 웹훅 로직 제거 필요(코드상 존재로 인해 혼란) - 해당 웹훅을 사용하는 채널이 없거나, Teams Connectors(웹훅 연결 앱) deprecated로 인해 제거 필요 또는 Teams Workflows로 이관 필요', NULL, '예정', 'BE', '{"김재범"}',
   NULL, 24, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', '[카탈로그] 카탈로그 최저가 Search vs Catalog sync 이슈', NULL, '예정', 'BE', '{"김재범"}',
   NULL, 25, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', '[결제/PG] 사이트 주문 발생했으나 PG 주문 미접수', 'TECH-25484', '보류', 'BE', '{"강성훈"}',
   NULL, 26, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', 'GitFlow 검토 및 적용', NULL, '예정', 'BE', '{}',
   NULL, 27, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'DevOps', '비밀번호 변경 후 로그인되지 않는 이슈 (FAQ 작성)', NULL, '예정', 'BE', '{}',
   NULL, 28, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'DevOps', 'MS365, Jira, Wiki, AD 등 계정관련 팀즈채널 신설', NULL, '예정', 'BE', '{}',
   NULL, 29, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', '크론 현황 정리', NULL, '예정', 'BE', '{}',
   NULL, 30, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', 'partner-stream-cdc-cj-item consume deadlock 이슈 건', 'TECH-25503', '예정', 'BE', '{"김재범"}',
   NULL, 31, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', '[임직원 복지] 임직원 할인 쿠폰, 생일 적립금 자동 지급 Job - 임직원 할인 쿠폰 자동 생성 로직 수정', 'TECH-25504', '예정', 'BE', '{}',
   NULL, 32, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'FE', '사용자화면 &판매자 > 무료/선결제/착불 배송비 금액과 추가배송비 금액 구분 표기', NULL, '예정', NULL, '{}',
   NULL, 33, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'FE', '판매자 사이트 > 상품등록/수정 페이지 내 추가배송비 관리 팝업 적용하기 버튼 삭제', NULL, '예정', NULL, '{}',
   NULL, 34, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'FE', '판매자 사이트 > 배송정보관리 페이지 추가배송비 설정 불가 제어 필요(묶음배송 설정 상품)', NULL, '예정', NULL, '{}',
   NULL, 35, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'FE', '무료배송 + 추가배송비 설정 상품 옵션별 배송비 합산 불가 처리 필요', NULL, '예정', NULL, '{}',
   NULL, 36, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', '[SRP/Diver] ''티셔츠'' 등 범용적인 키워드 검색 시, 응답이 느린 이슈 확인', NULL, '예정', NULL, '{}',
   NULL, 37, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', 'search job index 성능개선', NULL, '예정', 'BE', '{}',
   NULL, 38, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'APP', '[APP] 홈 메인 이동 시, 모든 적층창 창 닫고 이동', 'PROJ-9228', '완료', 'FE', '{"윤영주"}',
   NULL, 39, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), '주문', '배송지 변경 UX 개선', 'PROJ-9229', '예정', 'FE', '{}',
   NULL, 40, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'BE', 'n8n 운영데이터 분석 AGENT 추가', NULL, '예정', 'BE', '{"이동훈"}',
   NULL, 41, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'Search', '정렬필터 이슈 개선 (머스트잇 랭킹순 외 상품단위 검색 이슈)', NULL, '예정', 'PM', '{"조용익"}',
   NULL, 42, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'FE', 'RN + OTA로 현 네이티브 대체가 가능할지 실험', 'TECH-25781', '예정', 'FE', '{}',
   NULL, 43, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), '기타', '인기 상품 자동 추출 및 대시보드화', NULL, '대기', NULL, '{}',
   NULL, 44, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), '기타', '몰로코 홈 인벤토리', NULL, '대기', NULL, '{}',
   NULL, 45, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), '기타', 'AI 이미지 생성 자동화', NULL, '대기', NULL, '{}',
   NULL, 46, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), '기타', '해외 마켓 판매 구조 전환 (세금계산서 역발행 및 수출 신고)', NULL, '대기', NULL, '{}',
   NULL, 47, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), '기타', '상품명 AI 클렌징', NULL, '대기', NULL, '{}',
   NULL, 48, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'FE', 'PDP style review migration', 'TECH-25791', '완료', 'FE', '{"조현빈"}',
   NULL, 49, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'FE', 'PDP catalog migration', 'TECH-25876', '예정', 'FE', '{"조현빈"}',
   NULL, 50, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'FE', 'PDP seller review migration', NULL, '예정', 'FE', '{"조현빈"}',
   NULL, 51, true, false, NULL, NULL, NULL);

INSERT INTO public.projects
  (id, category, name, jira_ticket, status, department, assignees,
   parent_id, sort_order, is_backlog, is_archived, lts_date, start_date, end_date)
VALUES
  (gen_random_uuid(), 'FE', 'Naver 로그인 개선', NULL, '예정', 'FE', '{}',
   NULL, 52, true, false, NULL, NULL, NULL);
