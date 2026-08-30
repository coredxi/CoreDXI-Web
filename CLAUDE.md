# CLAUDE.md — CoreDXI-Web

> 프로젝트 루트에 두는 파일. 루트 CLAUDE.md의 규칙을 상속하며, 충돌 시 루트가 우선한다.
> [ ] 부분을 채우고, 해당 없는 섹션은 "해당 없음"으로 남긴다(삭제 금지 — 구조 통일 목적).

---

## 1. 프로젝트 개요

- 한 줄 정의: (주)코어디엑스아이(CoreDXI)의 공식 기업 홈페이지 — B2B AX(AI 전환) 솔루션 마케팅 사이트 + 관리자 CMS
- 로드맵 내 위치: 1층 컨설팅 기여 (리드 깔때기) — 문의(리드) 전환율을 높여 컨설팅 매출로 이어지는 B2B 리드 확보 채널
- 수익 모델: 깔때기(직접 수익 없음) — 사이트 자체는 상품을 판매하지 않고, 문의(Contact) 전환을 통해 컨설팅 영업으로 연결
- 상태: 활성 (2026-08-03 기준, "AX Growth Engine" 2단계 고도화 진행 중)

## 2. 현재 단계 (5단계 파이프라인)

- 현재: 홍보 — 핵심 기능(마케팅 페이지·CMS·인증·인프라)은 이미 배포 완료된 상태이며, 지금은 전환율·리텐션을 끌어올리는 홍보/그로스 단계
- 이번 분기 목표: Phase 1 로드맵 4개 항목 전부 완료(CSP Enforcing 전환, 뉴스레터 구독, 소셜 메타태그 강화, 전환 퍼널 분석 대시보드 2단계 — 2026-08-30 실측 완료). **Phase 1 공식 종료**. 다음은 진행 중인 Phase 1.5 영업 지원 트랙(~10/31) 마무리, 이후 Phase 2 착수 검토
- 완료 기준(Definition of Done): 전환 퍼널 분석 대시보드가 프로덕션에 배포되고, 문의 전환율·소스별 전환율이 관리자 대시보드에서 정량적으로 확인 가능해지면 Phase 1 종료. Phase 2(CMS 구조 편집, 댓글/반응, 관리자 다크모드)는 Phase 1.5 종료 후(11월 이후) — **2026-08-30 DoD 충족 확인, Phase 1 공식 종료**
- **Phase 1.5 영업 지원 트랙(2026-08-22 신설, ~10/31)**: 2026-08-18 합류한 영업이사의 아웃바운드(카톡·메일로 소개서 1장 + `/ax-check?ref=` 링크)를 지원. 타깃은 IT·통신·AV 시스템 구축 업체 대표·영업 담당자, 중점 솔루션은 "중소기업 AI 도입·AX 전환 컨설팅" 단일 오퍼. 1단계(~09/05) `/ax-check` 8문항 깔때기 + 규칙 기반 즉시 요약 + `/admin/leads`, 2단계(~09/26) LLM 상세 진단서·솔루션 단일 오퍼 재편, 3단계(~10/31) 팔로업 뉴스레터 발송(8/8 범위 제외 결정 철회)·미팅 예약. 설계 `docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md`, 실행 `docs/superpowers/plans/2026-08-22-sales-enablement-action-plan.md`, 진행 현황은 Notion AI 비서 집무실
- 병행 트랙(Phase 1 DoD에는 미포함, 상시 콘텐츠 운영으로 취급): 2026-08-14 블로그 게시물 전량 삭제 후 재건, 2026-08-15 4편 발행 완료 — "선택적 콘텐츠 브릿지" 전략대로 대시보드 2단계 착수 전 콘텐츠 재입고 선완료(데이터 대표성 확보). 상세: `docs/superpowers/specs/2026-08-14-content-brand-strategy-design.md`

## 3. 기술 스택 · 환경

