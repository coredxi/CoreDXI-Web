# AX 체크 자동 팔로업 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/ax-check` 제출 시 시스템이 사람 없이 (T0) 즉시 결과 요약 메일과 (T1) 영업일 D+2 09:30 KST 상세 진단 메일을 자동 발송하고, 관리자가 발송 전 보류·수정·즉시 발송할 수 있게 한다.

**Architecture:** `submitAxCheck`가 제출 시 T0을 즉시 발송하고 `followupScheduledAt`을 계산해 저장한다. Vercel Cron이 매일 00:30 UTC(09:30 KST)에 `/api/cron/ax-check-followup`을 호출해 `processDueFollowups()`(`src/lib/ax-check/followup.ts`)를 실행하고, 이 함수는 대상 리드를 원자적으로 선점(`updateMany` count===1)한 뒤 `sendFollowupEmail(id)`로 T1을 발송한다. 크론과 관리자 "지금 보내기" 버튼이 동일한 `sendFollowupEmail`을 호출해 발송 로직을 한 곳에 둔다. 관리자는 `/admin/leads`의 `EmailDraftPanel`(헤더만 "팔로업 메일"로 개편, 파일명·컴포넌트명 유지)에서 보류·해제·즉시 발송·본문 수정을 할 수 있다.

**Tech Stack:** Next.js 15 App Router + TypeScript, Prisma 7 + PostgreSQL(Supabase), Resend, Vercel Cron, Vitest + Playwright. 외부 날짜/크론 라이브러리 추가 금지 — `Intl.DateTimeFormat`만 사용.

**Spec:** `docs/superpowers/specs/2026-09-02-ax-check-auto-followup-design.md` (정본). 액션 플랜: `docs/superpowers/plans/2026-09-02-sales-channel-auto-followup-action-plan.md`. 메일 문구(안 1 확정): `docs/superpowers/plans/2026-09-02-ax-check-followup-email-drafts.md`.

## Global Constraints

- `prisma migrate dev` 절대 금지 — 수동 `migration.sql` + `prisma migrate deploy`만 사용.
- 기존 리드에 소급 자동 발송 금지 — 과거 행은 `SKIPPED` 기본값 유지(이미 Task 1에서 반영됨).
- HTML 메일 도입 금지 — 텍스트 메일 유지.
- 새 외부 라이브러리(날짜·크론) 추가 금지.
- 새 색상 토큰 추가 금지 — 기존 Tailwind 팔레트(`indigo`/`slate`/`red`/`amber`/`emerald` 등 이미 쓰이는 색)와 `rounded-xl`만 사용.
- `any` 타입 사용 금지, Named Export 유지, 컴포넌트 파일에는 `[홍보팀]` 한국어 주석 유지.
- T0·T1 문구는 `email-drafts.md` **안 1**만 사용 — 안 2 혼용 금지.
- 결과 화면·메일에 "09:30 정각" 같은 시각 확정 문구 금지(크론 지연 가능).
- 커밋은 Conventional Commits, 메시지 끝에 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` 유지.
- `src/app/admin/(panel)/leads/` 하위 파일들은 shadcn/ui를 쓰지 않는 기존 관례(raw Tailwind + `lucide-react`)를 따른다 — 이 디렉터리에 새로 shadcn 컴포넌트를 들여오지 않는다.

## 브랜치 상태 (읽고 시작할 것)

`feat/ax-check-auto-followup` 브랜치와 워크트리(`.claude/worktrees/ax-check-auto-followup`, `git worktree list`로 확인)가 이미 존재하고 main(`eae06bf`) 위에 커밋 1개(`618b150 feat: AxCheckResponse 팔로업 필드·마이그레이션 추가`)가 있다. **이 커밋이 아래 Task 1(데이터 모델)의 산출물과 정확히 일치하므로, 사용자 확인에 따라 이 브랜치/워크트리를 그대로 이어서 사용한다.** 새로 브랜치를 따지 말 것. 아래 Task 1은 "완료 확인"만 하고 Task 2부터 실제 구현을 시작한다.

---

### Task 1: 데이터 모델 — 완료 확인만 (이미 커밋됨, 코드 변경 없음)

**Files (읽기 전용 확인):**
- `prisma/schema.prisma` — `enum FollowupStatus`, `AxCheckResponse` 팔로업 필드 8개, 인덱스
- `prisma/migrations/20260908120000_add_ax_check_followup/migration.sql`
- `src/lib/ax-check/types.ts` — `FollowupStatus` 타입, `AxCheckLeadRecord` 팔로업 필드
- `src/actions/ax-check.ts` — `listAxCheckResponses`의 매핑에 팔로업 필드 포함

**Interfaces:**
- Produces (이후 모든 태스크가 사용): `FollowupStatus = "SCHEDULED" | "HELD" | "SENDING" | "SENT" | "FAILED" | "SKIPPED"` (`src/lib/ax-check/types.ts`), `AxCheckLeadRecord`에 `followupStatus: FollowupStatus`, `followupScheduledAt: Date | null`, `followupSentAt: Date | null`, `followupSubject: string | null`, `followupBody: string | null`, `followupError: string | null`, `followupAttempts: number`, `t0SentAt: Date | null`.

- [ ] **Step 1: 워크트리로 이동해 커밋 상태 확인**

```bash
cd C:/MyProjects/CoreDXI-Web/.claude/worktrees/ax-check-auto-followup
git log --oneline -3
git status
```
Expected: `618b150 feat: AxCheckResponse 팔로업 필드·마이그레이션 추가`가 최상단, working tree clean. 이후 모든 작업은 이 워크트리 디렉터리에서 진행한다.

- [ ] **Step 2: 스키마·타입이 설계와 일치하는지 육안 확인**

`prisma/schema.prisma`에서 `AxCheckResponse` 모델에 `followupStatus FollowupStatus @default(SCHEDULED)` 등 8개 필드와 `@@index([followupStatus, followupScheduledAt])`가 있는지, `migration.sql`이 `followupStatus` 기본값을 `SKIPPED`로 추가한 뒤 `SET DEFAULT 'SCHEDULED'`로 바꾸는 2단계 ALTER인지 확인한다(과거 리드 소급 발송 방지). 이미 확인됨 — 문제 없으면 다음 태스크로.

- [ ] **Step 3: `npx prisma generate` 실행해 Prisma Client 최신화**

```bash
npx prisma generate
```
Expected: 에러 없이 완료. 이후 태스크에서 `prisma.axCheckResponse`가 새 필드 타입을 인식한다.

---

### Task 2: `RESEND_FROM` 표시명 추가

**Files:**
- Modify: `src/lib/resend.ts:3`
- Test: 기존 `src/actions/contact.test.ts`, `src/actions/newsletter.test.ts`가 있다면 그대로 통과하는지만 확인(파일 내용 변경 없음)

**Interfaces:**
- Produces: `RESEND_FROM = "CoreDXI <noreply@coredxi.com>"` — 이후 모든 태스크(T0/T1/영업이사 알림)가 이 값을 그대로 사용(별도 `from` 미지정 시 기본값).

- [ ] **Step 1: `RESEND_FROM` 값 변경**

`src/lib/resend.ts`의 3번째 줄을 수정한다.

```ts
export const RESEND_FROM = "CoreDXI <noreply@coredxi.com>";
```

- [ ] **Step 2: 기존 발송 관련 테스트 전체 실행해 회귀 없는지 확인**

```bash
npx vitest run src/actions/contact.test.ts src/actions/newsletter.test.ts src/actions/ax-check.test.ts
```
Expected: 모두 PASS (이 상수를 문자열로 직접 검증하는 테스트가 없으므로 영향 없어야 함).

- [ ] **Step 3: 커밋**

```bash
git add src/lib/resend.ts
git commit -m "fix: Resend 발신자 표시명(CoreDXI) 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: 영업일 계산 유틸 (`business-days.ts`)

**Files:**
- Create: `src/lib/ax-check/business-days.ts`
- Test: `src/lib/ax-check/business-days.test.ts`

**Interfaces:**
- Produces (이후 Task 6·9가 사용):
  - `KR_PUBLIC_HOLIDAYS: ReadonlySet<string>`
  - `toKstDateString(date: Date): string` — `YYYY-MM-DD`(KST 기준)
  - `addBusinessDays(fromKstDate: string, n: number, holidays?: ReadonlySet<string>): string`
  - `kstDateTimeToUtc(dateStr: string, hh: number, mm: number): Date`
  - `computeFollowupScheduledAt(submittedAt: Date, holidays?: ReadonlySet<string>): Date` — 제출 시각(UTC) → D+2 영업일 09:30 KST의 UTC `Date`
  - `formatKstFollowupSchedule(date: Date): string` — `"2026-09-04(금) 09:30"` 형식(영업이사 알림 메일용)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/ax-check/business-days.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  KR_PUBLIC_HOLIDAYS,
  addBusinessDays,
  computeFollowupScheduledAt,
  formatKstFollowupSchedule,
  kstDateTimeToUtc,
  toKstDateString,
} from "./business-days";

describe("toKstDateString", () => {
  it("UTC 14:59:59는 같은 날짜의 KST(23:59:59)로 변환된다", () => {
    expect(toKstDateString(new Date("2026-09-02T14:59:59Z"))).toBe("2026-09-02");
  });

  it("UTC 15:00:00는 다음날 KST 자정(00:00:00)으로 넘어간다", () => {
    expect(toKstDateString(new Date("2026-09-02T15:00:00Z"))).toBe("2026-09-03");
  });
});

describe("kstDateTimeToUtc", () => {
  it("KST 09:30은 UTC 00:30이다", () => {
    expect(kstDateTimeToUtc("2026-09-04", 9, 30).toISOString()).toBe(
      "2026-09-04T00:30:00.000Z"
    );
  });
});

describe("addBusinessDays", () => {
  it("주말만 건너뛴다(공휴일 없음)", () => {
    // 2026-09-04는 금요일 — +1 영업일은 주말(토·일)을 건너뛴 월요일
    expect(addBusinessDays("2026-09-04", 1, new Set())).toBe("2026-09-07");
  });

  it("수요일 제출 → D+2 영업일은 금요일이다", () => {
    // 2026-09-02는 수요일
    expect(addBusinessDays("2026-09-02", 2, KR_PUBLIC_HOLIDAYS)).toBe("2026-09-04");
  });

  it("금요일 제출 → D+2 영업일은 화요일이다(주말 건너뜀)", () => {
    // 2026-09-04는 금요일
    expect(addBusinessDays("2026-09-04", 2, KR_PUBLIC_HOLIDAYS)).toBe("2026-09-08");
  });

  it("추석 연휴 직전 제출 → 연휴(9/24~26)와 주말을 모두 건너뛴다", () => {
    // 2026-09-23은 수요일. +1영업일은 9/24(목,휴일)·9/25(금,휴일)·9/26(토,휴일 겸 주말)·
    // 9/27(일,주말)을 모두 건너뛴 9/28(월). +2영업일은 9/29(화).
    expect(addBusinessDays("2026-09-23", 2, KR_PUBLIC_HOLIDAYS)).toBe("2026-09-29");
  });

  it("성탄절(공휴일) 다음이 주말과 이어지면 연속으로 건너뛴다", () => {
    // 2026-12-24(목) +1영업일: 12/25(금,휴일) → 12/26(토,주말) → 12/27(일,주말) → 12/28(월)
    expect(addBusinessDays("2026-12-24", 1, KR_PUBLIC_HOLIDAYS)).toBe("2026-12-28");
  });
});

describe("computeFollowupScheduledAt", () => {
  it("수요일 14:00 KST 제출 → D+2 영업일(금요일) 09:30 KST를 UTC로 반환한다", () => {
    // 2026-09-02T05:00:00Z = 2026-09-02 14:00 KST(수요일)
    const result = computeFollowupScheduledAt(new Date("2026-09-02T05:00:00Z"));
    expect(result.toISOString()).toBe("2026-09-04T00:30:00.000Z"); // 09/04 09:30 KST
  });
});

