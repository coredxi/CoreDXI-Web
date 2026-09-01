# CoreDXI-Web TODO

> 최종 업데이트: 2026-08-30
> 코드베이스 분석 기반 — 실제 구현 상태를 반영합니다. (2026-06-30 → 2026-07-07 종합 고도화 세션, 2026-07-19 rate limiting·다크모드 세션, 2026-08-05 CSP Enforcing 전환, 2026-08-06 소셜 메타태그 강화 착수, 2026-08-07 배포·전채널 검증까지 완료, 2026-08-08 뉴스레터 구독 구현, 2026-08-14 블로그 콘텐츠 전량 삭제·재건 전략 수립 + 전환 퍼널 대시보드 2단계·블로그 하단 CTA 구현, 2026-08-22 영업 지원 트랙(Phase 1.5) 설계·액션플랜 수립, 2026-08-30 전환 퍼널 대시보드 실측 완료 및 Phase 1 공식 종료)

---

## 범례

| 아이콘 | 의미 |
|--------|------|
| ✅ | 완료 |
| 🚧 | 진행 중 / 부분 구현 |
| ⬜ | 미구현 (플레이스홀더) |
| 🔧 | 개선 필요 |
| 💡 | 향후 계획 / 아이디어 |

---

## 1. 완료된 기능 ✅

### 공개 마케팅 페이지

- ✅ 홈 페이지 (`/`) — 히어로, 성공사례 미리보기, 최신 블로그, Mini About CTA (ISR, revalidate=60)
- ✅ 회사 소개 (`/about`) — 미션·핵심가치·KPI 수치·CTA, SEO 메타데이터, **CMS 연동 완료** (ISR)
- ✅ 솔루션 소개 (`/solutions`) — 솔루션 3종 카드, 4단계 도입 프로세스, **CMS 연동 완료** (ISR)
- ✅ 성공사례 목록 (`/cases`) — Prisma DB 기반 카드 그리드, **업종·솔루션 유형 필터** (ISR + 클라이언트 필터)
- ✅ 성공사례 상세 (`/cases/[id]`) — 동영상 embed, 동적 SEO 메타데이터 (ISR)
- ✅ 블로그 목록 (`/blog`) — 발행 글 목록, **서버사이드 검색**(`/api/blog/search`, 제목·요약·카테고리 ILIKE) (ISR)
- ✅ 블로그 상세 (`/blog/[slug]`) — Tiptap/BlockNote 본문 렌더, JSON-LD, `generateStaticParams()`로 사전 빌드, 하단 CTA(`BlogPostCta` — 문의 유도 + 뉴스레터 앵커 링크, `cta_location: "blog_post_bottom"`, 2026-08-14 추가)
- ✅ 블로그 카테고리 (`/blog/category/[slug]`) — 카테고리별 필터링 + 카테고리 스코프 검색 (ISR)
- ✅ 문의하기 (`/contact`) — 폼 제출, Supabase 저장, Resend 알림 이메일, **IP당 1시간 5회 rate limit**
- ✅ 이용약관 (`/terms`), 개인정보처리방침 (`/privacy`)

### 인증 시스템

- ✅ 일반 회원 로그인 (`/login`) — Google·Kakao·Naver OAuth, 이메일 2단계 (훅/단계별 컴포넌트로 리팩토링)
- ✅ 회원가입 (`/signup`) — 이메일 OTP 인증(6자리, 5분 만료) 3단계 플로우 (훅/단계별 컴포넌트로 리팩토링), **이메일당 5분 5회 rate limit** (`/api/auth/verify-otp`)
- ✅ 관리자 로그인 (`/admin/login`) — Credentials 인증, **이메일당 15분 5회 rate limit**
- ✅ 일반 회원 로그인 (`/login`) — **이메일당 15분 5회 + IP당 15분 20회 rate limit** (로그인 성공 시도는 카운트하지 않음)
- ✅ 최초 관리자 설정 (`/setup`) — DB Admin 없을 때만 접근
- ✅ OAuth 리다이렉트 URI 안내 컴포넌트 (`OAuthRedirectHelp`)
- ✅ 잘못된 쿠키 초기화 API (`/api/auth/reset`)
- ✅ 환경 진단 API (`/api/auth/health`)
- ✅ **비밀번호 재설정(이메일 링크)** — `/forgot-password`(요청) + `/reset-password/[token]`(재설정), Admin·User 공통 1개 플로우, 계정 존재 여부 비노출, 1시간 유효·1회용 토큰, IP·이메일 이중 rate limit. 영업이사 EDITOR 계정 생성 시 재설정 수단이 전혀 없다는 게 드러나 신설(2026-08-26). 설계: `docs/superpowers/specs/2026-08-26-password-reset-design.md`, 브랜치: `feat/password-reset-flow`(AX 체크와 독립)

