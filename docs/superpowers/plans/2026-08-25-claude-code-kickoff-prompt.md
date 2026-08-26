# Claude Code 작업지시 프롬프트 — Phase 1.5 영업 지원 트랙 1단계 (AX 체크 깔때기)

> 작성일: 2026-08-25
> 사용법: 아래 "프롬프트 본문"을 `C:\MyProjects\CoreDXI-Web`에서 실행한 Claude Code 세션에 그대로 붙여넣는다.
> 전제: 영업이사 서면 인터뷰(`docs/superpowers/plans/2026-08-22-sales-director-email-interview.md`) 답변은 아직 미수신 — 액션플랜의 대안 경로대로 **질문지 초안(v1-draft)으로 선구현**하고, 답변 수신 후 문구만 교체한다.

---

## 프롬프트 본문 (여기부터 복사)

Phase 1.5 "영업 지원 트랙" 1단계(AX 체크 인터뷰 깔때기)를 구현해줘.

### 0. 시작하기 전에 반드시 읽을 문서 (순서대로)

1. `CLAUDE.md` — 작업 규칙(금지 사항 포함). 특히 `prisma migrate dev` 절대 금지.
2. `docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md` — 이번 작업의 설계 문서. 데이터 모델·질문지·등급 규칙·라우트·보안 체크가 전부 여기 있다. **이 문서가 이 프롬프트와 충돌하면 설계 문서를 따른다.**
3. `docs/superpowers/plans/2026-08-22-sales-enablement-action-plan.md` — 실행 항목 표(0단계 0-6, 1단계 1-1~1-9가 이번 범위).
4. `docs/PRD.md` 5-1(라우트 표)·6-2(데이터 모델), `docs/TODO.md` 1-B절 — 이미 선반영된 요구사항.

### 1. 이번 세션의 범위 (액션플랜 기준 0-6 + 1-1 ~ 1-9)

1. **`prisma/migrations/20260825120000_add_ax_check_response/migration.sql`** — 설계 4번의 `AxCheckResponse` 모델·`LeadGrade`·`LeadStatus` enum을 `schema.prisma`에 추가하고 수동 SQL 작성. `prisma migrate dev`는 어떤 이유로도 실행하지 말 것(기존 `NewsletterSubscriber` 마이그레이션 SQL을 본보기로). `prisma migrate deploy`는 내가 나중에 직접 실행한다.
2. **`src/lib/ax-check/catalog.ts`** — 질문 8개·선택지·과제 카드(업무별 자동화 후보: title/why/firstStep/expectedEffect)·등급 규칙을 전부 데이터로 정의. 설계 3번 표의 문구를 그대로 v1-draft로 쓰되, 파일 상단에 "영업이사 인터뷰 답변 수신 후 문구 교체 예정(구조 변경 없이 데이터만 수정)"이라고 주석으로 명시. `catalogVersion = "v1-draft"`.
3. **`src/lib/ax-check/summarize.ts`** — 순수 함수. answers → 우선 과제 최대 3개 + grade(HOT/WARM/COLD) + score. LLM 호출 없음(1단계 결정 사항, TODO.md 3번 참조). Q5가 "흩어져 있음/잘 모름"이면 firstStep 앞에 데이터 정리 단계를 붙이는 분기 포함.
4. **`src/actions/ax-check.ts`** — `submitAxCheck`: 수동 검증(신규 의존성 금지) → `checkRateLimit("ax-check:{ip}", max 5, 1h)` → summarize → 저장(`resultToken`은 `newsletter-token.ts` 패턴의 랜덤 토큰) → 선택 동의 시 `subscribeNewsletter(email, "ax-check")` 호출 → 고객 상세본 메일 + 영업 알림 메일(`SALES_NOTIFY_EMAIL` 환경변수, 미설정 시 `contact_settings.notification_email` 폴백, 그것도 없으면 no-op). 메일 실패가 제출 성공을 막지 않는다(`contact.ts` 원칙). 관리자용 `listAxCheckResponses`/`updateAxCheckStatus`/`deleteAxCheckResponse`는 `requireAdmin` 게이트.
5. **`/ax-check` 페이지** — 모바일 우선(카톡 인앱 브라우저 기준), shadcn/ui RadioGroup·Checkbox·Input·Button만 사용, 브랜드 컬러 `#1E4E8C`·`rounded-xl`, 진행 표시, `?ref=` 쿼리를 hidden으로 보존, 필수 동의(개인정보)·선택 동의(소식 수신) 분리. 제출 성공 시 같은 화면에서 과제 3개 카드 + "상세 진단은 메일로 보내드렸습니다" + 문의 CTA.
6. **`/ax-check/result/[token]` 페이지** — 메일 링크 재열람용.
7. **`/admin/leads`** — 목록(등급 배지·상태·회사·담당자·ref·제출일, 등급→최신순 정렬), 행 클릭 상세(전체 답변·요약·메모 편집), 상태 변경(NEW/CONTACTED/MEETING/CLOSED), CSV 내보내기, 삭제(개인정보 파기용 hard delete). `/admin/settings` 허브에 메뉴 카드 추가. 기존 `/admin/newsletter`·`/admin/contact` 페이지 패턴을 따를 것.
8. **GA4** — `src/lib/ga4-events.ts`의 `AnalyticsEventMap`에 `ax_check_submit`(파라미터 `source` = ref 코드, 2026-08-16 등록된 기존 커스텀 디멘션 재사용) 추가, 결과 화면 CTA에 `cta_location: "ax_check_result"`. `src/lib/ga4/funnel-calc.ts`·`get-funnel-metrics.ts`·`Ga4FunnelPanel.tsx`에 "AX 체크 제출" 건수를 뉴스레터 구독처럼 별도 병기(퍼널 단계 재정의는 하지 말 것 — 스코프 확장 금지).
9. **문서·정책** — `/privacy`에 AX 체크 수집 항목·목적·보유기간(발송 후 1년 또는 삭제 요청 시 즉시) 조항 추가. `CONTENT_GUIDE.md`에 17번 절 신설(질문지 문구는 `catalog.ts`에서 수정, 리드 확인은 `/admin/leads`, 홍보팀·영업이사용 안내). `.env.example`에 `SALES_NOTIFY_EMAIL` 추가.
10. **테스트** — Vitest: `summarize.test.ts`(등급 3종·Q3 매핑·Q5 분기), `ax-check.test.ts`(`contact.test.ts` 모킹 패턴). Playwright: `ax-check.spec.ts` 골든패스 1개(`/ax-check?ref=e2e` 제출 → 결과 카드 노출, 관리자 확인은 `E2E_ADMIN_EMAIL` 없으면 skip).
11. **문서 갱신** — 완료 후 `docs/TODO.md` 1-B의 1단계 항목 상태, 액션플랜 2·3번 표의 해당 행(0-6, 1-1~1-9)을 갱신.

