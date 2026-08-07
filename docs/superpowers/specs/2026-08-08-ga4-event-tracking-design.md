# GA4 전환 이벤트 태깅 설계 (Phase 1 최종 항목 — 1단계)

> 작성일: 2026-08-08
> 상태: 설계 승인 완료, 구현 대기
> 선행 문서: `docs/superpowers/plans/2026-08-05-phase1-remaining-action-plan.md` (C. 전환 퍼널 분석 대시보드 절)
> 관련 규칙: `docs/PRD.md` 5-5, `CLAUDE.md`, 프로젝트 지침 5-1~5-4 (문서 우선, shadcn/ui 우선 원칙은 UI 신규 없음이라 해당 없음, Sentry·CSP nonce 정책 예외 없이 적용)

---

## 1. 목표

Phase 1 마지막 잔여 항목인 "전환 퍼널 분석 대시보드"를 2단계로 나눠 진행한다. 이 문서는 **1단계(이벤트 태깅)만** 다룬다.

**범위**: 방문자의 전환 행동(스크롤 → CTA 클릭 → 문의/구독 제출)을 GA4 커스텀 이벤트로 기록하는 코드만 구현한다. 이벤트가 2~3주 누적된 뒤, 그 데이터를 관리자 대시보드에 퍼널 차트로 시각화하는 작업은 **별도 설계 문서로 이후 진행**한다(액션플랜 C절 2단계).

**현황**: GA4 Data API 연동(`src/lib/ga4/`)은 이미 있고 관리자 대시보드에 방문자 수·세션·인기 페이지를 표시 중이다. 하지만 `layout.tsx`의 `gtag` 스크립트는 기본 pageview만 전송하며, 커스텀 이벤트 전송 코드는 전혀 없다. 이번 작업은 신규 GA4 연동이 아니라 기존 `gtag`에 이벤트 전송 호출을 추가하는 것이다.

---

## 2. 결정 사항

| 질문 | 결정 | 근거 |
|------|------|------|
| 이번 설계 범위 | 1단계(이벤트 태깅)만 | 시각화는 데이터가 쌓인 뒤 의미가 있음. 액션플랜이 이미 이 순서를 제안 |
| 태깅할 이벤트 | `cta_click`, `contact_submit`, `scroll_depth`, `newsletter_subscribe` (4종) | 액션플랜 제안 3종 + 2026-08-08 배포된 뉴스레터 구독도 전환 이벤트이므로 포함 |
| 스크롤 깊이 적용 범위 | 모든 공개 페이지 | 레이아웃 단위 공통 적용이 구현도 간단하고, 퍼널 분석 시에도 페이지 간 비교가 쉬움 |
| CTA 클릭 태깅 범위 | 문의/상담 전환 버튼만 (`/contact`로 연결되는 CTA) | 내비게이션·블로그 카드 클릭까지 포함하면 전환 퍼널 목적과 무관한 노이즈가 늘어남 |

---

## 3. 아키텍처

### 3-1. 접근 방식 비교

| | A. 중앙화된 유틸 + 얇은 클라이언트 래퍼 (채택) | B. 각 지점에 `window.gtag()` 직접 호출 |
|---|---|---|
| 장점 | 이벤트명·파라미터가 TS 유니언 타입으로 고정(오타 시 컴파일 에러), `gtag` 부재 시 무시 로직이 한 곳에만 존재, 단위 테스트 가능 | 새 파일 없음 |
| 단점 | 파일 몇 개 추가 | 6개 CTA 지점에 중복 코드, 오타가 나도 GA4가 조용히 무시해 런타임에만 발견됨, 테스트 어려움, `Hero.tsx` 등 서버 컴포넌트를 클라이언트로 전환해야 함 |

기존 프로젝트가 외부 서비스 연동을 항상 전용 파일로 감싸는 관행(`src/lib/resend.ts`, `src/lib/ga4/config.ts`)과 일치하는 **A안**을 채택한다.

### 3-2. 스크롤 깊이 측정 방식 비교

| | A. 커스텀 스크롤 리스너 + `scroll_depth` 커스텀 이벤트 (채택) | B. GA4 Enhanced Measurement 내장 스크롤 추적 |
|---|---|---|
| 장점 | 25/50/75/100% 4단계 세분화, 퍼널 정의(방문→스크롤 50%→CTA 클릭→제출)에 필요한 임계값을 직접 제어 | 코드 작성 없음(GA4 속성 설정에서 켜기만 하면 됨) |
| 단점 | 코드 작성 필요 | 90% 고정 임계값 1개뿐이라 퍼널 중간 단계(50%) 정의 불가 |

퍼널 설계상 세분화된 임계값이 필요하므로 **A안**을 채택한다.

---

## 4. 컴포넌트 상세

### 4-1. `src/lib/ga4-events.ts`

클라이언트 전용 이벤트 전송 유틸. `window.gtag`가 없으면(측정 ID 미설정, 광고 차단 등) 아무 동작도 하지 않는다 — `resend.ts`의 그레이스풀 디그레이드 패턴과 동일.

