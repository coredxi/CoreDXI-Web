# AX 체크 자동 팔로업 설계 — T0 즉시 요약 메일 · T1 D+2 영업일 상세 진단 자동 발송 · 관리자 보류 창

> 작성일: 2026-09-02
> 액션 플랜: `docs/superpowers/plans/2026-09-02-sales-channel-auto-followup-action-plan.md` (A단계 결정 7건 2026-09-02 사용자 확정)
> 대체하는 문서: `docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md` 5절(이메일 초안 워크플로우) — 인트로(6절)·피드백 구체화(7절)는 그대로 유효
> 구현 브랜치: `feat/ax-check-auto-followup` (main에서 새로 딴다)

---

## 1. 배경

`/ax-check`는 잠재 고객을 확보해 컨설팅 계약으로 잇는 영업채널의 전초기지다. 영업이사는 1명이고 외근 위주라, 리드마다 사람이 검토·작성·발송하는 8/30 워크플로우는 지켜지지 않는다(2026-09-02 실기기 테스트 후 판단). 8/30에 자동 발송을 철회한 이유였던 "부실한 상세본이 자동으로 나가는 거짓 안내" 우려는 질문지 v1 확정(`catalog.ts` v2)과 결과 피드백 구체화(답변 인용·업종 예시·3단계 로드맵)로 해소됐다고 본다.

이 설계의 원칙(액션 플랜 1절): 기본값은 자동, 사람은 예외(보류). 영업이사의 시간은 "쓰기"가 아니라 HOT 리드 통화에 쓴다. 자동이라고 거짓말하지 않는다. 동의 범위 안에서만 보낸다. 첫 링크 발송(09/04)을 막지 않는다.

---

## 2. 변경 사항 요약

| 구분 | 기존(8/30) | 변경 |
|---|---|---|
| 고객 메일 | 없음(화면만) | **T0** 제출 즉시 요약 메일 + **T1** D+2 영업일 09:30 KST 상세 진단 메일 자동 발송 |
| 발송 주체 | 영업이사가 초안 복사·수동 발송 | 시스템(Vercel Cron). 발송 전 관리자가 보류·수정·즉시 발송 가능 |
| 영업이사 알림 메일 | 초안 전문 동봉 | 등급·통화 포인트 3줄·예정 발송 시각·관리 링크. HOT는 제목 `[HOT]` |
| `/admin/leads` 상세 패널 | "이메일 초안"(복사·mailto) | "팔로업 메일"(상태·예정 시각·보류/해제·지금 보내기·본문 수정·이력) |
| 결과 화면 문구 | "담당 이사가 직접 검토해 영업일 기준 2~3일 내로 연락드립니다" | "정리된 상세 진단서를 영업일 기준 2~3일 내 메일로 보내드립니다. 우선 과제가 뚜렷한 경우 담당 이사가 직접 연락드립니다." |
| 데이터 모델 | 변경 없음 | `AxCheckResponse`에 followup 필드 7개 + enum `FollowupStatus` (수동 `migration.sql`) |
| 킬 스위치 | 없음 | `AX_CHECK_FOLLOWUP_ENABLED=false`면 신규 리드는 HELD로 저장, 크론은 no-op → 8/30 수동 모드로 즉시 복귀 |

---

## 3. 아키텍처

```
[고객] /ax-check 제출
   └─ submitAxCheck (src/actions/ax-check.ts)
        ├─ 검증 · rate limit · summarize · 저장
        │     followupStatus = SCHEDULED (킬 스위치 off면 HELD)
        │     followupScheduledAt = addBusinessDays(제출일 KST, 2) 09:30 KST
        ├─ T0 발송  sendT0Email()            → t0SentAt
        ├─ 옵트인 시 뉴스레터 구독 연동(기존)
        └─ 영업이사 알림 메일(개편)

[Vercel Cron] 매일 00:30 UTC (= 09:30 KST)
   └─ GET /api/cron/ax-check-followup  (Authorization: Bearer CRON_SECRET)
        └─ processDueFollowups()  (src/lib/ax-check/followup.ts)
             ├─ 대상: SCHEDULED & scheduledAt <= now  +  FAILED & attempts < 3
             ├─ 건별 원자적 선점: updateMany(status SCHEDULED|FAILED → SENDING) count==1
             ├─ sendFollowupEmail(id): override(subject/body) 우선, 없으면 buildCustomerEmailDraft(mode:"auto")
             └─ SENT(sentAt) / FAILED(error, attempts+1, Sentry)

[관리자] /admin/leads 상세 "팔로업 메일" 패널
   ├─ 보류(HELD) / 보류 해제(SCHEDULED, scheduledAt = max(now, 원래 예정))
   ├─ 지금 보내기 → sendFollowupEmail(id) 즉시 실행
   ├─ 본문 수정 → followupSubject/followupBody 저장(다음 발송에 사용)
   └─ 이력: 상태·예정·발송 시각·에러
```

