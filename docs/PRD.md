# CoreDXI-Web PRD (Product Requirements Document)

> 최종 업데이트: 2026-08-22
> 작성 기준: 코드베이스 분석 (Next.js App Router, `src/` 구조)

---

## 1. 제품 개요

**제품명**: CoreDXI 공식 기업 홈페이지 (`coredxi-web`)
**도메인**: [www.coredxi.com](https://www.coredxi.com)
**회사**: (주)코어디엑스아이 (CoreDXI)

CoreDXI는 복잡한 기업 협업을 단순화하고 AI를 통해 비즈니스 핵심을 깨우는 **AX(AI 전환) 코어 파트너**입니다. 이 홈페이지는 B2B 잠재 고객에게 회사의 솔루션·철학·성과를 전달하고, 문의 리드를 확보하는 것을 핵심 목표로 합니다. 채널톡·Loom의 디자인 철학을 참고하여 신뢰감 있고 미니멀한 톤앤매너로 설계되었습니다.

---

## 2. 목표 및 배경

| 목표 유형 | 내용 |
|-----------|------|
| **비즈니스 목표** | B2B 리드 확보(문의 전환율 향상), 브랜드 인지도 구축 |
| **마케팅 목표** | 블로그 콘텐츠 마케팅을 통한 SEO 트래픽 확보, 성공사례 노출 |
| **운영 목표** | 비개발자(홍보팀)도 콘텐츠를 자체 편집 가능한 CMS 제공 |
| **기술 목표** | Next.js 15 App Router 기반의 고성능·SEO 최적화 웹사이트 구축 |

**리드 유입 채널(2026-08-14 확인)**: coredxi.com이 서비스해야 하는 리드는 두 갈래다.
① **지인 소개·네트워킹** — 이미 신뢰가 형성된 상태로 유입, 사이트는 "확인" 역할.
② **크몽·숨고 리스팅 + 콘텐츠 팔로워** — 사전 신뢰 없는 콜드 인바운드, 사이트는 "발견·전환" 역할.
두 채널은 규모만 다를 뿐 동일한 역량(AI/AX 전환 컨설팅 및 서비스 구축)을 판매하므로, 블로그
콘텐츠 전략은 두 채널 모두에 통하는 단일 신뢰 자산을 지향한다. 상세: `docs/superpowers/specs/2026-08-14-content-brand-strategy-design.md`
③ **영업이사 아웃바운드(2026-08-22 추가)** — 2026-08-18 합류한 영업이사가 카카오톡·메일로 "솔루션 소개서(4~5p PDF, 2026-08-30 1장에서 확장 — `/solutions`에서도 다운로드 제공) + AX 체크 링크(`/ax-check?ref=`)"를 보내는 채널. 주 타깃은 **IT·통신·영상음향(AV) 시스템 구축 서비스 업체의 대표·영업 담당자**. 사이트의 역할은 "대화의 시작점 + 리드 구조화(핫/웜/콜드)". 중점 솔루션은 **"중소기업 AI 도입·AX 전환 컨설팅"** 단일 오퍼로 집중한다. 상세: `docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md`

---

## 3. 타겟 사용자

| 사용자 유형 | 설명 |
|-------------|------|
| **잠재 고객** | B2B 기업의 의사결정자(임원, 사업 담당자) — 솔루션·성공사례·문의 페이지 이용. **1순위 세그먼트(2026-08-22)**: IT·통신·AV 시스템 구축 업체 대표·영업 담당자 — `/ax-check` 인터뷰 깔때기 이용 |
| **영업이사** | 관리자 패널(EDITOR)에서 `/admin/leads` 리드 조회·등급 확인·상태 변경, `?ref=` 링크 발송 |
| **홍보·마케팅팀** | 블로그 작성, 성공사례 등록, 메인 텍스트·이미지 수정 |
| **개발·운영팀** | 관리자 계정 관리, 고객 데이터 조회, 인프라 모니터링 |
| **일반 회원** | OAuth·이메일 가입, 특정 콘텐츠 접근 (현재 제한적) |

---

## 4. 브랜드 & 디자인 가이드라인

| 항목 | 값 |
|------|-----|
| **메인 브랜드 컬러** | 로열 블루 `#1E4E8C` (`--primary`) |
| **배경 컬러** | `#F8F9FA` (`--background`) |
| **코너 반경** | `0.75rem` 이상 (`rounded-xl`) |
| **그림자** | `shadow-sm` ~ `shadow-md` |
| **폰트** | Geist (Variable) |
| **디자인 원칙** | 미니멀리즘, 충분한 여백, 신뢰감 있는 B2B 톤 |

---

## 5. 기능 명세

### 5-1. 공개 마케팅 페이지

| 페이지 | 경로 | 주요 기능 |
|--------|------|-----------|
| 홈 | `/` | 히어로 섹션, 성공사례 미리보기(3건), 최신 블로그(5건), Mini About CTA |
| 회사 소개 | `/about` | 미션·핵심가치·KPI 수치(50+, 98%, 3배)·CTA |
| 솔루션 | `/solutions` | AI 협업 자동화·AX 컨설팅·엔터프라이즈 AI 플랫폼 3종 카드, 4단계 도입 프로세스. **2026-09 재편 예정(Phase 1.5 2단계)**: "중소기업 AI 도입·AX 전환 컨설팅" 단일 오퍼 — 진단→설계→구축→교육 4단계 + 대상 업종 블록 + AX 체크 CTA |
| AX 체크(인터뷰 깔때기) | `/ax-check` | **신규(Phase 1.5 1단계, 2026-09-05 목표)** 8문항 전부 선택지·3분 질문지, `?ref=` 영업이사 식별, 제출 즉시 화면에 "AX 우선 과제 3가지"(규칙 기반) + 상세본 메일, 선택 동의 시 뉴스레터 구독 연동. 설계: `docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md` |
| AX 체크 결과 재열람 | `/ax-check/result/[token]` | 메일 링크용 토큰 페이지 |
| 성공사례 목록 | `/cases` | Prisma `Portfolio` DB → 카드 그리드 |
| 성공사례 상세 | `/cases/[id]` | 썸네일·동영상 embed·본문, 동적 SEO 메타데이터 |
| 블로그 목록 | `/blog` | 발행 글 목록 + URL 검색 필터(`?q=`). **2026-08-14 기준 게시물 전량 삭제 상태(재발행 준비 중)** — 경위·재건 전략은 `docs/superpowers/specs/2026-08-14-content-brand-strategy-design.md` 참고 |
| 블로그 상세 | `/blog/[slug]` | Tiptap/BlockNote 본문 렌더, JSON-LD, 하단 CTA(`BlogPostCta` — 문의 유도 + 뉴스레터 앵커 링크, `cta_location: "blog_post_bottom"`) |
| 블로그 카테고리 | `/blog/category/[slug]` | 카테고리별 필터링 |
| 문의하기 | `/contact` | 문의 폼(Supabase 저장) + 알림 이메일(Resend) |
| 이용약관 | `/terms` | 정적 법적 문서 |
| 개인정보처리방침 | `/privacy` | 정적 법적 문서 |
| 뉴스레터 구독 해지 | `/unsubscribe/[token]` | 이메일 하단 링크로 접근, 토큰 기반 즉시 해지(구현·검증 완료, 배포 대기) |

### 5-2. 인증 시스템

| 기능 | 경로 | 설명 |
|------|------|------|
| 일반 회원 로그인 | `/login` | Google·Kakao·Naver OAuth + 이메일 2단계(존재 확인 → 비밀번호) |
| 회원가입 | `/signup` | 이메일 → OTP 6자리 인증 → 이름·비밀번호 3단계 |
| 관리자 로그인 | `/admin/login` | Credentials (이메일+비밀번호) |
| 최초 설정 | `/setup` | DB에 Admin이 없을 때만 접근 가능한 초기 관리자 생성 |
| 비밀번호 재설정 요청 | `/forgot-password` | 이메일 링크 방식, Admin·User 공통(계정 존재 여부 비노출). 설계: `docs/superpowers/specs/2026-08-26-password-reset-design.md` |
| 새 비밀번호 설정 | `/reset-password/[token]` | 1시간 유효·1회용 토큰 확인 후 비밀번호 변경 |

**인증 라이브러리**: NextAuth v5 (Auth.js)
**보호 경로**: `src/middleware.ts` — `/admin/*` 경로는 `SUPER_ADMIN` 또는 `EDITOR` Role만 접근 허용

### 5-3. 관리자 CMS 패널 (`/admin`)

| 메뉴 | 경로 | 상태 | 기능 |
|------|------|------|------|
| 대시보드 | `/admin/dashboard` | ✅ 완료 | 통계 카드(블로그·문의·포트폴리오·회원 수), GA4 분석(방문자 요약·인기 페이지·전환 퍼널), 퀵액션, 활동 로그 |
| 홈 페이지 편집 | `/admin/main` | ⬜ 플레이스홀더 | 히어로 섹션 CMS (미구현) |
| 회사소개 편집 | `/admin/about` | ⬜ 플레이스홀더 | About 페이지 CMS (미구현) |
| 솔루션 편집 | `/admin/solutions` | ⬜ 플레이스홀더 | Solutions 페이지 CMS (미구현) |
| 성공사례 관리 | `/admin/portfolio` | ✅ 완료 | 목록·신규 등록·수정·삭제 |
| 블로그 관리 | `/admin/blog` | ✅ 완료 | 글 목록·신규 작성(Tiptap 에디터)·수정·발행 |
| 블로그 주제 관리 | `/admin/blog/topics` | ✅ 완료 | 카테고리 CRUD |
| 문의 관리 | `/admin/contact` | ✅ 완료 | 문의 목록·상태 변경·알림 이메일 설정 |
| 리드 관리 | `/admin/leads` | 🚧 Phase 1.5 | AX 체크 응답 목록(등급 HOT/WARM/COLD·상태·ref), 상세·메모·상태 변경·CSV·삭제 — 영업이사용 |
| 관리자 계정 | `/admin/users` | ✅ 완료 | 관리자 목록·Role 변경(SUPER_ADMIN/EDITOR/VIEWER) |
| 관리자 등록 | `/admin/register` | ✅ 완료 | 새 관리자 생성 |
| 고객 관리 | `/admin/customers` | ✅ 완료 | 일반 회원 목록·상세·수정·삭제 |
| 설정 | `/admin/settings` | ✅ 완료 | 계정 관리 메뉴 허브 |

### 5-4. API Routes

| 엔드포인트 | 메서드 | 용도 |
|------------|--------|------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth 핸들러 |
| `/api/auth/health` | GET | OAuth/DB 환경변수 진단 |
| `/api/auth/check-email` | POST | 이메일 존재·비밀번호 유무 확인 |
| `/api/auth/send-otp` | POST | 회원가입 OTP 발송 (Resend, 60초 쿨다운) |
| `/api/auth/verify-otp` | POST | OTP 검증 (5분 만료) |
| `/api/auth/register` | POST | 이메일 회원가입 (bcrypt → Prisma) |
| `/api/auth/reset` | GET | 잘못된 NextAuth 쿠키 삭제 |
| `/api/admin/blog/upload-image` | POST | 블로그 이미지 업로드 → Supabase Storage |
| `/api/admin/blog/import-image` | POST | 외부 이미지 URL → Supabase (CORS 회피, SSRF 방지) |

### 5-5. SEO & 메타데이터

- 루트 `layout.tsx`에 전역 `metadata` (title, description, openGraph, robots)
- 동적 페이지(`/cases/[id]`, `/blog/[slug]`)에 `generateMetadata()` 적용
- `opengraph-image.tsx` (루트·블로그·성공사례별)
- `sitemap.ts`, `robots.ts` 자동 생성
- 블로그 글 상세에 JSON-LD (Article) 삽입
- 루트 `layout.tsx`에 Organization JSON-LD
- 네이버 서치어드바이저 메타태그 포함
- **소셜 메타태그 강화 완료 (2026-08-07)** — 블로그 커버·성공사례 썸네일을 배경으로 합성한 1200×630 OG 카드(커버 없으면 브랜드 배지형 폴백), 파일 기반/config 기반 이미지 충돌 해소, SSRF 방지 URL 화이트리스트, `/privacy`·`/terms` canonical 보완. 배포 후 카카오톡·Facebook·LinkedIn 디버거 + 실기기 카카오톡 3종 검증까지 완료(`docs/superpowers/specs/2026-08-06-social-meta-design.md` 참고). `twitter:site` 핸들(`@coredxi`)도 마케팅팀 확인 후 `layout.tsx`에 반영 완료(2026-08-07) — 후속 항목 없음

---

## 6. 기술 아키텍처

### 6-1. 기술 스택

| 레이어 | 기술 | 버전 |
|--------|------|------|
| 프레임워크 | Next.js (App Router) | 15.5.x |
| UI 라이브러리 | React | 19.x |
| 언어 | TypeScript | 5.x |
| 스타일링 | Tailwind CSS (CSS 기반 설정) | v4 |
| UI 컴포넌트 | shadcn/ui (base-nova 스타일) | 최신 |
| ORM | Prisma | 7.x |
| 데이터베이스 | PostgreSQL (Supabase 호스팅) | - |
| 스토리지 | Supabase Storage (`blog-images` 버킷) | - |
| 인증 | NextAuth v5 (Auth.js) | 5.0.0-beta.31 |
| 에디터 | Tiptap (WYSIWYG) + BlockNote (레거시 호환) | 3.13.0 |
| 이메일 | Resend | - |
| 모니터링 | Sentry | - |
| 분석 | Google Analytics 4 (Data API) | - |
| 패키지 매니저 | pnpm + Turbopack | - |
| 배포 | Vercel | - |

- **GA4 전환 이벤트 태깅 완료 (2026-08-08)** — `cta_click`/`contact_submit`/`newsletter_subscribe`/`scroll_depth` 4종 커스텀 이벤트. 설계: `docs/superpowers/specs/2026-08-08-ga4-event-tracking-design.md`
- **영업 지원 트랙(Phase 1.5) 착수 (2026-08-22)** — 영업이사 합류에 맞춰 `/ax-check` 인터뷰 깔때기·`/admin/leads`·솔루션 단일 오퍼 재편·팔로업 뉴스레터 발송·미팅 예약을 3단계(09/05·09/26·10/31)로 진행. **2026-08-08 "뉴스레터 발송 범위 제외" 결정은 철회**하되 목적을 "리드 팔로업 월 1회"로 좁힘. GA4는 `ax_check_submit` 이벤트 신설(`source` 디멘션 재사용). 설계: `docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md`, 실행: `docs/superpowers/plans/2026-08-22-sales-enablement-action-plan.md`
- **전환 퍼널 분석 대시보드 2단계(시각화 UI) 구현 완료 (2026-08-14)** — `/admin/dashboard`의 `Ga4FunnelPanel`이 최근 30일 이벤트 카운트 기반 근사 퍼널(방문→스크롤 참여→CTA 클릭→문의 제출)과 뉴스레터 구독 건수를 가로 바 형태로 표시. GA4 정식 Funnel Exploration이 아닌 eventCount/sessions 근사치이며, 스크롤 깊이(`percent`) 구간 세분화는 커스텀 디멘션 등록 확인 전까지 보류(이벤트 총합만 사용). 설계: `docs/superpowers/specs/2026-08-14-funnel-dashboard-stage2-design.md`. **실측(실 GA4 데이터 렌더링·배포 후 실시간 이벤트 확인) 2026-08-30 완료** — 프로덕션에서 전환 퍼널 실 데이터 확인 및 블로그 하단 CTA `cta_click`(`cta_location=blog_post_bottom`) 실시간 수신 확인(`docs/superpowers/plans/2026-08-14-phase1-item4-5-action-plan.md` 2번 표 순서 5~7). **Phase 1 공식 종료**

### 6-2. 데이터베이스 스키마 (Prisma)

| 모델 | 용도 |
|------|------|
| `Admin` | 관리자 (이메일·비밀번호·Role: SUPER_ADMIN/EDITOR/VIEWER) |
| `User` | 일반 회원 (NextAuth) |
| `Account`, `Session`, `VerificationToken` | NextAuth 어댑터 |
| `OtpCode` | 회원가입 이메일 OTP |
| `PasswordResetToken` | Admin·User 공통 비밀번호 재설정 링크 토큰(1시간 유효, 1회용, 2026-08-26 추가) |
| `Portfolio` | 성공사례 CMS |
| `BlogPost` | 블로그 글 (Tiptap JSON 본문) |
| `BlogCategory` | 블로그 카테고리 |
| `RateLimitHit` | 관리자 로그인·문의 폼·뉴스레터 구독 등 요청 빈도 제한 기록 |
| `NewsletterSubscriber` | 뉴스레터 구독자(2026-08-08 구현·검증·DB 반영 완료, `docs/superpowers/specs/2026-08-08-newsletter-design.md` 참고). AX 체크 선택 동의 시 `source="ax-check"`로 합류 |
| `AxCheckResponse` | **코드·마이그레이션 SQL 작성 완료(2026-08-25), DB 반영은 `prisma migrate deploy` 실행 대기** AX 체크 응답·등급(HOT/WARM/COLD)·상태(NEW/CONTACTED/MEETING/CLOSED)·요약·영업 메모 |

**Supabase 테이블** (Prisma 외):

| 테이블 | 용도 |
|--------|------|
| `contacts` | 문의 접수·상태 관리 |
| `contact_settings` | 알림 이메일 설정 (`notification_email` 키) |

### 6-3. 아키텍처 다이어그램

```mermaid
flowchart TB
    subgraph PublicPages["공개 페이지"]
        Home["/"]
        About["/about"]
        Solutions["/solutions"]
        Cases["/cases"]
        Blog["/blog"]
        Contact["/contact"]
    end

    subgraph AuthPages["인증"]
        Login["/login"]
        Signup["/signup"]
        AdminLogin["/admin/login"]
    end

    subgraph AdminCMS["관리자 CMS /admin"]
        Dashboard["dashboard"]
        BlogAdmin["blog"]
        PortfolioAdmin["portfolio"]
        ContactAdmin["contact"]
        UserAdmin["users / customers"]
        CmsPlaceholder["main / about / solutions (미구현)"]
    end

    subgraph APILayer["API Routes /api"]
        AuthAPI["/api/auth/*"]
        BlogAPI["/api/admin/blog/*"]
    end

    subgraph DataLayer["데이터 계층"]
        Prisma["Prisma ORM"]
        PostgreSQL["PostgreSQL (Supabase)"]
        SupabaseStorage["Supabase Storage"]
        SupabaseTables["Supabase Tables (contacts)"]
    end

    subgraph ExternalServices["외부 서비스"]
        GA4["Google Analytics 4"]
        Sentry["Sentry"]
        Resend["Resend Email"]
        OAuth["Google / Kakao / Naver OAuth"]
    end

    PublicPages --> Prisma
    Contact --> SupabaseTables
    Contact --> Resend
    AdminCMS --> Prisma
    BlogAdmin --> SupabaseStorage
    AuthPages --> AuthAPI
    AuthAPI --> Prisma
    Signup --> Resend
    Dashboard --> GA4
    Prisma --> PostgreSQL
```

### 6-4. 프로젝트 디렉터리 구조

```
src/
├── app/                    # Next.js App Router (87개 파일)
│   ├── (공개 페이지)        # /, /about, /solutions, /cases, /blog, /contact, ...
│   ├── admin/              # 관리자 패널 (/admin/*)
│   ├── api/                # API Routes
│   ├── layout.tsx          # 루트 레이아웃
│   ├── globals.css         # Tailwind v4 + 테마 설정
│   ├── sitemap.ts
│   └── robots.ts
├── components/             # UI 컴포넌트 (46개 파일)
│   ├── Header.tsx, Hero.tsx, Footer.tsx, Logo.tsx
│   ├── CasesPreview.tsx
│   ├── cases/, blog/, login/, editor/
│   ├── admin/dashboard/    # 관리자 대시보드 컴포넌트
│   └── ui/                 # shadcn/ui 컴포넌트
├── lib/                    # 유틸·서비스 레이어 (30개 파일)
│   ├── prisma.ts, utils.ts
│   ├── supabase/admin.ts
│   ├── auth/, ga4/
│   └── blog-image-storage.ts, resend.ts, seo.ts, ...
├── actions/                # Server Actions
│   ├── contact.ts
│   └── sendEmail.ts
├── auth.ts, auth.config.ts # NextAuth 설정
├── middleware.ts            # 관리자 라우트 보호
└── types/                  # TypeScript 타입 확장
```

---

## 7. 외부 서비스 연동

| 서비스 | 용도 | 환경변수 |
|--------|------|----------|
| **Supabase** | PostgreSQL DB + Storage + contacts 테이블 | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Google OAuth** | 소셜 로그인 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Kakao OAuth** | 소셜 로그인 | `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` |
| **Naver OAuth** | 소셜 로그인 | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` |
| **Resend** | 이메일 발송 (OTP, 문의 알림, 뉴스레터 구독 확인) | `RESEND_API_KEY` |
| **Resend Audiences** | 뉴스레터 구독자 동기화(선택, 미설정 시 로컬 DB만 사용) | `RESEND_AUDIENCE_ID` |
| **Google Analytics 4** | 방문자 분석 + 관리자 대시보드 | `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `GA4_PROPERTY_ID`, `GA4_SERVICE_ACCOUNT_JSON` |
| **Sentry** | 에러 모니터링 | (next.config.ts에서 org/project 설정) |
| **Notion** | (환경변수 존재, 실제 연동 미확인) | `NOTION_TOKEN`, `NOTION_*_DB_ID` (7개) |
| **Vercel** | 배포 플랫폼 | `.vercel/project.json` |

---

## 8. 배포 환경

- **플랫폼**: Vercel
- **프로덕션 도메인**: `www.coredxi.com`
- **리다이렉트**: `coredxi.com/*` → `www.coredxi.com/*` (301 영구)
- **개발 서버**: `pnpm dev` → 포트 3100 (Turbopack)
- **빌드**: `prisma generate && next build`
- **postinstall**: `prisma generate` (Vercel 배포 시 자동 실행)

---

## 9. 비기능 요구사항

| 항목 | 내용 |
|------|------|
| **SEO** | 정적·동적 메타데이터, sitemap, robots, JSON-LD, OG 이미지 |
| **성능** | Turbopack 개발 빌드, `force-dynamic`은 홈(`/`)에만 적용, 이미지 최적화 |
| **보안** | 관리자 미들웨어 Role 체크, SSRF 방지(이미지 import), bcrypt 비밀번호 해시 |
| **접근성** | shadcn/ui 컴포넌트 기반 (WAI-ARIA 준수) |
| **반응형** | 모바일·태블릿·데스크탑 전 해상도 지원 |
| **유지보수** | 비개발자용 `CONTENT_GUIDE.md` 제공, 코드 내 `[홍보팀]` 한국어 주석 |

---

## 10. 용어 정의

| 용어 | 설명 |
|------|------|
| **AX** | AI 전환(AI Transformation) — CoreDXI의 핵심 사업 영역 |
| **Portfolio** | 코드베이스 내 성공사례 모델명 (공개 표시명: "성공사례") |
| **SUPER_ADMIN** | 모든 관리자 기능 접근 가능한 최고 권한 |
| **EDITOR** | 블로그·포트폴리오 편집 권한 |
| **VIEWER** | 조회 전용 권한 |
| **Tiptap** | 블로그 에디터로 사용하는 WYSIWYG 라이브러리 |
| **BlockNote** | 이전 버전 블로그 글 호환을 위한 레거시 에디터 |