### 관리자 CMS 패널

- ✅ 대시보드 (`/admin/dashboard`) — 통계 카드, GA4 분석 패널(방문자 요약·인기 페이지·**전환 퍼널**), 퀵액션, **활동 로그 실 DB 연동**(블로그+문의 통합)
- ✅ **메인 화면 관리** (`/admin/main`) — 히어로 문구·버튼·이미지·신뢰지표 편집 (PageContent 테이블)
- ✅ **회사소개 관리** (`/admin/about`) — 히어로·미션·핵심가치·지표·CTA 문구 편집 (PageContent 테이블)
- ✅ **솔루션 관리** (`/admin/solutions`) — 히어로·솔루션 카드 3종·프로세스 4단계·CTA 문구 편집 (PageContent 테이블)
- ✅ 성공사례 관리 (`/admin/portfolio`) — 목록·신규 등록·수정·삭제, **업종·솔루션 유형 필드 추가**
- ✅ 블로그 관리 (`/admin/blog`) — 글 목록·신규 작성·수정·발행 상태 관리 (훅/서브컴포넌트로 리팩토링)
- ✅ 블로그 주제 관리 (`/admin/blog/topics`) — 카테고리 CRUD
- ✅ 문의 관리 (`/admin/contact`) — 문의 목록·상태 변경·알림 이메일 설정 (목록/답장패널/템플릿으로 리팩토링)
- ✅ 관리자 계정 관리 (`/admin/users`) — 목록·Role 변경(SUPER_ADMIN/EDITOR/VIEWER)
- ✅ 관리자 등록 (`/admin/register`)
- ✅ 고객(일반 회원) 관리 (`/admin/customers`) — 목록·상세·수정·삭제
- ✅ 설정 허브 (`/admin/settings`)

### 인프라 & 품질