발송 로직은 한 곳(`followup.ts`)에만 두고, 크론과 "지금 보내기"가 같은 함수를 호출한다. 초안 생성은 기존 `buildCustomerEmailDraft`를 재사용하되 `mode: "auto"`에서 사람용 편집 슬롯(`[[통화에서 말씀 주신 ___]]`)을 제거한다.

---

## 4. 데이터 모델

```prisma
enum FollowupStatus {
  SCHEDULED  // 예정 (기본)
  HELD       // 관리자 보류 — 크론이 건너뜀
  SENDING    // 선점됨(중복 발송 방지, 수 초 내 SENT/FAILED로 전이)
  SENT
  FAILED     // 재시도 대상(attempts < 3)
  SKIPPED    // 배포 이전 리드(과도기 수동 처리) — D-1에서 SCHEDULED로 전환 여부 결정
}

model AxCheckResponse {
  // ...기존 필드 유지
  followupStatus      FollowupStatus @default(SCHEDULED)
  followupScheduledAt DateTime?
  followupSentAt      DateTime?
  followupSubject     String?        // 관리자 수정본(없으면 생성 초안 사용)
  followupBody        String?        @db.Text
  followupError       String?
  followupAttempts    Int            @default(0)
  t0SentAt            DateTime?      // T0 즉시 메일 발송 시각(실패 시 null)

  @@index([followupStatus, followupScheduledAt])
}
```

수동 `prisma/migrations/20260908120000_add_ax_check_followup/migration.sql` (`prisma migrate dev` 금지):

```sql
CREATE TYPE "FollowupStatus" AS ENUM ('SCHEDULED','HELD','SENDING','SENT','FAILED','SKIPPED');
-- 기존 행은 SKIPPED로 채운 뒤 기본값을 SCHEDULED로 바꾼다(과거 리드에 소급 발송되는 사고 방지)
ALTER TABLE "AxCheckResponse"
  ADD COLUMN "followupStatus" "FollowupStatus" NOT NULL DEFAULT 'SKIPPED',
  ADD COLUMN "followupScheduledAt" TIMESTAMP(3),
  ADD COLUMN "followupSentAt" TIMESTAMP(3),
  ADD COLUMN "followupSubject" TEXT,
  ADD COLUMN "followupBody" TEXT,
  ADD COLUMN "followupError" TEXT,
  ADD COLUMN "followupAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "t0SentAt" TIMESTAMP(3);
ALTER TABLE "AxCheckResponse" ALTER COLUMN "followupStatus" SET DEFAULT 'SCHEDULED';
CREATE INDEX "AxCheckResponse_followupStatus_followupScheduledAt_idx"
  ON "AxCheckResponse"("followupStatus", "followupScheduledAt");
```

`prisma/schema.prisma`의 `@default(SCHEDULED)`와 SQL의 최종 DEFAULT가 일치하므로 `prisma migrate deploy` 후 drift가 없다. 로컬에서 `npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --shadow-database-url ...`로 확인하는 대신, 기존 관행대로 `migrate deploy` 후 `prisma generate`·tsc 통과로 검증한다.

---

## 5. 영업일 계산 (`src/lib/ax-check/business-days.ts`)

- 순수 함수 `addBusinessDays(fromKstDate: string /* YYYY-MM-DD */, n: number, holidays: ReadonlySet<string>): string` — 주말(토·일)과 공휴일을 건너뛴다.
- `toKstDateString(date: Date): string`, `kstDateTimeToUtc(dateStr: string, hh: number, mm: number): Date` — 타임존 계산은 `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })` 기반, 외부 라이브러리 추가 없음.
- `KR_PUBLIC_HOLIDAYS`: 2026 잔여분(9/24·9/25·9/26 추석 연휴, 10/3 개천절, 10/9 한글날, 12/25) + 2027 1/1. 매년 갱신 — `CONTENT_GUIDE.md` 17번에 갱신 방법 기재. 대체공휴일은 관보 확인 후 추가.
- 예정 시각: `followupScheduledAt = kstDateTimeToUtc(addBusinessDays(제출일, 2), 9, 30)`. 예: 수요일 제출 → 금요일 09:30, 금요일 제출 → 화요일 09:30, 목요일(추석 전날) 제출 → 연휴 뒤 첫 영업일 +1.
- 크론이 09:30 KST에 돌므로 "D+2 09:30"은 같은 실행에서 잡힌다. 크론 지연을 감안해 조회 조건은 `scheduledAt <= now` (미래분은 다음 날).

