# 전환 퍼널 분석 대시보드 2단계(시각화 UI) 설계

> 작성일: 2026-08-14
> 상태: 설계 확정, 구현 대기
> 선행 문서: `docs/superpowers/specs/2026-08-08-ga4-event-tracking-design.md`(1단계 — 이벤트 태깅, 완료), `docs/superpowers/plans/2026-08-05-phase1-remaining-action-plan.md`(C절)
> 관련 실행 문서: `docs/superpowers/plans/2026-08-14-phase1-item4-5-action-plan.md`

---

## 1. 목표·범위

Phase 1 마지막 잔여 항목인 "전환 퍼널 분석 대시보드"의 2단계(시각화 UI)를 설계한다. 1단계에서 이미 `cta_click`/`contact_submit`/`newsletter_subscribe`/`scroll_depth` 4종 GA4 커스텀 이벤트가 2026-08-08부터 수집 중이다. 이번 범위는 이 이벤트를 관리자 대시보드(`/admin/dashboard`)에서 단계별 카드/막대 그래프로 보여주는 것이다.

**범위 밖(다음 단계 이후로 명시적으로 미룸)**:
- 소스별(리퍼럴·채널별) 전환율 — PRD 2번에 언급된 목표지만, `sessionSource` 교차 분석은 쿼리·UI 복잡도가 커서 이번 2단계에는 포함하지 않는다.
- GA4 정식 Funnel Exploration(`runFunnelReport`) 기반 순차 사용자 퍼널 — 아래 3번 결정사항 참고.

---

## 2. 현황

- `src/lib/ga4/get-dashboard-metrics.ts`가 이미 `BetaAnalyticsDataClient`로 방문자 요약(7일)·인기 페이지 TOP5를 조회해 `Ga4AnalyticsPanel`(`Ga4StatsGrid`+`Ga4TopPagesTable`)에 표시 중.
- `src/lib/ga4-events.ts`가 4종 이벤트를 `window.gtag`로 전송하는 클라이언트 유틸(그레이스풀 디그레이드 — `gtag` 없으면 조용히 무시).
- `TrackedCtaLink.tsx`가 `cta_click`을 6개 지점(`hero_primary`/`solutions_hero`/`solutions_mid`/`solutions_bottom`/`about_cta`/`footer`)에서 전송 중. **블로그 글 상세(`/blog/[slug]`)에는 아직 CTA 트래킹 지점이 없음** — 이번 문서의 5번에서 신규 지점으로 추가한다(콘텐츠 재건 액션플랜과 연동).
- GA4 이벤트 파라미터(`percent`, `cta_location`, `source`)는 GA4 속성에 **커스텀 디멘션으로 등록되지 않으면 Data API로 파라미터 단위 조회가 불가능**하다 — 등록 여부 미확인 상태(아래 3번 참고).

---

## 3. 결정 사항

| 질문 | 결정 | 근거 |
|------|------|------|
| 퍼널 계산 방식 | **이벤트 카운트 기반 근사 퍼널** (사용자 단위 순차 퍼널 아님) | GA4 정식 Funnel Exploration(`runFunnelReport`)은 별도 베타 API 경로·쿼터 정책이 있어 현재 `@google-analytics/data` 클라이언트 사용 범위를 벗어남. 이벤트count/세션수 근사치로 MVP를 먼저 출시하고, 필요성이 확인되면 후속 단계에서 정식 퍼널 API로 고도화 — UI에 "근사치" 문구 명시로 오해 방지 |
| 조회 기간 | **최근 30일** | 기존 방문자 요약은 7일 기준이지만, 이벤트 수집이 2026-08-08부터 시작되어 7일로는 표본이 작음. 별도 함수로 분리해 30일 고정(기간 선택 UI는 이번 범위 밖) |
| 스크롤 깊이(`percent`) 세분화 | **MVP는 `scroll_depth` 이벤트 총합만 사용**, 25/50/75/100% 구간별 세분화는 커스텀 디멘션 등록 확인 후 후속 | GA4 관리 콘솔에 `percent` 커스텀 디멘션이 등록되어 있는지 이 세션에서 확인 불가 — 개발팀 액션 아이템(6번 참고) |
| 소스별 전환율 | **이번 범위 제외** | 1번 참고. 필요성이 명확해지면 별도 설계 문서로 분리 |
| 블로그 CTA 신규 지점 | `cta_location: "blog_post_bottom"` 추가 | 콘텐츠 재건 작업(항목5)이 블로그 글 하단에 `/contact` CTA를 추가하기로 이미 결정(`docs/superpowers/specs/2026-08-14-content-brand-strategy-design.md` 5번) — 퍼널 대시보드가 이 신호도 함께 집계하도록 사전 반영 |

