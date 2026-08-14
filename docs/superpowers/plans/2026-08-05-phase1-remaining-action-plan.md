# Phase 1 잔여 3개 항목 착수 액션 플랜

> 작성일: 2026-08-05
> 작성 근거: `docs/PRD.md`, `docs/TODO.md`(2026-08-05 CSP 완료 반영본), `docs/CoreDXI-Web_2.0_AX_Growth_Engine_프로젝트기획서_2026-08-03.md`, 코드베이스 조사(`src/lib/seo.ts`, `src/lib/og-image.tsx`, `src/lib/rate-limit.ts`, `src/lib/ga4/`, `prisma/schema.prisma` 등)
> 관련 문서: [[project_web2_roadmap]]

---

## 0. 현재 상태

Phase 1의 4개 항목 중 **CSP Enforcing 전환은 완료**(2026-08-05, `docs/superpowers/specs/2026-07-19-csp-design.md` 참고)되었습니다. 남은 3개 — **뉴스레터 구독 / 소셜 메타태그 강화 / 전환 퍼널 분석 대시보드** — 는 `docs/TODO.md` "4. 향후 계획"에 아이디어(💡) 상태로만 존재하고, 아직 설계 문서가 없습니다. 이 문서는 세 항목을 어떤 순서로, 어떻게 착수할지 정리한 것입니다.

---

## 1. 착수 순서 제안

| 순서 | 항목 | 근거 |
|------|------|------|
| 1주차 | **소셜 메타태그 강화** (감사 + 보완) | 스키마 변경 없음, 리스크 낮음, 이미 기반(OG 이미지 자동생성, Twitter Card 메타)이 상당 부분 구현되어 있어 빠르게 마무리 가능 |
| 1주차 (병행) | **퍼널 대시보드 — GA4 이벤트 태깅만 먼저** | 대시보드 시각화는 몇 주치 이벤트 데이터가 쌓여야 의미가 있음. 태깅 코드만 지금 배포해두면 이후 대시보드 작업 시점에 이미 데이터가 쌓여있어 리드타임을 절약함 |
| 2~3주차 | **뉴스레터 구독** | 신규 DB 스키마 + Resend Audiences 외부 연동 + 법적 검토(개인정보처리방침 갱신)가 필요해 공수가 가장 큼. 이해관계자 결정사항(발행 주기, 폼 배치)이 선행되어야 함 |
| 3~4주차 | **퍼널 대시보드 — 시각화 UI** | 1주차부터 태깅된 이벤트가 2~3주 누적된 시점에 착수하면 바로 유의미한 그래프를 보여줄 수 있음 |

이 순서대로면 전체 4~6주 목표 안에 들어옵니다.

---

## 2. 항목별 상세 계획

### A. 소셜 메타태그 강화

**현황 조사 결과**: TODO.md에는 "미착수"로 되어 있지만, 실제로는 상당 부분 이미 구현돼 있습니다.
- `src/lib/seo.ts`의 `pageMetadata()`가 모든 페이지에 `twitter: { card: "summary_large_image", ... }`를 자동 생성 (OG 이미지를 그대로 재사용)
- `src/lib/og-image.tsx` + 각 라우트의 `opengraph-image.tsx`(루트/`blog/[slug]`/`cases/[slug]`)가 브랜드 컬러 기반 동적 OG 이미지를 이미 생성 중

즉 이번 작업의 실제 성격은 "처음부터 구현"이 아니라 **"감사 후 보완"**입니다.

**확인/보완 항목**:
1. `/about`, `/solutions`, `/contact`가 `pageMetadata()`로 페이지별 title/description을 갖는지 확인 (제네릭 기본값을 쓰고 있다면 페이지별로 채우기)
2. 카카오톡 링크 미리보기·Twitter/X 카드 디버거로 실제 공유 렌더링 검증 (OG 표준은 이미 따르고 있으나 실사용 채널에서 눈으로 확인된 적은 없음 — 카카오톡이 한국 B2B 공유의 주 채널일 가능성이 높음)
3. 현재 OG 이미지는 뱃지형 템플릿 카드(제목/부제만 표시)인데, 블로그 커버 이미지·성공사례 썸네일(`coverImageUrl`, `thumbnailUrl`)을 배경으로 합성하면 클릭률 개선 여지가 있음 — `og-image.tsx` 확장 여부 결정 필요

**공수**: 낮음, 스키마 변경 없음, 1주 내 마무리 가능

---

### B. 뉴스레터 구독

**선행 결정 필요 (마케팅/경영진)**:
- Resend Audiences 요금제 확인 (구독자 수 기준 과금)
- 발행 주기: 블로그 신규 글마다 자동 발송 vs 주간 다이제스트
- 구독 폼 배치: 블로그 하단 vs 팝업 — 프로젝트의 "여백 중심 미니멀 톤앤톤"(채널톡·Loom 철학) 고려 시 팝업보다 블로그 하단 상시 배치를 우선 검토 제안