```typescript
type AnalyticsEvent =
  | { name: "cta_click"; params: { cta_location: string } }
  | { name: "contact_submit"; params: Record<string, never> }
  | { name: "newsletter_subscribe"; params: { source: string } }
  | { name: "scroll_depth"; params: { percent: 25 | 50 | 75 | 100 } };

export function trackEvent(event: AnalyticsEvent["name"], params: AnalyticsEvent["params"]): void {
  // window.gtag 존재 여부 확인 후 호출, 없으면 무시
}
```

### 4-2. `src/components/analytics/TrackedCtaLink.tsx`

`next/link`를 감싼 얇은 클라이언트 컴포넌트(`"use client"`). `location` prop(문자열)을 받아 클릭 시 `trackEvent("cta_click", { cta_location: location })`를 호출한 뒤 정상적으로 이동한다. 아래 6개 CTA 지점의 `<Link href="/contact">`를 이 컴포넌트로 교체한다.

| 위치 | `cta_location` 값 |
|------|---------------------|
| `Hero.tsx` 메인 CTA (홈) | `hero_primary` |
| `solutions/page.tsx` 상단 | `solutions_hero` |
| `solutions/page.tsx` 중단 | `solutions_mid` |
| `solutions/page.tsx` 하단 | `solutions_bottom` |
| `about/page.tsx` CTA | `about_cta` |
| `Footer.tsx` 문의하기 링크 | `footer` |

(`Hero.tsx`의 secondary CTA는 `/about`로 연결되는 탐색성 링크라 문의 전환 목적이 아니므로 태깅 대상에서 제외한다.)

### 4-3. `ContactPageClient.tsx` / `NewsletterSubscribeForm.tsx` 수정

이미 클라이언트 컴포넌트이므로 새 파일 없이, 각각 성공 처리 분기에 한 줄만 추가한다.
- `ContactPageClient.tsx`: 문의 제출 성공 시 `trackEvent("contact_submit", {})`
- `NewsletterSubscribeForm.tsx`: 구독 성공 시 `trackEvent("newsletter_subscribe", { source })` (기존 `source` prop 재사용)

### 4-4. `src/lib/scroll-depth.ts`

순수 함수. DOM에 의존하지 않아 단위 테스트가 쉽다.

```typescript
export function getNewlyReachedThresholds(
  percent: number,
  alreadyFired: ReadonlySet<25 | 50 | 75 | 100>
): (25 | 50 | 75 | 100)[] {
  // percent 이하의 임계값 중 alreadyFired에 없는 것만 반환
}
```

### 4-5. `src/components/analytics/ScrollDepthTracker.tsx`

루트 `layout.tsx`에 한 번만 마운트하는, 화면에 아무것도 렌더링하지 않는 클라이언트 컴포넌트.
- 스크롤 이벤트를 스로틀링(예: `requestAnimationFrame` 기반)해서 현재 스크롤 비율을 계산
- `getNewlyReachedThresholds()`로 새로 도달한 임계값을 구해 `trackEvent("scroll_depth", { percent })` 호출
- `usePathname()`으로 페이지 이동을 감지해 "이미 쏜 임계값" 상태를 초기화 — 모든 공개 페이지에 공통 적용

---

## 5. 에러 처리 · 보안 체크

- `NEXT_PUBLIC_GA_MEASUREMENT_ID` 미설정 시 `gtag` 스크립트 자체가 로드되지 않으므로 `trackEvent`의 모든 호출이 자동으로 무시된다(별도 분기 불필요).
- CSP: 인라인 `<script>`를 추가하지 않고 이미 로드되어 있는 `gtag` 함수만 호출하므로 `csp.ts`의 nonce 정책과 충돌하지 않는다(액션플랜이 우려했던 지점, 코드 조사로 확인 완료).
- Sentry 20% 트레이스 샘플링은 이번 변경과 무관(신규 서버 API 라우트 없음).
- 개인정보: 이벤트 파라미터에 이메일 등 개인 식별 정보를 담지 않는다(`cta_location`, `source`, `percent` 등 비식별 값만 전송).

---

## 6. 테스트

- `src/lib/ga4-events.test.ts`: `window.gtag` 있음/없음 두 케이스에서 `trackEvent` 동작 검증. `vitest.config.ts`가 `environment: "node"`라 `vi.stubGlobal("window", ...)`로 모킹.
- `src/lib/scroll-depth.test.ts`: 임계값 계산 순수 함수 케이스별 검증 — 0%→`[]`, 30%→`[25]`, 60%(이미 25 도달)→`[50]`, 100%(미도달)→`[25,50,75,100]`.
- Playwright E2E: 이번 범위 밖(뉴스레터 구독 때와 동일 원칙 — 후속 검토).

---

## 7. 완료 기준 (Definition of Done)

- [ ] `docs/PRD.md`/`docs/TODO.md` 갱신
- [ ] `pnpm lint && npx tsc --noEmit && pnpm test` 통과
- [ ] 6개 CTA 지점 교체 확인 (grep으로 `<Link href="/contact"` 잔존 여부 확인)
- [ ] 로컬에서 `NEXT_PUBLIC_GA_MEASUREMENT_ID` 설정 후 브라우저 개발자 도구 Network 탭으로 실제 이벤트 전송 확인 (수동, 배포 전 1회)
- [ ] 노션 업무 DB·작업로그 갱신
- [ ] (이번 범위 밖) 2~3주 데이터 누적 후 2단계(퍼널 시각화 UI) 설계 문서 별도 작성