describe("formatKstFollowupSchedule", () => {
  it("YYYY-MM-DD(요일) HH:mm 형식으로 포맷한다", () => {
    // 2026-09-04T00:30:00Z = 2026-09-04 09:30 KST(금요일)
    expect(formatKstFollowupSchedule(new Date("2026-09-04T00:30:00Z"))).toBe(
      "2026-09-04(금) 09:30"
    );
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run src/lib/ax-check/business-days.test.ts
```
Expected: FAIL — `Cannot find module './business-days'`.

- [ ] **Step 3: 구현**

`src/lib/ax-check/business-days.ts`:

```ts
/**
 * business-days.ts — AX 체크 팔로업(T1) 발송 시각 계산용 KST 영업일 유틸
 *
 * 외부 날짜 라이브러리를 쓰지 않는다 — Intl.DateTimeFormat(Asia/Seoul)만 사용.
 * 설계: docs/superpowers/specs/2026-09-02-ax-check-auto-followup-design.md 5번
 */

/**
 * 한국 공휴일(2026년 잔여분 + 2027-01-01). 매년 갱신 필요 —
 * 수정 방법은 CONTENT_GUIDE.md 17번 참고. 대체공휴일은 관보 확인 후 추가한다.
 * [홍보팀] 새해가 되면 이 목록을 다음 해 공휴일로 갱신해 주세요.
 */
export const KR_PUBLIC_HOLIDAYS: ReadonlySet<string> = new Set([
  "2026-09-24", // 추석 연휴
  "2026-09-25", // 추석
  "2026-09-26", // 추석 연휴
  "2026-10-03", // 개천절
  "2026-10-09", // 한글날
  "2026-12-25", // 성탄절
  "2027-01-01", // 신정
]);

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** UTC Date → KST 기준 "YYYY-MM-DD" 문자열. */
export function toKstDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
}

/**
 * fromKstDate(YYYY-MM-DD, 달력상의 KST 날짜)로부터 n영업일 뒤의 날짜를 반환한다.
 * 주말(토·일)과 holidays에 포함된 날짜를 건너뛴다. 순수 함수 — 시각 정보는 다루지 않는다.
 */
export function addBusinessDays(
  fromKstDate: string,
  n: number,
  holidays: ReadonlySet<string> = KR_PUBLIC_HOLIDAYS
): string {
  const cursor = new Date(`${fromKstDate}T00:00:00Z`);
  let remaining = n;

  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dateStr = cursor.toISOString().slice(0, 10);
    const isWeekend = cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6;
    if (!isWeekend && !holidays.has(dateStr)) {
      remaining -= 1;
    }
  }

  return cursor.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" + KST 시:분 → 실제 시각(UTC Date). */
export function kstDateTimeToUtc(dateStr: string, hh: number, mm: number): Date {
  const hhStr = String(hh).padStart(2, "0");
  const mmStr = String(mm).padStart(2, "0");
  return new Date(`${dateStr}T${hhStr}:${mmStr}:00+09:00`);
}

/** 제출 시각(UTC) → D+2 영업일 09:30 KST(UTC Date). submitAxCheck에서 사용. */
export function computeFollowupScheduledAt(
  submittedAt: Date,
  holidays: ReadonlySet<string> = KR_PUBLIC_HOLIDAYS
): Date {
  const submittedKstDate = toKstDateString(submittedAt);
  const targetKstDate = addBusinessDays(submittedKstDate, 2, holidays);
  return kstDateTimeToUtc(targetKstDate, 9, 30);
}

/** "2026-09-04(금) 09:30" 형식 — 영업이사 알림 메일에서 사용. */
export function formatKstFollowupSchedule(date: Date): string {
  const dateStr = toKstDateString(date);
  const weekdayIndex = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  const timeStr = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${dateStr}(${WEEKDAY_KO[weekdayIndex]}) ${timeStr}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/ax-check/business-days.test.ts
```
Expected: 전체 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/ax-check/business-days.ts src/lib/ax-check/business-days.test.ts
git commit -m "feat: AX 체크 팔로업 영업일 계산 유틸 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `SALES_SIGNATURE` 교체 + `FOLLOWUP_COPY` 상수 (`catalog.ts`)

**Files:**
- Modify: `src/lib/ax-check/catalog.ts:333-342` (SALES_SIGNATURE 교체), 그 아래에 `renderSignatureBlock`·`FOLLOWUP_COPY` 추가

**Interfaces:**
- Produces (Task 5·6이 사용):
  - `SALES_SIGNATURE`: `{ name, title, company, phone, email, tagline, addresses: readonly [string,string] }`
  - `renderSignatureBlock(): string` — 5줄 서명 블록
  - `FOLLOWUP_COPY.optOutNotice: string`
  - `FOLLOWUP_COPY.t0`: `{ subject(company,count), greeting(company,name), introLine1(company,count), introLine2, followupNotice }`
  - `FOLLOWUP_COPY.t1`: `{ subject(company,count), greeting(company,name), introLine(industry,count), introLine2, processParagraph, callToAction(company) }`

- [ ] **Step 1: `SALES_SIGNATURE` 교체**

`src/lib/ax-check/catalog.ts`에서 기존 블록(333-342줄)을 찾아 교체한다.

```ts
// OLD
export const SALES_SIGNATURE = {
  name: "김영업",
  title: "영업이사",
  phone: "010-0000-0000",
  email: "sales@coredxi.com",
} as const;
```

```ts
// NEW
export const SALES_SIGNATURE = {
  name: "김문건",
  title: "이사(Sales)",
  company: "(주)코어디엑스아이 | CoreDXI",
  phone: "010-7192-0532",
  email: "obaamg1017@coredxi.com",
  tagline: "기업의 AI Digital workplace 여정을 함께하는 신뢰의 기술 파트너, CoreDXI",
  addresses: [
    "서울시 서초동 사임당로 27 평화빌딩 4층",
    "울산광역시 남구 달삼로 76 3층 307호",
  ],
} as const;

/**
 * 이메일 본문에 넣는 5줄 서명 블록. buildCustomerEmailDraft·buildT0Email이 공용으로 쓴다.
 * [홍보팀] 서명 내용을 바꾸려면 위 SALES_SIGNATURE만 수정하면 이 함수 출력도 같이 바뀝니다.
 */
export function renderSignatureBlock(): string {
  return [
    `${SALES_SIGNATURE.name} ${SALES_SIGNATURE.title}`,
    SALES_SIGNATURE.company,
    `${SALES_SIGNATURE.phone} | ${SALES_SIGNATURE.email}`,
    `"${SALES_SIGNATURE.tagline}"`,
    SALES_SIGNATURE.addresses.join(" · "),
  ].join("\n");
}
```

- [ ] **Step 2: `FOLLOWUP_COPY` 추가**

`renderSignatureBlock` 바로 아래에 추가한다.

```ts
/**
 * FOLLOWUP_COPY — T0(제출 즉시)·T1(D+2 영업일) 자동 발송 메일 문구.
 * [홍보팀] 문구만 바꾸고 싶으면 이 객체 안의 문자열/템플릿만 수정하면 됩니다(코드 구조 변경 불필요).
 * 안 1(정돈된 컨설턴트 톤) 확정본 — docs/superpowers/plans/2026-09-02-ax-check-followup-email-drafts.md
 */
export const FOLLOWUP_COPY = {
  optOutNotice:
    "이 메일은 AX 체크 진단 신청에 따른 결과 안내입니다. 추가 안내를 원치 않으시면 이 메일에 회신으로\n알려주세요.",
  t0: {
    subject: (company: string, count: number) =>
      `[CoreDXI] ${company} AX 체크 결과 — 우선 과제 ${count}가지 정리본`,
    greeting: (company: string, name: string) => `${company} ${name}님, 안녕하세요. CoreDXI입니다.`,
    introLine1: (company: string, count: number) =>
      `AX 체크에 참여해 주셔서 감사합니다. 방금 화면에서 확인하신 ${company}의 AX 우선 과제 ${count}가지를`,
    introLine2: "다시 볼 수 있도록 정리해 보내드립니다.",
    followupNotice:
      "답변해 주신 내용을 바탕으로 과제별 배경과 첫 1주·1개월·3개월 로드맵을 정리한 상세 진단 메일을\n영업일 기준 2~3일 내에 보내드리겠습니다. 우선 과제가 뚜렷한 경우에는 담당 이사가 직접 연락드립니다.",
  },
  t1: {
    subject: (company: string, count: number) =>
      `[CoreDXI] ${company} AX 체크 상세 진단 — 우선 과제 ${count}가지와 3개월 로드맵`,
    greeting: (company: string, name: string) => `${company} ${name}님, 안녕하세요. CoreDXI입니다.`,
    introLine: (industry: string, count: number) =>
      `지난 AX 체크에서 답변해 주신 내용을 바탕으로 ${industry} 기준의 우선 과제 ${count}가지를 정리했습니다.`,
    introLine2:
      "각 과제마다 왜 지금 이 과제인지, 첫 1주·1개월·3개월에 무엇을 하면 되는지, 기대 효과를 함께 적었습니다.",
    processParagraph:
      "CoreDXI는 진단(2주) → 설계 → 구축 → 교육 순서로 프로젝트를 진행합니다. 도구를 소개하는 데서 끝나지 않고,\n반복 업무가 실제로 줄어드는 것까지 함께 챙깁니다.",
    callToAction: (company: string) =>
      `이 메일에 회신해 주시면 편하신 시간에 30분 통화로 ${company}의 상황에 맞춰 자세히 설명드리겠습니다.`,
  },
} as const;
```

- [ ] **Step 3: 타입체크로 문법 확인(아직 이 상수를 쓰는 코드가 없으므로 단위 테스트 대신 tsc로 검증)**

```bash
npx tsc --noEmit
```
Expected: 에러 없음(email-draft.ts는 Task 5에서 아직 이 상수들을 참조하지 않으므로 미사용 export 경고는 없음).

- [ ] **Step 4: 커밋**

```bash
git add src/lib/ax-check/catalog.ts
git commit -m "feat: 영업이사 서명 실제 값 반영, 팔로업 메일 문구 상수(FOLLOWUP_COPY) 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `email-draft.ts` 개편 — `mode` 파라미터 + `buildT0Email`

**Files:**
- Modify: `src/lib/ax-check/email-draft.ts`
- Modify: `src/lib/ax-check/email-draft.test.ts`

**Interfaces:**
- Consumes: `SALES_SIGNATURE`, `renderSignatureBlock`, `FOLLOWUP_COPY` (Task 4), `getOptionLabel`, `getQuestionById` (기존 catalog.ts)
- Produces (Task 6·7·9가 사용):
  - `buildCustomerEmailDraft(answers, summary, contact, opts?: { mode?: "manual" | "auto" }): AxCheckEmailDraft` — `mode` 생략 시 `"manual"`(기존과 동일 출력, 서명만 5줄)
  - `buildT0Email(summary: { priorities: AxCheckPriority[] }, contact: { company: string; name: string }, links: { resultUrl: string; brochureUrl?: string }): AxCheckEmailDraft`

- [ ] **Step 1: 실패하는 테스트 작성 — 기존 파일에 추가**

`src/lib/ax-check/email-draft.test.ts`의 기존 "영업이사 서명 블록" 테스트를 아래로 교체하고, 파일 맨 아래에 새 `describe` 블록들을 추가한다.

기존(44-99줄 부근)의 이 테스트를:
```ts
  it("영업이사 서명 블록(catalog.ts SALES_SIGNATURE)을 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toContain(SALES_SIGNATURE.name);
    expect(draft.body).toContain(SALES_SIGNATURE.phone);
  });
```
아래로 교체:
```ts
  it("영업이사 서명 블록 5줄(이름·직함/회사/연락처/태그라인/주소)을 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" }
    );
    expect(draft.body).toContain(`${SALES_SIGNATURE.name} ${SALES_SIGNATURE.title}`);
    expect(draft.body).toContain(SALES_SIGNATURE.company);
    expect(draft.body).toContain(`${SALES_SIGNATURE.phone} | ${SALES_SIGNATURE.email}`);
    expect(draft.body).toContain(SALES_SIGNATURE.tagline);
    expect(draft.body).toContain(SALES_SIGNATURE.addresses.join(" · "));
  });
```

파일 맨 아래(마지막 `});` 뒤)에 추가:
```ts

describe("buildCustomerEmailDraft — mode: auto", () => {
  it("수동 편집 슬롯([[ ]])이 없다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" },
      { mode: "auto" }
    );
    expect(draft.body).not.toMatch(/\[\[.*\]\]/);
  });

  it("T1 확정 제목 형식을 쓴다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" },
      { mode: "auto" }
    );
    expect(draft.subject).toBe(
      "[CoreDXI] 테스트회사 AX 체크 상세 진단 — 우선 과제 1가지와 3개월 로드맵"
    );
  });

  it("안 1의 여는 말·맺는 말로 교체된다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" },
      { mode: "auto" }
    );
    expect(draft.body).toContain("테스트회사 홍길동님, 안녕하세요. CoreDXI입니다.");
    expect(draft.body).toContain("도구를 소개하는 데서 끝나지 않고,");
    expect(draft.body).toContain("이 메일에 회신해 주시면 편하신 시간에 30분 통화로 테스트회사의 상황에 맞춰");
  });

  it("수신 거부 안내 문구를 포함한다", () => {
    const draft = buildCustomerEmailDraft(
      baseAnswers(),
      baseSummary(),
      { company: "테스트회사", name: "홍길동" },
      { mode: "auto" }
    );
    expect(draft.body).toContain("추가 안내를 원치 않으시면 이 메일에 회신으로");
  });
});

describe("buildCustomerEmailDraft — mode 미지정(기본값 manual)", () => {
  it("mode를 생략하면 기존 출력과 동일하다(플레이스홀더 포함)", () => {
    const draft = buildCustomerEmailDraft(baseAnswers(), baseSummary(), {
      company: "테스트회사",
      name: "홍길동",
    });
    expect(draft.body).toMatch(/\[\[.*\]\]/);
    expect(draft.subject).toBe("[CoreDXI] 테스트회사 AX 체크 결과 — 귀사의 우선 과제 1가지");
  });
});

describe("buildT0Email", () => {
  const links = { resultUrl: "https://www.coredxi.com/ax-check/result/tok123" };

  it("확정 제목 형식을 쓴다", () => {
    const draft = buildT0Email(baseSummary(), { company: "테스트회사", name: "홍길동" }, links);
    expect(draft.subject).toBe("[CoreDXI] 테스트회사 AX 체크 결과 — 우선 과제 1가지 정리본");
  });

  it("인사말과 우선 과제 번호 목록을 포함한다", () => {
    const draft = buildT0Email(baseSummary(), { company: "테스트회사", name: "홍길동" }, links);
    expect(draft.body).toContain("테스트회사 홍길동님, 안녕하세요. CoreDXI입니다.");
    expect(draft.body).toContain("  1. 제안서·견적서 자동 초안 생성");
  });

  it("결과 재열람 링크를 포함한다", () => {
    const draft = buildT0Email(baseSummary(), { company: "테스트회사", name: "홍길동" }, links);
    expect(draft.body).toContain("결과 다시 보기: https://www.coredxi.com/ax-check/result/tok123");
  });

  it("brochureUrl이 있으면 소개서 링크 줄을 포함한다", () => {
    const draft = buildT0Email(baseSummary(), { company: "테스트회사", name: "홍길동" }, {
      ...links,
      brochureUrl: "https://www.coredxi.com/solutions",
    });
    expect(draft.body).toContain(
      "CoreDXI AX 전환 컨설팅 소개서: https://www.coredxi.com/solutions"
    );
  });

  it("brochureUrl이 없으면 소개서 줄이 통째로 빠진다", () => {
    const draft = buildT0Email(baseSummary(), { company: "테스트회사", name: "홍길동" }, links);
    expect(draft.body).not.toContain("소개서");
  });

  it("서명 블록을 포함한다", () => {
    const draft = buildT0Email(baseSummary(), { company: "테스트회사", name: "홍길동" }, links);
    expect(draft.body).toContain(SALES_SIGNATURE.company);
  });
});
```

이 테스트가 참조하는 `buildT0Email` import를 파일 상단에 추가한다:
```ts
import { buildCustomerEmailDraft, buildT0Email } from "./email-draft";
```
(기존 `import { buildCustomerEmailDraft } from "./email-draft";`를 위 줄로 교체)

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run src/lib/ax-check/email-draft.test.ts
```
Expected: FAIL — `buildT0Email` is not exported, `mode` 옵션 관련 assertion 실패.

- [ ] **Step 3: `email-draft.ts` 구현**

전체 파일을 아래로 교체한다.

```ts
/**
 * email-draft.ts — AX 체크 고객용 이메일 초안 생성 (순수 함수, DB 저장 없음)
 *
 * buildCustomerEmailDraft: T1(상세 진단) 본문. mode:"manual"(기본)은 관리자 미리보기용 —
 * 사람이 통화에서 들은 내용을 채워 넣을 편집 슬롯([[ ]])을 남긴다. mode:"auto"는
 * 자동 발송(followup.ts)이 실제로 쓰는 버전 — 편집 슬롯을 제거하고 안 1 여는 말/맺는 말을 쓴다.
 * buildT0Email: T0(제출 즉시 요약) 본문 — 항상 자동 발송 전용, mode 구분 없음.
 *
 * 저장된 응답(answers·summary)으로부터 매 조회/발송 시점에 초안을 새로 만든다.
 * catalog.ts(FOLLOWUP_COPY)를 개선하면 아직 발송 전인 리드의 메일도 자동으로 좋아진다.
 *
 * 설계: docs/superpowers/specs/2026-09-02-ax-check-auto-followup-design.md 8번
 */

import {
  FOLLOWUP_COPY,
  getOptionLabel,
  getQuestionById,
  renderSignatureBlock,
} from "./catalog";
import type { AxCheckAnswers, AxCheckPriority, AxCheckSummary } from "./summarize";

export type AxCheckEmailDraft = {
  subject: string;
  body: string;
};

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

export function buildCustomerEmailDraft(
  answers: AxCheckAnswers,
  summary: AxCheckSummary,
  contact: { company: string; name: string },
  opts?: { mode?: "manual" | "auto" }
): AxCheckEmailDraft {
  const mode = opts?.mode ?? "manual";
  const { company, name } = contact;
  const industryLabel = getOptionLabel(getQuestionById("q1"), answers.q1);
  const priorityLines = summary.priorities.flatMap((p, i) => formatPriorityBlock(p, i));
  const count = summary.priorities.length;

  if (mode === "auto") {
    const body = [
      FOLLOWUP_COPY.t1.greeting(company, name),
      "",
      FOLLOWUP_COPY.t1.introLine(industryLabel, count),
      FOLLOWUP_COPY.t1.introLine2,
      "",
      ...priorityLines,
      FOLLOWUP_COPY.t1.processParagraph,
      "",
      FOLLOWUP_COPY.t1.callToAction(company),
      "",
      FOLLOWUP_COPY.optOutNotice,
      "",
      renderSignatureBlock(),
    ].join("\n");

    return { subject: FOLLOWUP_COPY.t1.subject(company, count), body };
  }

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
    renderSignatureBlock(),
  ].join("\n");

  return {
    subject: `[CoreDXI] ${company} AX 체크 결과 — 귀사의 우선 과제 ${count}가지`,
    body,
  };
}

export function buildT0Email(
  summary: { priorities: AxCheckPriority[] },
  contact: { company: string; name: string },
  links: { resultUrl: string; brochureUrl?: string }
): AxCheckEmailDraft {
  const { company, name } = contact;
  const count = summary.priorities.length;
  const priorityLines = summary.priorities.map((p, i) => `  ${i + 1}. ${p.title}`);

  const bodyLines: string[] = [
    FOLLOWUP_COPY.t0.greeting(company, name),
    "",
    FOLLOWUP_COPY.t0.introLine1(company, count),
    FOLLOWUP_COPY.t0.introLine2,
    "",
    ...priorityLines,
    "",
    `결과 다시 보기: ${links.resultUrl}`,
  ];

  if (links.brochureUrl) {
    bodyLines.push(`CoreDXI AX 전환 컨설팅 소개서: ${links.brochureUrl}`);
  }

  bodyLines.push(
    "",
    FOLLOWUP_COPY.t0.followupNotice,
    "",
    FOLLOWUP_COPY.optOutNotice,
    "",
    renderSignatureBlock()
  );

  return {
    subject: FOLLOWUP_COPY.t0.subject(company, count),
    body: bodyLines.join("\n"),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/ax-check/email-draft.test.ts
```
Expected: 전체 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/ax-check/email-draft.ts src/lib/ax-check/email-draft.test.ts
git commit -m "feat: 이메일 초안에 mode(auto/manual) 추가, T0 요약 메일 생성 함수 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `normalizeLegacyPriorities` 공유화 + 발송 파이프라인 (`followup.ts`)

**Files:**
- Modify: `src/lib/ax-check/summarize.ts` (함수 이동)
- Modify: `src/actions/ax-check.ts:50-71` (로컬 정의 제거, import로 교체)
- Create: `src/lib/ax-check/followup.ts`
- Test: `src/lib/ax-check/followup.test.ts`
- Modify: `.env.example` (신규 env 4종 문서화)

**Interfaces:**
- Consumes: `sendResendEmail` (`@/lib/resend`), `SALES_SIGNATURE` (catalog.ts), `buildCustomerEmailDraft` (Task 5), `AxCheckAnswers`/`AxCheckPriority` (summarize.ts)
- Produces (Task 7·8·9가 사용):
  - `normalizeLegacyPriorities(raw: unknown): AxCheckPriority[]` (`summarize.ts`에서 export)
  - `isFollowupEnabled(): boolean`
  - `sendFollowupEmail(id: string, opts?: { force?: boolean }): Promise<{ success: true } | { success: false; error: string }>`
  - `processDueFollowups(opts?: { now?: Date; limit?: number }): Promise<{ processed: number; sent: number; failed: number; skipped: number }>`
  - `CLAIM_LOST_ERROR: string` (내부 선점 실패 구분용 에러 문자열, 테스트·`processDueFollowups`가 참조)

- [ ] **Step 1: `normalizeLegacyPriorities`를 `summarize.ts`로 이동**

`src/actions/ax-check.ts`에서 55-71줄(함수 정의 전체, 위 주석 포함)을 **삭제**하고, `src/lib/ax-check/summarize.ts` 파일 끝에 아래를 **추가**한다(타입 참조를 `AxCheckLeadRecord["priorities"]`가 아닌 로컬 `AxCheckPriority`로 바꿔 순환 참조를 피한다):

```ts
/**
 * 구버전(roadmap 도입 전, ~2026-08-30) 응답 호환 처리 — 당시 summary.priorities는
 * { title, why, firstStep, expectedEffect } 형태였다. 새 필드가 없으면 최소한으로
 * 채워 넣어 화면·이메일 초안·팔로업 발송이 크래시 없이 동작하도록 한다.
 */
export function normalizeLegacyPriorities(raw: unknown): AxCheckPriority[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const p = item as Partial<AxCheckPriority> & { firstStep?: string };
    if (Array.isArray(p.roadmap) && p.roadmap.length === 3) {
      return p as AxCheckPriority;
    }
    return {
      title: p.title ?? "",
      why: p.why ?? "",
      echo: p.echo ?? "",
      industryExample: p.industryExample ?? null,
      roadmap: [p.firstStep ?? "—", "—", "—"] as const,
      expectedEffect: p.expectedEffect ?? "",
    };
  });
}
```

`src/actions/ax-check.ts` 상단 import에 추가(기존 `import { summarizeAxCheck } from "@/lib/ax-check/summarize";`를 아래로 교체):
```ts
import { normalizeLegacyPriorities, summarizeAxCheck } from "@/lib/ax-check/summarize";
```

- [ ] **Step 2: 기존 `ax-check.test.ts`가 여전히 통과하는지 확인(리팩터만 했으므로 동작 변화 없음)**

```bash
npx vitest run src/actions/ax-check.test.ts
```
Expected: 전체 PASS(이 함수를 직접 테스트하는 케이스는 `getAxCheckResultByToken`을 통해 간접 검증됨 — 이미 존재).

- [ ] **Step 3: `.env.example`에 신규 환경변수 4종 추가**

`.env.example` 파일 끝(83번째 줄 `# SALES_NOTIFY_EMAIL=` 다음)에 추가:

```env

# 팔로업(T0/T1) 자동 발송 크론 인증 — Vercel Cron이 Authorization: Bearer 헤더로 보낸다
# 랜덤 32자 이상 문자열 (예: openssl rand -hex 32)
CRON_SECRET=

# (선택) T0·T1 메일의 reply-to 주소. 미설정 시 SALES_SIGNATURE.email로 폴백
# SALES_REPLY_TO=obaamg1017@coredxi.com

# (선택) T0 메일에 넣을 AX 전환 컨설팅 소개서 링크. 미설정 시 소개서 줄이 통째로 빠진다
# AX_CHECK_BROCHURE_URL=

# (선택) 자동 발송 킬 스위치. false로 설정하면 신규 리드는 HELD로 저장되고
# T0도 보내지 않으며, 크론은 즉시 no-op으로 종료된다(8/30 수동 모드로 즉시 복귀).
# 기본값(미설정)은 true와 동일.
# AX_CHECK_FOLLOWUP_ENABLED=
```

- [ ] **Step 4: 실패하는 테스트 작성 — `followup.test.ts`**

`src/lib/ax-check/followup.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendResendEmailMock = vi.fn();
vi.mock("@/lib/resend", () => ({
  sendResendEmail: (...args: unknown[]) => sendResendEmailMock(...args),
}));

const captureExceptionMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

const prismaMock = {
  axCheckResponse: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { CLAIM_LOST_ERROR, isFollowupEnabled, processDueFollowups, sendFollowupEmail } =
  await import("./followup");

function baseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    company: "테스트회사",
    name: "홍길동",
    email: "user@example.com",
    answers: {
      q1: "network",
      q2: "10_to_30",
      q3: ["quote"],
      q4: "personal",
      q5: "files",
      q6: "speed",
      q7: "within_3_months",
      q8: "self_decide",
    },
    catalogVersion: "v2",
    grade: "HOT",
    score: 320,
    summary: {
      priorities: [
        {
          title: "제안서·견적서 자동 초안 생성",
          why: "이유",
          echo: "echo",
          industryExample: null,
          roadmap: ["1주차", "1개월차", "3개월차"],
          expectedEffect: "효과",
        },
      ],
    },
    followupSubject: null,
    followupBody: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.AX_CHECK_FOLLOWUP_ENABLED;
  sendResendEmailMock.mockResolvedValue({ success: true });
});

describe("isFollowupEnabled", () => {
  it("환경변수가 없으면 true", () => {
    expect(isFollowupEnabled()).toBe(true);
  });

  it("AX_CHECK_FOLLOWUP_ENABLED=false면 false", () => {
    process.env.AX_CHECK_FOLLOWUP_ENABLED = "false";
    expect(isFollowupEnabled()).toBe(false);
  });
});

describe("sendFollowupEmail", () => {
  it("선점(claim)에 실패하면 발송하지 않는다", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 0 });

    const result = await sendFollowupEmail("lead-1");

    expect(result).toEqual({ success: false, error: CLAIM_LOST_ERROR });
    expect(sendResendEmailMock).not.toHaveBeenCalled();
  });

  it("followupSubject/Body(override)가 있으면 그대로 발송한다", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue(
      baseRecord({ followupSubject: "관리자 수정 제목", followupBody: "관리자 수정 본문" })
    );
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    await sendFollowupEmail("lead-1");

    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "관리자 수정 제목", text: "관리자 수정 본문" })
    );
  });

  it("override가 없으면 mode:auto로 생성한 초안에는 플레이스홀더가 없다", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue(baseRecord());
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    await sendFollowupEmail("lead-1");

    const call = sendResendEmailMock.mock.calls[0]![0];
    expect(call.text).not.toMatch(/\[\[.*\]\]/);
    expect(call.to).toBe("user@example.com");
  });

  it("성공하면 SENT로 갱신한다", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue(baseRecord());
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    const result = await sendFollowupEmail("lead-1");

    expect(result).toEqual({ success: true });
    expect(prismaMock.axCheckResponse.update).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: expect.objectContaining({ followupStatus: "SENT", followupError: null }),
    });
  });

  it("발송 실패 시 FAILED + attempts 증가 + Sentry 캡처", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue(baseRecord());
    prismaMock.axCheckResponse.update.mockResolvedValue({});
    sendResendEmailMock.mockResolvedValue({ success: false, error: "resend down" });

    const result = await sendFollowupEmail("lead-1");

    expect(result).toEqual({ success: false, error: "resend down" });
    expect(prismaMock.axCheckResponse.update).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: {
        followupStatus: "FAILED",
        followupError: "resend down",
        followupAttempts: { increment: 1 },
      },
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { feature: "ax-check-followup" } })
    );
  });

  it("force:true면 SENT 상태여도 다시 선점한다", async () => {
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue(baseRecord());
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    await sendFollowupEmail("lead-1", { force: true });

    expect(prismaMock.axCheckResponse.updateMany).toHaveBeenCalledWith({
      where: { id: "lead-1", followupStatus: { in: ["SCHEDULED", "HELD", "SENT", "FAILED", "SKIPPED"] } },
      data: { followupStatus: "SENDING" },
    });
  });
});

describe("processDueFollowups", () => {
  it("킬 스위치가 꺼져 있으면 조회 없이 즉시 반환한다", async () => {
    process.env.AX_CHECK_FOLLOWUP_ENABLED = "false";

    const result = await processDueFollowups();

    expect(result).toEqual({ processed: 0, sent: 0, failed: 0, skipped: 0 });
    expect(prismaMock.axCheckResponse.findMany).not.toHaveBeenCalled();
  });

  it("SCHEDULED·FAILED(3회 미만)만 대상으로 조회한다", async () => {
    prismaMock.axCheckResponse.findMany.mockResolvedValue([]);

    await processDueFollowups({ now: new Date("2026-09-04T00:30:00Z") });

    expect(prismaMock.axCheckResponse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { followupStatus: "SCHEDULED", followupScheduledAt: { lte: new Date("2026-09-04T00:30:00Z") } },
            {
              followupStatus: "FAILED",
              followupScheduledAt: { lte: new Date("2026-09-04T00:30:00Z") },
              followupAttempts: { lt: 3 },
            },
          ],
        },
      })
    );
  });

  it("대상 건을 처리해 sent/failed/processed 카운트를 반환한다", async () => {
    prismaMock.axCheckResponse.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.axCheckResponse.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        baseRecord({
          id: where.id,
          followupSubject: "제목",
          followupBody: "본문",
        })
      )
    );
    prismaMock.axCheckResponse.update.mockResolvedValue({});
    sendResendEmailMock.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({
      success: false,
      error: "boom",
    });

    const result = await processDueFollowups();

    expect(result).toEqual({ processed: 2, sent: 1, failed: 1, skipped: 0 });
  });

  it("선점에 실패한 건은 skipped로 집계한다", async () => {
    prismaMock.axCheckResponse.findMany.mockResolvedValue([{ id: "a" }]);
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 0 });

    const result = await processDueFollowups();

    expect(result).toEqual({ processed: 1, sent: 0, failed: 0, skipped: 1 });
  });
});
```

- [ ] **Step 5: 테스트 실패 확인**

```bash
npx vitest run src/lib/ax-check/followup.test.ts
```
Expected: FAIL — `Cannot find module './followup'`.

- [ ] **Step 6: `followup.ts` 구현**

`src/lib/ax-check/followup.ts`:

```ts
/**
 * followup.ts — AX 체크 T1(상세 진단) 자동 발송 파이프라인
 *
 * 크론(GET /api/cron/ax-check-followup)과 관리자 "지금 보내기" 버튼이 모두
 * sendFollowupEmail을 호출한다 — 발송 로직은 이 파일 한 곳에만 둔다(설계 6번).
 *
 * 설계: docs/superpowers/specs/2026-09-02-ax-check-auto-followup-design.md 6번
 */

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { SALES_SIGNATURE } from "./catalog";
import { buildCustomerEmailDraft } from "./email-draft";
import { normalizeLegacyPriorities } from "./summarize";
import type { AxCheckAnswers } from "./summarize";

/**
 * 선점(claim) 실패 — 이미 SENDING이거나 대상 상태가 아님 — 시 반환되는 에러 메시지.
 * processDueFollowups가 이 문자열로 "발송 실패"와 "선점 못 함(skipped)"을 구분한다.
 */
export const CLAIM_LOST_ERROR = "이미 처리 중이거나 발송 가능한 상태가 아닙니다.";

const NORMAL_CLAIM_STATUSES = ["SCHEDULED", "FAILED"] as const;
const FORCE_CLAIM_STATUSES = ["SCHEDULED", "HELD", "SENT", "FAILED", "SKIPPED"] as const;
const MAX_ATTEMPTS = 3;

/** AX_CHECK_FOLLOWUP_ENABLED=false가 아니면 true(기본 활성). */
export function isFollowupEnabled(): boolean {
  return process.env.AX_CHECK_FOLLOWUP_ENABLED !== "false";
}

export async function sendFollowupEmail(
  id: string,
  opts?: { force?: boolean }
): Promise<{ success: true } | { success: false; error: string }> {
  const claimStatuses = opts?.force ? FORCE_CLAIM_STATUSES : NORMAL_CLAIM_STATUSES;

  const claim = await prisma.axCheckResponse.updateMany({
    where: { id, followupStatus: { in: [...claimStatuses] } },
    data: { followupStatus: "SENDING" },
  });

  if (claim.count !== 1) {
    return { success: false, error: CLAIM_LOST_ERROR };
  }

  const record = await prisma.axCheckResponse.findUnique({ where: { id } });
  if (!record) {
    return { success: false, error: "리드를 찾을 수 없습니다." };
  }

  let subject = record.followupSubject;
  let body = record.followupBody;

  if (!subject || !body) {
    const summary = record.summary as unknown as { priorities: unknown };
    const draft = buildCustomerEmailDraft(
      record.answers as AxCheckAnswers,
      {
        priorities: normalizeLegacyPriorities(summary.priorities),
        grade: record.grade,
        score: record.score,
        catalogVersion: record.catalogVersion,
      },
      { company: record.company, name: record.name },
      { mode: "auto" }
    );
    subject = subject ?? draft.subject;
    body = body ?? draft.body;
  }

  const result = await sendResendEmail({
    to: record.email,
    subject,
    text: body,
    replyTo: process.env.SALES_REPLY_TO ?? SALES_SIGNATURE.email,
  });

  if (result.success) {
    await prisma.axCheckResponse.update({
      where: { id },
      data: { followupStatus: "SENT", followupSentAt: new Date(), followupError: null },
    });
    return { success: true };
  }

  await prisma.axCheckResponse.update({
    where: { id },
    data: {
      followupStatus: "FAILED",
      followupError: result.error,
      followupAttempts: { increment: 1 },
    },
  });
  Sentry.captureException(new Error(`ax-check followup send failed: ${result.error}`), {
    tags: { feature: "ax-check-followup" },
    extra: { id },
  });
  return { success: false, error: result.error };
}

export async function processDueFollowups(
  opts: { now?: Date; limit?: number } = {}
): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  if (!isFollowupEnabled()) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 50;

  const due = await prisma.axCheckResponse.findMany({
    where: {
      OR: [
        { followupStatus: "SCHEDULED", followupScheduledAt: { lte: now } },
        {
          followupStatus: "FAILED",
          followupScheduledAt: { lte: now },
          followupAttempts: { lt: MAX_ATTEMPTS },
        },
      ],
    },
    orderBy: { followupScheduledAt: "asc" },
    take: limit,
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const { id } of due) {
    const result = await sendFollowupEmail(id);
    if (result.success) {
      sent += 1;
    } else if (result.error === CLAIM_LOST_ERROR) {
      skipped += 1;
    } else {
      failed += 1;
    }
  }

  return { processed: due.length, sent, failed, skipped };
}
```

- [ ] **Step 7: 테스트 통과 확인**

```bash
npx vitest run src/lib/ax-check/followup.test.ts src/lib/ax-check/summarize.test.ts src/actions/ax-check.test.ts
```
Expected: 전체 PASS.

- [ ] **Step 8: 타입체크**

```bash
npx tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 9: 커밋**

```bash
git add src/lib/ax-check/summarize.ts src/actions/ax-check.ts src/lib/ax-check/followup.ts src/lib/ax-check/followup.test.ts .env.example
git commit -m "feat: AX 체크 팔로업(T1) 자동 발송 파이프라인 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `submitAxCheck` 개편 — T0 발송·스케줄링·알림 메일 개편

**Files:**
- Modify: `src/actions/ax-check.ts` (`submitAxCheck` 함수 전체 교체)
- Modify: `src/actions/ax-check.test.ts` (happy-path 블록 교체 + 신규 케이스 추가)
- Modify: `src/lib/ax-check/types.ts` (팔로업 서버 액션 공용 결과 타입 추가 — Task 8에서 사용)

**Interfaces:**
- Consumes: `computeFollowupScheduledAt`, `formatKstFollowupSchedule` (Task 3), `buildT0Email` (Task 5), `isFollowupEnabled` (Task 6), `getOptionLabel`/`getQuestionById` (기존 catalog.ts)
- Produces: `submitAxCheck` 동작 변경(아래), `UpdateAxCheckFollowupResult` 타입(Task 8이 사용)

- [ ] **Step 1: `types.ts`에 공용 결과 타입 추가**

`src/lib/ax-check/types.ts`의 `DeleteAxCheckResult` 타입 정의 바로 아래에 추가:

```ts
export type UpdateAxCheckFollowupResult =
  | { success: true }
  | { success: false; error: string };
```

- [ ] **Step 2: 실패하는 테스트로 교체 — `ax-check.test.ts`**

파일 상단 mock 섹션에 두 개 추가(`vi.mock("@/lib/ax-check/result-token", ...)` 바로 아래):

```ts
vi.mock("@/lib/ax-check/business-days", () => ({
  computeFollowupScheduledAt: () => new Date("2026-09-04T00:30:00.000Z"),
  formatKstFollowupSchedule: () => "2026-09-04(금) 09:30",
}));

const isFollowupEnabledMock = vi.fn();
vi.mock("@/lib/ax-check/followup", () => ({
  isFollowupEnabled: () => isFollowupEnabledMock(),
}));
```

`beforeEach` 블록에 한 줄 추가:
```ts
beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({ allowed: true });
  sendResendEmailMock.mockResolvedValue({ success: true });
  getContactNotificationEmailMock.mockResolvedValue("contact@coredxi.com");
  subscribeNewsletterMock.mockResolvedValue({ success: true });
  prismaMock.axCheckResponse.create.mockResolvedValue({ id: "lead-1" });
  isFollowupEnabledMock.mockReturnValue(true); // 추가
  delete process.env.SALES_NOTIFY_EMAIL;
});
```
(`prismaMock.axCheckResponse.create.mockResolvedValue({})`를 `{ id: "lead-1" }`로 변경 — `submitAxCheck`가 이제 생성된 `id`로 T0·알림 메일의 관리 링크를 만들기 때문)

`describe("submitAxCheck happy path", ...)` 블록 전체를 아래로 교체:

```ts
describe("submitAxCheck happy path", () => {
  it("응답을 저장하고 followupScheduledAt·followupStatus(SCHEDULED)를 계산해 저장한다", async () => {
    const result = await submitAxCheck(validInput());

    expect(result.success).toBe(true);
    expect(prismaMock.axCheckResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          followupStatus: "SCHEDULED",
          followupScheduledAt: new Date("2026-09-04T00:30:00.000Z"),
        }),
      })
    );
  });

  it("킬 스위치가 꺼져 있으면 followupStatus를 HELD로 저장하고 T0을 보내지 않는다", async () => {
    isFollowupEnabledMock.mockReturnValue(false);

    await submitAxCheck(validInput());

    expect(prismaMock.axCheckResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ followupStatus: "HELD" }),
      })
    );
    // T0 미발송 + 영업이사 알림만 발송 → sendResendEmail 1회
    expect(sendResendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "contact@coredxi.com" })
    );
  });

  it("고객에게 T0 요약 메일을 즉시 발송한다", async () => {
    await submitAxCheck(validInput());

    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" })
    );
  });

  it("영업이사 알림 메일에는 통화 포인트·예정 시각·관리 링크가 있고 초안 전문은 없다", async () => {
    await submitAxCheck(validInput());

    const salesCall = sendResendEmailMock.mock.calls.find(
      (call) => call[0].to === "contact@coredxi.com"
    );
    expect(salesCall).toBeDefined();
    const text = salesCall![0].text as string;
    expect(text).toContain("통화 포인트");
    expect(text).toContain("상세 진단 메일 예정: 2026-09-04(금) 09:30");
    expect(text).toContain("/admin/leads?lead=lead-1");
    expect(text).not.toContain("고객용 이메일 초안");
  });

  it("HOT 등급이면 알림 메일 제목에 [HOT]이 붙는다", async () => {
    await submitAxCheck(
      validInput({
        answers: validAnswers({ q7: "within_3_months", q8: "self_decide", q3: ["quote", "bidding"] }),
      })
    );

    const salesCall = sendResendEmailMock.mock.calls.find(
      (call) => call[0].to === "contact@coredxi.com"
    );
    expect(salesCall![0].subject).toContain("[HOT]");
  });

  it("uses SALES_NOTIFY_EMAIL over the contact settings fallback when set", async () => {
    process.env.SALES_NOTIFY_EMAIL = "sales@coredxi.com";

    await submitAxCheck(validInput());

    expect(sendResendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "sales@coredxi.com" })
    );
    expect(getContactNotificationEmailMock).not.toHaveBeenCalled();
  });

  it("subscribes to the newsletter when marketingOptIn is true", async () => {
    await submitAxCheck(validInput({ marketingOptIn: true }));

    expect(subscribeNewsletterMock).toHaveBeenCalledWith("user@example.com", "ax-check");
  });

  it("T0 발송이 실패해도 제출 자체는 성공한다", async () => {
    sendResendEmailMock.mockResolvedValue({ success: false, error: "boom" });

    const result = await submitAxCheck(validInput());

    expect(result.success).toBe(true);
  });

  it("surfaces an error when the DB write fails", async () => {
    prismaMock.axCheckResponse.create.mockRejectedValue(new Error("db down"));

    const result = await submitAxCheck(validInput());

    expect(result).toEqual({
      success: false,
      error: "제출 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    });
    expect(sendResendEmailMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
npx vitest run src/actions/ax-check.test.ts
```
Expected: FAIL — 모듈을 찾을 수 없음(`business-days`, `followup`) 및 새 assertion들이 기존 구현과 불일치.

- [ ] **Step 4: `submitAxCheck` 구현 교체**

`src/actions/ax-check.ts` 상단 import 블록을 아래와 같이 수정한다.

기존 `import { buildCustomerEmailDraft } from "@/lib/ax-check/email-draft";` 줄을 아래로 교체한다(이 파일은 이제 T0 메일만 직접 만들고, `buildCustomerEmailDraft`는 더 이상 이 파일에서 호출하지 않으므로 — 관리자 미리보기는 `EmailDraftPanel.tsx`가 `email-draft.ts`에서 직접 import한다 — 그대로 두면 미사용 import로 lint 에러가 난다):

```ts
import { buildT0Email } from "@/lib/ax-check/email-draft";
```

기존 `import { AX_CHECK_QUESTIONS, Q3_MAX_SELECT, type AxCheckQuestion } from "@/lib/ax-check/catalog";` 줄을 아래로 교체한다(같은 모듈을 두 줄로 나눠 import하지 않도록 합친다):

```ts
import {
  AX_CHECK_QUESTIONS,
  Q3_MAX_SELECT,
  getOptionLabel,
  getQuestionById,
  type AxCheckQuestion,
} from "@/lib/ax-check/catalog";
```

`import { generateAxCheckResultToken } from "@/lib/ax-check/result-token";` 바로 아래에 두 줄을 추가한다:

```ts
import { computeFollowupScheduledAt, formatKstFollowupSchedule } from "@/lib/ax-check/business-days";
import { isFollowupEnabled } from "@/lib/ax-check/followup";
```

`submitAxCheck` 함수 본문 중 `try { await prisma.axCheckResponse.create(...) } catch` 블록부터 함수 끝까지를 아래로 교체한다.

```ts
  const followupEnabled = isFollowupEnabled();
  const followupScheduledAt = computeFollowupScheduledAt(new Date());

  let createdId: string;
  try {
    const created = await prisma.axCheckResponse.create({
      data: {
        refCode,
        company,
        name,
        email,
        phone: phone || null,
        answers: input.answers,
        catalogVersion,
        grade,
        score,
        summary: { priorities },
        marketingOptIn: input.marketingOptIn,
        resultToken,
        followupStatus: followupEnabled ? "SCHEDULED" : "HELD",
        followupScheduledAt,
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch (e) {
    console.error("[submitAxCheck]", e);
    return { success: false, error: "제출 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  if (input.marketingOptIn) {
    const subscribeResult = await subscribeNewsletter(email, "ax-check");
    if (!subscribeResult.success) {
      // 뉴스레터 연동 실패가 AX 체크 제출 성공을 막지 않는다(contact.ts와 동일 원칙).
      console.error("[submitAxCheck] newsletter opt-in failed:", subscribeResult.error);
    }
  }

  const siteUrl = process.env.NEXTAUTH_URL ?? "https://www.coredxi.com";
  const resultUrl = `${siteUrl}/ax-check/result/${resultToken}`;

  // T0 — 제출 즉시 결과 요약 메일. 킬 스위치가 꺼져 있으면 보내지 않는다(완전한 8/30 수동 모드).
  if (followupEnabled) {
    const t0Draft = buildT0Email(
      { priorities },
      { company, name },
      { resultUrl, brochureUrl: process.env.AX_CHECK_BROCHURE_URL || undefined }
    );
    const t0Result = await sendResendEmail({
      to: email,
      subject: t0Draft.subject,
      text: t0Draft.body,
      replyTo: process.env.SALES_REPLY_TO ?? undefined,
    });
    if (t0Result.success) {
      await prisma.axCheckResponse.update({
        where: { id: createdId },
        data: { t0SentAt: new Date() },
      });
    } else {
      console.error("[submitAxCheck] T0 email failed:", t0Result.error);
    }
  }

  // 영업이사 알림 메일 — 통화 포인트 3줄 + 예정 발송 시각 + 관리 링크. 초안 전문은 동봉하지 않는다.
  const salesNotifyEmail =
    process.env.SALES_NOTIFY_EMAIL?.trim() || (await getContactNotificationEmail());
  if (salesNotifyEmail) {
    const q3Labels = input.answers.q3
      .slice(0, 2)
      .map((v) => getOptionLabel(getQuestionById("q3"), v));
    const q7Label = getOptionLabel(getQuestionById("q7"), input.answers.q7);
    const q8Label = getOptionLabel(getQuestionById("q8"), input.answers.q8);
    const adminLink = `${siteUrl}/admin/leads?lead=${createdId}`;
    const subjectPrefix = grade === "HOT" ? "[CoreDXI][HOT]" : "[CoreDXI]";

    const salesMailResult = await sendResendEmail({
      to: salesNotifyEmail,
      subject: `${subjectPrefix} 새 AX 체크 리드 - ${grade} - ${company}`,
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
        "통화 포인트",
        `- 가장 시간이 드는 업무: ${q3Labels.join(", ")}`,
        `- 검토 시점: ${q7Label}`,
        `- 의사결정 구조: ${q8Label}`,
        "",
        followupEnabled
          ? `상세 진단 메일 예정: ${formatKstFollowupSchedule(followupScheduledAt)}`
          : "상세 진단 메일: 자동 발송 꺼짐(HELD) — 관리자 페이지에서 직접 처리해 주세요.",
        `보류·수정·지금 보내기: ${adminLink}`,
        `결과 재열람 링크: ${resultUrl}`,
      ].join("\n"),
      replyTo: email,
    });
    if (!salesMailResult.success) {
      console.error("[submitAxCheck] sales notify email failed:", salesMailResult.error);
    }
  }

  return { success: true, priorities, resultToken };
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run src/actions/ax-check.test.ts
```
Expected: 전체 PASS.

- [ ] **Step 6: 타입체크 + 린트**

```bash
npx tsc --noEmit
npx eslint src/actions/ax-check.ts src/lib/ax-check/types.ts
```
Expected: 에러 없음.

- [ ] **Step 7: 커밋**

```bash
git add src/actions/ax-check.ts src/actions/ax-check.test.ts src/lib/ax-check/types.ts
git commit -m "feat: 제출 시 T0 즉시 발송·팔로업 스케줄링, 영업이사 알림 메일 개편

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: 관리자 팔로업 서버 액션 5개

**Files:**
- Modify: `src/actions/ax-check.ts` (파일 끝에 5개 함수 추가)
- Modify: `src/actions/ax-check.test.ts` (새 `describe` 블록 추가)

**Interfaces:**
- Consumes: `sendFollowupEmail` (Task 6), `requireAdmin`/`revalidatePath` (기존), `UpdateAxCheckFollowupResult` (Task 7)
- Produces (Task 9가 사용): `holdAxCheckFollowup(id)`, `resumeAxCheckFollowup(id)`, `sendAxCheckFollowupNow(id)`, `updateAxCheckFollowupDraft(id, subject, body)`, `resetAxCheckFollowupDraft(id)` — 모두 `Promise<UpdateAxCheckFollowupResult>`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/actions/ax-check.test.ts` 상단 mock 섹션에 `followup.ts` mock을 확장한다(Step 2에서 추가한 `vi.mock("@/lib/ax-check/followup", ...)`를 아래로 교체):

```ts
const isFollowupEnabledMock = vi.fn();
const sendFollowupEmailMock = vi.fn();
vi.mock("@/lib/ax-check/followup", () => ({
  isFollowupEnabled: () => isFollowupEnabledMock(),
  sendFollowupEmail: (...args: unknown[]) => sendFollowupEmailMock(...args),
}));
```

import 목록에 신규 함수 추가:
```ts
const {
  submitAxCheck,
  getAxCheckResultByToken,
  listAxCheckResponses,
  updateAxCheckStatus,
  updateAxCheckNote,
  deleteAxCheckResponse,
  holdAxCheckFollowup,
  resumeAxCheckFollowup,
  sendAxCheckFollowupNow,
  updateAxCheckFollowupDraft,
  resetAxCheckFollowupDraft,
} = await import("./ax-check");
```

파일 맨 끝(`describe("admin-gated actions", ...)` 블록 뒤)에 추가:

```ts

describe("admin followup actions", () => {
  beforeEach(() => {
    prismaMock.axCheckResponse.updateMany = vi.fn();
    prismaMock.axCheckResponse.findUnique = vi.fn();
  });

  it("holdAxCheckFollowup은 관리자 로그인을 요구한다", async () => {
    authMock.mockResolvedValue(null);

    const result = await holdAxCheckFollowup("id-1");

    expect(result).toEqual({ success: false, error: "관리자 로그인이 필요합니다." });
  });

  it("holdAxCheckFollowup은 SCHEDULED/FAILED 상태에서만 HELD로 전이한다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 1 });

    const result = await holdAxCheckFollowup("id-1");

    expect(result).toEqual({ success: true });
    expect(prismaMock.axCheckResponse.updateMany).toHaveBeenCalledWith({
      where: { id: "id-1", followupStatus: { in: ["SCHEDULED", "FAILED"] } },
      data: { followupStatus: "HELD" },
    });
  });

  it("holdAxCheckFollowup은 대상 상태가 아니면 에러를 반환한다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.updateMany.mockResolvedValue({ count: 0 });

    const result = await holdAxCheckFollowup("id-1");

    expect(result).toEqual({ success: false, error: "보류할 수 있는 상태가 아닙니다." });
  });

  it("resumeAxCheckFollowup은 HELD가 아니면 에러를 반환한다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue({
      followupStatus: "SCHEDULED",
      followupScheduledAt: new Date(),
    });

    const result = await resumeAxCheckFollowup("id-1");

    expect(result).toEqual({ success: false, error: "보류 상태가 아닙니다." });
  });

  it("resumeAxCheckFollowup은 HELD를 SCHEDULED로 되돌린다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue({
      followupStatus: "HELD",
      followupScheduledAt: new Date("2099-01-01T00:00:00Z"),
    });
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    const result = await resumeAxCheckFollowup("id-1");

    expect(result).toEqual({ success: true });
    expect(prismaMock.axCheckResponse.update).toHaveBeenCalledWith({
      where: { id: "id-1" },
      data: { followupStatus: "SCHEDULED", followupScheduledAt: new Date("2099-01-01T00:00:00Z") },
    });
  });

  it("resumeAxCheckFollowup은 예정 시각이 이미 지났으면 지금으로 당긴다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.findUnique.mockResolvedValue({
      followupStatus: "HELD",
      followupScheduledAt: new Date("2020-01-01T00:00:00Z"),
    });
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    await resumeAxCheckFollowup("id-1");

    const call = prismaMock.axCheckResponse.update.mock.calls[0]![0];
    expect(call.data.followupScheduledAt.getTime()).toBeGreaterThan(
      new Date("2020-01-01T00:00:00Z").getTime()
    );
  });

  it("sendAxCheckFollowupNow는 관리자 로그인을 요구한다", async () => {
    authMock.mockResolvedValue(null);

    const result = await sendAxCheckFollowupNow("id-1");

    expect(result).toEqual({ success: false, error: "관리자 로그인이 필요합니다." });
    expect(sendFollowupEmailMock).not.toHaveBeenCalled();
  });

  it("sendAxCheckFollowupNow는 force:true로 sendFollowupEmail을 호출한다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    sendFollowupEmailMock.mockResolvedValue({ success: true });

    const result = await sendAxCheckFollowupNow("id-1");

    expect(result).toEqual({ success: true });
    expect(sendFollowupEmailMock).toHaveBeenCalledWith("id-1", { force: true });
  });

  it("updateAxCheckFollowupDraft는 빈 제목/본문을 거부한다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });

    const result = await updateAxCheckFollowupDraft("id-1", "  ", "본문");

    expect(result).toEqual({ success: false, error: "제목과 본문을 모두 입력해 주세요." });
  });

  it("updateAxCheckFollowupDraft는 override를 저장한다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    const result = await updateAxCheckFollowupDraft("id-1", "새 제목", "새 본문");

    expect(result).toEqual({ success: true });
    expect(prismaMock.axCheckResponse.update).toHaveBeenCalledWith({
      where: { id: "id-1" },
      data: { followupSubject: "새 제목", followupBody: "새 본문" },
    });
  });

  it("resetAxCheckFollowupDraft는 override를 null로 되돌린다", async () => {
    authMock.mockResolvedValue({ user: { accountType: "admin", role: "EDITOR" } });
    prismaMock.axCheckResponse.update.mockResolvedValue({});

    const result = await resetAxCheckFollowupDraft("id-1");

    expect(result).toEqual({ success: true });
    expect(prismaMock.axCheckResponse.update).toHaveBeenCalledWith({
      where: { id: "id-1" },
      data: { followupSubject: null, followupBody: null },
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run src/actions/ax-check.test.ts
```
Expected: FAIL — 5개 함수가 export되지 않음.

- [ ] **Step 3: 구현 — `src/actions/ax-check.ts` 파일 끝에 추가**

```ts

export async function holdAxCheckFollowup(id: string): Promise<UpdateAxCheckFollowupResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id.trim()) return { success: false, error: "유효하지 않은 요청입니다." };

  try {
    const result = await prisma.axCheckResponse.updateMany({
      where: { id, followupStatus: { in: ["SCHEDULED", "FAILED"] } },
      data: { followupStatus: "HELD" },
    });
    if (result.count !== 1) {
      return { success: false, error: "보류할 수 있는 상태가 아닙니다." };
    }
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (e) {
    console.error("[holdAxCheckFollowup]", e);
    return { success: false, error: "보류 처리 중 오류가 발생했습니다." };
  }
}

export async function resumeAxCheckFollowup(id: string): Promise<UpdateAxCheckFollowupResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id.trim()) return { success: false, error: "유효하지 않은 요청입니다." };

  try {
    const record = await prisma.axCheckResponse.findUnique({
      where: { id },
      select: { followupStatus: true, followupScheduledAt: true },
    });
    if (!record || record.followupStatus !== "HELD") {
      return { success: false, error: "보류 상태가 아닙니다." };
    }
    const now = new Date();
    const scheduledAt =
      record.followupScheduledAt && record.followupScheduledAt > now
        ? record.followupScheduledAt
        : now;

    await prisma.axCheckResponse.update({
      where: { id },
      data: { followupStatus: "SCHEDULED", followupScheduledAt: scheduledAt },
    });
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (e) {
    console.error("[resumeAxCheckFollowup]", e);
    return { success: false, error: "보류 해제 중 오류가 발생했습니다." };
  }
}

export async function sendAxCheckFollowupNow(id: string): Promise<UpdateAxCheckFollowupResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id.trim()) return { success: false, error: "유효하지 않은 요청입니다." };

  const result = await sendFollowupEmail(id, { force: true });
  revalidatePath("/admin/leads");
  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

export async function updateAxCheckFollowupDraft(
  id: string,
  subject: string,
  body: string
): Promise<UpdateAxCheckFollowupResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (!id.trim() || !trimmedSubject || !trimmedBody) {
    return { success: false, error: "제목과 본문을 모두 입력해 주세요." };
  }

  try {
    await prisma.axCheckResponse.update({
      where: { id },
      data: { followupSubject: trimmedSubject, followupBody: trimmedBody },
    });
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (e) {
    console.error("[updateAxCheckFollowupDraft]", e);
    return { success: false, error: "저장 중 오류가 발생했습니다." };
  }
}

export async function resetAxCheckFollowupDraft(id: string): Promise<UpdateAxCheckFollowupResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id.trim()) return { success: false, error: "유효하지 않은 요청입니다." };

  try {
    await prisma.axCheckResponse.update({
      where: { id },
      data: { followupSubject: null, followupBody: null },
    });
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (e) {
    console.error("[resetAxCheckFollowupDraft]", e);
    return { success: false, error: "초기화 중 오류가 발생했습니다." };
  }
}
```

기존(Task 7에서 추가한) `import { isFollowupEnabled } from "@/lib/ax-check/followup";` 줄을 아래로 교체(중복 import 방지):
```ts
import { isFollowupEnabled, sendFollowupEmail } from "@/lib/ax-check/followup";
```

기존 `import type { ... } from "@/lib/ax-check/types";` 블록(`UpdateAxCheckNoteResult`, `UpdateAxCheckStatusResult` 등이 나열된 곳)에 `UpdateAxCheckFollowupResult`를 추가한다:
```ts
import type {
  AxCheckAnswers,
  AxCheckFormInput,
  AxCheckLeadRecord,
  AxCheckListResult,
  AxCheckResultLookupResult,
  AxCheckSubmitResult,
  DeleteAxCheckResult,
  LeadStatus,
  UpdateAxCheckFollowupResult,
  UpdateAxCheckNoteResult,
  UpdateAxCheckStatusResult,
} from "@/lib/ax-check/types";
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/actions/ax-check.test.ts
```
Expected: 전체 PASS.

- [ ] **Step 5: 타입체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 커밋**

```bash
git add src/actions/ax-check.ts src/actions/ax-check.test.ts
git commit -m "feat: 관리자 팔로업 제어 서버 액션(보류·해제·즉시발송·본문수정) 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: 크론 라우트 + `vercel.json`

**Files:**
- Create: `src/app/api/cron/ax-check-followup/route.ts`
- Test: `src/app/api/cron/ax-check-followup/route.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `processDueFollowups` (Task 6)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/app/api/cron/ax-check-followup/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const processDueFollowupsMock = vi.fn();
vi.mock("@/lib/ax-check/followup", () => ({
  processDueFollowups: (...args: unknown[]) => processDueFollowupsMock(...args),
}));

const captureMessageMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...args: unknown[]) => captureMessageMock(...args),
}));