- 스택: Next.js 15(App Router) + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui, Prisma 7.x + PostgreSQL(Supabase), NextAuth v5(Auth.js)
- 저장소: https://github.com/DevCoreDXI76/CoreDXI-Web
- 배포: Vercel (`coredxi.com` → `www.coredxi.com` 301 리다이렉트, `postinstall`에서 `prisma generate` 자동 실행)
- 외부 연동:
  - Supabase — PostgreSQL DB + Storage(`blog-images` 버킷) + `contacts`/`contact_settings` 직접 생성 테이블
  - Google/Kakao/Naver OAuth — 일반 회원 로그인
  - Resend — OTP·문의 알림 이메일 + 뉴스레터 구독 확인 메일. `RESEND_AUDIENCE_ID` 설정 시 Audiences 자동 동기화(선택, 2026-08-08 완료)
  - Google Analytics 4 — gtag + Data API(관리자 대시보드 실시간 지표)
  - Sentry — 에러 모니터링(트레이스 샘플링 20%)
  - Notion — 개발 워크플로 기록 전용(git post-commit 훅). DB: `NOTION_PROJECTS_DB_ID`, `NOTION_DOCUMENTS_DB_ID`, `NOTION_TASKS_DB_ID`, `NOTION_BUGTRACKER_DB_ID`, `NOTION_DEPLOYMENTLOG_DB_ID`, `NOTION_PORTFOLIO_DB_ID`, `NOTION_TEMPLATESTOOLS_DB_ID` (세일즈 CRM 연동 확장 여부는 2026-07-07 보류 결정, 필요 시 재검토)

## 4. 디렉토리 구조

```
src/app/            # Next.js App Router — 공개 페이지, /admin(CMS), /api
src/components/     # UI 컴포넌트 (Header/Hero/Footer, admin/*, ui/* 등 shadcn 기반)
src/lib/            # 유틸·서비스 레이어 (prisma, auth, seo, resend, supabase, url-safety 등)
prisma/             # schema.prisma + migrations/ (수동 SQL, 아래 5번 참고)
docs/               # PRD.md(요구사항), TODO.md(구현 현황), superpowers/specs·plans(설계 문서)
scripts/            # Notion 연동용 Python 스크립트 (개발 워크플로 기록 전용, 앱 기능 아님)
```

## 5. 작업 규칙

- 커밋: Conventional Commits(`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`) 형식 유지 — post-commit 훅이 Notion Tasks DB에 자동 기록
- 테스트/검증: 배포 전 Vitest 유닛 테스트(`npm run test`) + Playwright E2E 골든패스(`npm run test:e2e`) + `npm run lint` + `npx tsc --noEmit` 통과 확인. CI(`ci.yml`)에서 lint+typecheck+test 자동 실행
- 금지 사항:
  - `prisma migrate dev` 사용 금지 — `contacts`/`contact_settings`(Supabase 직접 생성 테이블)와 충돌해 스키마 리셋 위험. 반드시 수동 `migration.sql` 작성 + `prisma migrate deploy`만 사용
  - `@tiptap/*` 버전은 `package.json overrides`로 `3.13.0` 고정 — 업그레이드 시 전체 회귀 테스트 필수
  - 신규 기능 착수 전 스코프 확장(임의 기능 추가) 금지 — `docs/PRD.md`/`docs/TODO.md`에 먼저 반영 후 개발, 새 기능은 `docs/superpowers/specs/`에 설계 문서 선행(CSP 설계 문서 사례 참고)
  - 브랜드 컬러(로열 블루 `#1E4E8C`, `primary` 토큰), 코너 반경 `0.75rem`(`rounded-xl`) 이상, 여백 중심 미니멀 톤앤톤 유지 — 임의의 blue-500 등 새 색상 추가 금지
  - 신규 UI는 shadcn/ui 컴포넌트 우선 사용, WCAG AA 대비 기준 검증
  - 신규 폼(뉴스레터 구독, 예약 시스템 등)은 기존 `RateLimitHit` 테이블 기반 rate limiting 패턴 재사용
  - 외부 서비스 연동(Calendly, Resend Audiences 등) 시 SSRF·CORS 정책은 기존 `src/lib/url-safety.ts` 패턴 동일 적용
  - Sentry 트레이스 샘플링(20%)·CSP nonce 정책은 신규 라우트 추가 시에도 예외 없이 적용
  - 컴포넌트 파일에는 비개발자(홍보팀)도 이해할 수 있는 한국어 주석(`[홍보팀]` 태그) 필수, `any` 타입 사용 금지, Named Export 방식 유지

## 6. 홍보 · 콘텐츠 연결 (3층 연결부)

