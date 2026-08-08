# GA4 전환 이벤트 태깅 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 방문자의 전환 행동(스크롤 → CTA 클릭 → 문의/구독 제출)을 4종 GA4 커스텀 이벤트(`cta_click`, `contact_submit`, `newsletter_subscribe`, `scroll_depth`)로 기록한다.

**Architecture:** 클라이언트 전용 유틸(`trackEvent`)이 `window.gtag`를 감싸 그레이스풀 디그레이드를 중앙화한다. 이벤트 3종(`cta_click`, `contact_submit`, `newsletter_subscribe`)은 기존 컴포넌트/신규 얇은 래퍼 컴포넌트에서 호출하고, `scroll_depth`는 순수 함수(임계값 계산)+얇은 클라이언트 컴포넌트(DOM 리스너) 조합으로 구현해 로직만 단위 테스트한다.

**Tech Stack:** Next.js 15 App Router (Server/Client Components), TypeScript, GA4 `gtag.js`(이미 `layout.tsx`에 로드됨), Vitest(`environment: "node"`).

## Global Constraints

- `prisma migrate dev` 금지 — 이번 작업은 DB 스키마 변경이 없으므로 해당 없음.
- 브랜드 컬러 `#1E4E8C`(`primary` 토큰), 코너 반경 `0.75rem`(`rounded-xl`) 이상 — 이번 작업은 기존 CTA 버튼의 스타일을 그대로 유지하고 동작만 추가하므로 신규 스타일 없음.
- `any` 타입 사용 금지 — `window.gtag` 타입은 `declare global`로 명시적 시그니처를 선언한다.
- 컴포넌트 파일에 비개발자(홍보팀)도 이해할 수 있는 한국어 주석(`[홍보팀]` 태그) 필요 — 단, 이번 신규 파일들은 순수 개발 인프라(추적 코드)라 홍보팀이 직접 편집할 대상이 아니므로 일반 개발자 주석만 작성한다(기존 `src/lib/rate-limit.ts`, `src/lib/ga4/config.ts`와 동일 수준).
- Named Export 방식 유지.
- CSP nonce 정책은 예외 없이 적용 — 단, 이번 작업은 인라인 스크립트를 추가하지 않으므로 별도 조치 불필요(설계 문서 5절 확인 완료).
- Sentry 20% 트레이스 샘플링 — 이번 작업과 무관.

---

## Task 1: `trackEvent` 유틸 (GA4 이벤트 전송 그레이스풀 디그레이드)

**Files:**
- Create: `src/lib/ga4-events.ts`
- Test: `src/lib/ga4-events.test.ts`

**Interfaces:**
- Produces: `trackEvent<T extends "cta_click" | "contact_submit" | "newsletter_subscribe" | "scroll_depth">(name: T, params: AnalyticsEventMap[T]): void` — Task 3, 4, 5에서 이 함수를 import해 사용한다.
  - `cta_click`의 params 타입: `{ cta_location: string }`
  - `contact_submit`의 params 타입: `Record<string, never>` (빈 객체 `{}` 전달)
  - `newsletter_subscribe`의 params 타입: `{ source: string }`
  - `scroll_depth`의 params 타입: `{ percent: 25 | 50 | 75 | 100 }`

- [ ] **Step 1: Write the failing test**

