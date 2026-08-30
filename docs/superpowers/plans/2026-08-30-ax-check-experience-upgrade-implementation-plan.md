# AX 체크 경험 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/ax-check` 깔때기에 ① 컨설팅 소개 인트로 화면, ② 규칙 기반 결과 피드백 구체화, ③ "초안 생성 + 영업이사 수동 발송" 이메일 워크플로우를 추가해, 첫 링크 발송(1-11) 전 "메일 보내드렸습니다"가 거짓 안내가 되는 문제를 없애고 전환 경험을 개선한다.

**Architecture:** 기존 `catalog.ts`(데이터) → `summarize.ts`(순수 함수) → `ax-check.ts`(서버 액션) → UI(`AxCheckForm`/`AxCheckPriorityCards`/`/admin/leads`) 파이프라인을 그대로 유지한 채, (a) `AxCheckPriority` 타입에 `echo`/`industryExample`/`roadmap` 필드를 추가해 카탈로그 콘텐츠만으로 개인화를 강화하고, (b) 신규 순수 함수 모듈 `email-draft.ts`가 저장된 응답으로부터 조회 시점에 이메일 초안을 생성하며(DB 미저장), (c) 신규 프레젠테이션 컴포넌트 `AxCheckIntro.tsx`가 같은 페이지 상단에 삽입된다. DB 스키마 변경 없음.

**Tech Stack:** Next.js 15 App Router, TypeScript(strict), Prisma(JSON 컬럼 `summary` 그대로 사용 — 마이그레이션 없음), Vitest, Playwright, shadcn/ui, Tailwind v4.

**Spec:** `docs/superpowers/plans/2026-08-30-ax-check-experience-upgrade-action-plan.md`(요구사항 원본), `docs/superpowers/plans/2026-08-30-ax-check-experience-upgrade-claude-code-prompt.md`(실행 지시), Task 0에서 작성하는 `docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md`(이 계획이 근거로 삼는 설계 문서)

## Global Constraints

- `prisma migrate dev` 절대 금지. 이번 작업은 DB 마이그레이션이 아예 없다(모든 변경은 JSON 컬럼이 이미 수용하는 범위).
- 브랜드 컬러 `#1E4E8C`(`--primary` 토큰), 코너 반경 `0.75rem`(`rounded-xl`) 이상, 여백 중심, shadcn/ui 컴포넌트 우선, WCAG AA 대비 — 새 UI는 기존 토큰만 사용(`bg-primary`/`text-foreground`/`bg-card`/`border-border` 등), 임의 색상 추가 금지.
- 신규 문구는 전부 `src/lib/ax-check/catalog.ts` 데이터 상수로 존재해야 한다 — 컴포넌트/로직 파일에 한글 문구 하드코딩 금지(단, JSX 라벨처럼 구조적으로 고정된 텍스트는 예외 — catalog.ts 값과 조합되는 진짜 "콘텐츠"만 대상).
- 확정 수치·보장 표현 금지 — 기대 효과는 범위 + "일반적 도입 사례 기준" 문구를 동반한다.
- 컴포넌트 파일에는 비개발자(홍보팀)가 이해할 수 있는 한국어 주석(`[홍보팀]` 태그) 유지, `any` 타입 금지, Named Export 유지.
- 커밋은 Conventional Commits, 작업 단위(C 관련 → A 관련 → B 관련) 분리. 각 작업 커밋 전 `npm run lint && npx tsc --noEmit && npm run test` 통과.
- 브랜치: `feat/ax-check-experience-upgrade`를 **main에서** 새로 판다(다른 미병합 브랜치 위에 잇지 않는다 — 8/26 브랜치 오염 재발 방지).

---

### Task 0: 문서 우선 — 설계 문서 · PRD/TODO 반영 · 브랜치 생성

**Files:**
- Create: `docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md`
- Modify: `docs/PRD.md:70` (AX 체크 라우트 설명), `docs/PRD.md`의 "결정 사항" 절(신규 항목 추가)
- Modify: `docs/TODO.md:112` (1-B 절 "1단계 영업 가동" 항목 하위에 이번 개선 작업 상태 추가)

**Interfaces:**
- Produces: 없음(문서 전용 작업). 이후 모든 Task의 커밋 메시지·PR 본문이 이 spec 문서를 참조한다.

- [ ] **Step 1: 브랜치 생성**

```bash
git checkout main
git pull origin main
git checkout -b feat/ax-check-experience-upgrade
```

- [ ] **Step 2: 설계 문서 작성**

`docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md` 신규 생성:

```markdown
# AX 체크 경험 개선 설계 — 인트로 화면 · 피드백 구체화 · 이메일 초안 워크플로우

> 작성일: 2026-08-30
> 선행 문서: `docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md`(원 설계),
> `docs/superpowers/plans/2026-08-30-ax-check-experience-upgrade-action-plan.md`(요구사항)
> 관련 규칙: 프로젝트 지침 5-1(문서 우선), 5-2(`prisma migrate dev` 금지),
> 5-3(브랜드 컬러·코너 반경·shadcn/ui), 5-4(rate limiting·CSP nonce·Sentry 예외 없음)

## 1. 배경

영업채널 고도화의 목적은 AX 전환 컨설팅을 소개하고 고객사가 AI·AX에 대한 거부감을 덜
느끼게 하는 것이다. 현재 `/ax-check`는 소개 없이 설문이 바로 시작되고, 결과 카드가
형식적이며, 원 설계의 "상세본 자동 메일 발송"은 **첫 링크를 발송하면 곧바로 거짓 안내가
되는 리스크**를 안고 있다(영업이사가 결과를 검토·수정할 기회 없이 자동 발송됨).

## 2. 변경 사항 요약

| # | 항목 | 기존 | 변경 |
|---|------|------|------|
| C | 이메일 워크플로우 | 제출 즉시 고객에게 상세본 자동 발송 | 자동 발송 **제거**. 조회 시점에 초안을 생성해 영업이사 알림 메일에 동봉 + `/admin/leads`에서 복사해 수동 발송 |
| A | 인트로 화면 | 없음(설문 즉시 시작) | 같은 페이지 상단에 컨설팅 소개 + 거부감 완화 섹션, 앵커 스크롤로 설문 진입 |
| B | 결과 피드백 | Q3+Q5+Q6만 반영, 카드당 4문장 | Q1(업종)·Q2(규모)·Q4(성숙도) 추가 반영, 답변 인용(echo)·업종 예시·3단계 로드맵으로 확장 |

## 3. 아키텍처

파이프라인은 그대로: `catalog.ts`(데이터) → `summarize.ts`(순수 함수, LLM 없음) →
`ax-check.ts`(서버 액션) → UI. 신규 모듈 `email-draft.ts`는 `summarize.ts`의 출력
(`AxCheckSummary`)을 받아 이메일 초안을 만드는 순수 함수이며, **DB에 저장하지 않고
조회 시점에 매번 생성**한다 — 카탈로그를 개선하면 이미 접수된 미발송 리드의 초안도
자동으로 좋아진다는 트레이드오프를 의도적으로 택함(발송 이력은 영업이사 메일함으로
갈음, `catalogVersion`은 응답에 이미 저장되어 있어 추적 가능).

## 4. 데이터 모델 변경 (스키마 변경 없음)

`AxCheckResponse.summary`(JSON 컬럼)에 저장되는 `priorities` 배열의 원소 타입이
바뀐다:

```
// 기존
{ title, why, firstStep, expectedEffect }
// 신규
{ title, why, echo, industryExample: string | null, roadmap: [string, string, string], expectedEffect }
```

마이그레이션 불필요(JSON 컬럼, 런타임 검증 없음). 이미 접수된 리드가 없는 상태에서
착수하므로 구버전 호환 처리는 이번 스코프에서 생략한다(첫 링크 미발송 확인 완료).

## 5. 이메일 초안 워크플로우

- `buildCustomerEmailDraft(answers, summary, contact) → { subject, body }` 순수 함수.
- 영업이사 알림 메일(자동 발송 유지)의 본문 하단에 초안 전문을 동봉.
- `/admin/leads` 리드 상세에 "이메일 초안" 패널: 미리보기 + 복사 버튼(주 경로) +
  `mailto:` 링크(보조 경로).
- 결과 화면 문구: "상세 진단서는 담당 이사가 직접 검토해 1영업일 내 메일로
  보내드립니다."로 통일(인트로·결과 화면·이메일 초안 안내 문구 정합).

## 6. 인트로 화면

같은 페이지 상단 섹션(별도 게이트 아님) — 완료율 보호를 위해 클릭 한 번 늘리지 않고
앵커 스크롤(`#ax-check-form`)로 설문 진입. 카피는 `catalog.ts`의 `INTRO_COPY` 상수.

## 7. 결과 피드백 구체화 (규칙 기반 유지)

2026-08-22 결정(응답 20건 누적 전 LLM 금지)을 유지. `catalog.ts`에 다음을 추가:
- `INDUSTRY_TASK_EXAMPLES`: Q1×Q3 업종별 예시 문장
- `TASK_CARDS[*].roadmap`: 기존 `firstStep` 단일 문장을 3단계(첫 1주/첫 1개월/3개월)로 확장
- `NO_AI_EXPERIENCE`(Q4)·`SMALL_TEAM_SIZE`(Q2) 분기 상수
- `EFFECT_DISCLAIMER`: 모든 기대 효과에 공통으로 붙는 면책 문구

`summarize.ts`의 `buildPriority`가 답변 인용(echo) 문장을 생성하고 위 데이터를
조합한다. `CATALOG_VERSION`을 `v2-draft`로 올린다(구조 변경 반영, 문구는 여전히
영업이사 인터뷰 대기 중이라 draft 유지).

## 8. 보안·정책 체크 (지침 5-4)

- 신규 서버 코드 없음(email-draft.ts는 순수 함수, DB/외부 호출 없음) — rate limit
  영향 없음.
- `/admin/leads`의 복사 버튼은 클라이언트 컴포넌트의 `navigator.clipboard` 호출이며
  인라인 `<script>`나 `javascript:` URL을 쓰지 않으므로 CSP `script-src` nonce 정책과
  무관.
- `/privacy` 제2조·제3조의 AX 체크 관련 문구("진단 결과 발송 후 1년간 보관",
  "결과 안내를 위한 담당자 연락")는 "담당자 검토 후 발송" 구조와 모순되지 않음을
  확인(Task 5에서 재확인, 자동 발송을 명시하는 문구가 없어 수정 불필요).

## 9. 테스트 계획

- `email-draft.test.ts`(신규), `summarize.test.ts`(echo·업종·Q2/Q4 분기 케이스 추가),
  `ax-check.test.ts`(고객 자동 발송 제거 반영).
- Playwright: `e2e/ax-check.spec.ts` 결과 화면 문구 갱신. 인트로 삽입 후에도 폼 셀렉터는
  영향받지 않음(Playwright `getByRole`은 스크롤 위치 무관).
- 모바일 뷰포트(Galaxy S9+) Playwright 스크린샷으로 인트로 1.5화면 이내 확인(수동 검토).

## 10. 완료 기준 (Definition of Done)

- [ ] 제출 시 고객에게 자동 발송되는 메일이 없다
- [ ] 영업이사 알림 메일에 리드 요약 + 고객용 초안 전문이 담긴다
- [ ] `/admin/leads`에서 초안 복사가 가능하다
- [ ] 결과 화면·인트로 문구가 서로 모순되지 않는다
- [ ] 서로 다른 Q1·Q2·Q4 조합 3세트가 눈에 띄게 다른 카드 결과를 낸다
- [ ] `npm run lint && npx tsc --noEmit && npm run test` 통과, E2E 골든패스 통과
- [ ] `docs/PRD.md`·`docs/TODO.md`·`CONTENT_GUIDE.md` 17번 갱신

