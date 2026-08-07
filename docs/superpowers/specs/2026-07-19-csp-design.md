# CSP(Content-Security-Policy) 도입 설계

> 작성일: 2026-07-19
> 관련 항목: `docs/TODO.md` §2 "CSP(Content-Security-Policy) 미적용", §4 "CSP 도입"

## 배경

`next.config.ts`의 `headers()`에 X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
Permissions-Policy, HSTS는 이미 적용되어 있으나 CSP만 빠져 있다. TODO.md는 "script-src/connect-src를
잘못 설정하면 OAuth·GA4·Sentry·영상임베드가 조용히 깨질 위험"을 이유로 보류해 왔다. 이번 설계는 그
리스크를 낮추는 롤아웃 방식(Report-Only 선행)과 정확한 허용 목록을 정한다.

## 현황 조사 결과

- **정적 헤더의 한계**: `next.config.ts`의 `headers()`는 빌드 타임 고정값이라 요청별 nonce를 넣을 수 없음.
  nonce 기반 CSP를 도입하려면 CSP 헤더 생성을 `src/middleware.ts`로 옮겨야 함.
- **현재 `middleware.ts` 매처**: `/admin/:path*`, `/concepts`, `/concepts/:path*`만 매칭. 전체 라우트에
  CSP를 적용하려면 매처를 확장해야 하며, 기존 admin 인증 가드 로직은 그대로 유지.
- **외부 리소스 인벤토리** (CSP 허용 목록의 근거):
  - GA4: `layout.tsx`에서 `https://www.googletagmanager.com/gtag/js` 스크립트 로드 + 인라인 `gtag(...)` 초기화 스크립트.
  - JSON-LD: `layout.tsx`에서 페이지별 동적 콘텐츠를 담은 인라인 `<script type="application/ld+json">`.
    (내용이 페이지마다 달라 해시 기반 CSP는 불가 — nonce 필요)
  - Sentry: `instrumentation-client.ts`에서 SDK 초기화(npm 패키지 번들, 외부 스크립트 로드 없음). `next.config.ts`의
    `tunnelRoute: "/monitoring"` 설정으로 이벤트 전송이 same-origin으로 터널링됨 → 별도 CSP 허용 불필요.
  - 영상 임베드: `src/lib/video-embed.ts`가 YouTube/Vimeo URL을 `iframe` embed URL로 변환,
    `src/app/cases/[slug]/page.tsx`에서 렌더링.
  - 블로그 이미지: Supabase Storage(`blog-images` 버킷) URL + 관리자가 붙여넣은 임의 외부 이미지 URL
    (`src/lib/tiptap-content.ts`, `src/lib/url-safety.ts`가 감지만 하고 차단하지 않음 — 좁은 img-src는
    기존 콘텐츠를 깨뜨릴 위험).
  - OAuth(Google/Kakao/Naver): `src/auth.config.ts` — next-auth가 서버 라우트 302 리다이렉트로 처리하는
    top-level navigation이라 `connect-src`/`form-action` 영향 없음, 별도 허용 불필요.
  - Supabase 클라이언트(`src/lib/supabase/admin.ts`): `"use client"` 없음 — 전부 서버 사이드 호출이라
    브라우저 CSP(`connect-src`) 대상 아님. 단, 이미지 자체는 브라우저에 `<img>`로 렌더링되므로 `img-src`에는 포함.
  - 폰트: `next/font/google`(Geist)가 셀프호스팅 — 외부 `font-src` 불필요.

## 아키텍처

1. **`src/middleware.ts` 확장**
   - 매처를 전체 라우트로 확장(정적 자산 `_next/*`, `public` 파일 제외), 기존 `/admin`, `/concepts` 가드 로직은 유지.
   - 매 요청마다 `crypto.randomUUID()`로 nonce 생성.
   - nonce를 요청 헤더(`x-nonce`)에 실어 `NextResponse.next({ request: { headers } })`로 다운스트림에 전달.
   - 응답 헤더에 `Content-Security-Policy-Report-Only`(Phase 1) 설정. Phase 3에서 `Content-Security-Policy`로 전환.
   - 같은 CSP 값을 요청 헤더(`Content-Security-Policy-Report-Only`)에도 설정 — Next.js가 자체 프레임워크 인라인 스크립트(hydration/flight-data bootstrap)에 적용할 nonce를 요청 헤더에서 파싱하기 때문(`getScriptNonceFromHeader`). 응답 헤더에만 설정하면 프레임워크 스크립트가 nonce 없이 렌더링되어 Report-Only 단계에서부터 위반 리포트가 대량 발생하고, Phase 3 enforcing 전환 시 hydration이 깨진다.