`src/lib/ga4-events.test.ts` 새로 생성:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "./ga4-events";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("trackEvent", () => {
  it("does nothing when window is undefined (SSR)", () => {
    expect(() => trackEvent("contact_submit", {})).not.toThrow();
  });

  it("does nothing when window.gtag is not a function", () => {
    vi.stubGlobal("window", {});
    expect(() => trackEvent("cta_click", { cta_location: "footer" })).not.toThrow();
  });

  it("calls window.gtag with the event name and params", () => {
    const gtagMock = vi.fn();
    vi.stubGlobal("window", { gtag: gtagMock });

    trackEvent("cta_click", { cta_location: "footer" });

    expect(gtagMock).toHaveBeenCalledWith("event", "cta_click", {
      cta_location: "footer",
    });
  });

  it("passes scroll_depth params through unchanged", () => {
    const gtagMock = vi.fn();
    vi.stubGlobal("window", { gtag: gtagMock });

    trackEvent("scroll_depth", { percent: 50 });

    expect(gtagMock).toHaveBeenCalledWith("event", "scroll_depth", { percent: 50 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ga4-events.test.ts`
Expected: FAIL — `Cannot find module './ga4-events'` (파일이 아직 없음)

- [ ] **Step 3: Write minimal implementation**

`src/lib/ga4-events.ts` 새로 생성:

```typescript
/**
 * ga4-events.ts — GA4 커스텀 이벤트 전송 유틸
 *
 * layout.tsx에 이미 로드된 gtag.js를 감싸서, 측정 ID가 설정되지 않았거나
 * 광고 차단기 등으로 gtag가 없을 때 조용히 무시한다(그레이스풀 디그레이드,
 * resend.ts의 getResendApiKey() ?? null 패턴과 동일한 원칙).
 */

type AnalyticsEventMap = {
  cta_click: { cta_location: string };
  contact_submit: Record<string, never>;
  newsletter_subscribe: { source: string };
  scroll_depth: { percent: 25 | 50 | 75 | 100 };
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent<T extends keyof AnalyticsEventMap>(
  name: T,
  params: AnalyticsEventMap[T]
): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }
  window.gtag("event", name, params);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ga4-events.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ga4-events.ts src/lib/ga4-events.test.ts
git commit -m "feat: GA4 커스텀 이벤트 전송 유틸 trackEvent 추가"
```

---

## Task 2: `scroll-depth` 임계값 계산 순수 함수

**Files:**
- Create: `src/lib/scroll-depth.ts`
- Test: `src/lib/scroll-depth.test.ts`

**Interfaces:**
- Produces: `type ScrollThreshold = 25 | 50 | 75 | 100`, `getNewlyReachedThresholds(percent: number, alreadyFired: ReadonlySet<ScrollThreshold>): ScrollThreshold[]` — Task 4에서 사용.

- [ ] **Step 1: Write the failing test**

`src/lib/scroll-depth.test.ts` 새로 생성:

```typescript
import { describe, expect, it } from "vitest";
import { getNewlyReachedThresholds } from "./scroll-depth";

describe("getNewlyReachedThresholds", () => {
  it("returns nothing at 0%", () => {
    expect(getNewlyReachedThresholds(0, new Set())).toEqual([]);
  });

  it("returns [25] once the user scrolls past 25%", () => {
    expect(getNewlyReachedThresholds(30, new Set())).toEqual([25]);
  });

  it("does not repeat thresholds that already fired", () => {
    expect(getNewlyReachedThresholds(60, new Set([25]))).toEqual([50]);
  });

  it("returns every remaining threshold when the page is fully scrolled", () => {
    expect(getNewlyReachedThresholds(100, new Set())).toEqual([25, 50, 75, 100]);
  });

  it("returns nothing when every threshold already fired", () => {
    expect(getNewlyReachedThresholds(100, new Set([25, 50, 75, 100]))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/scroll-depth.test.ts`
Expected: FAIL — `Cannot find module './scroll-depth'`

- [ ] **Step 3: Write minimal implementation**

`src/lib/scroll-depth.ts` 새로 생성:

```typescript
/**
 * scroll-depth.ts — 스크롤 깊이 임계값 계산 (순수 함수)
 *
 * DOM에 의존하지 않아 단위 테스트가 쉽다. 실제 스크롤 이벤트 리스닝은
 * ScrollDepthTracker.tsx(클라이언트 컴포넌트)가 담당하고, 이 함수는
 * "현재 스크롤 비율 + 이미 전송한 임계값 목록"을 받아 "새로 전송해야 할
 * 임계값"만 계산한다.
 */

export type ScrollThreshold = 25 | 50 | 75 | 100;

const THRESHOLDS: ScrollThreshold[] = [25, 50, 75, 100];

export function getNewlyReachedThresholds(
  percent: number,
  alreadyFired: ReadonlySet<ScrollThreshold>
): ScrollThreshold[] {
  return THRESHOLDS.filter(
    (threshold) => percent >= threshold && !alreadyFired.has(threshold)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/scroll-depth.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scroll-depth.ts src/lib/scroll-depth.test.ts
git commit -m "feat: 스크롤 깊이 임계값 계산 순수 함수 추가"
```

---

## Task 3: `TrackedCtaLink` 컴포넌트 + 6개 CTA 지점 교체

**Files:**
- Create: `src/components/analytics/TrackedCtaLink.tsx`
- Modify: `src/components/Hero.tsx:54-62`
- Modify: `src/app/solutions/page.tsx:46-52`, `:110-116`, `:168-174`
- Modify: `src/app/about/page.tsx:149-155`
- Modify: `src/components/Footer.tsx:34-40`

**Interfaces:**
- Consumes: `trackEvent` from `src/lib/ga4-events.ts` (Task 1)
- Produces: `TrackedCtaLink` — `next/link`의 모든 props(`href`, `className`, `children` 등)를 그대로 받고 `location: string` prop을 추가로 받는 클라이언트 컴포넌트. Task 5·6에서는 사용하지 않음(CTA 전용).

이 컴포넌트는 얇은 UI 래퍼라 자동화된 단위 테스트를 추가하지 않는다(프로젝트 관행상 `NewsletterSubscribeForm.tsx` 같은 클라이언트 폼 컴포넌트도 별도 단위 테스트 없이 `lint`/`tsc`/수동 확인으로 검증). 대신 이 태스크의 완료 기준은 "6개 지점 모두 교체 + 빌드 통과"다.

- [ ] **Step 1: `TrackedCtaLink` 컴포넌트 작성**

`src/components/analytics/TrackedCtaLink.tsx` 새로 생성:

```tsx
"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { trackEvent } from "@/lib/ga4-events";

type Props = ComponentProps<typeof Link> & {
  /** 클릭 위치 식별자 (예: "hero_primary", "footer") — GA4 cta_location 파라미터로 전송 */
  location: string;
};

export function TrackedCtaLink({ location, onClick, ...linkProps }: Props) {
  return (
    <Link
      {...linkProps}
      onClick={(e) => {
        trackEvent("cta_click", { cta_location: location });
        onClick?.(e);
      }}
    />
  );
}
```

- [ ] **Step 2: `Hero.tsx`의 메인 CTA 교체**

`src/components/Hero.tsx` 상단에 import 추가:

```typescript
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";
```

기존 코드 (54-62행):

```tsx
          <a
            href={content.primaryCtaHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-base font-semibold text-white shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 sm:w-auto"
          >
            {content.primaryCtaText}
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </a>
```

교체 후:

```tsx
          <TrackedCtaLink
            href={content.primaryCtaHref}
            location="hero_primary"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-base font-semibold text-white shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 sm:w-auto"
          >
            {content.primaryCtaText}
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </TrackedCtaLink>
```

(secondary CTA인 `content.secondaryCtaHref` 링크는 `/about`로 이동하는 탐색용이라 그대로 둔다 — 설계 문서 4-2절 참고)

- [ ] **Step 3: `solutions/page.tsx`의 CTA 3곳 교체**

상단에 import 추가:

```typescript
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";
```

46-52행 (히어로 CTA), `<Link href="/contact" ...>` → `<TrackedCtaLink href="/contact" location="solutions_hero" ...>` (className·children 그대로 유지)

110-116행 (솔루션 카드 내부 "도입 문의" 버튼, `.map()` 안), `<Link href="/contact" ...>` → `<TrackedCtaLink href="/contact" location="solutions_mid" ...>`

168-174행 (하단 파란 배경 CTA), `<Link href="/contact" ...>` → `<TrackedCtaLink href="/contact" location="solutions_bottom" ...>`

- [ ] **Step 4: `about/page.tsx`의 CTA 교체**

상단에 import 추가:

```typescript
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";
```

149-155행, `<Link href="/contact" ...>` → `<TrackedCtaLink href="/contact" location="about_cta" ...>` (className·children 그대로 유지)

- [ ] **Step 5: `Footer.tsx`의 CTA 교체**

`import Link from "next/link";` 옆에 추가:

```typescript
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";
```

34-40행, `<Link href="/contact" ...>` → `<TrackedCtaLink href="/contact" location="footer" ...>` (className·children 그대로 유지, `/terms`·`/privacy` 링크는 그대로 `Link` 유지)

- [ ] **Step 6: 잔여 지점 확인**

Run: `grep -rn 'href="/contact"' src --include="*.tsx"`
Expected: `src/app/contact/ContactPageClient.tsx`에서 `mailto:` 링크를 제외하면 매칭 결과 없음 (6곳 모두 `TrackedCtaLink`로 교체됐는지 확인)

- [ ] **Step 7: 타입 체크 + lint**

Run: `npx tsc --noEmit && npx eslint src/components/Hero.tsx src/app/solutions/page.tsx src/app/about/page.tsx src/components/Footer.tsx src/components/analytics/TrackedCtaLink.tsx`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add src/components/analytics/TrackedCtaLink.tsx src/components/Hero.tsx src/app/solutions/page.tsx src/app/about/page.tsx src/components/Footer.tsx
git commit -m "feat: 전환 CTA 6곳에 cta_click 이벤트 태깅 추가"
```

---

## Task 4: `ScrollDepthTracker` 컴포넌트 + 루트 레이아웃 마운트

**Files:**
- Create: `src/components/analytics/ScrollDepthTracker.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `trackEvent` from `src/lib/ga4-events.ts` (Task 1), `getNewlyReachedThresholds`/`ScrollThreshold` from `src/lib/scroll-depth.ts` (Task 2)
- Produces: `ScrollDepthTracker` — props 없음, `null` 렌더링. `layout.tsx`에 1회만 마운트.

- [ ] **Step 1: `ScrollDepthTracker` 컴포넌트 작성**

`src/components/analytics/ScrollDepthTracker.tsx` 새로 생성:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/ga4-events";
import { getNewlyReachedThresholds, type ScrollThreshold } from "@/lib/scroll-depth";

/**
 * ScrollDepthTracker — 모든 공개 페이지에서 스크롤 깊이(25/50/75/100%)를
 * GA4 scroll_depth 이벤트로 전송한다. 화면에는 아무것도 렌더링하지 않으며
 * layout.tsx에 한 번만 마운트한다. 페이지 이동 시 임계값 기록을 초기화한다.
 */
export function ScrollDepthTracker() {
  const pathname = usePathname();
  const firedRef = useRef<Set<ScrollThreshold>>(new Set());

  useEffect(() => {
    firedRef.current = new Set();
    let ticking = false;

    function handleScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const doc = document.documentElement;
        const scrollableHeight = doc.scrollHeight - doc.clientHeight;
        const percent =
          scrollableHeight <= 0
            ? 100
            : Math.round((window.scrollY / scrollableHeight) * 100);

        for (const threshold of getNewlyReachedThresholds(percent, firedRef.current)) {
          firedRef.current.add(threshold);
          trackEvent("scroll_depth", { percent: threshold });
        }
        ticking = false;
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  return null;
}
```

- [ ] **Step 2: `layout.tsx`에 마운트**

`src/app/layout.tsx` import 목록에 추가 (`Toaster` import 근처):

```typescript
import { ScrollDepthTracker } from "@/components/analytics/ScrollDepthTracker";
```

기존 body 내부 (현재 마지막 부분):

```tsx
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} nonce={nonce}>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-center" />
          </AuthProvider>
        </ThemeProvider>
      </body>
```

교체 후 (`ScrollDepthTracker` 한 줄 추가):

```tsx
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} nonce={nonce}>
          <AuthProvider>
            {children}
            <ScrollDepthTracker />
            <Toaster richColors position="top-center" />
          </AuthProvider>
        </ThemeProvider>
      </body>
```

- [ ] **Step 3: 타입 체크 + lint**

Run: `npx tsc --noEmit && npx eslint src/components/analytics/ScrollDepthTracker.tsx src/app/layout.tsx`
Expected: 0 errors

- [ ] **Step 4: 로컬 수동 확인**

Run: `pnpm dev` 로 개발 서버 실행 후 아무 공개 페이지에서 브라우저 개발자 도구 콘솔에 `document.querySelector('body')`로 컴포넌트가 렌더링 트리에 있는지, 스크롤 시 에러가 발생하지 않는지 확인 (자동화된 테스트는 Task 2의 순수 함수 테스트로 이미 커버됨)

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/ScrollDepthTracker.tsx src/app/layout.tsx
git commit -m "feat: 전체 공개 페이지에 scroll_depth 이벤트 태깅 추가"
```

---

## Task 5: `contact_submit` / `newsletter_subscribe` 이벤트 연결

**Files:**
- Modify: `src/app/contact/ContactPageClient.tsx:75-87`
- Modify: `src/components/newsletter/NewsletterSubscribeForm.tsx:40-47`

**Interfaces:**
- Consumes: `trackEvent` from `src/lib/ga4-events.ts` (Task 1)

- [ ] **Step 1: `ContactPageClient.tsx`에 `contact_submit` 추가**

상단 import에 추가:

```typescript
import { trackEvent } from "@/lib/ga4-events";
```

기존 코드 (75-87행):

```typescript
      if (!result.success) {
        alert(result.error ?? "문의 접수에 실패했습니다.");
        return;
      }

      alert(
        "문의가 성공적으로 접수되었습니다. 영업일 기준 1~2일 내로 연락드리겠습니다."
      );
      setFirstName("");
      setLastName("");
      setEmail("");
      setInquiryType("");
      setMessage("");
```

교체 후 (`trackEvent` 한 줄 추가):

```typescript
      if (!result.success) {
        alert(result.error ?? "문의 접수에 실패했습니다.");
        return;
      }

      trackEvent("contact_submit", {});
      alert(
        "문의가 성공적으로 접수되었습니다. 영업일 기준 1~2일 내로 연락드리겠습니다."
      );
      setFirstName("");
      setLastName("");
      setEmail("");
      setInquiryType("");
      setMessage("");
```

- [ ] **Step 2: `NewsletterSubscribeForm.tsx`에 `newsletter_subscribe` 추가**

상단 import에 추가:

```typescript
import { trackEvent } from "@/lib/ga4-events";
```

기존 코드 (40-47행):

```typescript
      const result = await subscribeNewsletter(email, source);
      if (!result.success) {
        setStatus({ type: "error", message: result.error });
        return;
      }
      setStatus({ type: "success" });
      setEmail("");
      setConsent(false);
```

교체 후 (`trackEvent` 한 줄 추가):

```typescript
      const result = await subscribeNewsletter(email, source);
      if (!result.success) {
        setStatus({ type: "error", message: result.error });
        return;
      }
      trackEvent("newsletter_subscribe", { source });
      setStatus({ type: "success" });
      setEmail("");
      setConsent(false);
```

- [ ] **Step 3: 타입 체크 + lint + 기존 테스트 회귀 확인**

Run: `npx tsc --noEmit && npx eslint src/app/contact/ContactPageClient.tsx src/components/newsletter/NewsletterSubscribeForm.tsx && npx vitest run`
Expected: 0 errors, 기존 vitest 스위트(뉴스레터·문의 테스트 포함) 전부 통과 — `trackEvent`는 `window`가 없는 서버/테스트 환경에서 자동으로 무시되므로 `newsletter.test.ts`/기존 contact 테스트가 깨지지 않아야 함

- [ ] **Step 4: Commit**

```bash
git add src/app/contact/ContactPageClient.tsx src/components/newsletter/NewsletterSubscribeForm.tsx
git commit -m "feat: 문의·뉴스레터 제출 성공 시 전환 이벤트 전송 추가"
```

---

## Task 6: 문서 갱신 + 최종 검증 + 배포

**Files:**
- Modify: `docs/PRD.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: `docs/TODO.md` 갱신**

"1. 완료된 기능" 섹션의 소셜 메타태그 항목 다음, 뉴스레터 구독 항목 다음에 새 항목 추가:

```markdown
- ✅ **GA4 전환 이벤트 태깅 (Phase 1 마지막 잔여 항목 — 1단계)** — 2026-08-08 완료. 설계: `docs/superpowers/specs/2026-08-08-ga4-event-tracking-design.md`
  - `cta_click`(전환 CTA 6곳) / `contact_submit` / `newsletter_subscribe` / `scroll_depth`(25/50/75/100%, 전체 공개 페이지) 4종 이벤트 태깅
  - `src/lib/ga4-events.ts`(전송 유틸) + `src/lib/scroll-depth.ts`(임계값 계산 순수 함수) Vitest 단위 테스트 추가
  - ⏸️ **남은 작업**: 2~3주 데이터 누적 후 2단계(퍼널 시각화 UI) 별도 설계·구현
```

"4. 향후 계획" 섹션의 Phase 1 잔여 항목 안내 문구를 갱신:

```markdown
> Phase 1 잔여 3개 항목(뉴스레터 구독/소셜 메타태그 강화/전환 퍼널 대시보드)의 착수 순서·설계 방향은
> `docs/superpowers/plans/2026-08-05-phase1-remaining-action-plan.md` 참고 (2026-08-05 작성)
> — **소셜 메타태그 강화는 2026-08-07 완료**, **뉴스레터 구독은 2026-08-08 완료**, **전환 퍼널 대시보드는 1단계(이벤트 태깅) 2026-08-08 완료, 2단계(시각화)는 데이터 누적 후 별도 진행** — Phase 1 1단계 항목 전부 완료
```

- [ ] **Step 2: `docs/PRD.md` 갱신**

"6-1. 기술 스택" 아래 또는 "5-5. SEO & 메타데이터" 근처에 한 줄 추가:

```markdown
- **GA4 전환 이벤트 태깅 완료 (2026-08-08)** — `cta_click`/`contact_submit`/`newsletter_subscribe`/`scroll_depth` 4종 커스텀 이벤트. 설계: `docs/superpowers/specs/2026-08-08-ga4-event-tracking-design.md`. 시각화 대시보드는 데이터 누적 후 별도 진행
```

- [ ] **Step 3: 최종 전체 검증**

Run: `pnpm lint && npx tsc --noEmit && pnpm test`
Expected: lint 0 errors(기존 스크립트 파일 `no-console` 경고 9건 제외), tsc 0 errors, vitest 전부 통과(기존 126개 + 이번에 추가한 테스트)

- [ ] **Step 4: 잔여 CTA 지점 재확인**

Run: `grep -rn 'href="/contact"' src --include="*.tsx"`
Expected: `ContactPageClient.tsx`의 `mailto:` 관련 줄 외에는 결과 없음 (모든 CTA가 `TrackedCtaLink`로 교체됨을 재확인)

- [ ] **Step 5: 문서 커밋**

```bash
git add docs/PRD.md docs/TODO.md
git commit -m "docs: GA4 전환 이벤트 태깅 완료 상태를 문서에 반영한다"
```

- [ ] **Step 6: main 푸시**

```bash
git push origin main
```

- [ ] **Step 7: 배포 후 수동 확인 (Vercel 배포 완료 후)**

- 브라우저에서 `NEXT_PUBLIC_GA_MEASUREMENT_ID`가 설정된 프로덕션 환경에 접속해 개발자 도구 Network 탭에서 `collect?...` 요청에 `en=cta_click` 등 이벤트명이 실제로 전송되는지 확인
- GA4 관리자 화면(실시간 보고서 → 이벤트)에서 4종 이벤트가 수신되는지 확인