- 이 프로젝트에서 나올 콘텐츠 소재: Phase 1~3 구축 과정(CSP 전환, 뉴스레터 오픈, 퍼널 대시보드 도입 등), 문의 전환율 개선 Before/After 사례
- 홍보 채널: CoreDXI 자사 블로그(`/blog`)
- 배포 단계 도달 시 홍보 단계를 건너뛰지 않는다 — 콘텐츠 수정은 `CONTENT_GUIDE.md`를 최신화하며 진행, 신규 CMS 기능 추가 시마다 가이드 문서도 함께 갱신
- 콘텐츠 소싱 원칙(2026-08-14 명문화): 외부 사이트 복붙 금지. 신규 글은 (a) 검증된 리서치 파이프라인 산출물 재가공 또는 (b) 출처 표기를 갖춘 직접 리서치로만 작성 — 상세 `CONTENT_GUIDE.md` 16번
- 2026-08-14 기준 블로그 게시물 전량 삭제 후 재건 중 — 바이라인은 "CoreDXI 팀" 명의로 통일, 재건 전략은 `docs/superpowers/specs/2026-08-14-content-brand-strategy-design.md` 참고

## 7. 세션 로그 (기록 에이전트)

- 세션 종료 시 루트 규칙 5번 형식으로 노션 작업 로그 DB(`NOTION_TASKS_DB_ID`)에 기록 — git post-commit 훅(`scripts/notion_post_commit.py`)이 자동 처리
- 프로젝트 태그: `CoreDXI-Web` (Notion Projects DB `NOTION_PROJECT_PAGE_ID`와 연결)
- 사용 도구는 `.claude`/`.cursor` 폴더 최근 수정 시각으로 자동 추정되며, 필요 시 `.env`의 `VIBE_CODING_TOOL`로 수동 지정 가능

## 8. 백로그 · 다음 할 일

- [x] CSP Report-Only → Enforcing 전환 (2026-08-05 완료)
- [x] 뉴스레터 구독 기능 — Footer 전체 페이지 공통 구독 폼(팝업 아님), `RESEND_AUDIENCE_ID` 설정 시에만 Resend Audiences 선택적 동기화 (2026-08-08 완료. 실제 발송 파이프라인은 범위 제외, 별도 트랙)
- [x] 블로그·성공사례별 OG/Twitter Card 커스텀 이미지 (소셜 메타태그 강화, 2026-08-07 완료)
- [x] 전환 퍼널 분석 대시보드 — GA4 이벤트 태깅(1단계, 2026-08-08 완료) + 관리자 대시보드 시각화(2단계 코드 2026-08-14 완료, 실측·배포 2026-08-30 완료 확인) — **Phase 1 공식 종료**
- [ ] **Phase 1.5 영업 지원 트랙** — 0단계 준비(영업이사 인터뷰→질문지 v1, 소개서 1장, 마이그레이션 SQL) → 1단계 `/ax-check`+`/admin/leads` 배포·첫 링크 발송(~09/05) → 2단계 LLM 진단서·솔루션 재편(~09/26) → 3단계 뉴스레터 발송·예약(~10/31)
- [x] 블로그 콘텐츠 재건 — 2026-08-14 게시물 전량 삭제(외부 복붙 콘텐츠 확인) 후 naver-blog ①클러스터(AI/Claude 생산성) 4편을 CoreDXI 톤으로 재가공해 "AI 실무 활용" 카테고리로 발행 (2026-08-15 완료. 등록 자동화 스크립트 `scripts/publish-blog-drafts.ts` 신규 추가, 발행 과정에서 발견한 프로덕션 500 에러·썸네일 크롭 버그도 함께 수정)
- 아이디어 주차장(당장 스코프에 넣지 않음): CMS 구조 편집 확장(카드 개수·순서), 블로그 댓글/반응 기능, 관리자 패널(`/admin/**`) 다크모드, 회원 전용 콘텐츠 영역, 다국어(i18n) 지원, Notion-세일즈 CRM 연동 재검토, AX 체크 업종 확장(건설 등 — Phase 1.5 3단계에서 결정). 예약/미팅 시스템은 Phase 1.5 3단계로 이동


## 노션 3-DB 장부 연동 (fifty-ledger Skill, 2026-08-25 추가)

이 프로젝트에서 AI 비서 집무실의 노션 3-DB 장부(프로젝트/액션/로그, 워크스페이스 (주)코어디엑스아이)에
쓰기 작업(생성·수정·완료처리·이월)을 할 때는 항상 `fifty-ledger` Skill을 거친다. claude.ai 계정에 저장된
Skill이라 별도 설치 없이 바로 사용 가능하다. DB ID·스키마·완료 판정 규칙·알려진 API 함정은 이 Skill
자체(SKILL.md 및 참고 문서 schema.md·known-issues.md)를 따르며, 이 문서에 별도로 중복 기술하지 않는다.