---

## 6. 발송 파이프라인 (`src/lib/ax-check/followup.ts`)

```ts
export async function processDueFollowups(opts?: { now?: Date; limit?: number }): Promise<{ processed: number; sent: number; failed: number; skipped: number }>;
export async function sendFollowupEmail(id: string, opts?: { force?: boolean }): Promise<{ success: true } | { success: false; error: string }>;
export function isFollowupEnabled(): boolean; // AX_CHECK_FOLLOWUP_ENABLED !== "false"
```

- **대상 선정**: `followupStatus IN (SCHEDULED, FAILED) AND followupScheduledAt <= now AND (status != FAILED OR followupAttempts < 3)`, `orderBy scheduledAt asc`, `take 50`.
- **선점**: `prisma.axCheckResponse.updateMany({ where: { id, followupStatus: { in: ["SCHEDULED","FAILED"] } }, data: { followupStatus: "SENDING" } })` → `count === 1`일 때만 발송. 크론 중복 실행·"지금 보내기" 동시 클릭에도 1회만 나간다.
- **본문**: `followupSubject/followupBody`가 있으면 그대로, 없으면 `buildCustomerEmailDraft(answers, summary, contact, { mode: "auto" })`. 발송 직전 생성이므로 `catalog.ts` 개선이 아직 안 나간 리드에도 반영된다(8/30 설계의 장점 유지).
- **발신**: `from: noreply@coredxi.com`(기존 `RESEND_FROM`), `replyTo: process.env.SALES_REPLY_TO ?? SALES_SIGNATURE.email`. 회신은 영업이사에게 간다.
- **성공**: `SENT`, `followupSentAt = now`, `followupError = null`. **실패**: `FAILED`, `followupError`, `followupAttempts + 1`, `Sentry.captureException(e, { tags: { feature: "ax-check-followup" }, extra: { id } })`. 3회 실패 후에는 크론이 건너뛰고 관리자 카운트에 "실패"로 남는다.
- **`force`**: "지금 보내기"에서 HELD·SENT 상태여도 다시 보낼 수 있게 한다(재발송은 관리자 확인 다이얼로그 후).
- **킬 스위치**: `isFollowupEnabled() === false`면 `processDueFollowups`는 `{ processed: 0, skipped: n }`을 반환하고 아무것도 보내지 않는다. `submitAxCheck`는 신규 리드를 `HELD`로 저장하고 T0도 보내지 않는다(완전한 8/30 모드).

---

## 7. 크론 라우트 (`src/app/api/cron/ax-check-followup/route.ts`)

- `vercel.json`에 `"crons": [{ "path": "/api/cron/ax-check-followup", "schedule": "30 0 * * *" }]` 추가(기존 `redirects`와 병기). Hobby 플랜은 일 1회 제한이므로 정확히 일 1회.
- `GET`만 허용. `Authorization: Bearer ${process.env.CRON_SECRET}` 불일치·미설정 시 401. Vercel은 `CRON_SECRET` env가 있으면 크론 호출에 자동으로 헤더를 붙인다. 로컬 검증은 `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3100/api/cron/ax-check-followup`.
- 응답: `{ ok: true, processed, sent, failed, skipped, ranAt }`. 실패가 1건 이상이면 `Sentry.captureMessage("ax-check followup: N failed", "warning")`.
- `export const dynamic = "force-dynamic"; export const maxDuration = 60;` (Resend 호출 50건 상한 기준 충분).
- 미들웨어: 현재 matcher가 `/api/*`를 포함하므로 CSP 헤더가 붙지만 JSON 응답에는 무해. 관리자 리다이렉트 로직이 `/admin` 한정인지 확인하고, 필요하면 `/api/cron`을 matcher 예외에 추가한다.

---

## 8. 메일 템플릿