- ✅ Next.js 미들웨어 기반 관리자 라우트 Role 보호 (`src/middleware.ts`), `/concepts` 프로덕션 접근 차단
- ✅ Sentry 에러 모니터링 연동, **트레이스 샘플링 100%→20% 축소**(에러 캡처는 영향 없음)
- ✅ GA4 Data API 연동 (관리자 대시보드 실시간 지표)
- ✅ Supabase Storage 블로그 이미지 업로드·외부 URL import (SSRF 방지, `src/lib/url-safety.ts`로 분리·테스트)
- ✅ `sitemap.ts`, `robots.ts` 자동 생성
- ✅ OG 이미지 자동 생성 (`opengraph-image.tsx`) — 루트·블로그·성공사례
- ✅ `coredxi.com` → `www.coredxi.com` 301 리다이렉트
- ✅ **Tiptap 단일화** — BlockNote 완전 제거(에디터·리더·`@blocknote/*` 의존성 4개). 실 DB 확인 결과 BlockNote 포맷 글 0건이라 안전하게 제거, 전체 글 Tiptap 포맷
- ✅ 비개발자용 `CONTENT_GUIDE.md` 작성 (홍보팀 가이드)
- ✅ 브랜드 컬러·디자인 시스템 (`globals.css`, `--primary: #1E4E8C`)
- ✅ **Vitest 유닛 테스트 171개** (OTP, SSRF 가드, 문의 액션, SEO, rate-limit, 답장 템플릿, blog/cases 검색, page-content, CMS 액션, 일반 회원 로그인 rate limiting, OTP 인증 rate limiting, OG 배경 URL 검증·합성/배지 분기 판단, 뉴스레터 구독, GA4 이벤트 전송·스크롤 임계값 계산, **전환 퍼널 계산**(`funnel-calc.ts`), 비밀번호 재설정 토큰·서버 액션)
- ✅ **Playwright E2E 골든패스 7개** (문의 제출, 관리자 로그인 성공/실패, 블로그 발행, 블로그 소셜 메타, 비밀번호 재설정 성공/만료 토큰 — 관리자 테스트는 `E2E_ADMIN_EMAIL/PASSWORD` 없으면 자동 skip)
- ✅ CI(`ci.yml`)에 lint + typecheck + test 스텝 추가 (기존엔 build만 실행)
- ✅ `.env.example` 생성, README 전면 현행화 (npm/포트3100/Turbopack/Supabase/Sentry/GA4/테스트 반영)
- ✅ **관리자 로그인·문의 폼·회원가입 OTP 인증 rate limiting** (Prisma `RateLimitHit` 테이블 기반)
- ✅ **보안 헤더** (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS)
- ✅ **프로덕션 TLS 검증 정상화** — `NODE_TLS_REJECT_UNAUTHORIZED="0"` 제거, Supabase 루트 CA 명시 신뢰로 교체
- ✅ **git 히스토리 보안 정리** — 커밋돼 있던 실제 인증 쿠키 파일(ck.txt 등) 완전 제거, `.gitignore` 추가
- ✅ **공개 페이지 다크모드** — `next-themes` `ThemeProvider` 연결(기본값 라이트, 사용자가 직접 전환), Header에 토글 버튼 추가. 홈/소개/솔루션/성공사례/블로그/문의/로그인/회원가입/404 등 공개 페이지 24개 파일 색상 토큰화(`bg-background`/`bg-card`/`text-foreground` 등). WCAG AA 대비 기준 검증 포함. 관리자 패널(`/admin/**`)은 의도적으로 범위 제외(아래 4번 참고)
- ✅ **CSP(Content-Security-Policy) Enforcing 전환 완료** — nonce 기반(`src/lib/csp.ts`), GA4/영상임베드/OAuth 허용 목록 확정, 위반 리포트 Sentry 연동(`/api/csp-report`). Report-Only 3주 모니터링 중 위반 1건(2026-07-19 개발 환경, `/cases/[slug]` JSON-LD nonce 누락) 확인 후 즉시 수정(2026-07-22), 이후 프로덕션 포함 재발 없음 확인. 2026-08-05 `Content-Security-Policy-Report-Only` → `Content-Security-Policy`로 전환, 로컬 골든패스·자동테스트(lint/tsc/vitest 101개/E2E)·프로덕션 콘솔 확인까지 완료(`docs/superpowers/specs/2026-07-19-csp-design.md` 참고)
- ✅ **소셜 메타태그(OG/Twitter Card) 강화 완료** — 2026-08-06 착수, 2026-08-07 배포·전채널 검증 + `twitter:site` 핸들까지 완료. 설계: `docs/superpowers/specs/2026-08-06-social-meta-design.md` / 트레이드오프: `docs/superpowers/specs/2026-08-06-social-meta-tradeoffs.md`
  - 커버 합성형 OG 카드(블로그 커버·사례 썸네일 배경 + 브랜드 오버레이, 실패 시 배지형 폴백) + 파일 기반 `opengraph-image.tsx`/config 이미지 우선순위 충돌 해소 + SSRF 방지 URL 화이트리스트(`feat`, T1·T2·T3·T4·T5·T7·T8)
  - `/privacy`·`/terms` canonical — 기존에 이미 `pageMetadata()` 적용돼 있어 재현되지 않음을 확인, 재발 방지 주석만 추가(`fix`, T6)
  - Vitest 유닛(배경 URL 검증·합성/배지 분기 판단) + Playwright E2E 골든패스(블로그 상세 og:title/twitter:card/og:image 200 응답) 추가(`test`, T10)
  - 프로덕션 배포 후 카카오톡 공유 디버거·Facebook Sharing Debugger·LinkedIn Post Inspector + 실기기 카카오톡 3종(홈/블로그/성공사례) 전부 정상 렌더링 확인 완료(2026-08-07). X는 공개 Card Validator가 폐지되어 실기기 확인으로 대체
  - ✅ **후속 항목도 완료**: 마케팅팀이 회사 공식 X 계정(`@coredxi`) 확인 → `layout.tsx` 전역 `twitter.site`에 핸들 추가(`feat: 전역 twitter:site 메타 핸들 추가`, 커밋 `aacf0b0`, 2026-08-07)