---

## 4. 아키텍처

### 4-1. `src/lib/ga4/get-funnel-metrics.ts` (신규)

`get-dashboard-metrics.ts`와 동일한 `BetaAnalyticsDataClient` 인스턴스·에러 처리 패턴(`isGa4Configured()`, `ok`/`reason` 유니언)을 재사용한다. 기존 함수는 건드리지 않고 새 함수를 추가한다(회귀 리스크 최소화).

```typescript
// dimension: eventName, metric: eventCount — 최근 30일, 4종 이벤트만 필터
// 별도 쿼리로 sessions(최근 30일) 총계도 함께 조회 — 퍼널 1단계(분모) 기준
export async function getGa4FunnelMetrics(): Promise<Ga4FunnelFetchResult> { ... }
```

- 이벤트 필터: `dimensionFilter`로 `eventName IN ["scroll_depth","cta_click","contact_submit","newsletter_subscribe"]`
- 세션 총계: 별도 `runReport({ metrics: [{name: "sessions"}], dateRanges: [{startDate: "30daysAgo", endDate: "today"}] })`
- 두 호출은 `Promise.all`로 병렬 처리(기존 `get-dashboard-metrics.ts` 관행과 동일)

### 4-2. `src/lib/ga4/types.ts`에 타입 추가

```typescript
export type Ga4FunnelStage = {
  key: "sessions" | "scroll_depth" | "cta_click" | "contact_submit";
  label: string;
  count: number;
  conversionRate: number; // count / sessions * 100, 소수 1자리
};

export type Ga4FunnelMetrics = {
  stages: Ga4FunnelStage[];
  newsletterSubscribeCount: number; // 퍼널과 별개 지표(카드 1개로 병기)
  periodDays: 30;
  fetchedAt: string;
};

export type Ga4FunnelFetchResult =
  | { ok: true; data: Ga4FunnelMetrics }
  | { ok: false; reason: "not_configured" | "api_error"; message: string };
```

### 4-3. `src/lib/ga4/funnel-calc.ts` (신규, 순수 함수 — 단위 테스트 대상)

```typescript
// eventName → eventCount 맵과 sessions 총계를 받아 Ga4FunnelStage[]를 계산
// sessions가 0이면 conversionRate는 0으로 반환(0으로 나누기 방지)
export function buildFunnelStages(
  sessions: number,
  eventCounts: Record<string, number>
): Ga4FunnelStage[] { ... }
```

`get-dashboard-metrics.ts`의 `parseMetricValue`처럼 GA4 API 응답 파싱과 계산 로직을 분리해, DOM/네트워크 의존 없이 테스트 가능하게 한다.

### 4-4. `src/components/admin/dashboard/Ga4FunnelPanel.tsx` (신규)

`Ga4AnalyticsPanel.tsx`와 같은 서버 컴포넌트 패턴. `Ga4AnalyticsPanel` 내부, `Ga4TopPagesTable` 아래에 이어서 렌더링한다(같은 섹션 안, 새 상위 섹션을 만들지 않음 — 대시보드 페이지 구조 변경 최소화).