모든 문구 상수는 `catalog.ts`의 `INTRO_COPY`와 같은 방식으로 `FOLLOWUP_COPY`에 모아 홍보팀이 코드 구조를 몰라도 수정할 수 있게 한다(`CONTENT_GUIDE.md` 17번 갱신). 텍스트 메일 유지(기존 알림 메일과 동일 패턴, HTML은 후속).

### T0 — 결과 요약 (`buildT0Email(summary, contact, links)`)
- 제목: `[CoreDXI] {company} AX 체크 결과 — 우선 과제 {n}가지 정리본`
- 본문: 인사 → 우선 과제 제목 3줄 → "지금 바로 다시 보기: {resultUrl}" → 소개서 링크(`AX_CHECK_BROCHURE_URL`이 설정된 경우에만 줄 추가; 0-4 S4 게시 후 설정) → "영업일 기준 2~3일 내에 답변 내용을 바탕으로 정리한 상세 진단 메일을 보내드립니다. 우선 과제가 뚜렷한 경우 담당 이사가 직접 연락드립니다." → 안내 문구(아래) → 서명.
- 초안 후보 2벌: `docs/superpowers/plans/2026-09-02-ax-check-followup-email-drafts.md` — **2026-09-02 영업이사 검토 결과 T0·T1 모두 안 1 확정**. 서명(`SALES_SIGNATURE`)은 김문건 이사(Sales) / 010-7192-0532 / obaamg1017@coredxi.com + 태그라인·주소 2곳(프롬프트 문서 확정 값 참조).

### T1 — 상세 진단 (`buildCustomerEmailDraft(..., { mode: "auto" })`)
- 기존 구조(인사 → 과제별 인용·업종 예시·이유·로드맵·기대 효과 → 진행 방식 → 통화 제안 → 서명) 유지.
- `mode: "auto"`: `[[통화에서 말씀 주신 ___]]` 줄 제거, 통화 제안 문장을 "이 메일에 회신해 주시면 편하신 시간에 30분 통화로 자세히 설명드리겠습니다."로 고정. `mode: "manual"`(기본, 관리자 미리보기·수정용)은 기존 그대로.
- 제목: 기존 `[CoreDXI] {company} AX 체크 결과 — 귀사의 우선 과제 {n}가지`에 "상세 진단"을 붙여 T0과 구분.

### 공통 안내 문구 (원칙 4, A-6)
- 말미 1줄: "이 메일은 AX 체크 진단 신청에 따른 결과 안내입니다. 추가 안내를 원치 않으시면 이 메일에 회신으로 알려주세요." — T0·T1은 서비스 이행 메일로 분류하되, 수신 거부 경로를 명시해 둔다. T2(너처)·뉴스레터는 `marketingOptIn=true`만 대상이며 기존 `/unsubscribe/[token]` 링크를 쓴다(E단계).

### 영업이사 알림 메일 (개편)
- 제목: `[CoreDXI]{HOT면 "[HOT]"} 새 AX 체크 리드 - {grade} - {company}`
- 본문: 회사·담당자·이메일·연락처·ref·등급 → **통화 포인트 3줄**(Q3 선택 업무 라벨 상위 2개 / Q7 검토 시점 라벨 / Q8 의사결정 구조 라벨) → `상세 진단 메일 예정: {YYYY-MM-DD(요일) 09:30}` → `보류·수정·지금 보내기: {siteUrl}/admin/leads?lead={id}` → 결과 재열람 링크. 초안 전문은 동봉하지 않는다.
- `replyTo`는 기존처럼 고객 이메일.

---

## 9. 관리자 UI (`/admin/leads`)

- `EmailDraftPanel` → `FollowupPanel`로 개편(파일명 유지 가능, 헤더 "팔로업 메일"):
  - 상단: 상태 배지(예정/보류/발송 완료/실패/과도기) + 예정·발송 시각(`formatKstDateTime`) + T0 발송 여부.
  - 버튼: **보류**(SCHEDULED→HELD) / **보류 해제**(HELD→SCHEDULED, 예정이 지났으면 지금+0으로) / **지금 보내기**(확인 다이얼로그, SENT면 "다시 보내기") / **본문 수정**(제목·본문 textarea, 저장 시 override, "초안으로 되돌리기"로 null).
  - 미리보기: override가 있으면 override, 없으면 `mode:"manual"` 초안. 복사·mailto 버튼은 보조로 남긴다.
  - 실패 시 `followupError` 표시.