## 11. 열린 리스크

- 초안 방치 리스크: 자동 발송이 없으므로 영업이사가 안 보내면 고객은 아무것도 못 받음
  → 알림 메일에 초안을 동봉해 최소한의 안전망 확보(2단계에서 "N일 미발송" 표시 검토).
- 영업이사 서명 블록(`SALES_SIGNATURE`)은 실제 정보 입력 전까지 v1-draft 값.
```

- [ ] **Step 3: `docs/PRD.md` 갱신**

`docs/PRD.md:70`의 AX 체크 행을 찾아 교체:

```diff
- | AX 체크(인터뷰 깔때기) | `/ax-check` | **신규(Phase 1.5 1단계, 2026-09-05 목표)** 8문항 전부 선택지·3분 질문지, `?ref=` 영업이사 식별, 제출 즉시 화면에 "AX 우선 과제 3가지"(규칙 기반) + 상세본 메일, 선택 동의 시 뉴스레터 구독 연동. 설계: `docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md` |
+ | AX 체크(인터뷰 깔때기) | `/ax-check` | **신규(Phase 1.5 1단계, 2026-09-05 목표)** 8문항 전부 선택지·3분 질문지, 상단 컨설팅 소개 인트로, `?ref=` 영업이사 식별, 제출 즉시 화면에 "AX 우선 과제 3가지"(규칙 기반, 업종 예시·3단계 로드맵 포함). **상세 진단서는 영업이사가 초안을 검토·수정 후 수동 발송(자동 메일 발송 없음, 2026-08-30 결정)**, 선택 동의 시 뉴스레터 구독 연동. 설계: `docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md`, `docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md` |
```

같은 파일의 "주요 의사결정 로그" 절(164번째 줄 인근, `**영업 지원 트랙(Phase 1.5) 착수` 항목 다음)에 새 줄 추가:

```markdown
- **AX 체크 경험 개선 (2026-08-30)** — 인트로 화면·결과 피드백 구체화(Q1/Q2/Q4 추가 반영)·
  이메일 워크플로우 전환(고객 자동 발송 제거 → 초안 생성 + 영업이사 수동 발송)을
  첫 링크 발송(1-11) 전에 반영. 설계: `docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md`
```

- [ ] **Step 4: `docs/TODO.md` 갱신**

`docs/TODO.md:112`의 1단계 항목 뒤에 이어서(같은 불릿 안, 문장 추가) 다음을 덧붙인다:

```diff
- 🚧 **1단계 영업 가동 (08/27~09/05)** — 코드 구현 완료(2026-08-25): ... ⬜ 남은 것: `prisma migrate deploy`(사용자 직접 실행), Playwright E2E 골든패스, 영업이사 실기기 테스트, **첫 링크 발송**
+ 🚧 **1단계 영업 가동 (08/27~09/05)** — 코드 구현 완료(2026-08-25): ... ⬜ 남은 것: 영업이사 실기기 테스트, **첫 링크 발송**. `prisma migrate deploy`·Playwright E2E는 2026-08-26~27 완료.
+   - 🚧 **경험 개선 착수 (2026-08-30)** — 인트로 화면(A)·결과 피드백 구체화(B)·이메일 초안 워크플로우(C) 3개 보강. 설계: `docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md`, 구현 계획: `docs/superpowers/plans/2026-08-30-ax-check-experience-upgrade-implementation-plan.md`. 첫 링크 발송 전 필수(C — 고객 자동 발송 메일 문구가 실제 동작과 어긋나는 문제 해소).
```

> 참고: 위 diff의 "..." 부분은 실제 파일의 기존 문장을 그대로 유지하고, 표시된 앞뒤 텍스트만 정확히 찾아 수정한다(전체 문장을 다시 쓰지 않는다).

- [ ] **Step 5: 커밋**

```bash
git add docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md docs/PRD.md docs/TODO.md
git commit -m "docs: AX 체크 경험 개선 설계 문서·PRD/TODO 반영"
```

---

### Task 1: 영업이사 서명 블록 상수 (catalog.ts)

**Files:**
- Modify: `src/lib/ax-check/catalog.ts`

**Interfaces:**
- Produces: `export const SALES_SIGNATURE: { name: string; title: string; phone: string; email: string }`

- [ ] **Step 1: 상수 추가**

`src/lib/ax-check/catalog.ts` 맨 아래(`AUTHORITY_DECISIVE` 선언 다음)에 추가:

```ts
/**
 * 이메일 초안 서명 블록 — v1-draft 값. 영업이사 실제 이름·연락처로 교체 필요
 * (교체는 이 상수만 수정하면 됨, 코드 변경 불필요).
 */
export const SALES_SIGNATURE = {
  name: "김영업",
  title: "영업이사",
  phone: "010-0000-0000",
  email: "sales@coredxi.com",
} as const;
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 없음(신규 export 추가만이라 기존 코드에 영향 없음).

- [ ] **Step 3: 커밋**

```bash
git add src/lib/ax-check/catalog.ts
git commit -m "feat: AX 체크 이메일 서명 블록 상수 추가"
```

---

### Task 2: 이메일 초안 빌더 (email-draft.ts)

**Files:**
- Create: `src/lib/ax-check/email-draft.ts`
- Test: `src/lib/ax-check/email-draft.test.ts`

**Interfaces:**
- Consumes: `AxCheckAnswers`, `AxCheckSummary`(둘 다 `./summarize`), `getOptionLabel`·`getQuestionById`·`SALES_SIGNATURE`(`./catalog`, Task 1 산출)
- Produces:
  - `export type AxCheckEmailDraft = { subject: string; body: string }`
  - `export function buildCustomerEmailDraft(answers: AxCheckAnswers, summary: AxCheckSummary, contact: { company: string; name: string }): AxCheckEmailDraft`

> 이 시점의 `AxCheckPriority`는 아직 Task 10 이전이라 `{ title, why, firstStep, expectedEffect }` 형태다. Task 11에서 `roadmap`으로 교체될 때 이 파일의 `formatPriorityBlock` 함수 **하나만** 다시 손댄다(아래 Task 11 참고) — 지금은 현재 형태로 정확히 동작하는 버전을 만든다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/ax-check/email-draft.test.ts` 신규 생성:

```ts
import { describe, expect, it } from "vitest";
import { buildCustomerEmailDraft } from "./email-draft";
import { SALES_SIGNATURE } from "./catalog";
import type { AxCheckAnswers, AxCheckSummary } from "./summarize";

function baseAnswers(overrides: Partial<AxCheckAnswers> = {}): AxCheckAnswers {
  return {
    q1: "network",
    q2: "10_to_30",
    q3: ["quote"],
    q4: "personal",
    q5: "files",
    q6: "speed",
    q7: "within_3_months",
    q8: "self_decide",
    ...overrides,
  };
}

function baseSummary(overrides: Partial<AxCheckSummary> = {}): AxCheckSummary {
  return {
    priorities: [
      {
        title: "제안서·견적서 자동 초안 생성",
        why: "과거 제안서·견적 데이터를 기반으로 반복 작성 시간을 줄일 수 있습니다.",
        firstStep: "최근 1년 제안서·견적서 20건 정리",
        expectedEffect: "작성 시간 50%↓",
      },
    ],
    grade: "HOT",
    score: 320,
    catalogVersion: "v1-draft",
    ...overrides,
  };
}

describe("buildCustomerEmailDraft", () => {
  it("제목에 회사명을 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.subject).toBe("[CoreDXI] 테스트회사 AX 체크 결과 — 귀사의 우선 과제 3가지");
  });

  it("본문에 회사명·성함 인사말이 들어간다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toContain("테스트회사 홍길동님, 안녕하세요.");
  });

  it("우선 과제 제목·첫 단계·기대 효과가 본문에 포함된다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toContain("제안서·견적서 자동 초안 생성");
    expect(draft.body).toContain("최근 1년 제안서·견적서 20건 정리");
    expect(draft.body).toContain("작성 시간 50%↓");
  });

  it("CoreDXI 진행 방식 문단을 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toContain("진단(2주) → 설계 → 구축 → 교육");
  });

  it("수동 편집 슬롯([[ ]])을 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toMatch(/\[\[.*\]\]/);
  });

  it("영업이사 서명 블록(catalog.ts SALES_SIGNATURE)을 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toContain(SALES_SIGNATURE.name);
    expect(draft.body).toContain(SALES_SIGNATURE.phone);
  });

  it("업종(Q1) 라벨을 본문에 반영한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers({ q1: "av" }),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toContain("영상·음향(AV) 시스템 구축");
  });

  it("우선 과제 여러 개를 순서대로 번호 매겨 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary({
        priorities: [
          {
            title: "제안서·견적서 자동 초안 생성",
            why: "why1",
            firstStep: "step1",
            expectedEffect: "effect1",
          },
          {
            title: "입찰 공고 탐색·서류 자동화",
            why: "why2",
            firstStep: "step2",
            expectedEffect: "effect2",
          },
        ],
      }),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body.indexOf("1. 제안서·견적서 자동 초안 생성")).toBeLessThan(
      draft.body.indexOf("2. 입찰 공고 탐색·서류 자동화")
    );
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
npx vitest run src/lib/ax-check/email-draft.test.ts
```

Expected: FAIL — `Cannot find module './email-draft'`

- [ ] **Step 3: 최소 구현 작성**

`src/lib/ax-check/email-draft.ts` 신규 생성:

```ts
/**
 * email-draft.ts — AX 체크 고객용 이메일 초안 생성 (순수 함수, DB 저장 없음)
 *
 * 저장된 응답(answers·summary)으로부터 매 조회 시점에 이메일 초안을 만든다.
 * 카탈로그(catalog.ts)를 개선하면 아직 발송 전인 리드의 초안도 자동으로 좋아진다.
 * 영업이사가 이 초안을 복사해 검토·수정 후 직접 발송한다(자동 발송 없음).
 *
 * 설계: docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md 5번
 */

import { getOptionLabel, getQuestionById, SALES_SIGNATURE } from "./catalog";
import type { AxCheckAnswers, AxCheckPriority, AxCheckSummary } from "./summarize";

export type AxCheckEmailDraft = {
  subject: string;
  body: string;
};

function formatPriorityBlock(priority: AxCheckPriority, index: number): string[] {
  return [
    `${index + 1}. ${priority.title}`,
    `   - ${priority.why}`,
    `   - 첫 단계: ${priority.firstStep}`,
    `   - 기대 효과: ${priority.expectedEffect}`,
    "",
  ];
}