**기술 설계 초안**:
- `prisma/schema.prisma`에 `Subscriber` 모델 신규 추가(email unique, subscribedAt, unsubscribeToken, status). **`prisma migrate dev` 금지** — `contacts`/`contact_settings`와 충돌해 스키마 리셋 위험(TODO.md "알려진 이슈" 참고). 반드시 수동 `migration.sql` 작성 + `prisma migrate deploy`
- `src/actions/newsletter.ts` Server Action 신설, rate limiting은 기존 `src/lib/rate-limit.ts` 재사용(문의 폼과 동일 패턴: IP당 1시간 5회 등)
- Resend Audiences API로 구독자 등록, 이중 옵트인(더블 옵트인) 적용 여부 결정 필요 — 법적 리스크 완화 차원에서 권장
- 구독 해지: `unsubscribeToken` 기반 `/api/newsletter/unsubscribe` 라우트
- UI: 블로그 목록/상세 하단 구독 폼 컴포넌트, shadcn/ui `Input`+`Button`, 브랜드 컬러(`#1E4E8C`)·코너 반경 `0.75rem` 이상 준수
- `/privacy`(개인정보처리방침)에 이메일 수집·활용 목적 조항 추가 필요
- 관리자 패널 노출 범위는 최소화 제안 — 대시보드 스탯카드에 "구독자 수" 1개 추가하는 정도로 시작하고, 별도 관리 화면은 필요성이 확인되면 Phase 2에서 검토

**공수**: 중간, 신규 스키마 + 외부 연동 + 법적 검토로 1.5~2주 예상

---

### C. 전환 퍼널 분석 대시보드

**현황**: GA4 Data API 연동은 이미 존재합니다(`src/lib/ga4/`, 관리자 대시보드의 `Ga4AnalyticsPanel`/`Ga4StatsGrid`/`Ga4TopPagesTable`이 방문자 통계를 표시 중). 이번 작업은 신규 GA4 연동이 아니라 **(1) 커스텀 이벤트 태깅 확장 + (2) 퍼널 시각화 UI 추가**입니다.

**1단계 — GA4 이벤트 태깅 (지금 바로 착수 가능)**:
- 이벤트 정의: `cta_click`(각 페이지 "상담 신청" 등 CTA 버튼), `contact_submit`(문의 폼 제출), `scroll_depth`(25/50/75/100%) 등
- 이벤트 네이밍 규칙 확정 필요(담당자 지정 권장)
- `layout.tsx`의 GA4 `<Script>` 로드 코드 옆에 클라이언트 이벤트 전송 로직 추가 — CSP `script-src`/nonce 정책과 충돌 없는지 확인(`csp.ts` 참고)

**2단계 — 대시보드 시각화 (이벤트 데이터 2~3주 누적 후 착수)**:
- `src/lib/ga4/get-dashboard-metrics.ts`를 확장해 이벤트별 집계 조회 추가
- 퍼널 단계 정의(예: 방문 → 스크롤 50% → CTA 클릭 → 문의 제출) 및 단계별 전환율 계산
- 관리자 대시보드에 퍼널 차트 컴포넌트 추가 — 기존 `Ga4StatsGrid`/`Ga4TopPagesTable` 패턴 재사용

**공수**: 이벤트 태깅은 낮음(수일), 시각화는 중간(1주) — 단 데이터 누적 대기 시간 때문에 전체 리드타임은 3주 이상

---

## 3. 공통 실행 프로세스 (프로젝트 기존 관행 준수)

각 항목 착수 시 아래 순서를 따릅니다.

1. `docs/PRD.md`(요구사항)·`docs/TODO.md`(구현 현황)에 계획 반영 — 상태 💡 → 🚧로 갱신
2. `docs/superpowers/specs/`에 설계 문서 작성 (CSP/로그인 rate limiting 설계문서 패턴 참고)
3. 필요 시 `docs/superpowers/plans/`에 구현 계획 문서 추가
4. 구현 — Conventional Commits(`feat:`/`fix:`/`refactor:`/`chore:`/`docs:`), `RateLimitHit`/`src/lib/url-safety.ts` 패턴 재사용, shadcn/ui 우선, WCAG AA 검증, Sentry 20% 샘플링·CSP nonce 정책 예외 없이 적용
5. Vitest 유닛 테스트 + Playwright E2E 골든패스 추가
6. 홍보팀이 다루는 기능(뉴스레터 등)은 `CONTENT_GUIDE.md` 동시 갱신
7. 노션 업무 DB 상태 갱신 + 작업로그 기록

---

## 4. 즉시 결정이 필요한 질문

- 뉴스레터 발행 주기 및 구독 폼 배치 위치 (마케팅 리드)
- Resend Audiences 요금제 확인 (경영진/개발팀)
- GA4 이벤트 네이밍 규칙 확정 담당자
- 소셜 메타 이미지에 실제 썸네일을 합성할지 여부 (지금은 뱃지형 템플릿) — 감사 후 결정

---

## 5. 다음 액션 (오늘 기준)

- [ ] 이 액션플랜을 `docs/PRD.md`/`docs/TODO.md`에 참조 반영
- [ ] 소셜 메타태그 감사 착수 (가장 빠르게 시작 가능한 항목)
- [ ] GA4 이벤트 네이밍 규칙 담당자 지정 요청
- [ ] 뉴스레터 관련 열린 질문(4번) 마케팅 리드에게 확인 요청
