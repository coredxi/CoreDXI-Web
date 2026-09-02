# Claude Code 작업 프롬프트 — AX 체크 자동 팔로업 (2026-09-02, 확정본)

> 사용법: 아래 프롬프트 전문을 복사해 `C:\MyProjects\CoreDXI-Web`에서 실행한 Claude Code 세션에 붙여넣으세요.
> 확정 사항(2026-09-02 영업이사 검토 완료): 메일 문구는 **T0·T1 모두 안 1(정돈된 컨설턴트 톤)**, 서명은 아래 실제 값.

---

```
/ax-check(AX 체크 깔때기)의 "자동 팔로업" 기능을 구현해줘. 근거 문서는 아래 3개이고,
작업 전에 반드시 전부 읽고 시작해.

- 설계: docs/superpowers/specs/2026-09-02-ax-check-auto-followup-design.md  (이 문서가 정본)
- 액션 플랜: docs/superpowers/plans/2026-09-02-sales-channel-auto-followup-action-plan.md
- 메일 문구: docs/superpowers/plans/2026-09-02-ax-check-followup-email-drafts.md
  → 확정: T0·T1 모두 "안 1"을 그대로 사용한다(안 2는 쓰지 않는다).

기존 코드 컨텍스트: src/actions/ax-check.ts, src/lib/ax-check/{catalog,summarize,email-draft,types}.ts,
src/app/admin/(panel)/leads/{EmailDraftPanel,LeadDetailPanel,AdminLeadsManager,LeadList}.tsx,
src/lib/resend.ts, src/lib/rate-limit.ts, src/app/api/csp-report/route.ts(Sentry 패턴), vercel.json.

## 목적

리드가 들어오면 사람 없이도 시스템이 (T0) 제출 즉시 결과 요약 메일을, (T1) 영업일 D+2 09:30 KST에
상세 진단 메일을 자동 발송한다. 영업이사는 메일을 쓰지 않고 HOT 리드 통화만 한다.
관리자는 발송 전에 보류·수정·즉시 발송할 수 있다. 8/30의 "초안 + 수동 발송"은 이 작업으로 대체된다.

## 확정 값 (그대로 사용)

- 영업이사 서명(src/lib/ax-check/catalog.ts SALES_SIGNATURE 교체):
    name: "김문건", title: "이사(Sales)", company: "(주)코어디엑스아이 | CoreDXI",
    phone: "010-7192-0532", email: "obaamg1017@coredxi.com",
    tagline: "기업의 AI Digital workplace 여정을 함께하는 신뢰의 기술 파트너, CoreDXI",
    addresses: ["서울시 서초동 사임당로 27 평화빌딩 4층", "울산광역시 남구 달삼로 76 3층 307호"]
  서명 블록 출력 순서(텍스트 메일):
    김문건 이사(Sales)
    (주)코어디엑스아이 | CoreDXI
    010-7192-0532 | obaamg1017@coredxi.com
    "기업의 AI Digital workplace 여정을 함께하는 신뢰의 기술 파트너, CoreDXI"
    서울시 서초동 사임당로 27 평화빌딩 4층 · 울산광역시 남구 달삼로 76 3층 307호
  기존 email-draft.test.ts의 서명 테스트는 새 필드 구조에 맞게 갱신한다.
- 회신 주소: T0·T1의 replyTo = process.env.SALES_REPLY_TO ?? SALES_SIGNATURE.email
  (.env.example에 SALES_REPLY_TO=obaamg1017@coredxi.com 예시 주석).
- 발신 표시명: from을 "CoreDXI <noreply@coredxi.com>" 형식으로(RESEND_FROM 상수에 표시명 추가,
  기존 문의·뉴스레터 메일에 영향 없는지 확인).
- 결과 화면 문구(AxCheckPriorityCards.tsx):
  "정리된 상세 진단서를 영업일 기준 2~3일 내 메일로 보내드립니다. 우선 과제가 뚜렷한 경우 담당 이사가 직접 연락드립니다."
- T0 제목: "[CoreDXI] {company} AX 체크 결과 — 우선 과제 {n}가지 정리본"
- T1 제목: "[CoreDXI] {company} AX 체크 상세 진단 — 우선 과제 {n}가지와 3개월 로드맵"
- T0·T1 본문: email-drafts.md "안 1"의 여는 말·맺는 말·안내 문구를 FOLLOWUP_COPY 상수로 옮겨 그대로 사용.
  {brochureUrl} 줄은 AX_CHECK_BROCHURE_URL 미설정 시 통째로 생략.

## 착수 전 (프로젝트 지침 5-1)

1. docs/PRD.md·docs/TODO.md·CLAUDE.md 2절에 이번 변경이 반영되어 있는지 확인(2026-09-02 AI 비서 세션이
   1차 반영함). 미커밋 문서(설계·액션플랜·초안·프롬프트·assets/sales-followup/)가 있으면 먼저
   "docs: 영업채널 자동 팔로업 설계·액션플랜·검토 자료 추가" 커밋으로 정리한다.
2. 브랜치 feat/ax-check-auto-followup 을 main 최신에서 새로 딴다. 기존 feat/* 브랜치 위에 얹지 말 것.
3. prisma migrate dev 는 절대 쓰지 않는다. 수동 migration.sql + prisma migrate deploy 만 사용.

## 작업 순서 (설계 문서 절 번호와 대응)

### 1. 데이터 모델 (설계 4절)
- prisma/schema.prisma: enum FollowupStatus(SCHEDULED/HELD/SENDING/SENT/FAILED/SKIPPED),
  AxCheckResponse에 followupStatus(@default SCHEDULED)·followupScheduledAt·followupSentAt·
  followupSubject·followupBody(@db.Text)·followupError·followupAttempts(@default 0)·t0SentAt,
  @@index([followupStatus, followupScheduledAt]).
- prisma/migrations/20260908120000_add_ax_check_followup/migration.sql 을 설계 4절의 SQL 그대로 작성.
  기존 행은 SKIPPED로 채운 뒤 DEFAULT를 SCHEDULED로 바꾸는 2단계 ALTER를 반드시 지킬 것
  (과거 리드에 소급 발송되는 사고 방지).
- src/lib/ax-check/types.ts: AxCheckLeadRecord에 followup 필드·FollowupStatus 타입 추가.

### 2. 영업일 계산 (설계 5절)
- src/lib/ax-check/business-days.ts: addBusinessDays / toKstDateString / kstDateTimeToUtc /
  KR_PUBLIC_HOLIDAYS(2026 잔여: 09-24·09-25·09-26·10-03·10-09·12-25, 2027-01-01). 외부 라이브러리 금지.
- business-days.test.ts: 주말·공휴일·KST 자정 경계·D+2 09:30 KST 케이스.

### 3. 메일 문구·초안 (설계 8절)
- src/lib/ax-check/catalog.ts: SALES_SIGNATURE를 위 확정 값으로 교체(필드 확장), INTRO_COPY 옆에
  FOLLOWUP_COPY 상수(T0 제목·본문 조각, T1 제목·여는 말·맺는 말, 공통 안내 문구 — 전부 안 1).
  홍보팀이 수정할 수 있게 [홍보팀] 주석.
- src/lib/ax-check/email-draft.ts:
  - buildCustomerEmailDraft(answers, summary, contact, opts?: { mode?: "manual" | "auto" }) —
    "auto"는 [[통화에서 말씀 주신 ___]] 슬롯을 제거하고 FOLLOWUP_COPY의 T1 여는 말·맺는 말·안내 문구 사용.
    "manual"(기본)은 기존 출력과 동일해야 한다(기존 테스트 유지, 서명 블록만 새 형식).
  - 신규 buildT0Email(summary, contact, links: { resultUrl, brochureUrl?: string }) → { subject, body }.
- email-draft.test.ts 갱신·추가(서명 5줄, auto 모드에 플레이스홀더 없음, brochureUrl 생략).

### 4. 발송 파이프라인 (설계 6절)
- src/lib/ax-check/followup.ts: isFollowupEnabled / sendFollowupEmail(id, { force }) /
  processDueFollowups({ now, limit }). 선점은 updateMany(count===1)로, 실패 시 FAILED+attempts+
  Sentry.captureException.
- followup.test.ts: 선점 실패 미발송, override 우선, 실패 전이, 3회 초과 건너뜀, 킬 스위치.

### 5. 제출 액션 (설계 3절·8절)
- src/actions/ax-check.ts submitAxCheck:
  - 저장 시 followupStatus(SCHEDULED, 킬 스위치 off면 HELD)·followupScheduledAt 계산.
  - T0 발송(sendResendEmail, replyTo 영업이사) → 성공 시 t0SentAt. 실패는 로그·Sentry, 제출 성공은 유지.
  - 영업이사 알림 메일 개편: 초안 전문 제거, 통화 포인트 3줄(Q3 상위 2개 라벨·Q7 라벨·Q8 라벨),
    예정 발송 시각(KST, 요일 포함), 관리 링크 {siteUrl}/admin/leads?lead={id}. HOT는 제목에 [HOT].
  - 관리자 서버 액션 추가: holdAxCheckFollowup / resumeAxCheckFollowup / sendAxCheckFollowupNow /
    updateAxCheckFollowupDraft / resetAxCheckFollowupDraft (requireAdmin, revalidatePath).
  - listAxCheckResponses에 followup 필드 포함.
- ax-check.test.ts 갱신: T0 1통 + 알림 1통(초안 전문 없음), scheduledAt 계산, HELD 케이스, 새 액션 게이트.

### 6. 크론 라우트 (설계 7절)
- src/app/api/cron/ax-check-followup/route.ts: GET, Bearer CRON_SECRET 검증(미설정·불일치 401),
  processDueFollowups 호출, JSON 카운트 응답, 실패≥1이면 Sentry.captureMessage warning.
  export const dynamic="force-dynamic", maxDuration=60.
- vercel.json에 crons [{ path: "/api/cron/ax-check-followup", schedule: "30 0 * * *" }] 추가(redirects 유지).
- src/middleware.ts: /api/cron 경로가 관리자 리다이렉트 등에 걸리지 않는지 확인, 필요 시 matcher 예외.
- route.test.ts: 401 / 정상 카운트(prisma·resend 모킹).

### 7. 관리자 UI (설계 9절)
- src/app/admin/(panel)/leads/EmailDraftPanel.tsx → "팔로업 메일" 패널로 개편(파일명 유지 가능):
  상태 배지·예정/발송 시각(formatKstDateTime)·T0 여부, 보류/보류 해제/지금 보내기(확인 다이얼로그)/
  본문 수정(textarea, 저장·초안으로 되돌리기), 실패 에러 표시, 미리보기(override 우선), 복사·mailto는 보조.
  shadcn/ui 컴포넌트 우선, rounded-xl, 새 색상 금지(LeadGradeBadge 패턴 재사용), [홍보팀] 주석.
- LeadList/AdminLeadsManager: 상단 카운트 4개(예정/보류/발송/실패), ?lead={id} 자동 선택,
  CSV에 followupStatus·followupSentAt 열 추가.

### 8. 문구·문서 (설계 10절)
- src/components/ax-check/AxCheckPriorityCards.tsx 안내 문구 → 위 확정 문구.
- AxCheckForm 제출 완료 안내에 "결과 요약 메일을 보내드렸습니다" 추가.
- src/app/privacy/page.tsx AX 체크 조항에 결과 안내 메일 자동 발송(제출 직후·영업일 기준 2~3일 내) 명시.
- .env.example: CRON_SECRET / SALES_REPLY_TO(선택, 예시 obaamg1017@coredxi.com) / AX_CHECK_BROCHURE_URL(선택) /
  AX_CHECK_FOLLOWUP_ENABLED(선택, 기본 true) 주석 포함.
- CONTENT_GUIDE.md 17번: FOLLOWUP_COPY·SALES_SIGNATURE 위치, 보류·수정·지금 보내기 방법, 공휴일 상수 갱신, 킬 스위치.
- docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md 5절 상단의
  "2026-09-02 자동 발송 설계로 대체됨" 표기가 있는지 확인.

### 9. 검증·PR
- pnpm lint / npx tsc --noEmit / pnpm test / pnpm test:e2e(ax-check 골든패스) 통과.
- 커밋은 Conventional Commits로 작업 단위별 분리(feat: 데이터 모델·영업일 / feat: 발송 파이프라인·크론 /
  feat: 관리자 패널 / docs: 문구·가이드). 커밋 메시지 끝에 지정된 Co-Authored-By·Claude-Session 라인 유지.
- PR 본문에 설계 문서 링크 + DoD 체크리스트(설계 14절)를 붙이고, 사용자가 할 일을 명시:
  ① Vercel env CRON_SECRET(랜덤 32자+)·SALES_REPLY_TO 등록 ② prisma migrate deploy
  ③ C-8 프로덕션 검증(테스트 ref 제출 → T0 → 크론 수동 호출 → T1 → 보류 1건, 등급×업종 샘플 9건 육안 검수).

## 하지 말 것
- prisma migrate dev, 기존 리드에 소급 자동 발송(SKIPPED 기본값 유지), HTML 메일 도입(텍스트 유지),
  새 외부 라이브러리(날짜·크론), 새 색상 토큰, any 타입, default export, 안 2 문구 혼용.
- 결과 화면·메일에 "09:30 정각" 같은 시각 약속 문구(크론 지연 가능).
```