- 서버 액션(`src/actions/ax-check.ts`, `requireAdmin` — EDITOR 포함): `holdAxCheckFollowup(id)`, `resumeAxCheckFollowup(id)`, `sendAxCheckFollowupNow(id)`, `updateAxCheckFollowupDraft(id, subject, body)`, `resetAxCheckFollowupDraft(id)`. 모두 `revalidatePath("/admin/leads")`.
- 목록 상단 카운트 4개(예정/보류/발송/실패) — `listAxCheckResponses` 결과에서 집계(추가 쿼리 없음). `?lead={id}` 쿼리로 상세 자동 선택(알림 메일 링크용).
- `AxCheckLeadRecord`에 followup 필드 추가, CSV 내보내기에 `followupStatus`·`followupSentAt` 열 추가.
- 디자인: 기존 패널과 동일 톤(`rounded-xl`, primary 토큰). 새 색상 추가 금지, 상태 배지는 `LeadGradeBadge` 패턴 재사용.

---

## 10. 결과 화면·문구·문서

- `AxCheckPriorityCards.tsx` 안내 문구 → A-4 확정 문구(2절 표). 재열람 페이지도 동일 컴포넌트라 함께 바뀐다.
- `AxCheckForm` 제출 완료 토스트/문구에 "결과 요약 메일을 {email}로 보내드렸습니다" 추가(T0 실패 시에도 화면은 성공 — 메일 실패는 로그·Sentry).
- `INTRO_COPY`에 "자동 발송" 관련 모순 문구가 없는지 확인.
- `/privacy` AX 체크 조항: 수집 목적에 "진단 결과 안내 메일 발송(제출 직후·영업일 기준 2~3일 내)" 명시.
- `CONTENT_GUIDE.md` 17번: 팔로업 메일 문구 위치(`FOLLOWUP_COPY`), 보류·수정·지금 보내기 방법, 공휴일 상수 갱신 방법, 킬 스위치.
- `.env.example`: `CRON_SECRET`, `SALES_REPLY_TO`(선택), `AX_CHECK_BROCHURE_URL`(선택), `AX_CHECK_FOLLOWUP_ENABLED`(선택, 기본 true).
- `SALES_SIGNATURE` 실제 값(이름·직함·전화·메일)은 0-5 후속으로 사용자가 채운다 — 자동 발송 전 필수 게이트(C-8 체크리스트).

---

## 11. 보안·정책 체크 (지침 5-4)

- 크론 라우트는 `CRON_SECRET` Bearer 검증, GET 전용, 입력 파라미터 없음(외부 입력으로 대상 선택 불가).
- 제출 rate limit(IP당 시간당 5회) 유지. T0 발송은 제출당 1통이라 발송량도 같은 상한에 묶인다.
- 메일은 텍스트 전용 — 고객 입력(회사명·성함)이 본문에 들어가지만 HTML 렌더링이 없어 인젝션 표면이 없다. HTML 템플릿을 도입하면 그때 escape 필수.
- 외부 URL 사용 없음(`url-safety.ts` 불필요). Calendly 도입(E-2) 시 `frame-src`·화이트리스트 적용.
- Sentry: 발송 실패·크론 실패 캡처, 트레이스 샘플링 20% 그대로.
- 개인정보: 메일 발송은 수집 목적(진단 결과 안내) 내. 삭제(`deleteAxCheckResponse`) 시 followup 필드도 행과 함께 삭제됨.

---

## 12. 테스트 계획

- **Vitest**
  - `business-days.test.ts`: 주말 건너뛰기, 공휴일 건너뛰기(추석 케이스), KST 자정 경계(UTC 15:00), D+2 결과 시각이 09:30 KST인지.
  - `followup.test.ts`: 선점 실패 시 미발송, override 우선, `mode:"auto"`에 플레이스홀더 없음, 실패 시 FAILED+attempts, 3회 초과 건너뜀, 킬 스위치.
  - `ax-check.test.ts` 갱신: 제출 시 T0 1통 + 알림 1통(초안 전문 미포함), `followupScheduledAt` 계산, 킬 스위치 off면 HELD.
  - `route.test.ts`(크론): 401, 정상 처리 카운트, Resend 모킹.
  - 관리자 액션: 비관리자 거부, HELD/SCHEDULED 전이, override 저장·초기화.