- 막대 그래프 대신(신규 차트 라이브러리 의존성 추가를 피하기 위해) 기존 `DashboardStatCard` 패턴을 재사용한 **가로 바 형태의 커스텀 CSS 퍼널 컴포넌트**로 구현 — `rounded-xl`, 브랜드 컬러(`#1E4E8C`) 농도로 단계 표현
- 각 단계: 라벨, 카운트, "전체 방문 대비 N%"
- 하단에 "※ 방문 대비 이벤트 발생 비율 기반 근사치이며, 개별 사용자의 단계별 이동을 추적한 것은 아닙니다" 안내 문구 고정 표시(3번 결정사항 반영)
- 뉴스레터 구독 카운트는 퍼널 바 밖에 별도 미니 카드로 병기("퍼널 단계 아님" 명시)
- GA4 미설정 시 `Ga4AnalyticsPanel`의 기존 안내 배너를 그대로 재사용(별도 에러 UI 신설 안 함 — 이미 `Ga4AnalyticsPanel`이 통합 관리)

### 4-5. 블로그 상세 페이지 CTA 추가

`src/app/blog/[slug]/page.tsx`의 `<BlogPostContentServer>` 아래에 `TrackedCtaLink`(location=`"blog_post_bottom"`)로 `/contact` 링크를 추가한 `BlogPostCta.tsx` 컴포넌트를 신설한다. 뉴스레터 구독은 이미 전 페이지 Footer에 있으므로 별도 폼을 중복 배치하지 않고, "더 많은 AI/AX 인사이트는 아래 뉴스레터로" 문구 + 앵커 링크(`#newsletter` 등)만 추가하는 정도로 최소화한다.

---

## 5. 에러 처리·보안

- 기존 `Ga4AnalyticsPanel`의 `not_configured`/`api_error` 분기를 그대로 재사용 — 신규 에러 UI 없음
- 이벤트 파라미터를 조회에 사용하지 않는 MVP 범위에서는 커스텀 디멘션 미등록 상태여도 `eventName`/`eventCount`만으로 정상 동작
- 개인정보: 집계 수치만 표시, 사용자 식별 정보 없음 — 기존 원칙과 동일
- CSP·Sentry 샘플링: 신규 API 라우트 없음(서버 컴포넌트가 직접 GA4 Data API 호출), 기존 정책과 충돌 없음

---

## 6. 사전 확인 필요(개발팀 액션 아이템)

- [ ] GA4 관리 콘솔 → 관리 → 맞춤 정의에서 `percent`/`cta_location`/`source` 커스텀 디멘션 등록 여부 확인. 미등록이면 이번 2단계는 이벤트 총합만 사용(3번 결정사항대로 진행), 등록되어 있다면 스크롤 50%+ 세분화를 이번 범위에 추가할지 재검토
- [ ] 최근 30일 동안 4종 이벤트가 실제로 GA4에 유의미한 볼륨으로 쌓였는지 GA4 실시간/표준 보고서에서 육안 확인(2026-08-08 배포 이후 처음 하는 실측 확인 — 1단계 DoD에서 미실시로 남아있던 항목)

---

## 7. 테스트

- `src/lib/ga4/funnel-calc.test.ts`: `buildFunnelStages()` 케이스 — 정상 계산, `sessions=0`일 때 0으로 나누기 방지, 이벤트 카운트 누락(0건) 처리
- Playwright E2E: 이번 범위 밖(기존 GA4 패널과 동일 원칙 — 실 데이터 의존적이라 골든패스에 포함하지 않음)

---

## 8. 완료 기준(Definition of Done)

- [ ] `docs/PRD.md`/`docs/TODO.md` 갱신
- [ ] `pnpm lint && npx tsc --noEmit && pnpm test` 통과
- [ ] 로컬에서 실제 GA4 프로퍼티로 대시보드 렌더링 확인(미설정 상태 안내 배너도 별도 확인)
- [ ] 블로그 상세 CTA(`blog_post_bottom`) 클릭 시 GA4 실시간 이벤트 수신 확인
- [ ] 노션 업무 DB·작업로그 갱신