### 2. 지켜야 할 것 (CLAUDE.md 요약 + 이번 작업 특이사항)

- `prisma migrate dev` 금지. `@tiptap/*` 건드리지 말 것. 신규 npm 의존성 추가 금지(react-hook-form·zod 등 불필요 — 기존 패턴으로 충분).
- CSP nonce·Sentry 20%는 전역 설정이 적용되도록 인라인 스크립트를 추가하지 말 것. `/blog/[slug]`에서 겪은 `DYNAMIC_SERVER_USAGE` 이슈(nonce `headers()` + 정적 생성 충돌)를 기억할 것 — 신규 공개 라우트에 `generateStaticParams()`를 쓰지 말고 동적 렌더로.
- 컴포넌트에 `[홍보팀]` 한국어 주석, `any` 금지, Named Export.
- 커밋은 Conventional Commits로 작업 단위별 분리(제안: ① `feat: AxCheckResponse 스키마·마이그레이션`, ② `feat: AX 체크 카탈로그·규칙 기반 요약 엔진`, ③ `feat: AX 체크 제출 서버 액션·메일`, ④ `feat: /ax-check 공개 페이지·결과 화면`, ⑤ `feat: /admin/leads 리드 관리`, ⑥ `feat: GA4 ax_check_submit 이벤트·퍼널 병기`, ⑦ `docs: Phase 1.5 1단계 문서 갱신`).
- 마지막에 `pnpm lint && npx tsc --noEmit && pnpm test` 전부 통과 확인. E2E는 로컬 환경이 되면 실행, 안 되면 skip 사유를 보고.

### 3. 이번 범위에서 제외 (하지 말 것)

- LLM 분석(2단계), `/solutions`·`/about` 개편(2단계), 뉴스레터 실제 발송·미팅 예약(3단계), 소개서 1장 PDF(별도 작업), 질문지 문구 확정(영업이사 답변 대기), 배포·`prisma migrate deploy`(사용자가 직접).

### 4. 완료 보고 형식

작업이 끝나면: 생성·수정 파일 목록, 테스트 결과 수치, 내가 직접 해야 할 일(`prisma migrate deploy`, Vercel 환경변수 `SALES_NOTIFY_EMAIL`, 배포, 실기기 테스트)을 순서대로 정리해서 알려줘.

## (여기까지 복사)

---

## 내부 메모 (프롬프트에 포함하지 않음)

- 이 프롬프트는 액션플랜의 "답변이 8/27까지 안 오면 초안대로 1단계 진행" 대안 경로를 8/25로 앞당겨 실행하는 것 — 영업이사 회신 지연 확인(2026-08-25 사용자 결정).
- 답변 수신 후 후속 작업: `catalog.ts` 문구 교체(v1-draft → v1) + 소개서 1장 PDF 제작은 Cowork 세션에서 진행.