export function buildCustomerEmailDraft(
  answers: AxCheckAnswers,
  summary: AxCheckSummary,
  contact: { company: string; name: string }
): AxCheckEmailDraft {
  const { company, name } = contact;
  const industryLabel = getOptionLabel(getQuestionById("q1"), answers.q1);

  const priorityLines = summary.priorities.flatMap((p, i) => formatPriorityBlock(p, i));

  const body = [
    `${company} ${name}님, 안녕하세요.`,
    "",
    `AX 체크 진단에 참여해 주셔서 감사합니다. ${industryLabel} 기준으로 정리한 귀사의 AX 우선 과제입니다.`,
    "",
    ...priorityLines,
    "CoreDXI는 진단(2주) → 설계 → 구축 → 교육 순서로 프로젝트를 진행합니다. 반복 업무를 실제로 줄이는 것까지 함께 챙깁니다.",
    "",
    "[[통화에서 말씀 주신 ___ 관련해서는 별도로 안내드리겠습니다.]]",
    "",
    "편하신 시간에 30분 정도 통화하며 자세히 설명드리고 싶습니다. 이 메일에 회신해 주시면 일정을 조율하겠습니다.",
    "",
    SALES_SIGNATURE.name,
    `${SALES_SIGNATURE.title} | CoreDXI`,
    `${SALES_SIGNATURE.phone} | ${SALES_SIGNATURE.email}`,
  ].join("\n");

  return {
    subject: `[CoreDXI] ${company} AX 체크 결과 — 귀사의 우선 과제 3가지`,
    body,
  };
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
npx vitest run src/lib/ax-check/email-draft.test.ts
```

Expected: PASS (8개 테스트)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/ax-check/email-draft.ts src/lib/ax-check/email-draft.test.ts
git commit -m "feat: AX 체크 고객용 이메일 초안 빌더 추가"
```

---

### Task 3: 서버 액션 — 고객 자동 발송 제거, 초안 동봉

**Files:**
- Modify: `src/actions/ax-check.ts:1-229` (import 절, `buildDetailMailText` 삭제, `submitAxCheck` 하단 로직)
- Modify: `src/actions/ax-check.test.ts:172-237` ("happy path" describe 블록)

**Interfaces:**
- Consumes: `buildCustomerEmailDraft`(Task 2 산출), `AxCheckEmailDraft`
- Produces: `submitAxCheck`의 외부 시그니처는 불변(`AxCheckFormInput → Promise<AxCheckSubmitResult>`) — 내부 동작만 변경.

- [ ] **Step 1: import 교체**

`src/actions/ax-check.ts` 상단 import 절에서 아래 줄을 찾아:

```ts
import { summarizeAxCheck } from "@/lib/ax-check/summarize";
```

바로 아래에 추가:

```ts
import { buildCustomerEmailDraft } from "@/lib/ax-check/email-draft";
```

- [ ] **Step 2: `buildDetailMailText` 함수 삭제**

`src/actions/ax-check.ts:91-116`의 `buildDetailMailText` 함수 전체(선언부터 닫는 중괄호까지)를 삭제한다. 더 이상 아무 곳에서도 참조하지 않는다(다음 스텝에서 호출부도 제거).

- [ ] **Step 3: `submitAxCheck` 하단 로직 교체**

`src/actions/ax-check.ts:191-226`(고객 메일 발송부터 영업이사 알림 메일까지)을 찾아:

```ts
  const siteUrl = process.env.NEXTAUTH_URL ?? "https://www.coredxi.com";
  const resultUrl = `${siteUrl}/ax-check/result/${resultToken}`;

  const customerMailResult = await sendResendEmail({
    to: email,
    subject: "[CoreDXI] AX 체크 결과 — 귀사의 우선 과제 3가지",
    text: buildDetailMailText({ company, name, resultUrl, priorities }),
  });
  if (!customerMailResult.success) {
    console.error("[submitAxCheck] customer email failed:", customerMailResult.error);
  }

  const salesNotifyEmail =
    process.env.SALES_NOTIFY_EMAIL?.trim() || (await getContactNotificationEmail());
  if (salesNotifyEmail) {
    const salesMailResult = await sendResendEmail({
      to: salesNotifyEmail,
      subject: `[CoreDXI] 새 AX 체크 리드 - ${grade} - ${company}`,
      text: [
        "새 AX 체크 응답이 접수되었습니다.",
        "",
        `회사: ${company}`,
        `담당자: ${name}`,
        `이메일: ${email}`,
        `연락처: ${phone || "-"}`,
        `유입 경로(ref): ${refCode ?? "-"}`,
        `등급: ${grade}`,
        "",
        "관리자 페이지(/admin/leads)에서 전체 답변을 확인해 주세요.",
      ].join("\n"),
      replyTo: email,
    });
    if (!salesMailResult.success) {
      console.error("[submitAxCheck] sales notify email failed:", salesMailResult.error);
    }
  }
```

다음으로 교체(**고객 발송 삭제, 초안을 영업이사 메일에 동봉**):

```ts
  const siteUrl = process.env.NEXTAUTH_URL ?? "https://www.coredxi.com";
  const resultUrl = `${siteUrl}/ax-check/result/${resultToken}`;

  // 고객에게는 자동 발송하지 않는다 — 영업이사가 아래 초안을 검토·수정 후 직접 보낸다
  // (2026-08-30 결정, docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md 5번).
  const emailDraft = buildCustomerEmailDraft(
    input.answers,
    { priorities, grade, score, catalogVersion },
    { company, name }
  );

  const salesNotifyEmail =
    process.env.SALES_NOTIFY_EMAIL?.trim() || (await getContactNotificationEmail());
  if (salesNotifyEmail) {
    const salesMailResult = await sendResendEmail({
      to: salesNotifyEmail,
      subject: `[CoreDXI] 새 AX 체크 리드 - ${grade} - ${company}`,
      text: [
        "새 AX 체크 응답이 접수되었습니다.",
        "",
        `회사: ${company}`,
        `담당자: ${name}`,
        `이메일: ${email}`,
        `연락처: ${phone || "-"}`,
        `유입 경로(ref): ${refCode ?? "-"}`,
        `등급: ${grade}`,
        `결과 재열람 링크: ${resultUrl}`,
        "",
        "관리자 페이지(/admin/leads)에서 전체 답변과 이메일 초안을 확인·복사할 수 있습니다.",
        "아래는 고객에게 보낼 이메일 초안입니다 — 검토·수정 후 직접 발송해 주세요.",
        "",
        "==================== 고객용 이메일 초안: 제목 ====================",
        emailDraft.subject,
        "",
        "==================== 고객용 이메일 초안: 본문 ====================",
        emailDraft.body,
      ].join("\n"),
      replyTo: email,
    });
    if (!salesMailResult.success) {
      console.error("[submitAxCheck] sales notify email failed:", salesMailResult.error);
    }
  }
```

- [ ] **Step 4: 타입 체크로 미사용 import 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음. (`sendResendEmail`은 영업이사 메일에 계속 쓰이므로 import 유지)

- [ ] **Step 5: 기존 테스트 갱신**

`src/actions/ax-check.test.ts:172-224`의 `describe("submitAxCheck happy path", ...)` 블록에서 아래 두 테스트를 찾아 교체한다.

`"saves the response, emails the customer and sales notify address"` 테스트를:

```ts
  it("saves the response and emails only the sales notify address (no customer auto-send)", async () => {
    const result = await submitAxCheck(validInput());

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.resultToken).toBe("generated-result-token");
    expect(result.priorities).toHaveLength(2);

    expect(prismaMock.axCheckResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          company: "테스트회사",
          email: "user@example.com",
          grade: expect.any(String),
          resultToken: "generated-result-token",
        }),
      })
    );

    // 고객에게는 자동 발송하지 않는다 — sendResendEmail 호출은 영업이사 알림 1건뿐.
    expect(sendResendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "contact@coredxi.com" })
    );
    expect(sendResendEmailMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" })
    );
    expect(subscribeNewsletterMock).not.toHaveBeenCalled();
  });

  it("includes the customer email draft in the sales notify email body", async () => {
    await submitAxCheck(validInput());

    const salesCall = sendResendEmailMock.mock.calls.find(
      (call) => call[0].to === "contact@coredxi.com"
    );
    expect(salesCall).toBeDefined();
    expect(salesCall![0].text).toContain("고객용 이메일 초안");
    expect(salesCall![0].text).toContain("테스트회사 홍길동님, 안녕하세요.");
  });
```

`"still succeeds when the customer email fails to send"` 테스트를(더 이상 고객 발송이 없으므로 영업이사 발송 실패 케이스로 대체):

```ts
  it("still succeeds when the sales notify email fails to send", async () => {
    sendResendEmailMock.mockResolvedValue({ success: false, error: "boom" });

    const result = await submitAxCheck(validInput());

    expect(result.success).toBe(true);
  });
```

- [ ] **Step 6: 테스트 실행 → 통과 확인**

```bash
npx vitest run src/actions/ax-check.test.ts
```

Expected: PASS (기존 25개 유지 + 신규 1개 = 26개, 단 삭제한 것 없이 교체만 했으므로 총 개수는 동일하거나 +1)

- [ ] **Step 7: 전체 검증 후 커밋**

```bash
npm run lint
npx tsc --noEmit
npm run test
git add src/actions/ax-check.ts src/actions/ax-check.test.ts
git commit -m "feat: AX 체크 고객 자동 발송 제거, 영업이사 메일에 초안 동봉"
```

---

### Task 4: `/admin/leads` 이메일 초안 패널

**Files:**
- Create: `src/app/admin/(panel)/leads/EmailDraftPanel.tsx`
- Modify: `src/app/admin/(panel)/leads/LeadDetailPanel.tsx:69-70,203-205` (패널 삽입)

**Interfaces:**
- Consumes: `buildCustomerEmailDraft`(Task 2), `AxCheckLeadRecord`(`@/lib/ax-check/types`)
- Produces: `export function EmailDraftPanel({ lead }: { lead: AxCheckLeadRecord }): JSX.Element`

- [ ] **Step 1: 컴포넌트 작성**

`src/app/admin/(panel)/leads/EmailDraftPanel.tsx` 신규 생성:

```tsx
"use client";

/**
 * EmailDraftPanel.tsx — AX 체크 리드 상세의 "이메일 초안" 패널
 *
 * [홍보팀 참고] 여기 보이는 문구 자체는 src/lib/ax-check/email-draft.ts와
 * catalog.ts(SALES_SIGNATURE 등)에서 생성됩니다. 이 파일은 화면(복사·mailto 버튼)만
 * 담당합니다. 자동 발송 기능은 없습니다 — 영업이사가 직접 복사해 보내야 합니다.
 */

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { buildCustomerEmailDraft } from "@/lib/ax-check/email-draft";
import type { AxCheckLeadRecord } from "@/lib/ax-check/types";

type Props = { lead: AxCheckLeadRecord };

export function EmailDraftPanel({ lead }: Props) {
  const [copied, setCopied] = useState(false);

  const draft = buildCustomerEmailDraft(
    lead.answers,
    {
      priorities: lead.priorities,
      grade: lead.grade,
      score: lead.score,
      catalogVersion: lead.catalogVersion,
    },
    { company: lead.company, name: lead.name }
  );

  const mailtoHref = `mailto:${lead.email}?subject=${encodeURIComponent(
    draft.subject
  )}&body=${encodeURIComponent(draft.body)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("복사에 실패했습니다. 아래 미리보기에서 직접 선택해 복사해 주세요.");
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
      <div className="border-b pb-3">
        <h2 className="text-lg font-bold text-slate-900">이메일 초안</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          자동 발송되지 않습니다. 검토·수정 후 아래 복사 버튼으로 붙여넣어 직접
          보내주세요.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "복사됨" : "초안 복사"}
        </button>
        <a
          href={mailtoHref}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Mail className="h-3.5 w-3.5" />
          메일 앱에서 열기
        </a>
        <span className="text-[11px] text-slate-400">
          메일 앱 열기는 본문이 길면 잘릴 수 있어요 — 복사가 기본입니다.
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500">제목</p>
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{draft.subject}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500">본문 미리보기</p>
        <pre className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 font-sans text-sm leading-relaxed text-slate-800">
          {draft.body}
        </pre>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `LeadDetailPanel.tsx`에 삽입**

`src/app/admin/(panel)/leads/LeadDetailPanel.tsx` 상단 import 절(`import { LeadGradeBadge } from "./LeadGradeBadge";` 다음 줄)에 추가:

```ts
import { EmailDraftPanel } from "./EmailDraftPanel";
```

`return (` 바로 다음 줄(현재 `<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">`)을 찾아, 그 안의 두 카드(`<div className="space-y-4 rounded-xl ...">` 두 개) 뒤, 최상위 `</div>` 닫기 직전에 아래 줄을 추가:

```tsx
      <EmailDraftPanel lead={lead} />
```

즉 최종 구조는:

```tsx
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
        {/* 기존 좌측 카드 그대로 */}
      </div>

      <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
        {/* 기존 우측 카드 그대로 */}
      </div>

      <EmailDraftPanel lead={lead} />
    </div>
  );
```

(`EmailDraftPanel`이 `lg:col-span-2`를 이미 갖고 있으므로 grid 하단에 전체 폭으로 붙는다.)

- [ ] **Step 3: 타입 체크·lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 에러 없음.

- [ ] **Step 4: 로컬 렌더링 확인**

```bash
npm run dev
```

브라우저(또는 `curl`)로 관리자 로그인 후 `/admin/leads`에 접속해 리드 하나를 선택 —
"이메일 초안" 패널이 하단 전체 폭으로 나타나는지, 복사 버튼 클릭 시 "복사됨"으로
바뀌는지 눈으로 확인한다. (E2E_ADMIN_EMAIL/PASSWORD 없는 환경이면 시각 확인만 하고
자동화 테스트는 생략 — 기존 코드베이스도 이 패널류 컴포넌트는 단위 테스트 대상으로
삼지 않는다.)

- [ ] **Step 5: 커밋**

```bash
git add src/app/admin/\(panel\)/leads/EmailDraftPanel.tsx src/app/admin/\(panel\)/leads/LeadDetailPanel.tsx
git commit -m "feat: /admin/leads 이메일 초안 패널(복사·mailto) 추가"
```

---

### Task 5: 결과 화면 문구 교체 + `/privacy` 점검

**Files:**
- Modify: `src/components/ax-check/AxCheckPriorityCards.tsx:1-30,68-71`

**Interfaces:**
- Consumes: 없음(신규 export 없음, 기존 props 그대로)
- Produces: 없음(문구만 변경, `LeadDetailPanel`·`AxCheckForm`·`/ax-check/result/[token]` 세 곳 모두 이 컴포넌트를 공유하므로 한 번의 수정으로 전부 반영됨)

- [ ] **Step 1: import에서 `Mail` 아이콘 제거**

`src/components/ax-check/AxCheckPriorityCards.tsx:8`을 찾아:

```ts
import { ArrowRight, Lightbulb, Mail } from "lucide-react";
```

다음으로 교체:

```ts
import { ArrowRight, Lightbulb } from "lucide-react";
```

- [ ] **Step 2: 헤더 문구 교체**

`src/components/ax-check/AxCheckPriorityCards.tsx:27-29`를 찾아:

```tsx
        <p className="mt-1 text-sm text-muted-foreground">
          상세 진단은 입력하신 메일로 보내드렸습니다.
        </p>
```

다음으로 교체:

```tsx
        <p className="mt-1 text-sm text-muted-foreground">
          상세 진단서는 담당 이사가 직접 검토해 1영업일 내 메일로 보내드립니다.
        </p>
```

- [ ] **Step 3: 하단 안내 문단 제거**

`src/components/ax-check/AxCheckPriorityCards.tsx:68-71`을 찾아:

```tsx
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="size-3.5 shrink-0" aria-hidden="true" />
          이 결과는 메일로도 보내드렸으니 언제든 다시 확인하실 수 있어요.
        </p>
```

이 블록 전체를 삭제한다(위 Step 2에서 이미 같은 메시지를 헤더에 한 번 통일했으므로
중복 문구를 남기지 않는다). 삭제 후 `<div className="mt-8 flex flex-col gap-2.5">`
안에는 `TrackedCtaLink` 하나만 남는다.

- [ ] **Step 4: `/privacy` 정합성 확인(수정 여부 결정)**

```bash
grep -n "AX 체크" src/app/privacy/page.tsx
```

`제2조`("진단 결과 안내 및 후속 컨설팅 상담을 위한 담당자 연락")와 `제3조`("진단 결과
발송 후 1년간 보관")를 읽고, "자동으로 즉시 발송됩니다" 류의 표현이 있는지 확인한다.
설계 문서 8번에서 이미 확인했듯 두 조항 모두 발송 주체(자동/수동)를 특정하지 않으므로
**수정하지 않는다**. (만약 실제로 "즉시 자동 발송"을 명시하는 문구를 발견하면, 그
문장만 "담당 이사가 검토 후 발송"으로 고치고 이 스텝 설명에 그 사실을 기록한다.)

- [ ] **Step 5: 타입 체크·lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 에러 없음(미사용 `Mail` import 제거로 lint 경고도 발생하지 않아야 함).

- [ ] **Step 6: 커밋**

```bash
git add src/components/ax-check/AxCheckPriorityCards.tsx
git commit -m "fix: AX 체크 결과 화면 문구를 담당 이사 검토 발송 방식으로 교체"
```

---

### Task 6: E2E 골든패스 문구 갱신

**Files:**
- Modify: `e2e/ax-check.spec.ts:51-54`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

- [ ] **Step 1: 문구 검증 갱신**

`e2e/ax-check.spec.ts:51-54`를 찾아:

```ts
  await expect(page.getByText("AX 우선 과제 3가지")).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText("상세 진단은 입력하신 메일로 보내드렸습니다.")
  ).toBeVisible();
```

다음으로 교체:

```ts
  await expect(page.getByText("AX 우선 과제 3가지")).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText("상세 진단서는 담당 이사가 직접 검토해 1영업일 내 메일로 보내드립니다.")
  ).toBeVisible();
```

- [ ] **Step 2: 로컬 E2E 실행**

```bash
npx playwright test e2e/ax-check.spec.ts --project=chromium
```

Expected: PASS(관리자 파트는 `E2E_ADMIN_EMAIL` 미설정 시 설계대로 skip).

- [ ] **Step 3: 커밋**

```bash
git add e2e/ax-check.spec.ts
git commit -m "test: AX 체크 E2E 골든패스를 새 결과 화면 문구에 맞춰 갱신"
```

---

### Task 7: 인트로 화면 (작업 A)

**Files:**
- Modify: `src/lib/ax-check/catalog.ts` (INTRO_COPY 상수 추가)
- Create: `src/app/ax-check/AxCheckIntro.tsx`
- Modify: `src/app/ax-check/page.tsx`
- Modify: `CONTENT_GUIDE.md:637-673` (17번 절)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `export const INTRO_COPY: { eyebrow: string; headline: string; description: string; steps: readonly string[]; reassurances: readonly string[]; previewLabel: string; previewExample: string; cta: string }` (catalog.ts)
  - `export function AxCheckIntro(): JSX.Element` (AxCheckIntro.tsx, props 없음)

- [ ] **Step 1: `INTRO_COPY` 상수 추가**

`src/lib/ax-check/catalog.ts` 맨 아래(Task 1에서 추가한 `SALES_SIGNATURE` 다음)에 추가:

```ts
/**
 * /ax-check 페이지 상단 인트로 섹션 문구 — v1-draft. 홍보팀이 이 상수만 수정하면
 * 화면에 바로 반영된다(CONTENT_GUIDE.md 17번 참고).
 */
export const INTRO_COPY = {
  eyebrow: "CoreDXI AX 전환 컨설팅",
  headline:
    "코어디엑스아이는 중소기업의 AI 도입·AX 전환을 설계부터 교육까지 함께하는 컨설팅 회사입니다.",
  description:
    "복잡한 협업은 심플하게, 반복 업무는 줄이는 일 — 진단부터 설계·구축·교육까지 4단계로 함께합니다.",
  steps: ["진단", "설계", "구축", "교육"],
  reassurances: [
    "AI를 몰라도 됩니다 — 모든 질문이 선택지로 되어 있습니다.",
    "3분, 8개 질문이면 끝납니다.",
    "제출한다고 영업 전화가 자동으로 가지 않습니다 — 결과는 화면에서 바로 확인하시고, 상세 진단서는 담당 이사가 직접 검토해 메일로 보내드립니다.",
  ],
  previewLabel: "제출 즉시 화면에서 바로 확인",
  previewExample: "예: '제안서·견적서 자동 초안 생성' — 최근 1년 제안서 20건 정리부터 시작",
  cta: "3분 진단 시작하기",
} as const;
```

- [ ] **Step 2: `AxCheckIntro.tsx` 작성**

`src/app/ax-check/AxCheckIntro.tsx` 신규 생성:

```tsx
/**
 * AxCheckIntro.tsx — /ax-check 페이지 상단 인트로 섹션
 *
 * [홍보팀] 문구 자체는 여기가 아니라 src/lib/ax-check/catalog.ts의 INTRO_COPY에서
 * 수정합니다. 별도 게이트 화면이 아니라 같은 페이지 상단에 붙는 섹션이며, 하단 CTA는
 * 클릭 한 번을 늘리지 않도록 폼 앵커(#ax-check-form)로 스크롤만 시킵니다.
 */

import { CheckCircle2 } from "lucide-react";
import { INTRO_COPY } from "@/lib/ax-check/catalog";

export function AxCheckIntro() {
  return (
    <section className="mb-10">
      <p className="text-sm font-semibold text-primary">{INTRO_COPY.eyebrow}</p>
      <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
        {INTRO_COPY.headline}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {INTRO_COPY.description}
      </p>

      <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {INTRO_COPY.steps.map((step, i) => (
          <li
            key={step}
            className="rounded-xl border border-border bg-card p-3 text-center text-xs font-medium text-foreground"
          >
            <span className="block text-[11px] text-muted-foreground">{i + 1}단계</span>
            {step}
          </li>
        ))}
      </ol>

      <ul className="mt-6 space-y-2">
        {INTRO_COPY.reassurances.map((text) => (
          <li key={text} className="flex items-start gap-2 text-sm text-foreground/90">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-xs font-semibold text-primary">{INTRO_COPY.previewLabel}</p>
        <p className="mt-1 text-sm text-foreground">{INTRO_COPY.previewExample}</p>
      </div>

      <a
        href="#ax-check-form"
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {INTRO_COPY.cta}
      </a>
    </section>
  );
}
```

- [ ] **Step 3: `page.tsx`에 삽입**

`src/app/ax-check/page.tsx` 상단 import 절(`import { AxCheckForm } from "./AxCheckForm";` 다음)에 추가:

```ts
import { AxCheckIntro } from "./AxCheckIntro";
```

같은 파일의 `metadata` 선언을 찾아:

```ts
export const metadata: Metadata = pageMetadata({
  title: "AX 체크 — 3분 AI 도입 진단",
  description:
    "8개 질문에 답하면 귀사의 AX(AI 전환) 우선 과제 3가지를 바로 확인할 수 있습니다.",
  path: "/ax-check",
});
```

다음으로 교체(인트로 톤과 일치):

```ts
export const metadata: Metadata = pageMetadata({
  title: "AX 체크 — 3분 AI 도입 진단",
  description:
    "중소기업의 AI 도입·AX 전환을 함께하는 CoreDXI가 8개 질문으로 귀사의 우선 과제 3가지를 무료로 진단해 드립니다.",
  path: "/ax-check",
});
```

`AxCheckPage` 함수 본문을 찾아:

```tsx
      <main className="min-h-screen bg-background pt-24 pb-24">
        <div className="mx-auto max-w-2xl px-6 py-8">
          <AxCheckForm refCode={refCode} />
        </div>
      </main>
```

다음으로 교체:

```tsx
      <main className="min-h-screen bg-background pt-24 pb-24">
        <div className="mx-auto max-w-2xl px-6 py-8">
          <AxCheckIntro />
          <div id="ax-check-form">
            <AxCheckForm refCode={refCode} />
          </div>
        </div>
      </main>
```

- [ ] **Step 4: `CONTENT_GUIDE.md` 17번 갱신**

`CONTENT_GUIDE.md:644`(`### 질문지·과제 카드 문구를 바꾸고 싶다면` 절) 바로 앞에 새 하위 절 삽입:

```markdown
### 인트로 화면(맨 위 소개) 문구를 바꾸고 싶다면

- `/ax-check` 페이지 맨 위에 뜨는 회사 소개·안심 문구·CTA 버튼 텍스트는 전부
  **`src/lib/ax-check/catalog.ts`의 `INTRO_COPY`** 상수 하나에 들어 있습니다. 이 값만
  고치면 화면에 바로 반영됩니다.
- "제출한다고 영업 전화가 자동으로 가지 않습니다" 문구는 실제 발송 방식(담당 이사
  검토 후 발송)과 반드시 일치해야 합니다 — 이 문구를 고칠 때는 결과 화면 문구
  (`src/components/ax-check/AxCheckPriorityCards.tsx`)도 함께 확인해 주세요.

```

(빈 줄 하나 남기고 기존 `### 질문지·과제 카드 문구를 바꾸고 싶다면` 절이 이어지도록
한다.)

- [ ] **Step 5: 타입 체크·lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 에러 없음.

- [ ] **Step 6: E2E 재실행(인트로 삽입 후 폼 셀렉터 영향 확인)**

```bash
npx playwright test e2e/ax-check.spec.ts --project=chromium
```

Expected: PASS(인트로가 위에 추가돼도 `getByRole`은 스크롤 위치와 무관하게 동작).

- [ ] **Step 7: 커밋**

```bash
git add src/lib/ax-check/catalog.ts src/app/ax-check/AxCheckIntro.tsx src/app/ax-check/page.tsx CONTENT_GUIDE.md
git commit -m "feat: /ax-check 인트로 화면 추가(컨설팅 소개 + 거부감 완화)"
```

---

### Task 8: 인트로 모바일 시각 검증

**Files:**
- 없음(검증 전용 태스크, 파일 변경 없음)

**Interfaces:**
- Consumes: Task 7 산출물
- Produces: 없음

- [ ] **Step 1: 개발 서버 기동**

```bash
npm run dev
```

- [ ] **Step 2: Playwright로 모바일 뷰포트 스크린샷**

`radio-check.mjs`와 동일한 패턴(이전 세션에서 라디오/체크박스 중앙정렬 검증에 사용한
방식)으로 임시 스크립트를 프로젝트 루트에 작성해 실행한다:

```js
// verify-intro.mjs (임시 — 확인 후 삭제)
import { chromium, devices } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["Galaxy S9+"] });
const page = await context.newPage();
await page.goto("http://localhost:3100/ax-check?ref=visual-check");
await page.screenshot({ path: "intro-mobile.png", fullPage: true });
await browser.close();
console.log("done");
```

```bash
node verify-intro.mjs
```

- [ ] **Step 3: 스크린샷 육안 확인**

`intro-mobile.png`를 열어 다음을 확인한다:
- 인트로가 화면 스크롤 1.5배 이내로 끝나는가(과도하게 길지 않은가)
- 4단계 카드(진단/설계/구축/교육)가 2×2로 깨지지 않고 정렬되는가
- CTA 버튼("3분 진단 시작하기")이 잘리지 않고 전체 폭으로 보이는가

문제가 있으면 `AxCheckIntro.tsx`의 spacing 클래스(`mb-10`, `mt-6` 등)를 조정하고
Step 2를 반복한다.

- [ ] **Step 4: CTA 클릭 시 스크롤 동작 확인**

```js
// verify-intro-scroll.mjs (임시 — 확인 후 삭제)
import { chromium, devices } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["Galaxy S9+"] });
const page = await context.newPage();
await page.goto("http://localhost:3100/ax-check?ref=e2e-scroll-check");
await page.getByRole("link", { name: "3분 진단 시작하기" }).click();
await page.waitForTimeout(500);
await expect(page.getByRole("radio").first()).toBeInViewport();
console.log("scroll ok");
await browser.close();
```

이 스크립트는 `expect`를 쓰므로 Playwright 테스트 러너로 실행하거나, 간단히
`page.evaluate(() => document.querySelector('#ax-check-form')?.getBoundingClientRect().top)`
값이 0에 가까운지 콘솔로 확인하는 방식으로 대체해도 된다. 핵심은 **클릭 후
`?ref=e2e-scroll-check` 쿼리가 유지된 채로 폼 영역이 뷰포트에 들어오는지**다.

- [ ] **Step 5: 임시 스크립트 정리**

```bash
rm -f verify-intro.mjs verify-intro-scroll.mjs intro-mobile.png
```

이 태스크는 검증 전용이라 커밋할 변경 사항이 없다(Task 7의 커밋에 이미 기능이
포함돼 있음). 문제를 발견해 `AxCheckIntro.tsx`를 수정했다면:

```bash
git add src/app/ax-check/AxCheckIntro.tsx
git commit -m "fix: 인트로 화면 모바일 레이아웃 조정"
```

---

### Task 9: 카탈로그 콘텐츠 확장 (작업 B — 데이터)

**Files:**
- Modify: `src/lib/ax-check/catalog.ts` (전체 — `CATALOG_VERSION`, `AxCheckTaskCard` 타입, `TASK_CARDS`, 신규 상수들)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `export const CATALOG_VERSION = "v2-draft"`
  - `export type AxCheckTaskCard = { title: string; why: string; roadmap: readonly [string, string, string]; expectedEffect: string }`
  - `export const INDUSTRY_TASK_EXAMPLES: Readonly<Record<string, Readonly<Record<string, string>>>>`
  - `export const NO_AI_EXPERIENCE: Set<string>`, `export const SMALL_TEAM_SIZE: Set<string>`
  - `export const DATA_PREP_STEP_LABEL: string`, `NO_AI_EXPERIENCE_STEP_LABEL: string`, `SMALL_TEAM_STEP_LABEL: string`
  - `export const EFFECT_DISCLAIMER: string`
  - `TASK_CARDS`의 각 값에서 `firstStep` 필드가 `roadmap: [string,string,string]`로 대체됨

- [ ] **Step 1: `CATALOG_VERSION` 갱신**

`src/lib/ax-check/catalog.ts:15`를 찾아:

```ts
export const CATALOG_VERSION = "v1-draft";
```

다음으로 교체:

```ts
export const CATALOG_VERSION = "v2-draft";
```

- [ ] **Step 2: `AxCheckTaskCard` 타입 교체**

`src/lib/ax-check/catalog.ts:141-146`을 찾아:

```ts
export type AxCheckTaskCard = {
  title: string;
  why: string;
  firstStep: string;
  expectedEffect: string;
};
```

다음으로 교체:

```ts
export type AxCheckTaskCard = {
  title: string;
  why: string;
  /** 미니 로드맵 원본 3단계: [첫 1주, 첫 1개월, 3개월]. Q2·Q4·Q5 분기로 접두어가 붙는다(summarize.ts). */
  roadmap: readonly [string, string, string];
  expectedEffect: string;
};
```

- [ ] **Step 3: `TASK_CARDS` 전체 교체**

`src/lib/ax-check/catalog.ts:149-193`(`TASK_CARDS` 선언 전체)을 찾아 다음으로 교체:

```ts
/** Q3 선택지 → 우선 과제 카드. summarize.ts가 이 데이터를 그대로 화면/메일에 사용한다. */
export const TASK_CARDS: Record<string, AxCheckTaskCard> = {
  quote: {
    title: "제안서·견적서 자동 초안 생성",
    why: "과거 제안서·견적 데이터를 기반으로 반복 작성 시간을 크게 줄일 수 있는 영역입니다.",
    roadmap: [
      "최근 1년 제안서·견적서 20건 정리",
      "표준 템플릿 3종 확정 후 AI 초안 도구로 파일럿 5건 작성",
      "실제 제안 건에 적용해 작성 시간 정착, 월별 절감 시간 측정",
    ],
    expectedEffect: "작성 시간 40~60%↓",
  },
  bidding: {
    title: "입찰 공고 탐색·서류 자동화",
    why: "나라장터 등 입찰 공고를 조건에 맞게 자동 필터링하고 제출 서류 초안을 준비할 수 있습니다.",
    roadmap: [
      "최근 낙찰·유찰 이력 및 참가 자격 요건 정리",
      "관심 공고 키워드·조건 설정 후 자동 필터링 파일럿 운영",
      "제출 서류 초안 자동화까지 확장, 참가율·낙찰률 추적",
    ],
    expectedEffect: "공고 탐색 시간 30~50%↓, 입찰 누락 방지",
  },
  site_report: {
    title: "현장 실사 보고 자동 정리",
    why: "현장 사진·도면 자료를 업로드하면 정형화된 보고서 초안을 자동 생성할 수 있습니다.",
    roadmap: [
      "최근 실사 보고서 양식과 사진 자료 정리",
      "표준 보고서 템플릿 확정 후 현장 2~3건 파일럿 적용",
      "전 현장 적용, 작성 시간·누락 항목 정기 점검",
    ],
    expectedEffect: "보고서 작성 시간 30~50%↓, 항목 누락 방지",
  },
  maintenance_request: {
    title: "유지보수 민원 응대 자동화",
    why: "반복되는 민원 유형을 자동으로 분류하고 처리 이력을 관리할 수 있습니다.",
    roadmap: [
      "최근 6개월 민원 이력을 유형별로 정리",
      "민원 유형 자동 분류 규칙 확정 후 파일럿 운영",
      "전체 민원 채널 적용, 응대 시간·재발률 추적",
    ],
    expectedEffect: "응대 시간 20~40%↓, 이력 누락 방지",
  },
  delivery_docs: {
    title: "납품·준공 문서 자동 생성",
    why: "표준 양식을 기반으로 납품·검수·준공 문서를 자동 생성해 오류를 줄일 수 있습니다.",
    roadmap: [
      "최근 납품·준공 문서 양식 정리",
      "표준 양식 확정 후 신규 건 2~3건 파일럿 적용",
      "전 건 적용, 서류 오류·반려율 정기 점검",
    ],
    expectedEffect: "문서 작성 시간 30~50%↓, 서류 오류 감소",
  },
  client_management: {
    title: "거래처 관리·후속 영업 자동화",
    why: "거래처 연락 이력을 자동으로 정리하고, 재계약·후속 영업 타이밍을 놓치지 않게 합니다.",
    roadmap: [
      "주요 거래처 연락 이력 정리",
      "재계약·후속 영업 타이밍 알림 규칙 설정 후 파일럿 운영",
      "전체 거래처 적용, 재계약률·후속 연락 누락률 추적",
    ],
    expectedEffect: "후속 영업 누락 방지, 재계약률 개선",
  },
  // Q3에서 선택지에 없는 업무를 "기타"로 응답한 경우의 기본 카드.
  other: {
    title: "업무 자동화 후보 진단",
    why: "말씀해 주신 업무는 상담을 통해 구체적인 자동화 방안을 함께 설계해 드립니다.",
    roadmap: [
      "해당 업무의 반복 패턴 정리",
      "상담을 통해 자동화 방식 설계 및 소규모 파일럿",
      "적용 범위 확대 및 효과 측정",
    ],
    expectedEffect: "상담 후 구체적인 범위로 안내",
  },
};

/**
 * Q1(업종) × Q3(업무) → 업종 특화 예시 1문장. 없으면(업종 "위 복합"/"기타" 등)
 * 결과 화면에서 이 줄을 생략한다(summarize.ts).
 */
export const INDUSTRY_TASK_EXAMPLES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  network: {
    quote: "예: BOM·회선 구성 기반 제안 초안 자동 생성",
    bidding: "예: 통신 인프라 관련 입찰 공고 자동 필터링",
    site_report: "예: 회선·장비 설치 현장 사진 기반 시공 보고서 자동 정리",
    maintenance_request: "예: 회선 장애·품질 민원 자동 분류 및 이력 관리",
    delivery_docs: "예: 회선 개통·준공 확인서 자동 생성",
    client_management: "예: 통신사·대리점 재계약 시점 자동 알림",
  },
  av: {
    quote: "예: 장비 구성표·시공 내역 기반 견적 초안 자동 생성",
    bidding: "예: AV 관련 입찰 공고 자동 필터링",
    site_report: "예: 장비 설치 현장 사진·도면 기반 시공 보고서 자동 정리",
    maintenance_request: "예: 장비 고장·A/S 민원 자동 분류 및 이력 관리",
    delivery_docs: "예: 장비 납품·준공 확인서 자동 생성",
    client_management: "예: 유지보수 계약 갱신 시점 자동 알림",
  },
  it_si: {
    quote: "예: 시스템 구성도·라이선스 기반 제안 초안 자동 생성",
    bidding: "예: SI 관련 입찰 공고 자동 필터링",
    site_report: "예: 구축 현장 점검 결과 기반 보고서 자동 정리",
    maintenance_request: "예: 장애·헬프데스크 문의 자동 분류 및 이력 관리",
    delivery_docs: "예: 시스템 납품·검수 확인서 자동 생성",
    client_management: "예: 유지보수·SLA 계약 갱신 시점 자동 알림",
  },
  maintenance_ops: {
    quote: "예: 정기 점검·운영 범위 기반 견적 초안 자동 생성",
    bidding: "예: 운영 위탁 관련 입찰 공고 자동 필터링",
    site_report: "예: 정기 점검 결과 기반 보고서 자동 정리",
    maintenance_request: "예: 운영 중 발생 민원 자동 분류 및 이력 관리",
    delivery_docs: "예: 정기 점검·운영 보고서 자동 생성",
    client_management: "예: 운영 계약 갱신·SLA 점검 시점 자동 알림",
  },
} as const;

/** Q4가 "전혀 없음"이면 로드맵 1주차 앞에 붙는 문구. */
export const NO_AI_EXPERIENCE = new Set(["none"]);
export const NO_AI_EXPERIENCE_STEP_LABEL = "임직원 기초 교육(2시간)";

/** Q2가 "10명 미만"이면 로드맵 1개월차 앞에 붙는 문구. */
export const SMALL_TEAM_SIZE = new Set(["under_10"]);
export const SMALL_TEAM_STEP_LABEL = "전담자 없이 쓸 수 있는 SaaS 도구부터 시작";

/** Q5가 흩어져 있음/잘 모름이면 로드맵 1주차 앞에 붙는 문구. */
export const DATA_PREP_STEP_LABEL = "데이터 정리 1주";

/** 모든 기대 효과 뒤에 공통으로 붙는 면책 문구 — 확정 수치·보장 표현 금지 규칙 대응. */
export const EFFECT_DISCLAIMER = " (일반적 도입 사례 기준, 실제 효과는 상담 후 안내)";
```

이 교체로 기존 `Q5_NEEDS_DATA_PREP`·`DATA_PREP_PREFIX`·`EXPECTED_EFFECT_TONE_SUFFIX`
선언(66-96번째 줄, 195-205번째 줄 부근)은 **그대로 둔다** — 단, `DATA_PREP_PREFIX`
(`"데이터 정리 1주 → "` 화살표 포함 버전)는 이제 `DATA_PREP_STEP_LABEL`(화살표 없는
라벨만)로 대체되므로 `export const DATA_PREP_PREFIX = "데이터 정리 1주 → ";` 줄은
**삭제**한다(Task 10에서 summarize.ts가 더 이상 참조하지 않음).

- [ ] **Step 4: 타입 체크(의도적으로 깨지는 지점 확인)**

```bash
npx tsc --noEmit
```

Expected: **FAIL** — `summarize.ts`가 여전히 `card.firstStep`·`DATA_PREP_PREFIX`를
참조하므로 에러가 난다. 이건 정상이다 — Task 10에서 고친다. 에러 메시지가
`Property 'firstStep' does not exist on type 'AxCheckTaskCard'`와
`Module '"./catalog"' has no exported member 'DATA_PREP_PREFIX'` 두 종류인지만
확인하고 다음 태스크로 진행한다(같은 커밋 범위 안에서 Task 10과 함께 커밋한다 —
catalog.ts 단독 커밋은 하지 않는다).

---

### Task 10: `summarize.ts` 재작성 (작업 B — 로직)

**Files:**
- Modify: `src/lib/ax-check/summarize.ts` (전체)
- Modify: `src/lib/ax-check/summarize.test.ts` (전체 재작성)

**Interfaces:**
- Consumes: Task 9의 모든 신규 catalog.ts export
- Produces: `export type AxCheckPriority = { title: string; why: string; echo: string; industryExample: string | null; roadmap: readonly [string, string, string]; expectedEffect: string }` (기존 `AxCheckSummary`/`gradeAxCheck`/`summarizeAxCheck` 시그니처는 불변)

- [ ] **Step 1: `summarize.ts` import 절 교체**

`src/lib/ax-check/summarize.ts:11-24`를 찾아:

```ts
import {
  AUTHORITY_DECISIVE,
  CATALOG_VERSION,
  DATA_PREP_PREFIX,
  EXPECTED_EFFECT_TONE_SUFFIX,
  GRADE_BASE_SCORE,
  Q3_MAX_SELECT,
  Q5_NEEDS_DATA_PREP,
  TASK_CARDS,
  TIMING_CONSIDERING,
  TIMING_NEAR_TERM,
  type AxCheckTaskCard,
  type CatalogLeadGrade,
} from "./catalog";
```

다음으로 교체:

```ts
import {
  AUTHORITY_DECISIVE,
  CATALOG_VERSION,
  DATA_PREP_STEP_LABEL,
  EFFECT_DISCLAIMER,
  EXPECTED_EFFECT_TONE_SUFFIX,
  GRADE_BASE_SCORE,
  getOptionLabel,
  getQuestionById,
  INDUSTRY_TASK_EXAMPLES,
  NO_AI_EXPERIENCE,
  NO_AI_EXPERIENCE_STEP_LABEL,
  Q3_MAX_SELECT,
  Q5_NEEDS_DATA_PREP,
  SMALL_TEAM_SIZE,
  SMALL_TEAM_STEP_LABEL,
  TASK_CARDS,
  TIMING_CONSIDERING,
  TIMING_NEAR_TERM,
  type AxCheckTaskCard,
  type CatalogLeadGrade,
} from "./catalog";
```

- [ ] **Step 2: `AxCheckPriority` 타입 + `buildPriority` 재작성**

`src/lib/ax-check/summarize.ts:39,66-77`을 찾아:

```ts
export type AxCheckPriority = AxCheckTaskCard;
```

다음으로 교체:

```ts
export type AxCheckPriority = {
  title: string;
  why: string;
  /** 답변 인용 근거 문장 — "'제안서·견적서 작성'을(를) 가장 시간이 많이 드는 업무로 꼽아주셨습니다." */
  echo: string;
  /** Q1(업종) 기준 구체 예시 1문장. 매핑이 없는 업종("위 복합"/"기타" 등)이면 null. */
  industryExample: string | null;
  /** 미니 로드맵 3단계: [첫 1주, 첫 1개월, 3개월] — Q2·Q4·Q5 분기 접두어가 이미 반영됨. */
  roadmap: readonly [string, string, string];
  expectedEffect: string;
};
```

그리고 `buildPriority` 함수(`src/lib/ax-check/summarize.ts:66-77`)를:

```ts
function buildPriority(taskValue: string, answers: AxCheckAnswers): AxCheckPriority {
  const card = TASK_CARDS[taskValue] ?? TASK_CARDS.other!;
  const needsDataPrep = Q5_NEEDS_DATA_PREP.has(answers.q5);
  const toneSuffix = EXPECTED_EFFECT_TONE_SUFFIX[answers.q6] ?? "";

  return {
    title: card.title,
    why: card.why,
    firstStep: needsDataPrep ? `${DATA_PREP_PREFIX}${card.firstStep}` : card.firstStep,
    expectedEffect: `${card.expectedEffect}${toneSuffix}`,
  };
}
```

다음으로 교체:

```ts
function buildEcho(taskValue: string, answers: AxCheckAnswers): string {
  const label =
    taskValue === "other" && answers.q3Other?.trim()
      ? answers.q3Other.trim()
      : getOptionLabel(getQuestionById("q3"), taskValue);
  return `'${label}'을(를) 가장 시간이 많이 드는 업무로 꼽아주셨습니다.`;
}

function withPrefixes(base: string, prefixes: string[]): string {
  return prefixes.length > 0 ? `${prefixes.join(" → ")} → ${base}` : base;
}

function buildRoadmap(card: AxCheckTaskCard, answers: AxCheckAnswers): [string, string, string] {
  const week1Prefixes: string[] = [];
  if (NO_AI_EXPERIENCE.has(answers.q4)) week1Prefixes.push(NO_AI_EXPERIENCE_STEP_LABEL);
  if (Q5_NEEDS_DATA_PREP.has(answers.q5)) week1Prefixes.push(DATA_PREP_STEP_LABEL);

  const month1Prefixes: string[] = [];
  if (SMALL_TEAM_SIZE.has(answers.q2)) month1Prefixes.push(SMALL_TEAM_STEP_LABEL);

  return [
    withPrefixes(card.roadmap[0], week1Prefixes),
    withPrefixes(card.roadmap[1], month1Prefixes),
    card.roadmap[2],
  ];
}

function buildPriority(taskValue: string, answers: AxCheckAnswers): AxCheckPriority {
  const card = TASK_CARDS[taskValue] ?? TASK_CARDS.other!;
  const toneSuffix = EXPECTED_EFFECT_TONE_SUFFIX[answers.q6] ?? "";
  const industryExample = INDUSTRY_TASK_EXAMPLES[answers.q1]?.[taskValue] ?? null;

  return {
    title: card.title,
    why: card.why,
    echo: buildEcho(taskValue, answers),
    industryExample,
    roadmap: buildRoadmap(card, answers),
    expectedEffect: `${card.expectedEffect}${toneSuffix}${EFFECT_DISCLAIMER}`,
  };
}
```

- [ ] **Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: `summarize.ts` 관련 에러는 사라진다. `summarize.test.ts`가 옛 `firstStep`
기대값을 쓰고 있어서 **테스트 실행 시**(타입 체크가 아니라) 실패할 것이다 — 다음
스텝에서 고친다.

- [ ] **Step 4: `summarize.test.ts` 전체 재작성**

`src/lib/ax-check/summarize.test.ts` 파일 전체를 다음으로 교체:

```ts
import { describe, expect, it } from "vitest";
import { gradeAxCheck, summarizeAxCheck, type AxCheckAnswers } from "./summarize";
import { CATALOG_VERSION } from "./catalog";

function baseAnswers(overrides: Partial<AxCheckAnswers> = {}): AxCheckAnswers {
  return {
    q1: "network",
    q2: "10_to_30",
    q3: ["quote", "bidding"],
    q4: "personal",
    q5: "files",
    q6: "speed",
    q7: "within_3_months",
    q8: "self_decide",
    ...overrides,
  };
}

describe("gradeAxCheck", () => {
  it("HOT: 임박한 시점 + 결정 권한 + 업무 2개 이상 선택", () => {
    expect(
      gradeAxCheck({ q3: ["quote", "bidding"], q7: "this_year", q8: "ceo_report" })
    ).toBe("HOT");
  });

  it("WARM: 검토 의사는 있지만 HOT 조건을 충족하지 못함 (업무 1개만 선택)", () => {
    expect(
      gradeAxCheck({ q3: ["quote"], q7: "within_3_months", q8: "self_decide" })
    ).toBe("WARM");
  });

  it("WARM: 결정 권한이 없어 HOT이 아님(내년 이후 검토)", () => {
    expect(
      gradeAxCheck({ q3: ["quote", "bidding"], q7: "next_year", q8: "undecided" })
    ).toBe("WARM");
  });

  it("COLD: 아직 정보 수집 단계", () => {
    expect(
      gradeAxCheck({ q3: ["quote", "bidding"], q7: "info_gathering", q8: "self_decide" })
    ).toBe("COLD");
  });
});

describe("summarizeAxCheck — Q3 과제 매핑", () => {
  it("선택한 업무마다 카탈로그의 과제 카드를 매핑한다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote", "bidding"] }));

    expect(summary.priorities).toHaveLength(2);
    expect(summary.priorities[0]).toMatchObject({ title: "제안서·견적서 자동 초안 생성" });
    expect(summary.priorities[0]?.roadmap[0]).toBe("최근 1년 제안서·견적서 20건 정리");
    expect(summary.priorities[1]).toMatchObject({ title: "입찰 공고 탐색·서류 자동화" });
  });

  it("최대 3개까지만 우선 과제로 반환한다", () => {
    const summary = summarizeAxCheck(
      baseAnswers({ q3: ["quote", "bidding", "site_report", "maintenance_request"] })
    );

    expect(summary.priorities).toHaveLength(3);
  });

  it("카탈로그에 없는 업무는 기타(other) 카드로 대체한다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["unknown-task-value"] }));

    expect(summary.priorities[0]).toMatchObject({ title: "업무 자동화 후보 진단" });
  });

  it("catalogVersion을 함께 반환한다", () => {
    const summary = summarizeAxCheck(baseAnswers());
    expect(summary.catalogVersion).toBe(CATALOG_VERSION);
  });
});

describe("summarizeAxCheck — 답변 인용(echo)", () => {
  it("선택한 업무 라벨을 그대로 인용한다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"] }));
    expect(summary.priorities[0]?.echo).toBe(
      "'제안서·견적서 작성'을(를) 가장 시간이 많이 드는 업무로 꼽아주셨습니다."
    );
  });

  it("'기타'를 선택하고 q3Other를 입력했으면 그 텍스트를 인용한다", () => {
    const summary = summarizeAxCheck(
      baseAnswers({ q3: ["other"], q3Other: "재고 실사 정리" })
    );
    expect(summary.priorities[0]?.echo).toContain("재고 실사 정리");
  });
});

describe("summarizeAxCheck — Q1 업종 예시", () => {
  it("업종에 매핑된 예시가 있으면 industryExample을 채운다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q1: "av", q3: ["quote"] }));
    expect(summary.priorities[0]?.industryExample).toContain("장비 구성표");
  });

  it("같은 업무라도 업종이 다르면 다른 예시가 나온다", () => {
    const networkSummary = summarizeAxCheck(baseAnswers({ q1: "network", q3: ["quote"] }));
    const avSummary = summarizeAxCheck(baseAnswers({ q1: "av", q3: ["quote"] }));
    expect(networkSummary.priorities[0]?.industryExample).not.toBe(
      avSummary.priorities[0]?.industryExample
    );
  });

  it("매핑이 없는 업종(위 복합)이면 industryExample이 null이다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q1: "mixed", q3: ["quote"] }));
    expect(summary.priorities[0]?.industryExample).toBeNull();
  });
});

describe("summarizeAxCheck — 로드맵 분기", () => {
  it("Q5가 '흩어져 있음'이면 1주차 앞에 데이터 정리를 붙인다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q5: "scattered" }));
    expect(summary.priorities[0]?.roadmap[0]).toBe(
      "데이터 정리 1주 → 최근 1년 제안서·견적서 20건 정리"
    );
  });

  it("Q5가 ERP 등 정리된 데이터면 접두어를 붙이지 않는다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q5: "erp" }));
    expect(summary.priorities[0]?.roadmap[0]).toBe("최근 1년 제안서·견적서 20건 정리");
  });

  it("Q4가 '전혀 없음'이면 1주차 앞에 기초 교육을 붙인다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q4: "none" }));
    expect(summary.priorities[0]?.roadmap[0]).toContain("임직원 기초 교육(2시간)");
  });

  it("Q4·Q5가 둘 다 해당하면 두 접두어가 화살표로 이어진다", () => {
    const summary = summarizeAxCheck(
      baseAnswers({ q3: ["quote"], q4: "none", q5: "scattered" })
    );
    expect(summary.priorities[0]?.roadmap[0]).toBe(
      "임직원 기초 교육(2시간) → 데이터 정리 1주 → 최근 1년 제안서·견적서 20건 정리"
    );
  });

  it("Q2가 '10명 미만'이면 1개월차 앞에 SaaS 문구를 붙인다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q2: "under_10" }));
    expect(summary.priorities[0]?.roadmap[1]).toContain("전담자 없이 쓸 수 있는 SaaS");
  });

  it("Q2가 10명 이상이면 1개월차에 접두어가 붙지 않는다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q2: "30_to_100" }));
    expect(summary.priorities[0]?.roadmap[1]).toBe(
      "표준 템플릿 3종 확정 후 AI 초안 도구로 파일럿 5건 작성"
    );
  });

  it("3개월차는 분기와 무관하게 카탈로그 원본을 그대로 쓴다", () => {
    const summary = summarizeAxCheck(
      baseAnswers({ q3: ["quote"], q2: "under_10", q4: "none", q5: "scattered" })
    );
    expect(summary.priorities[0]?.roadmap[2]).toBe(
      "실제 제안 건에 적용해 작성 시간 정착, 월별 절감 시간 측정"
    );
  });
});

describe("summarizeAxCheck — Q6 톤 + 효과 면책 문구", () => {
  it("Q6에 따라 expectedEffect에 톤 접미사가 붙고, 면책 문구가 항상 함께 붙는다", () => {
    const summary = summarizeAxCheck(baseAnswers({ q3: ["quote"], q6: "cost" }));
    expect(summary.priorities[0]?.expectedEffect).toBe(
      "작성 시간 40~60%↓ (인건비·야근 절감 관점) (일반적 도입 사례 기준, 실제 효과는 상담 후 안내)"
    );
  });
});

describe("summarizeAxCheck — 서로 다른 조합의 개인화 체감", () => {
  it("Q1·Q2·Q4 조합이 다른 3세트가 눈에 띄게 다른 결과를 낸다", () => {
    const a = summarizeAxCheck(
      baseAnswers({ q1: "network", q2: "over_100", q4: "integrated", q3: ["quote"] })
    );
    const b = summarizeAxCheck(
      baseAnswers({ q1: "av", q2: "under_10", q4: "none", q3: ["quote"] })
    );
    const c = summarizeAxCheck(
      baseAnswers({ q1: "it_si", q2: "30_to_100", q4: "team", q3: ["quote"] })
    );

    const roadmaps = [a, b, c].map((s) => s.priorities[0]?.roadmap.join("|"));
    const industryExamples = [a, b, c].map((s) => s.priorities[0]?.industryExample);

    expect(new Set(roadmaps).size).toBe(3);
    expect(new Set(industryExamples).size).toBe(3);
  });
});

describe("summarizeAxCheck — score", () => {
  it("등급이 높을수록, 선택한 업무가 많을수록 점수가 높다", () => {
    const hot = summarizeAxCheck(
      baseAnswers({ q3: ["quote", "bidding"], q7: "within_3_months", q8: "self_decide" })
    );
    const warm = summarizeAxCheck(
      baseAnswers({ q3: ["quote"], q7: "next_year", q8: "undecided" })
    );
    const cold = summarizeAxCheck(
      baseAnswers({ q3: ["quote"], q7: "info_gathering", q8: "undecided" })
    );

    expect(hot.score).toBeGreaterThan(warm.score);
    expect(warm.score).toBeGreaterThan(cold.score);
  });
});
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

```bash
npx vitest run src/lib/ax-check/summarize.test.ts
```

Expected: PASS(신규 테스트 포함 약 20개, 기존 13개보다 늘어남).

- [ ] **Step 6: 전체 검증**

```bash
npm run lint
npx tsc --noEmit
npm run test
```

Expected: 전부 통과. (이 시점에 `ax-check.ts`/`email-draft.ts`/`AxCheckPriorityCards.tsx`/
`LeadDetailPanel.tsx`가 아직 `priority.firstStep`을 참조하는 곳이 있으면 `tsc`가
잡아낸다 — Task 11에서 마저 고친다. 만약 위 명령이 여기서 에러를 내면 정상이니
당황하지 말고 Task 11로 진행한다.)

- [ ] **Step 7: 커밋 (Task 9 + Task 10을 하나로)**

```bash
git add src/lib/ax-check/catalog.ts src/lib/ax-check/summarize.ts src/lib/ax-check/summarize.test.ts
git commit -m "feat: AX 체크 결과 카드에 답변 인용·업종 예시·3단계 로드맵 추가"
```

---

### Task 11: 새 `AxCheckPriority` 형태를 소비하는 화면·초안 갱신

**Files:**
- Modify: `src/components/ax-check/AxCheckPriorityCards.tsx:32-56`
- Modify: `src/app/admin/(panel)/leads/LeadDetailPanel.tsx:168-179`
- Modify: `src/lib/ax-check/email-draft.ts` (`formatPriorityBlock`만)
- Modify: `src/lib/ax-check/email-draft.test.ts` (기대값 갱신)

**Interfaces:**
- Consumes: Task 10에서 만든 최종 `AxCheckPriority` 형태
- Produces: 없음(내부 렌더링/포맷팅만 변경)

- [ ] **Step 1: `AxCheckPriorityCards.tsx` 카드 렌더링 교체**

`src/components/ax-check/AxCheckPriorityCards.tsx:32-56`(`<ol>` 블록 전체)을 찾아:

```tsx
      <ol className="mt-6 space-y-3">
        {priorities.map((priority, index) => (
          <li
            key={`${priority.title}-${index}`}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {index + 1}
              </span>
              {priority.title}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{priority.why}</p>
            <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex gap-1.5">
                <dt className="shrink-0 font-medium text-foreground">첫 단계</dt>
                <dd>{priority.firstStep}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="shrink-0 font-medium text-foreground">기대 효과</dt>
                <dd>{priority.expectedEffect}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
```

다음으로 교체:

```tsx
      <ol className="mt-6 space-y-3">
        {priorities.map((priority, index) => (
          <li
            key={`${priority.title}-${index}`}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {index + 1}
              </span>
              {priority.title}
            </p>
            <p className="mt-2 text-xs font-medium text-primary">{priority.echo}</p>
            {priority.industryExample ? (
              <p className="mt-1 text-xs text-muted-foreground">{priority.industryExample}</p>
            ) : null}
            <p className="mt-2 text-sm text-muted-foreground">{priority.why}</p>
            <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex gap-1.5">
                <dt className="shrink-0 font-medium text-foreground">첫 1주</dt>
                <dd>{priority.roadmap[0]}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="shrink-0 font-medium text-foreground">첫 1개월</dt>
                <dd>{priority.roadmap[1]}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="shrink-0 font-medium text-foreground">3개월</dt>
                <dd>{priority.roadmap[2]}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="shrink-0 font-medium text-foreground">기대 효과</dt>
                <dd>{priority.expectedEffect}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
```

- [ ] **Step 2: `LeadDetailPanel.tsx` 우선 과제 목록 교체**

`src/app/admin/(panel)/leads/LeadDetailPanel.tsx:168-179`를 찾아:

```tsx
        <ol className="space-y-2">
          {lead.priorities.map((p, i) => (
            <li key={`${p.title}-${i}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">
                {i + 1}. {p.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">{p.why}</p>
              <p className="mt-1 text-xs text-slate-600">첫 단계: {p.firstStep}</p>
              <p className="text-xs text-slate-600">기대 효과: {p.expectedEffect}</p>
            </li>
          ))}
        </ol>
```

다음으로 교체:

```tsx
        <ol className="space-y-2">
          {lead.priorities.map((p, i) => (
            <li key={`${p.title}-${i}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">
                {i + 1}. {p.title}
              </p>
              <p className="mt-1 text-xs text-indigo-600">{p.echo}</p>
              {p.industryExample ? (
                <p className="mt-1 text-xs text-slate-500">{p.industryExample}</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">{p.why}</p>
              <p className="mt-1 text-xs text-slate-600">첫 1주: {p.roadmap[0]}</p>
              <p className="text-xs text-slate-600">첫 1개월: {p.roadmap[1]}</p>
              <p className="text-xs text-slate-600">3개월: {p.roadmap[2]}</p>
              <p className="text-xs text-slate-600">기대 효과: {p.expectedEffect}</p>
            </li>
          ))}
        </ol>
```

- [ ] **Step 3: `email-draft.ts`의 `formatPriorityBlock` 갱신**

`src/lib/ax-check/email-draft.ts`의 `formatPriorityBlock` 함수를 찾아:

```ts
function formatPriorityBlock(priority: AxCheckPriority, index: number): string[] {
  return [
    `${index + 1}. ${priority.title}`,
    `   - ${priority.why}`,
    `   - 첫 단계: ${priority.firstStep}`,
    `   - 기대 효과: ${priority.expectedEffect}`,
    "",
  ];
}
```

다음으로 교체:

```ts
function formatPriorityBlock(priority: AxCheckPriority, index: number): string[] {
  return [
    `${index + 1}. ${priority.title}`,
    `   - ${priority.echo}`,
    priority.industryExample ? `   - ${priority.industryExample}` : null,
    `   - ${priority.why}`,
    `   - 첫 1주: ${priority.roadmap[0]}`,
    `   - 첫 1개월: ${priority.roadmap[1]}`,
    `   - 3개월: ${priority.roadmap[2]}`,
    `   - 기대 효과: ${priority.expectedEffect}`,
    "",
  ].filter((line): line is string => line !== null);
}
```

- [ ] **Step 4: `email-draft.test.ts` 기대값 갱신**

`src/lib/ax-check/email-draft.test.ts`의 `baseSummary()` 헬퍼와 관련 단언을 새
`AxCheckPriority` 형태에 맞춘다. 파일 상단의 `baseSummary` 함수를:

```ts
function baseSummary(overrides: Partial<AxCheckSummary> = {}): AxCheckSummary {
  return {
    priorities: [
      {
        title: "제안서·견적서 자동 초안 생성",
        why: "과거 제안서·견적 데이터를 기반으로 반복 작성 시간을 줄일 수 있습니다.",
        echo: "'제안서·견적서 작성'을(를) 가장 시간이 많이 드는 업무로 꼽아주셨습니다.",
        industryExample: "예: BOM·회선 구성 기반 제안 초안 자동 생성",
        roadmap: [
          "최근 1년 제안서·견적서 20건 정리",
          "표준 템플릿 3종 확정 후 AI 초안 도구로 파일럿 5건 작성",
          "실제 제안 건에 적용해 작성 시간 정착, 월별 절감 시간 측정",
        ],
        expectedEffect: "작성 시간 40~60%↓ (일반적 도입 사례 기준, 실제 효과는 상담 후 안내)",
      },
    ],
    grade: "HOT",
    score: 320,
    catalogVersion: "v2-draft",
    ...overrides,
  };
}
```

다음으로 교체하고, `"우선 과제 제목·첫 단계·기대 효과가 본문에 포함된다"` 테스트의
단언을:

```ts
    expect(draft.body).toContain("최근 1년 제안서·견적서 20건 정리");
```

는 그대로 유지(roadmap[0] 값이 같은 문자열이라 수정 불필요). `"우선 과제 여러 개를
순서대로..."` 테스트의 두 번째 `priorities` 항목도 `roadmap: ["step1a", "step1b", "step1c"]`,
`echo: "echo2"`, `industryExample: null` 형태로 채워 타입 에러가 나지 않게 한다.

- [ ] **Step 5: 전체 테스트·타입 체크**

```bash
npm run lint
npx tsc --noEmit
npm run test
```

Expected: 전부 통과. `tsc`가 더 이상 `firstStep` 관련 에러를 내지 않아야 한다.

- [ ] **Step 6: E2E 재실행**

```bash
npx playwright test e2e/ax-check.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/components/ax-check/AxCheckPriorityCards.tsx src/app/admin/\(panel\)/leads/LeadDetailPanel.tsx src/lib/ax-check/email-draft.ts src/lib/ax-check/email-draft.test.ts
git commit -m "feat: 결과 화면·관리자·이메일 초안에 답변 인용·로드맵 3단계 반영"
```

---

### Task 12: 최종 검증 · 문서 마감 커밋

**Files:**
- Modify: `docs/TODO.md:112` (진행 상황 최종 갱신)

**Interfaces:**
- Consumes: 없음
- Produces: 없음

- [ ] **Step 1: 전체 자동 검증**

```bash
npm run lint
npx tsc --noEmit
npm run test
npx playwright test e2e/ax-check.spec.ts --project=chromium
```

Expected: 전부 통과. (`admin-login.spec.ts`의 기존 무관한 실패 1건은 이번 작업 범위
밖이므로 무시한다 — `--grep` 없이 전체 스위트를 돌린다면 그 1건만 예외.)

- [ ] **Step 2: 변경 파일 최종 점검**

```bash
git diff main --stat
```

다음이 포함돼야 한다: `docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md`,
`docs/PRD.md`, `docs/TODO.md`, `CONTENT_GUIDE.md`, `src/lib/ax-check/catalog.ts`,
`src/lib/ax-check/summarize.ts`, `src/lib/ax-check/summarize.test.ts`,
`src/lib/ax-check/email-draft.ts`(신규), `src/lib/ax-check/email-draft.test.ts`(신규),
`src/actions/ax-check.ts`, `src/actions/ax-check.test.ts`,
`src/app/ax-check/AxCheckIntro.tsx`(신규), `src/app/ax-check/page.tsx`,
`src/components/ax-check/AxCheckPriorityCards.tsx`,
`src/app/admin/(panel)/leads/EmailDraftPanel.tsx`(신규),
`src/app/admin/(panel)/leads/LeadDetailPanel.tsx`, `e2e/ax-check.spec.ts`.

- [ ] **Step 3: `docs/TODO.md` 진행 상황 최종 갱신**

Task 0에서 추가한 "경험 개선 착수 (2026-08-30)" 줄을 찾아 `🚧`를 `✅`로 바꾸고
완료 문장으로 교체:

```diff
-   - 🚧 **경험 개선 착수 (2026-08-30)** — 인트로 화면(A)·결과 피드백 구체화(B)·이메일 초안 워크플로우(C) 3개 보강. 설계: `docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md`, 구현 계획: `docs/superpowers/plans/2026-08-30-ax-check-experience-upgrade-implementation-plan.md`. 첫 링크 발송 전 필수(C — 고객 자동 발송 메일 문구가 실제 동작과 어긋나는 문제 해소).
+   - ✅ **경험 개선 완료 (2026-08-30)** — 인트로 화면(A)·결과 피드백 구체화(B, Q1/Q2/Q4 추가 반영·답변 인용·업종 예시·3단계 로드맵)·이메일 초안 워크플로우(C, 고객 자동 발송 제거 → 영업이사 메일 동봉 + `/admin/leads` 복사 패널) 전부 구현·테스트 완료. 남은 것: 영업이사 서명 블록(`SALES_SIGNATURE`) 실제 정보 입력, 인트로·초안 카피 최종 검수, 실기기 테스트.
```

- [ ] **Step 4: 커밋**

```bash
git add docs/TODO.md
git commit -m "docs: AX 체크 경험 개선 완료 반영"
```

- [ ] **Step 5: 최종 보고 준비**

다음을 정리해 사용자에게 보고한다(브랜치 push·PR 생성은 사용자 확인 후 진행 —
이 세션에서 학습한 대로 CI/Vercel 상태를 push 직후 확인한다):

- 변경 파일 목록(Step 2 결과)
- 남은 사람 작업: ① `SALES_SIGNATURE`(catalog.ts) 실제 이름·연락처 입력, ② 인트로
  (`INTRO_COPY`)·이메일 초안 카피 최종 검수(경영진 승인), ③ 영업이사 실기기 테스트
  (인트로 스크롤·이메일 초안 복사→발송 플로우 포함)
- 첫 링크 발송 전 체크리스트: `/admin/leads`에서 초안 복사가 실제로 되는지,
  영업이사 알림 메일에 초안이 잘 담겨오는지, 결과 화면·인트로·`/privacy` 문구가
  서로 모순되지 않는지 실제 프로덕션에서 최종 확인

---

## Self-Review 기록

- **Spec coverage**: 작업 A(Task 7·8) / 작업 B(Task 9·10·11) / 작업 C(Task 1·2·3·4) /
  결과 화면 문구(Task 5) / E2E(Task 6) / 문서 우선(Task 0) / 완료 보고(Task 12) —
  액션플랜·프롬프트 문서의 모든 절이 태스크로 매핑됨을 확인.
- **Placeholder scan**: "TBD"·"적절히 처리"류 문구 없음. `SALES_SIGNATURE` 값은
  catalog.ts의 기존 "v1-draft" 관례를 따르는 명시적 placeholder이며 완료 보고의
  "남은 사람 작업"에 명기함 — 계획 문서 자체의 placeholder가 아님.
- **Type consistency**: `AxCheckPriority`(roadmap 3-튜플, echo, industryExample)가
  Task 10에서 정의된 형태 그대로 Task 11(UI 2곳)·email-draft.ts(Task 2 최초 작성,
  Task 11에서 갱신)까지 일관되게 사용됨을 확인. `buildCustomerEmailDraft` 시그니처는
  Task 2~11 전체에서 `(answers, summary, contact)`로 고정.