2. **`src/lib/csp.ts` 신설**
   - `buildCsp(nonce: string): string` 순수 함수로 CSP 문자열 조립 로직 분리 (유닛 테스트 대상).
3. **`src/app/layout.tsx` 수정**
   - `next/headers`의 `headers()`로 `x-nonce` 읽어 GA4 `<Script nonce={nonce}>`, JSON-LD `<script nonce={nonce}>`에 적용.
   - **주의**: 사이트 공통 JSON-LD(layout.tsx)뿐 아니라 페이지에서 직접 렌더하는 JSON-LD도 각각 nonce 적용 필요. Phase 2 모니터링에서 `src/app/cases/[slug]/page.tsx`(누락 확인), `src/app/blog/[slug]/page.tsx`, `src/app/contact/page.tsx`에도 동일 패턴의 `<script type="application/ld+json">`이 있어 각 페이지에서 개별적으로 `headers()`를 호출해 nonce를 적용함(2026-07-22 수정).
4. **`src/app/api/csp-report/route.ts` 신설**
   - `application/csp-report`, `application/reports+json` 바디를 받아 파싱.
   - `Sentry.captureMessage("CSP Violation", { level: "warning", extra: {...} })`로 로깅(Sentry가 동일 위반 자동 그룹핑, 별도 rate-limit 불필요).

## CSP 정책

| Directive | 값 |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self' 'nonce-{NONCE}' 'strict-dynamic' https:` |
| `style-src` | `'self' 'unsafe-inline'` (Tailwind/Radix/shadcn 인라인 style 속성 대응, 스타일 인젝션은 XSS 리스크 낮아 트레이드오프 수용) |
| `img-src` | `'self' data: https:` (블로그 본문 임의 외부 이미지 호환) |
| `font-src` | `'self'` |
| `connect-src` | `'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com` |
| `frame-src` | `'self' https://www.youtube.com https://player.vimeo.com` |
| `form-action` | `'self'` |
| `frame-ancestors` | `'self'` |
| `object-src` | `'none'` |
| `base-uri` | `'self'` |
| `report-uri` | `/api/csp-report` |

## 롤아웃 계획

1. **Phase 1**: Report-Only 헤더 + nonce 배관 + `/api/csp-report` 배포. 개발 서버에서 골든패스 수동 검증
   (일반 로그인 OAuth 3종, 관리자 로그인, 문의 폼, 블로그 상세 영상 임베드, GA4 스크립트 동작, Sentry 에러 캡처)
   + 기존 Playwright E2E 4개(`문의 제출`, `관리자 로그인 성공/실패`, `블로그 발행`) 통과 확인.
2. **Phase 2**: 프로덕션 배포 후 약 1주간 Sentry에 쌓인 CSP 위반 리포트 검토, 누락된 허용 항목 있으면 `csp.ts` 조정.
3. **Phase 3**: 위반 없음 확인되면 헤더명을 `Content-Security-Policy-Report-Only` → `Content-Security-Policy`로
   전환(enforcing). `docs/TODO.md`의 "CSP 미적용" 항목을 완료로 갱신.
   **완료(2026-08-05)**: Sentry 검토 결과 위반 1건(2026-07-19, 개발 환경, `/cases/[slug]` JSON-LD nonce 누락)뿐이었고
   이미 2026-07-22 커밋(`101abcb`)으로 수정·재발 없음 확인. `src/middleware.ts` 헤더명 전환, 로컬 골든패스·
   `npm run lint`/`tsc --noEmit`/`test`(101개)/`test:e2e`(2 passed 2 skipped) 통과, 프로덕션(`www.coredxi.com`)
   콘솔에서 CSP 에러 없음 확인 후 배포 완료.

## 테스트 계획

- `src/lib/csp.ts`의 `buildCsp()` 유닛 테스트(Vitest) — nonce 삽입, 각 directive 존재 여부 검증.
- `/api/csp-report` 라우트 — 잘못된 바디/빈 바디 처리 유닛 테스트.
- 기존 Playwright E2E 4개 회귀 확인(로그인/문의/블로그).
- OAuth 3종은 E2E 커버리지 밖이므로 개발 서버에서 수동 브라우저 검증 필요(설계 문서에 한계로 명시).

## 범위 제외 / 결정 사항

- Report-To/Reporting-Endpoints(모던 스펙)는 도입하지 않고 `report-uri`(레거시, 브라우저 호환성 최광)만 사용.
- `style-src`는 nonce 미적용 — Tailwind/Radix 인라인 style 속성 특성상 비용 대비 효과 낮다고 판단.
- 해시 기반 CSP는 JSON-LD가 페이지별 동적 콘텐츠라 적용 불가로 검토 후 제외.