- **Playwright**: 기존 `ax-check.spec.ts` 골든패스 유지(제출 → 결과 화면 문구 확인). 관리자 패널 상태 배지 확인은 `E2E_ADMIN_*` 설정 시에만.
- **프로덕션 검증(C-8)**: 테스트 ref 제출 → T0 수신 → `/admin/leads`에 예정 시각 표시 → 크론 수동 호출 또는 다음 날 09:30 대기 → T1 수신 → 보류 1건이 건너뛰어지는지 → 등급×업종 샘플 9건 본문 육안 검수.

---

## 13. 롤백

- 즉시: Vercel env `AX_CHECK_FOLLOWUP_ENABLED=false` → 재배포 없이 다음 요청부터 수동 모드(신규 HELD, 크론 no-op). 관리자 패널의 복사·mailto로 8/30 방식 운영 가능.
- 코드 롤백 시에도 추가된 컬럼은 남겨 둔다(NULL·기본값이라 구코드와 호환).

---

## 14. 완료 기준 (Definition of Done)

> 2026-09-03 갱신(2차): 1차 조사(로컬 저장소 커밋만 근거)에서는 T1 수신·Vercel env를 미확인으로 남겼으나,
> Notion 액션 DB(fifty-ledger, 다른 세션에서 이미 사용자 확인 후 완료 처리)를 조회해 실제로는 09/02~09/03
> 사이 아래 항목 전부(Playwright 재실행 제외)가 완료됐음을 확인. Notion을 최종 근거로 다시 갱신.

- [x] `migration.sql` 작성, `prisma migrate deploy` 프로덕션 적용, `prisma generate`·tsc 통과 — 09/03 `prisma migrate status`로 직접 확인 + Notion 기록
- [x] 제출 시 T0 1통 발송, `followupScheduledAt`이 D+2 영업일 09:30 KST로 저장 — 코드 반영, `ref=test-c8` 알림 메일로 확인
- [x] Vercel Cron이 매일 09:30 KST에 실행되어 대상 리드에 T1 발송, 로그에 카운트 출력 — Notion 액션 DB "C 구현 1차" 항목에 T1 수신·크론 인증 통과로 기록(2026-09-03, 사용자 확인). 어떤 리드로 어떻게 검증했는지(자연 스케줄 대기 vs "지금 보내기" 강제 발송)는 로컬에서 재확인 못함
- [x] `/admin/leads`에서 보류·해제·지금 보내기·본문 수정·이력이 EDITOR 계정으로 동작 — 코드 반영 + Notion에 보류/해제/지금 보내기 통과로 기록
- [x] 영업이사 알림 메일에 통화 포인트·예정 시각·관리 링크가 있고 초안 전문은 없음 — `ref=test-c8` 알림 메일로 확인
- [x] 결과 화면·`/privacy`·`CONTENT_GUIDE.md` 17번·`.env.example` 갱신 — 커밋 반영 확인
- [x] Vitest 신규·갱신 테스트 통과, CI 녹색 — 09/03 기준 305개 전체 통과. **Playwright 골든패스만 유일하게 미확인**(프로덕션 DB 직결이라 이번 세션에서 임의 실행 보류)
- [x] `SALES_SIGNATURE` 실제 값 입력 확인(자동 발송 전 게이트) — `catalog.ts`에 김문건 이사 실제 연락처 반영 확인
- [x] C-8 프로덕션 검증 체크리스트 통과 — Notion 기록상 완료(사용자 확인). 등급×업종 9건 육안 검수는 그 시점엔 "선택 QA, 후속 세션"으로 유보돼 있었는데 이번 세션(09-03)에서 완료 — 어색한 조사 병기 발견·수정(커밋 `acb9561`)

---

## 15. 열린 리스크

- 등급×업종 조합에 따라 자동 본문이 어색할 수 있음 → C-8 샘플 9건 검수, 어색한 조합은 `catalog.ts` 문구 보강.
- Vercel Hobby 크론 정확도(수 분 지연 가능) → "09:30 정각" 약속을 문구에 쓰지 않는다.
- Resend 도메인 평판 — 발송량은 작지만 SPF/DKIM/DMARC 설정 상태를 C-8 전에 확인.
- 과도기(SKIPPED) 리드 소급 발송 여부는 D-1에서 사람이 결정 — 이미 수동 발송된 건에 중복 발송되지 않도록 관리자 패널에서 건별 "지금 보내기"만 허용.
