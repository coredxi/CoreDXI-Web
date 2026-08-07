# CoreDXI-Web TODO

> 최종 업데이트: 2026-08-08
> 코드베이스 분석 기반 — 실제 구현 상태를 반영합니다. (2026-06-30 → 2026-07-07 종합 고도화 세션, 2026-07-19 rate limiting·다크모드 세션, 2026-08-05 CSP Enforcing 전환, 2026-08-06 소셜 메타태그 강화 착수, 2026-08-07 배포·전채널 검증까지 완료, 2026-08-08 뉴스레터 구독 구현)

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
- ✅ 블로그 상세 (`/blog/[slug]`) — Tiptap/BlockNote 본문 렌더, JSON-LD, `generateStaticParams()`로 사전 빌드
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

### 관리자 CMS 패널

- ✅ 대시보드 (`/admin/dashboard`) — 통계 카드, GA4 분석 패널, 퀵액션, **활동 로그 실 DB 연동**(블로그+문의 통합)
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
- ✅ **Vitest 유닛 테스트 116개** (OTP, SSRF 가드, 문의 액션, SEO, rate-limit, 답장 템플릿, blog/cases 검색, page-content, CMS 액션, 일반 회원 로그인 rate limiting, OTP 인증 rate limiting, OG 배경 URL 검증·합성/배지 분기 판단)
- ✅ **Playwright E2E 골든패스 5개** (문의 제출, 관리자 로그인 성공/실패, 블로그 발행, 블로그 소셜 메타 — 관리자 테스트는 `E2E_ADMIN_EMAIL/PASSWORD` 없으면 자동 skip)
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
- ✅ **뉴스레터 구독 (Phase 1 마지막 잔여 항목, 구현·검증·DB 반영 완료)** — 2026-08-08 착수. 설계: `docs/superpowers/specs/2026-08-08-newsletter-design.md`
  - `NewsletterSubscriber` Prisma 모델 신설(수동 `migration.sql`, `prisma migrate dev` 미사용) + `RateLimitHit` 재사용 rate limiting(IP당 1시간 5회, 문의 폼과 동일 기준)
  - Footer에 전 페이지 공통 구독 폼(`NewsletterSubscribeForm`) + 필수 동의 체크박스, 구독 확인 메일(Resend) 발송
  - `RESEND_AUDIENCE_ID` 설정 시 Resend Audiences 자동 동기화, 미설정 시에도 로컬 DB만으로 기능 100% 동작(그레이스풀 디그레이드)
  - 랜덤 토큰 기반 `/unsubscribe/[token]` 구독 해지 페이지, 관리자 전용 `/admin/newsletter`(구독자 수·목록)
  - `/privacy` 뉴스레터 수집 항목·보유기간(해지 시 즉시 파기) 조항 추가, `CONTENT_GUIDE.md`에 확인 방법 안내 추가
  - Vitest 유닛 테스트 추가(`src/actions/newsletter.test.ts`, `contact.test.ts`와 동일 모킹 패턴)
  - `pnpm lint`(0 errors) · `npx tsc --noEmit`(0 errors, 테스트 파일 `auth()` 모킹 타입 오류 1건 수정) · `pnpm test`(20 files, 126 tests 전부 통과) 확인 완료(2026-08-08, Claude Code 세션)
  - `prisma migrate deploy`로 실제 Supabase DB에 `NewsletterSubscriber` 테이블 반영 완료(2026-08-08), `prisma migrate status`로 스키마 최신 상태 확인
  - ⏸️ **남은 작업**: Resend Audience 생성 시 `RESEND_AUDIENCE_ID` 환경변수 설정(선택, 경영진 소관), git 커밋·배포, Playwright E2E 골든패스 추가 여부 검토, 노션 업무 DB·작업로그 갱신

## 2. 개선이 필요한 항목 🔧

현재 없음 — 이전에 추적하던 항목(CSP 미적용, OTP 무효화 재검토, BlockNote 레거시 정리, `/admin/inquiries` 구 리다이렉트 제거)이 모두 해결되었습니다.

---

## 3. 결정 완료 (재검토 불필요)

- **Notion API 연동**: 앱 기능으로 확장하지 않고 현 상태(git post-commit 훅을 통한 개발 워크플로 기록용) 유지하기로 결정 (2026-07-07)
- **블로그 검색**: Postgres full-text search(tsvector)는 한국어(띄어쓰기 기반이 아닌 언어)에 부적합하다고 판단, 서버사이드 ILIKE 부분 문자열 검색으로 구현
- **CMS 편집 범위**: 홈/소개/솔루션 페이지는 텍스트만 편집 가능하도록 구현 — 카드 개수·아이콘·레이아웃 구조는 고정 (구조 편집까지 지원하려면 재설계 필요)

---

## 4. 향후 계획 💡

> Phase 1 잔여 3개 항목(뉴스레터 구독/소셜 메타태그 강화/전환 퍼널 대시보드)의 착수 순서·설계 방향은
> `docs/superpowers/plans/2026-08-05-phase1-remaining-action-plan.md` 참고 (2026-08-05 작성)
> — **소셜 메타태그 강화는 2026-08-07 완료**, **뉴스레터 구독은 2026-08-08 구현 완료(테스트/배포 대기, 위 1번 🚧 참고)**, 남은 1개(전환 퍼널 대시보드)가 Phase 1 마지막 잔여 항목

### 중기 (3~6개월)

- 💡 **댓글/반응 기능** — 블로그 글에 좋아요 또는 댓글 기능
- 💡 **관리자 패널 다크모드** — 공개 페이지는 완료(위 1번 참고), `/admin/**`은 범위 밖으로 남겨둠

### 장기 (6개월+)

- 💡 **회원 전용 콘텐츠 영역** — 로그인 회원에게만 공개되는 심화 자료·리포트 페이지
- 💡 **예약/미팅 시스템** — AX 컨설팅 상담 예약 기능 (Calendly 연동 또는 자체 구현)
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