- ✅ **뉴스레터 구독** — 2026-08-08 완료(구현·검증·배포). 설계: `docs/superpowers/specs/2026-08-08-newsletter-design.md`
  - `NewsletterSubscriber` Prisma 모델 신설(수동 `migration.sql`, `prisma migrate dev` 미사용) + `RateLimitHit` 재사용 rate limiting(IP당 1시간 5회, 문의 폼과 동일 기준)
  - Footer에 전 페이지 공통 구독 폼(`NewsletterSubscribeForm`) + 필수 동의 체크박스, 구독 확인 메일(Resend) 발송
  - `RESEND_AUDIENCE_ID` 설정 시 Resend Audiences 자동 동기화, 미설정 시에도 로컬 DB만으로 기능 100% 동작(그레이스풀 디그레이드)
  - 랜덤 토큰 기반 `/unsubscribe/[token]` 구독 해지 페이지, 관리자 전용 `/admin/newsletter`(구독자 수·목록)
  - `/privacy` 뉴스레터 수집 항목·보유기간(해지 시 즉시 파기) 조항 추가, `CONTENT_GUIDE.md`에 확인 방법 안내 추가
  - Vitest 유닛 테스트 추가(`src/actions/newsletter.test.ts`, `contact.test.ts`와 동일 모킹 패턴)
  - ⏸️ **남은 작업(이 세션에서는 불가능 — 로컬 개발자/Claude Code가 수행)**: `pnpm install` 후 lint/typecheck/vitest 실행 확인, `prisma migrate deploy`로 실제 DB 반영, Resend Audience 생성 시 `RESEND_AUDIENCE_ID` 환경변수 설정(선택), git 커밋·배포, Playwright E2E 골든패스 추가 여부 검토
  - **범위 제외 결정(2026-08-08) → 2026-08-22 철회**: 당시 "구독자 모으기"까지만 완료 기준으로 삼고 발송은 별도 트랙으로 뺐으나, 영업이사 합류로 "접촉 리드에게 월 1회 팔로업 발송"이라는 구체적 목적이 생겨 Phase 1.5 3단계(10월)로 다시 편입. 발송 담당자(콘텐츠기획) 지정이 선행 조건이며, 착수 시 별도 설계 문서 작성. 상세는 아래 "Phase 1.5" 절 참고