const { GET } = await import("./route");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
  processDueFollowupsMock.mockResolvedValue({ processed: 0, sent: 0, failed: 0, skipped: 0 });
});

describe("GET /api/cron/ax-check-followup", () => {
  it("Authorization 헤더가 없으면 401을 반환한다", async () => {
    const request = new Request("http://localhost/api/cron/ax-check-followup");
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(processDueFollowupsMock).not.toHaveBeenCalled();
  });

  it("시크릿이 틀리면 401을 반환한다", async () => {
    const request = new Request("http://localhost/api/cron/ax-check-followup", {
      headers: { authorization: "Bearer wrong" },
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("CRON_SECRET이 설정되어 있지 않으면 401을 반환한다", async () => {
    delete process.env.CRON_SECRET;
    const request = new Request("http://localhost/api/cron/ax-check-followup", {
      headers: { authorization: "Bearer test-secret" },
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("유효한 요청이면 처리 결과를 JSON으로 반환한다", async () => {
    processDueFollowupsMock.mockResolvedValue({ processed: 3, sent: 2, failed: 1, skipped: 0 });
    const request = new Request("http://localhost/api/cron/ax-check-followup", {
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, processed: 3, sent: 2, failed: 1, skipped: 0 });
    expect(captureMessageMock).toHaveBeenCalledWith("ax-check followup: 1 failed", "warning");
  });

  it("실패가 없으면 Sentry를 호출하지 않는다", async () => {
    processDueFollowupsMock.mockResolvedValue({ processed: 2, sent: 2, failed: 0, skipped: 0 });
    const request = new Request("http://localhost/api/cron/ax-check-followup", {
      headers: { authorization: "Bearer test-secret" },
    });

    await GET(request);

    expect(captureMessageMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run src/app/api/cron/ax-check-followup/route.test.ts
```
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 라우트 구현**

`src/app/api/cron/ax-check-followup/route.ts`:

```ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { processDueFollowups } from "@/lib/ax-check/followup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDueFollowups();

  if (result.failed > 0) {
    Sentry.captureMessage(`ax-check followup: ${result.failed} failed`, "warning");
  }

  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/app/api/cron/ax-check-followup/route.test.ts
```
Expected: 전체 PASS.

- [ ] **Step 5: `vercel.json`에 크론 등록**

`vercel.json` 전체를 아래로 교체(기존 `redirects` 유지, `crons` 추가):

```json
{
  "redirects": [
    {
      "source": "/:path((?!ads\\.txt$).*)",
      "has": [{ "type": "host", "value": "coredxi.com" }],
      "destination": "https://www.coredxi.com/:path",
      "permanent": true
    }
  ],
  "crons": [
    { "path": "/api/cron/ax-check-followup", "schedule": "30 0 * * *" }
  ]
}
```

- [ ] **Step 6: 미들웨어 통과 여부 로컬 확인(코드 변경 없음 — 확인만)**

`src/middleware.ts`의 matcher는 `/admin`으로 시작하지 않는 경로를 그대로 통과시키므로 `/api/cron/*`은 이미 안전하다(Task 착수 전 조사에서 확인 완료). 로컬 서버 기동 후 확인:

```bash
npm run dev
```
다른 터미널에서:
```bash
curl -i -H "Authorization: Bearer wrong" http://localhost:3100/api/cron/ax-check-followup
```
Expected: `HTTP/1.1 401` (관리자 로그인 리다이렉트가 아니라 라우트 자체의 401 JSON이어야 함 — CSP 헤더는 붙어도 무방).

- [ ] **Step 7: 타입체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: 커밋**

```bash
git add src/app/api/cron/ax-check-followup/route.ts src/app/api/cron/ax-check-followup/route.test.ts vercel.json
git commit -m "feat: 팔로업 발송 Vercel Cron 라우트 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: 관리자 UI — `EmailDraftPanel` "팔로업 메일" 패널로 개편

**Files:**
- Create: `src/app/admin/(panel)/leads/FollowupStatusBadge.tsx`
- Modify: `src/app/admin/(panel)/leads/EmailDraftPanel.tsx` (전체 교체, 파일명·컴포넌트명 `EmailDraftPanel` 유지 — `LeadDetailPanel.tsx`의 import 변경 불필요)

**Interfaces:**
- Consumes: `holdAxCheckFollowup`/`resumeAxCheckFollowup`/`sendAxCheckFollowupNow`/`updateAxCheckFollowupDraft`/`resetAxCheckFollowupDraft` (Task 8), `buildCustomerEmailDraft` (Task 5), `AxCheckLeadRecord` (Task 1)
- Produces: `FollowupStatusBadge` — Task 11의 CSV 라벨이 재사용하는 `FOLLOWUP_STATUS_LABEL` 상수도 이 파일에서 export

이 태스크는 UI 컴포넌트라 Vitest 단위 테스트 대신 **타입체크 + 수동 확인(Step 4)**으로 검증한다(이 프로젝트의 admin 패널 관례상 컴포넌트 테스트가 없음 — 기존 `EmailDraftPanel.tsx`도 테스트 파일이 없다).

- [ ] **Step 1: `FollowupStatusBadge.tsx` 작성**

```tsx
import type { FollowupStatus } from "@/lib/ax-check/types";

export const FOLLOWUP_STATUS_LABEL: Record<FollowupStatus, string> = {
  SCHEDULED: "예정",
  HELD: "보류",
  SENDING: "발송 중",
  SENT: "발송 완료",
  FAILED: "실패",
  SKIPPED: "과도기(수동)",
};

const STATUS_BADGE: Record<FollowupStatus, string> = {
  SCHEDULED: "bg-indigo-50 text-indigo-600",
  HELD: "bg-amber-50 text-amber-600",
  SENDING: "bg-blue-50 text-blue-600",
  SENT: "bg-emerald-50 text-emerald-600",
  FAILED: "bg-red-50 text-red-600",
  SKIPPED: "bg-slate-100 text-slate-500",
};

export function FollowupStatusBadge({ status }: { status: FollowupStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[status]}`}
    >
      {FOLLOWUP_STATUS_LABEL[status]}
    </span>
  );
}
```

- [ ] **Step 2: `EmailDraftPanel.tsx` 전체 교체**

```tsx
"use client";

/**
 * EmailDraftPanel.tsx — AX 체크 리드 상세의 "팔로업 메일" 패널
 *
 * [홍보팀 참고] 여기 보이는 문구 자체는 src/lib/ax-check/email-draft.ts와
 * catalog.ts(SALES_SIGNATURE·FOLLOWUP_COPY)에서 생성됩니다. T1(상세 진단)은
 * 시스템(Vercel Cron)이 예정 시각에 자동 발송합니다 — 발송 전에는 이 패널에서
 * 보류·수정·즉시 발송할 수 있습니다.
 */

import { useState } from "react";
import { AlertCircle, Check, Copy, Mail, Pause, Play, RotateCcw, Send } from "lucide-react";
import {
  holdAxCheckFollowup,
  resetAxCheckFollowupDraft,
  resumeAxCheckFollowup,
  sendAxCheckFollowupNow,
  updateAxCheckFollowupDraft,
} from "@/actions/ax-check";
import { buildCustomerEmailDraft } from "@/lib/ax-check/email-draft";
import { formatKstDateTime } from "@/lib/format-kst-date";
import type { AxCheckLeadRecord } from "@/lib/ax-check/types";
import { FollowupStatusBadge } from "./FollowupStatusBadge";

type Props = { lead: AxCheckLeadRecord };

export function EmailDraftPanel({ lead }: Props) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState(lead.followupSubject ?? "");
  const [bodyDraft, setBodyDraft] = useState(lead.followupBody ?? "");
  const [isPending, setIsPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const autoDraft = buildCustomerEmailDraft(
    lead.answers,
    {
      priorities: lead.priorities,
      grade: lead.grade,
      score: lead.score,
      catalogVersion: lead.catalogVersion,
    },
    { company: lead.company, name: lead.name },
    { mode: "manual" }
  );

  const hasOverride = Boolean(lead.followupSubject && lead.followupBody);
  const previewSubject = lead.followupSubject ?? autoDraft.subject;
  const previewBody = lead.followupBody ?? autoDraft.body;

  const mailtoHref = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(
    previewSubject
  )}&body=${encodeURIComponent(previewBody)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("복사에 실패했습니다. 아래 미리보기에서 직접 선택해 복사해 주세요.");
    }
  };

  async function runAction(
    action: () => Promise<{ success: boolean; error?: string }>
  ): Promise<boolean> {
    setIsPending(true);
    setActionError(null);
    try {
      const result = await action();
      if (!result.success) {
        setActionError(result.error ?? "처리 중 오류가 발생했습니다.");
        return false;
      }
      return true;
    } finally {
      setIsPending(false);
    }
  }

  const handleHold = () => void runAction(() => holdAxCheckFollowup(lead.id));
  const handleResume = () => void runAction(() => resumeAxCheckFollowup(lead.id));

  const handleSendNow = () => {
    const message =
      lead.followupStatus === "SENT"
        ? `${lead.company}에 팔로업 메일을 다시 보낼까요?`
        : `${lead.company}에 팔로업 메일을 지금 보낼까요?`;
    if (!confirm(message)) return;
    void runAction(() => sendAxCheckFollowupNow(lead.id));
  };

  const handleSaveDraft = async () => {
    const success = await runAction(() =>
      updateAxCheckFollowupDraft(lead.id, subjectDraft, bodyDraft)
    );
    if (success) setIsEditing(false);
  };

  const handleResetDraft = () => void runAction(() => resetAxCheckFollowupDraft(lead.id));

  return (
    <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">팔로업 메일</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            T1(상세 진단)은 시스템이 예정 시각에 자동 발송합니다. 필요하면 보류·수정·즉시 발송할
            수 있어요.
          </p>
        </div>
        <FollowupStatusBadge status={lead.followupStatus} />
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-xs sm:grid-cols-4">
        <div>
          <span className="block font-medium text-slate-400">T0 요약 메일</span>
          <span className="mt-1 block text-slate-700">
            {lead.t0SentAt ? formatKstDateTime(lead.t0SentAt) : "미발송"}
          </span>
        </div>
        <div>
          <span className="block font-medium text-slate-400">T1 예정 시각</span>
          <span className="mt-1 block text-slate-700">
            {lead.followupScheduledAt ? formatKstDateTime(lead.followupScheduledAt) : "—"}
          </span>
        </div>
        <div>
          <span className="block font-medium text-slate-400">T1 발송 시각</span>
          <span className="mt-1 block text-slate-700">
            {lead.followupSentAt ? formatKstDateTime(lead.followupSentAt) : "—"}
          </span>
        </div>
        <div>
          <span className="block font-medium text-slate-400">재시도 횟수</span>
          <span className="mt-1 block text-slate-700">{lead.followupAttempts}회</span>
        </div>
      </div>

      {lead.followupError ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{lead.followupError}</span>
        </div>
      ) : null}

      {actionError ? (
        <p className="text-xs text-red-600" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(lead.followupStatus === "SCHEDULED" || lead.followupStatus === "FAILED") && (
          <button
            type="button"
            onClick={handleHold}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Pause className="h-3.5 w-3.5" />
            보류
          </button>
        )}
        {lead.followupStatus === "HELD" && (
          <button
            type="button"
            onClick={handleResume}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="h-3.5 w-3.5" />
            보류 해제
          </button>
        )}
        <button
          type="button"
          onClick={handleSendNow}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-3.5 w-3.5" />
          {lead.followupStatus === "SENT" ? "다시 보내기" : "지금 보내기"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSubjectDraft(lead.followupSubject ?? autoDraft.subject);
            setBodyDraft(lead.followupBody ?? autoDraft.body);
            setIsEditing((v) => !v);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          {isEditing ? "수정 취소" : "본문 수정"}
        </button>
        {hasOverride ? (
          <button
            type="button"
            onClick={handleResetDraft}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            초안으로 되돌리기
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">제목</label>
            <input
              value={subjectDraft}
              onChange={(e) => setSubjectDraft(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">본문</label>
            <textarea
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              className="h-64 w-full resize-none rounded-lg border border-slate-200 p-3 text-sm leading-relaxed"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            저장
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "복사됨" : "본문 복사"}
        </button>
        <a
          href={mailtoHref}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Mail className="h-3.5 w-3.5" />
          메일 앱에서 열기
        </a>
        <span className="text-[11px] text-slate-400">
          {hasOverride ? "수정된 본문을 발송합니다." : "자동 생성된 초안입니다(발송 시점에 다시 생성)."}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500">제목</p>
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{previewSubject}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500">본문 미리보기</p>
        <pre className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 font-sans text-sm leading-relaxed text-slate-800">
          {previewBody}
        </pre>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 타입체크·린트**

```bash
npx tsc --noEmit
npx eslint "src/app/admin/(panel)/leads/**/*.tsx"
```
Expected: 에러 없음.

- [ ] **Step 4: 로컬 수동 확인**

```bash
npm run dev
```
`/admin/leads`에 EDITOR 계정으로 로그인해 임의 리드를 선택하고: 상태 배지·T0/T1 시각이 표시되는지, "보류"→"보류 해제"가 왕복되는지, "본문 수정" 후 저장하면 미리보기가 override로 바뀌는지, "초안으로 되돌리기"가 다시 자동 생성 초안으로 돌아가는지, "지금 보내기"가 확인 다이얼로그를 띄우는지 확인한다(실제 발송은 Task 12 C-8에서 프로덕션으로 검증).

- [ ] **Step 5: 커밋**

```bash
git add "src/app/admin/(panel)/leads/FollowupStatusBadge.tsx" "src/app/admin/(panel)/leads/EmailDraftPanel.tsx"
git commit -m "feat: 관리자 리드 상세 패널을 팔로업 메일 제어 UI로 개편

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: `AdminLeadsManager`/`LeadList` — 카운트·CSV·`?lead=` 자동 선택

**Files:**
- Modify: `src/app/admin/(panel)/leads/page.tsx`
- Modify: `src/app/admin/(panel)/leads/AdminLeadsManager.tsx`

**Interfaces:**
- Consumes: `FOLLOWUP_STATUS_LABEL` (Task 10)

- [ ] **Step 1: `page.tsx`에서 `?lead=` 쿼리를 서버에서 읽어 프롭으로 내려줌**

전체 파일을 아래로 교체(Next.js 15에서 `searchParams`는 Promise이므로 `useSearchParams`+Suspense 대신 서버 컴포넌트 프롭으로 처리 — 클라이언트 훅·Suspense 경계가 필요 없어 더 단순하다):

```tsx
import { listAxCheckResponses } from "@/actions/ax-check";
import { AdminLeadsManager } from "./AdminLeadsManager";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const result = await listAxCheckResponses();
  const { lead } = await searchParams;

  return (
    <AdminLeadsManager
      initialLeads={result.success ? result.leads : []}
      loadError={result.success ? undefined : result.error}
      initialSelectedId={lead}
    />
  );
}
```

- [ ] **Step 2: `AdminLeadsManager.tsx` 수정 — 프롭 추가, 초기 선택 로직, 카운트 4개, CSV 열 추가**

`Props` 타입 교체:
```tsx
type Props = {
  initialLeads: AxCheckLeadRecord[];
  loadError?: string;
  initialSelectedId?: string;
};
```

컴포넌트 시그니처와 `selectedId` 초기화 교체:
```tsx
export function AdminLeadsManager({ initialLeads, loadError, initialSelectedId }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (initialSelectedId && initialLeads.some((l) => l.id === initialSelectedId)) {
      return initialSelectedId;
    }
    return initialLeads[0]?.id ?? null;
  });
```

`import` 목록에 `FOLLOWUP_STATUS_LABEL` 추가:
```tsx
import { FOLLOWUP_STATUS_LABEL } from "./FollowupStatusBadge";
```

`useMemo` import 바로 아래(기존 `const selectedLead = useMemo(...)` 위)에 카운트 계산 추가:
```tsx
  const followupCounts = useMemo(
    () => ({
      scheduled: leads.filter((l) => l.followupStatus === "SCHEDULED").length,
      held: leads.filter((l) => l.followupStatus === "HELD").length,
      sent: leads.filter((l) => l.followupStatus === "SENT").length,
      failed: leads.filter((l) => l.followupStatus === "FAILED").length,
    }),
    [leads]
  );
```

`buildLeadsCsv` 함수 교체(헤더·행에 팔로업 2열 추가):
```tsx
function buildLeadsCsv(leads: AxCheckLeadRecord[]): string {
  const header = [
    "제출일",
    "회사",
    "담당자",
    "이메일",
    "연락처",
    "ref",
    "등급",
    "상태",
    "메모",
    "팔로업 상태",
    "팔로업 발송일시",
  ];
  const rows = leads.map((lead) => [
    formatKstDateTime(lead.createdAt),
    lead.company,
    lead.name,
    lead.email,
    lead.phone ?? "",
    lead.refCode ?? "",
    lead.grade,
    STATUS_LABEL[lead.status] ?? lead.status,
    lead.note ?? "",
    FOLLOWUP_STATUS_LABEL[lead.followupStatus] ?? lead.followupStatus,
    lead.followupSentAt ? formatKstDateTime(lead.followupSentAt) : "",
  ]);

  const lines = [header, ...rows].map((row) => row.map(csvEscape).join(","));
  return `﻿${lines.join("\n")}`; // BOM — 엑셀에서 한글이 깨지지 않도록
}
```

렌더링 부분 — 헤더 영역(`<h1>...</h1>` 블록) 바로 아래에 카운트 4개 타일 추가(기존 `<div className="flex flex-col gap-4 ...">...</div>` 블록 뒤, `<LeadList .../>` 앞):
```tsx
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400">팔로업 예정</p>
          <p className="mt-1 text-xl font-bold text-indigo-600">{followupCounts.scheduled}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400">보류</p>
          <p className="mt-1 text-xl font-bold text-amber-600">{followupCounts.held}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400">발송 완료</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{followupCounts.sent}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400">발송 실패</p>
          <p className="mt-1 text-xl font-bold text-red-600">{followupCounts.failed}</p>
        </div>
      </div>

```

- [ ] **Step 3: 타입체크·린트**

```bash
npx tsc --noEmit
npx eslint "src/app/admin/(panel)/leads/**/*.tsx"
```

- [ ] **Step 4: 로컬 수동 확인**

```bash
npm run dev
```
`/admin/leads`에서 카운트 4개 타일이 실제 리드 수와 맞는지, CSV 내보내기 파일에 "팔로업 상태"·"팔로업 발송일시" 열이 추가됐는지, 영업이사 알림 메일의 관리 링크(`/admin/leads?lead={id}`)로 접속하면 해당 리드가 자동 선택되는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add "src/app/admin/(panel)/leads/page.tsx" "src/app/admin/(panel)/leads/AdminLeadsManager.tsx"
git commit -m "feat: 리드 목록에 팔로업 상태 카운트·CSV 열·lead 쿼리 자동 선택 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: 문구·문서 갱신 (결과 화면·폼·개인정보방침·CONTENT_GUIDE·E2E)

**Files:**
- Modify: `src/components/ax-check/AxCheckPriorityCards.tsx:28`
- Modify: `src/app/ax-check/AxCheckForm.tsx` (제출 완료 문구 추가)
- Modify: `src/lib/ax-check/catalog.ts` (`INTRO_COPY.reassurances[2]` 문구 정합성)
- Modify: `src/app/privacy/page.tsx` (제2조 목적 문구)
- Modify: `e2e/ax-check.spec.ts` (골든패스 문구 갱신)
- Modify: `CONTENT_GUIDE.md` (17번 절 확장)
- Modify: `docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md` (대체됨 표기 확인)

- [ ] **Step 1: 결과 화면 안내 문구 확정값으로 교체**

`src/components/ax-check/AxCheckPriorityCards.tsx:28`을 교체:

```tsx
// OLD
          상세 진단서는 담당 이사가 직접 검토해 영업일 기준 2~3일 내로 연락드립니다.
```
```tsx
// NEW
          정리된 상세 진단서를 영업일 기준 2~3일 내 메일로 보내드립니다. 우선 과제가 뚜렷한
          경우 담당 이사가 직접 연락드립니다.
```

- [ ] **Step 2: `AxCheckForm.tsx` 제출 완료 화면에 T0 발송 안내 추가**

`src/app/ax-check/AxCheckForm.tsx`의 `if (priorities) { return <AxCheckPriorityCards ... />; }` 블록을 교체:

```tsx
// OLD
  if (priorities) {
    return <AxCheckPriorityCards company={contact.company} priorities={priorities} />;
  }
```
```tsx
// NEW
  if (priorities) {
    return (
      <div className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          결과 요약 메일을 {contact.email}로 보내드렸습니다.
        </p>
        <AxCheckPriorityCards company={contact.company} priorities={priorities} />
      </div>
    );
  }
```

- [ ] **Step 3: `INTRO_COPY` 문구 정합성 확인·수정**

`src/lib/ax-check/catalog.ts`의 `INTRO_COPY.reassurances` 배열 세 번째 항목을 교체:

```ts
// OLD
    "제출한다고 영업 전화가 자동으로 가지 않습니다 — 결과는 화면에서 바로 확인하시고, 상세 진단서는 담당 이사가 직접 검토해 메일로 보내드립니다.",
```
```ts
// NEW
    "제출한다고 영업 전화가 자동으로 가지 않습니다 — 결과는 화면에서 바로 확인하시고, 상세 진단 메일은 영업일 기준 2~3일 내 자동으로 발송됩니다. 우선 과제가 뚜렷한 경우 담당 이사가 직접 연락드립니다.",
```

- [ ] **Step 4: `/privacy` 조항에 자동 발송 명시**

`src/app/privacy/page.tsx`의 제2조 목적 항목(현재 "AX 체크 진단 제공: 진단 결과 안내 및 후속 컨설팅 상담을 위한 담당자 연락")을 교체:

```tsx
// OLD
                <li>
                  AX 체크 진단 제공: 진단 결과 안내 및 후속 컨설팅 상담을 위한
                  담당자 연락
                </li>
```
```tsx
// NEW
                <li>
                  AX 체크 진단 제공: 진단 결과 안내 메일 발송(제출 직후·영업일 기준 2~3일 내)
                  및 후속 컨설팅 상담을 위한 담당자 연락
                </li>
```

- [ ] **Step 5: E2E 골든패스 문구를 최종 확정 문구로 갱신**

`e2e/ax-check.spec.ts`에서 (Step 1과 이미 어긋나 있던) 아래 줄을 교체:

```ts
// OLD
  await expect(
    page.getByText("상세 진단서는 담당 이사가 직접 검토해 1영업일 내 메일로 보내드립니다.")
  ).toBeVisible();
```
```ts
// NEW
  await expect(
    page.getByText(
      "정리된 상세 진단서를 영업일 기준 2~3일 내 메일로 보내드립니다. 우선 과제가 뚜렷한"
    )
  ).toBeVisible();
```

- [ ] **Step 6: `CONTENT_GUIDE.md` 17번 절 확장**

`CONTENT_GUIDE.md`의 "17. AX 체크(인터뷰 진단) 문구 수정 및 리드 확인하기" 절 본문 끝에 아래 하위 섹션을 추가한다(기존 17번 절 내용은 그대로 두고 뒤에 이어붙인다):

```markdown

### 팔로업(자동 발송) 메일 문구 수정

- T0(제출 즉시 요약)·T1(D+2 영업일 상세 진단) 메일 문구는 `src/lib/ax-check/catalog.ts`의
  `FOLLOWUP_COPY` 상수에 모여 있습니다. 이 객체 안의 문자열만 바꾸면 됩니다.
- 영업이사 서명은 같은 파일의 `SALES_SIGNATURE`에 있습니다(이름·직함·연락처·태그라인·주소).

### 발송 보류·수정·즉시 발송

- `/admin/leads`에서 리드를 선택하면 "팔로업 메일" 패널이 나옵니다.
- **보류**: 예정된 자동 발송을 막습니다(다시 "보류 해제"를 눌러야 재개됩니다).
- **본문 수정**: 이번 건에 한해 자동 생성 초안 대신 직접 쓴 제목·본문을 보냅니다.
  "초안으로 되돌리기"를 누르면 다시 자동 생성 초안을 씁니다.
- **지금 보내기**: 예정 시각을 기다리지 않고 즉시 발송합니다(이미 보낸 건도 다시 보낼 수
  있습니다 — 확인 창이 뜹니다).

### 공휴일 상수 갱신

- `src/lib/ax-check/business-days.ts`의 `KR_PUBLIC_HOLIDAYS`에 다음 해 공휴일 목록을
  `"YYYY-MM-DD"` 형식으로 추가해 주세요(연말에 한 번씩). 대체공휴일은 관보 확정 후 추가합니다.

### 자동 발송 끄기(킬 스위치)

- Vercel 환경변수 `AX_CHECK_FOLLOWUP_ENABLED`를 `false`로 설정하면 재배포 없이 다음 요청부터
  신규 리드는 발송 대기 없이 "보류" 상태로 저장되고, 예약 발송도 멈춥니다(8/30 이전의 수동
  운영 방식으로 즉시 복귀). 다시 켜려면 이 값을 지우거나 `true`로 바꾸면 됩니다.
```

- [ ] **Step 7: 8/30 설계 문서 "대체됨" 표기 확인**

`docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md` 5절 상단에 "2026-09-02 자동 발송 설계로 대체됨"이라는 표기가 있는지 확인한다. 없다면 5절 제목 바로 아래에 아래 한 줄을 추가한다:

```markdown
> **2026-09-02 자동 발송 설계로 대체됨** — `docs/superpowers/specs/2026-09-02-ax-check-auto-followup-design.md` 참고.
```

- [ ] **Step 8: 관련 Vitest·Playwright 실행**

```bash
npx vitest run src/lib/ax-check
npx playwright test e2e/ax-check.spec.ts
```
Expected: 전체 PASS.

- [ ] **Step 9: 커밋**

```bash
git add src/components/ax-check/AxCheckPriorityCards.tsx src/app/ax-check/AxCheckForm.tsx src/lib/ax-check/catalog.ts src/app/privacy/page.tsx e2e/ax-check.spec.ts CONTENT_GUIDE.md docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md
git commit -m "docs: 자동 발송에 맞춰 결과 화면·개인정보방침·가이드 문구 갱신

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: 최종 검증 + PR

**Files:** 없음(검증·PR만)

- [ ] **Step 1: 전체 정적 검사**

```bash
npm run lint
npx tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 2: 전체 단위 테스트**

```bash
npm run test
```
Expected: 전체 PASS(Task 1~12에서 다룬 모든 신규·갱신 테스트 포함).

- [ ] **Step 3: E2E 골든패스**

```bash
npm run test:e2e
```
Expected: `ax-check.spec.ts` PASS. `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`가 설정돼 있으면 관리자 파트도 함께 PASS.

- [ ] **Step 4: 로컬에서 크론 핸들러 수동 스모크(Resend 실제 발송 없이 구조만 확인)**

```bash
npm run dev
```
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3100/api/cron/ax-check-followup | jq .
```
Expected: `{ ok: true, processed, sent, failed, skipped, ranAt }` 형태의 JSON(로컬 DB에 대상 리드가 없으면 전부 0).

- [ ] **Step 5: PR 생성**

```bash
git push -u origin feat/ax-check-auto-followup
gh pr create --base main --title "feat: AX 체크 자동 팔로업(T0/T1) 발송 파이프라인" --body "$(cat <<'EOF'
## 요약
/ax-check 제출 시 시스템이 T0(즉시 요약)·T1(D+2 영업일 09:30 KST 상세 진단) 메일을 자동 발송한다.
관리자는 /admin/leads에서 발송 전 보류·수정·즉시 발송할 수 있다.

설계: docs/superpowers/specs/2026-09-02-ax-check-auto-followup-design.md

## DoD 체크리스트 (설계 14절)
- [ ] migration.sql 작성, prisma migrate deploy 프로덕션 적용, prisma generate·tsc 통과
- [ ] 제출 시 T0 1통 발송, followupScheduledAt이 D+2 영업일 09:30 KST로 저장
- [ ] Vercel Cron이 매일 09:30 KST에 실행되어 대상 리드에 T1 발송
- [ ] /admin/leads에서 보류·해제·지금 보내기·본문 수정·이력이 EDITOR 계정으로 동작
- [ ] 영업이사 알림 메일에 통화 포인트·예정 시각·관리 링크가 있고 초안 전문은 없음
- [ ] 결과 화면·/privacy·CONTENT_GUIDE.md 17번·.env.example 갱신
- [ ] Vitest 신규·갱신 테스트 통과, Playwright 골든패스 통과, CI 녹색
- [ ] SALES_SIGNATURE 실제 값 입력 확인(완료 — 김문건 이사)
- [ ] C-8 프로덕션 검증 체크리스트 통과

## 배포 후 사용자가 해야 할 일
1. Vercel 환경변수 등록: `CRON_SECRET`(랜덤 32자+), `SALES_REPLY_TO`(선택), `AX_CHECK_BROCHURE_URL`(선택)
2. `npx prisma migrate deploy` 프로덕션 DB 적용(이미 Task 1에서 로컬 반영됨 — 프로덕션에도 적용 필요)
3. C-8 프로덕션 검증: 테스트 ref 제출 → T0 수신 확인 → 크론 수동 호출 → T1 수신 확인 → 리드 1건 보류 테스트 → 등급×업종 샘플 9건 본문 육안 검수

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 완료 기준 (설계 14절 요약)

- [ ] `migration.sql` 작성·적용, `prisma generate`·tsc 통과
- [ ] 제출 시 T0 1통 발송, `followupScheduledAt`이 D+2 영업일 09:30 KST로 저장
- [ ] Vercel Cron이 매일 09:30 KST 실행, 대상 리드에 T1 발송
- [ ] `/admin/leads`에서 보류·해제·지금 보내기·본문 수정·이력이 EDITOR 계정으로 동작
- [ ] 영업이사 알림 메일에 통화 포인트·예정 시각·관리 링크, 초안 전문 없음
- [ ] 결과 화면·`/privacy`·`CONTENT_GUIDE.md`·`.env.example` 갱신
- [ ] Vitest·Playwright·lint·tsc 전체 통과
- [ ] `SALES_SIGNATURE` 실제 값 반영 완료(이 플랜에서 완료)
- [ ] C-8 프로덕션 검증(사용자가 배포 후 수행)