- ✅ **GA4 전환 이벤트 태깅 (Phase 1 마지막 잔여 항목 — 1단계)** — 2026-08-08 완료. 설계: `docs/superpowers/specs/2026-08-08-ga4-event-tracking-design.md`
  - `cta_click`(전환 CTA 6곳) / `contact_submit` / `newsletter_subscribe` / `scroll_depth`(25/50/75/100%, 전체 공개 페이지) 4종 이벤트 태깅
  - `src/lib/ga4-events.ts`(전송 유틸) + `src/lib/scroll-depth.ts`(임계값 계산 순수 함수) Vitest 단위 테스트 추가
  - ✅ **2단계(퍼널 시각화 UI) 구현 완료 (2026-08-14)** — `src/lib/ga4/get-funnel-metrics.ts`(GA4 Data API 조회) + `src/lib/ga4/funnel-calc.ts`(순수 계산 함수, 단위 테스트) + `Ga4FunnelPanel.tsx`(`Ga4AnalyticsPanel` 통합, 신규 차트 라이브러리 없이 커스텀 CSS 가로 바). 이벤트 카운트 기반 근사 퍼널(방문→스크롤 참여→CTA 클릭→문의 제출) + 뉴스레터 구독 건수 별도 병기, 최근 30일 고정. 스크롤 깊이(`percent`) 구간 세분화는 GA4 커스텀 디멘션 등록 확인 전까지 보류(이벤트 총합만 사용, 설계 3번 결정사항). 설계: `docs/superpowers/specs/2026-08-14-funnel-dashboard-stage2-design.md`, 실행 순서: `docs/superpowers/plans/2026-08-14-phase1-item4-5-action-plan.md` 2번 표
  - ✅ **GA4 커스텀 디멘션 등록 확인·완료 (2026-08-16)** — 미등록 상태였음을 확인, 사용자가 GA4 관리 콘솔에서 `percent`/`cta_location`/`source` 3개를 이벤트 범위로 신규 등록(스크린샷 확인 완료). 등록 시점 이후 이벤트부터만 소급 없이 집계되므로 파라미터 단위 조회는 2026-08-16부터 가능 — 설계 3번 결정사항(스크롤 세분화는 범위 밖, 총합만 사용)은 스코프 확장 금지 원칙에 따라 그대로 유지
  - ✅ **순서 5~7 완료 (2026-08-30)** — 프로덕션(`coredxi.com/admin/dashboard`)에서 전환 퍼널 실 데이터 렌더링 확인(최근 30일: 전체 방문 197건·스크롤 참여 436건·CTA 클릭 1건·문의 제출 0건, 뉴스레터 구독·AX 체크 제출 별도 병기 정상). lint/typecheck/vitest·PR·배포는 8/26~27 이미 완료(PR #4 `feat/funnel-dashboard-stage2` main 병합, Vercel 재배포 확인). 사용자가 실제 블로그 글 하단 `문의하기` 버튼 클릭 → GA4 실시간 보고서에서 `cta_click`(`cta_location=blog_post_bottom`) 이벤트 즉시 수신 확인. → **전환 퍼널 대시보드 2단계 최종 완료, Phase 1 공식 종료**

## 1-B. 진행 중 — Phase 1.5 영업 지원 트랙 🚧 (2026-08-22 착수)

> 배경: 2026-08-18 영업이사 합류. 주 타깃은 IT·통신·영상음향(AV) 시스템 구축 업체 대표·영업 담당자. 중점 솔루션은 "중소기업 AI 도입·AX 전환 컨설팅" 단일 오퍼.
> 설계: `docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md` / 실행: `docs/superpowers/plans/2026-08-22-sales-enablement-action-plan.md` / 진행 현황: Notion AI 비서 집무실 계획 마일스톤 "Phase 1.5 영업 지원 트랙"

- 🚧 **0단계 준비 (08/22~08/26, 실제 08/31까지 연장)** — ✅ 영업이사 서면 인터뷰 회신 수령·정리 완료(0-2, 2026-08-31): `docs/superpowers/specs/2026-08-31-sales-director-interview-response.md`(타깃 6개사·첫 멘트·자주 받는 질문·업무 용어 전부 확보). 🚧 질문지 v1 문구 확정(0-3)은 회신 반영까지 완료, `catalog.ts` 코드 반영은 Claude Code 프롬프트 작성 완료·구현 대기: `docs/superpowers/plans/2026-08-31-ax-check-questionnaire-v1-claude-code-prompt.md`. ⬜ 담당자 지정(0-7)은 아직 사람이 정할 일로 남아 있음. 🚧 **소개서(0-4)는 2026-08-30 1장 → 4~5p 슬라이드 PDF로 확장 결정, 사용자가 다른 세션 v1_draft(일반형 문구, 인터뷰 미반영)를 최종 채택(2026-09-01) — AI 비서가 인터뷰 반영해 새로 만든 v2_draft는 미채택. 최종본 `docs/superpowers/assets/brochure/20260830_제안서_사내_AX전환컨설팅소개서_v1_draft.pdf`·`.pptx`로 로컬 저장 완료. 영업이사 검토(S2)·홈페이지 게시(S4, `/solutions` 다운로드 버튼) 아직 미착수: `docs/superpowers/plans/2026-08-30-ax-consulting-brochure-action-plan.md`** ✅ `AxCheckResponse` 수동 `migration.sql` 작성 완료(0-6, 2026-08-25). ✅ `?ref=`코드·EDITOR 계정·`SALES_NOTIFY_EMAIL` 확정 완료(0-5, 2026-08-26) — ref=`sales-kim`, `scripts/create-sales-editor-account.ts`로 `obaamg1017@coredxi.com` EDITOR 계정 생성, `SALES_NOTIFY_EMAIL=devcoredxi00@coredxi.com`을 `.env.local`·Vercel Production/Preview에 등록
- 🚧 **1단계 영업 가동 (08/27~09/05)** — 코드 구현 완료(2026-08-25): `catalog.ts`+`summarize.ts`(등급 규칙·Q3 매핑·Q5 분기, Vitest 13개) + `src/actions/ax-check.ts`(검증·rate limit·저장·옵트인 구독·메일 2통, Vitest 25개) + `/ax-check`(8문항 전부 선택지, 3분, `?ref=` 보존) + `/ax-check/result/[token]` + `/admin/leads`(HOT/WARM/COLD·상태·메모·CSV·삭제) + GA4 `ax_check_submit`(`source`=ref) 이벤트·퍼널 패널 병기 + `/privacy`·`CONTENT_GUIDE.md` 17번. 질문지 문구는 여전히 v1-draft(0-3 인터뷰 결과 대기, `catalog.ts` 상단 주석 참고). ⬜ 남은 것: 영업이사 실기기 테스트, **첫 링크 발송**. `prisma migrate deploy`·Playwright E2E는 2026-08-26~27 완료.
  - ✅ **경험 개선 완료 (2026-08-30)** — 인트로 화면(A)·결과 피드백 구체화(B, Q1/Q2/Q4 추가 반영·답변 인용·업종 예시·3단계 로드맵)·이메일 초안 워크플로우(C, 고객 자동 발송 제거 → 영업이사 메일 동봉 + `/admin/leads` 복사 패널) 전부 구현·테스트 완료. 남은 것: 영업이사 서명 블록(`SALES_SIGNATURE`) 실제 정보 입력, 인트로·초안 카피 최종 검수, 실기기 테스트.
- ⬜ **2단계 보강 (09/08~09/26)** — 완료율 점검(20% 미만이면 문항 8→6), LLM 상세 진단서(관리자 검토 후 발송, 응답 20건 이상 기준), `/solutions` 단일 오퍼 재편(+`/admin/solutions` 폼·가이드 갱신), `/about` 레퍼런스 중심 축약, 블로그 1편
- ⬜ **3단계 닫기 (09/29~10/31)** — 팔로업 뉴스레터 발송 설계·1호 발송(옵트인 대상만), Calendly 임베드로 결과 화면 CTA → 미팅 예약, 업종 확장(건설 등) 여부 결정, 종료 보고
- Phase 2에서 이동: 예약/미팅 시스템 → 이 트랙 3단계로 흡수. CMS 구조 편집·댓글·관리자 다크모드는 Phase 2에 잔류(11월 이후)

---

## 2. 개선이 필요한 항목 🔧

- 🔧 **블로그 콘텐츠 전량 소실 및 재건 (2026-08-14)** — coredxi.com 블로그 게시물 다수가 외부 콘텐츠를 복사·붙여넣기한 것으로 확인되어 관리자 페이지에서 전체 삭제. 발단은 사용자의 별도 프로젝트(애드센스 포트폴리오)에서 `fiftyvibe.kr` 애드센스 거절을 계기로 같은 구글 계정에 있던 coredxi.com을 점검하며 발견된 것. coredxi.com은 애드센스 수익화 목적이 아니므로 애드센스 제외 자체는 로드맵에 영향 없음. 재건 전략(브랜드 구조·콘텐츠 소싱·재발 방지책)은 설계 문서로 확정: `docs/superpowers/specs/2026-08-14-content-brand-strategy-design.md`, 실행 순서: `docs/superpowers/plans/2026-08-14-content-rebuild-action-plan.md`, 소싱 정책은 `CONTENT_GUIDE.md` 16번에 반영 완료
  - ✅ **2026-08-14 결정·확인 완료**: 바이라인은 대표 실명 병기 없이 "CoreDXI 팀" 명의로 통일 / 크몽·숨고 리스팅은 AI·AX 컨설팅으로 명확히 포지셔닝되어 있음을 사용자가 확인 / 삭제된 블로그 URL은 `sitemap.ts`(PUBLISHED만 동적 조회) + `blog/[slug]/page.tsx`의 `notFound()` 처리로 이미 정상 404 — 코드 조사로 확인, 추가 조치 불필요
  - **2026-08-14 상세 액션플랜 작성**: 후보 5편 정리, 편당 재가공 체크리스트, 3주 타임라인(항목4 퍼널 대시보드 2단계와 병행) — `docs/superpowers/plans/2026-08-14-phase1-item4-5-action-plan.md` 참고
  - ✅ **①클러스터 재가공·발행 완료 (2026-08-15)** — 후보 5편 중 3편(클로드 코워크 사용법·Notion 업무 자동화·클로드 메모리 기능) + 후보 외 대체 1편(클로드 잘 쓰는 법 5단계) 총 4편을 CoreDXI 톤으로 재가공(1인칭→법인 주어, 바이라인 "CoreDXI 팀", 출처·확인일자 유지)해 신규 카테고리 "AI 실무 활용"으로 발행 완료. `scripts/publish-blog-drafts.ts`(신규)로 마크다운→Tiptap JSON 변환·브랜드 톤 SVG 이미지 생성(커버+섹션별, `src/lib/blog-card-image.ts`)·DRAFT 등록을 자동화, 관리자 검수 후 발행은 사람이 진행
  - ✅ **발행 과정에서 발견한 프로덕션 버그 2건 수정**: (1) 목록 카드 썸네일이 `aspect-[16/10]` 크롭에 걸려 텍스트가 잘리던 문제 — 이미지 생성 시 안전 여백(160px) 확보로 해결. (2) `/blog/[slug]` 상세 페이지가 빌드 이후 새로 발행된 글에서 500 에러(`DYNAMIC_SERVER_USAGE`, CSP nonce용 `headers()`와 `generateStaticParams()`+ISR 충돌) — `dynamic = "force-dynamic"`으로 수정, PR #1로 `main`에 핫픽스 배포·확인 완료
  - ✅ **`/cases/[slug]` 동일 계열 잠재 이슈 후속 조치 완료 (2026-08-15)** — 코드 조사 + 로컬 프로덕션 빌드(`next build`)·신규 사례 등록 후 실제 요청으로 재현 테스트해 확인: 이 라우트는 `generateStaticParams()`가 없어 오늘 시점엔 `/blog/[slug]`와 같은 `DYNAMIC_SERVER_USAGE` 크래시가 재현되지 않는다(빌드 결과 이미 "ƒ Dynamic", 응답은 매번 `Cache-Control: private, no-store`이고 nonce도 요청마다 새로 발급됨을 확인 — `revalidate = 60`은 실질적으로 죽은 설정이었음). 다만 훗날 이 라우트에 `generateStaticParams()`가 추가되면 `/blog/[slug]`와 동일하게 크래시할 잠재 위험이 남아 있어, 재발을 원천 차단하고 죽은 `revalidate` 설정도 함께 정리하는 차원에서 선제적으로 `dynamic = "force-dynamic"`을 명시(동작 변화 없음). 검증: Vitest 135개·`tsc --noEmit`·lint 통과, Playwright E2E는 이 변경과 무관하게 기존에도 실패하던 `admin-login.spec.ts`("잘못된 비밀번호" 케이스, 수정 전 코드로도 동일 실패 확인) 1건을 제외하고 전부 통과 — 해당 실패는 이번 작업 범위 밖이라 별도 트랙으로 남김

---

## 3. 결정 완료 (재검토 불필요)

- **Notion API 연동**: 앱 기능으로 확장하지 않고 현 상태(git post-commit 훅을 통한 개발 워크플로 기록용) 유지하기로 결정 (2026-07-07)
- **블로그 검색**: Postgres full-text search(tsvector)는 한국어(띄어쓰기 기반이 아닌 언어)에 부적합하다고 판단, 서버사이드 ILIKE 부분 문자열 검색으로 구현
- **CMS 편집 범위**: 홈/소개/솔루션 페이지는 텍스트만 편집 가능하도록 구현 — 카드 개수·아이콘·레이아웃 구조는 고정 (구조 편집까지 지원하려면 재설계 필요)
- **블로그 전량 삭제 후 URL 404·sitemap 상태**: 2026-08-14 코드 조사로 정상 동작 확인(`sitemap.ts` 동적 조회 + `blog/[slug]` `notFound()` 처리) — 추가 조치 불필요, 재검토 불필요
- **블로그 콘텐츠 바이라인**: 대표 개인 실명 병기하지 않음, "CoreDXI 팀" 명의로 통일 (2026-08-14 결정)
- **AX 체크 1단계는 LLM 없이 규칙 기반 요약**: 응답 20건 누적 전까지 LLM 분석을 붙이지 않는다 — 즉시성·비용·재현성 우선, LLM은 2단계 "관리자 검토 후 발송"으로 도입 (2026-08-22 결정)
- **AX 체크 타깃 업종**: IT·통신·AV 시스템 구축 업체 우선. 동진기술(종합건설)은 지인 경유 예외 건으로 깔때기를 타지 않으며, 건설업 추가는 3단계에서 응답 분포 보고 결정 (2026-08-22 결정)

---

## 4. 향후 계획 💡

> Phase 1 잔여 3개 항목(뉴스레터 구독/소셜 메타태그 강화/전환 퍼널 대시보드)의 착수 순서·설계 방향은
> `docs/superpowers/plans/2026-08-05-phase1-remaining-action-plan.md` 참고 (2026-08-05 작성)
> — **소셜 메타태그 강화는 2026-08-07 완료**, **뉴스레터 구독은 2026-08-08 완료**, **전환 퍼널 대시보드는 1단계(이벤트 태깅) 2026-08-08 완료, 2단계(시각화 UI) 구현 2026-08-14 완료, 실 데이터 검증·배포 2026-08-30 완료** — **Phase 1 공식 종료.** Phase 2(CMS 구조 편집·댓글/반응·관리자 다크모드)는 Phase 1.5 영업 지원 트랙 종료 후(11월 이후) 착수 검토

### 중기 (3~6개월)

- 💡 **댓글/반응 기능** — 블로그 글에 좋아요 또는 댓글 기능
- 💡 **관리자 패널 다크모드** — 공개 페이지는 완료(위 1번 참고), `/admin/**`은 범위 밖으로 남겨둠

### 장기 (6개월+)

- 💡 **회원 전용 콘텐츠 영역** — 로그인 회원에게만 공개되는 심화 자료·리포트 페이지
- 💡 **예약/미팅 시스템** — AX 컨설팅 상담 예약 기능 (Calendly 연동 또는 자체 구현) → **2026-08-22 Phase 1.5 3단계로 이동**(위 1-B 참고)
- 💡 **다국어(i18n) 지원** — 영문 버전 추가 (글로벌 B2B 확장 대비)
- 💡 **CMS 구조 편집 확장** — 필요 시 홈/소개/솔루션 카드 개수·순서까지 관리자가 조정 가능하도록 재설계

---

## 5. 알려진 이슈

| 이슈 | 설명 | 우선순위 |
|------|------|----------|
| **Prisma 마이그레이션 주의** | `DATABASE_URL`이 개발/프로덕션 분리 없이 단일 Supabase 프로젝트를 가리킴. `prisma migrate dev`는 `contacts`/`contact_settings`(Supabase 직접 생성 테이블) 때문에 드리프트 감지→스키마 전체 리셋을 유도함. **반드시 수동 `migration.sql` 작성 + `prisma migrate deploy`만 사용할 것** | 높음 (데이터 손실 위험) |
| next-auth beta | `5.0.0-beta.31` — 2026-07-07 기준 아직 stable 미출시, 조치 불필요 | 낮음 |

---

## 6. 의존성 관리 메모

- `@tiptap/*` 패키지는 `package.json` `overrides`로 `3.13.0`에 고정 (버전 충돌 방지) — 업그레이드 시 주의
- `next-auth`는 `5.0.0-beta.31` 베타 버전 — 2026-07-07 기준 최신도 여전히 beta, stable 출시 시 마이그레이션 검토
- `prisma`는 `7.x` — 주요 버전 업 시 마이그레이션 스크립트 필요. **스키마 변경은 위 "알려진 이슈"의 Prisma 마이그레이션 주의사항을 반드시 따를 것**
