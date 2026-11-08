# AX 뉴스레터 발송 시스템 1단계(MVP — 1호 발송) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ⛔ **착수 게이트**: 이 계획의 Task 1 이후 코드 작업은 **신규 기능 착수 게이트 "AX 체크 실응답 5건 + HOT 1건" 충족 후**에만 시작한다(2026-09-06 결정, 설계서 상태란). 게이트 전에는 Task 0(준비, 코드 아님)만 진행한다. 실행자는 착수 전 Notion AI 비서 집무실에서 게이트 충족 여부를 사용자에게 확인받는다.

**Goal:** 네이버 뉴스 검색 API·언론사 RSS로 기사를 매일 수집하고, 규칙 점수로 선별한 초안을 관리자가 승인하면 `NewsletterSubscriber` 구독자에게 "(광고) [AX 위클리]" 메일을 보내는 파이프라인(설계서 11절 "1. MVP")을 만든다.

**Architecture:** 순수 함수 계층(`normalize`·`keyword-filter`·`score-rules`·`schedule`·`subject`·`templates`)을 먼저 TDD로 고정하고, 그 위에 I/O 계층(`collect/*`·`send.ts`)을 prisma·fetch 모킹 테스트로 쌓는다. 진입점은 Vercel Cron 2개(`newsletter-collect` 매일 06:00 KST, `newsletter-send` 매일 08:00 KST)와 관리자 Server Action 2개 파일이며, 발송 로직은 `sendIssue()` 한 곳에만 둔다(`ax-check/followup.ts`의 선점(claim) 패턴 재사용).

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript · Prisma 7(PostgreSQL/Supabase) · Resend · Vitest · Playwright · 신규 의존성 `rss-parser` 1개

**Spec:** `docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md` (실행자는 이 계획과 설계서를 함께 읽는다)

## Global Constraints

- 마이그레이션: `prisma migrate dev` 금지. 수동 `migration.sql` + `npx prisma migrate deploy`만 사용(CLAUDE.md 5번).
- 신규 Prisma 모델 9종 + enum 7종은 설계서 5절 이름 그대로: `NewsletterCampaign`·`NewsletterKeyword`·`NewsletterSelectionRule`·`NewsSource`·`NewsletterCampaignSource`·`NewsArticle`·`NewsletterIssue`·`NewsletterIssueArticle`·`NewsletterDelivery`.
- 환경변수: 네이버 검색 API는 `NAVER_SEARCH_CLIENT_ID` / `NAVER_SEARCH_CLIENT_SECRET` (소셜 로그인용 `NAVER_CLIENT_ID`와 **절대 혼용 금지**). Cron은 기존 `CRON_SECRET`.
- 메일 제목은 반드시 `(광고)`로 시작한다 — 기본 템플릿 `(광고) [AX 위클리] {{issueDate}} 중소기업 AI 도입 소식`(설계 결정 #8).
- 발송 기본값: `sendType=REVIEW_THEN_SEND`, `cadence=WEEKLY`, `sendDayOfWeek=2`(화), `sendHourKst=8`, `collectDays=7`, `maxArticles=7`(설계 결정 #4·#5·#11).
- 1단계에서 `sendType=SCHEDULED`(승인 없는 자동 발송)는 저장 불가 — 2단계에서 활성화(설계 7절 표).
- 저작권: 기사 본문 전문 저장 금지. `snippet`은 200자로 자른다. 매체 로고·이미지 미사용(설계 9절).
- 외부 URL fetch(RSS)는 `isSafeFeedUrl`(https 강제·사설/루프백/링크로컬 IP 차단) 검사를 **등록 시점과 fetch 시점(리다이렉트 매 hop 포함)** 모두 통과해야 한다. 네이버 API 호스트는 상수.
- 관리자 액션: `SUPER_ADMIN` 또는 `EDITOR`만. 캠페인 편집·발송은 `SUPER_ADMIN` 또는 해당 캠페인 `ownerId`/`coManagerIds`.
- UI: 로열 블루 `#1E4E8C`(`primary`), `rounded-xl` 이상, 새 색상 추가 금지. 컴포넌트 파일 상단에 `[홍보팀]` 한국어 주석, `any` 금지, Named Export(페이지 `default export`는 Next.js 규약상 예외).
- 커밋: `feat(newsletter): …` 등 Conventional Commits. 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 검증 명령: `npm run test` · `npm run lint` · `npx tsc --noEmit` · `npm run test:e2e`.
- Vercel 플랜 가정: **Hobby(무료)** — Cron은 하루 1회만 가능하고 실행 시각이 해당 시(hour) 안에서 흔들린다. 따라서 설계서 4절의 "매시 정각 발송 Cron"을 **매일 23:00 UTC(08:00 KST) 1회**로 바꾼다. 예약 시각은 KST 08시 슬롯 기준으로만 의미가 있다(아래 "설계서 대비 변경점" 참고).

### 설계서 대비 변경점 (실행자가 임의로 되돌리지 말 것)

| 항목 | 설계서 | 이 계획 | 이유 |
|---|---|---|---|
| 발송 Cron 주기 | 매시 정각 | 매일 `0 23 * * *` | Hobby 플랜 Cron 1일 1회 제한. 기본 발송 슬롯(화 08:00 KST)과 정확히 맞음 |
| Cron `maxDuration` | 60 | 300 | RSS 15곳 × 10s 타임아웃·발송 스로틀(600ms × 최대 80통)을 감당. 현재 Vercel 기본 한도 300s |
| `NewsletterCampaign.isDraft` | 없음 | 추가 | 설계 3절 "삭제(임시저장만)"을 구현하려면 임시저장 상태가 필요 |
| `NewsletterIssue.editedAt`·`lastError` | 없음 | 추가 | 관리자가 손댄 호를 매일 수집이 덮어쓰지 않게(`editedAt`), 발송 이력 화면 실패 사유 표시(`lastError`) |
| `NewsletterSubscriber.lastSentAt` | "필요 시" | 추가 | 설계 5절 말미 |
| 드래그 정렬 | 드래그 | ▲▼ 버튼 | 신규 의존성(dnd) 회피 |
| 키워드 연산자 UI | OR/AND/NOT | "포함(그룹)"/"제외" 2종 | 설계상 그룹 내 OR·그룹 간 AND라 `AND` 연산자는 의미가 중복. enum에는 남겨 두고 UI에서만 숨김 |
| 메일 양식 파일 | `ax-weekly.tsx` | `ax-weekly.ts` | JSX 없이 HTML 문자열만 생성(설계 8절 "외부 템플릿 엔진 추가 없음"과 동일 취지) |
| 수신자 상한 | 없음 | `NEWSLETTER_MAX_RECIPIENTS`(기본 80) 초과 시 발송 거부 | Resend 무료 일 100통 한도(T0/T1 메일과 공유). 초과 시 2단계 Batch 전환 신호 |
| 신규 테이블 RLS | 언급 없음 | 9개 테이블 `ENABLE ROW LEVEL SECURITY` | 공개 anon 키로 PostgREST 접근 차단. Prisma(소유자 연결)는 영향 없음(`20260707190000` 마이그레이션 주석과 동일 근거) |

## Review Focus

1. **EUC-KR 인코딩 RSS** — 국내 언론사 RSS 일부는 EUC-KR. UTF-8로 디코딩하면 제목이 깨진 채 저장·발송된다 → 헤더/XML 선언의 charset으로 디코딩해야 한다(Task 6 `detectCharset`/`decodeFeedBody` 테스트).
2. **지난 호에 이미 보낸 기사의 재선별** — 수집기간 7일이 발송 주기 7일과 겹쳐, 월요일 기사가 이번 호·다음 호 후보에 모두 들어갈 수 있다 → 같은 캠페인의 `SENT` 호에 `isSelected=true`로 실린 기사는 후보에서 제외(Task 7 테스트).
3. **승인 후 구독 해지한 사람에게 발송** — `QUEUED` 행 생성 후 실제 발송 전에 해지할 수 있다 → 발송 직전 현재 구독자 목록에 없으면 `SKIPPED`(Task 9 테스트).
4. **`(광고)` 누락 제목** — 관리자가 호 제목을 수정하며 `(광고)`를 지울 수 있다 → 발송·테스트 발송 시 `ensureAdPrefix`로 강제(Task 5·9 테스트).
5. **네이버 응답의 HTML 엔티티·`<b>` 태그** — `&quot;AI&quot; <b>도입</b>` 같은 원문이 그대로 메일에 노출되거나 이중 이스케이프된다 → `cleanText`로 태그 제거 후 엔티티 디코딩, 메일 렌더 시 1회만 `escapeHtml`(Task 3·6·8 테스트).
6. **시간대 없는 RSS 날짜** — 아이티조선·블로터 피드는 `2026-10-03 18:30:00`처럼 시간대 없이 준다(Task 0 실측). UTC 서버에서 9시간 미래로 해석되면 "미래 기사 컷(1시간)"에 걸려 최신 기사가 전부 버려진다 → KST로 고정 해석(Task 6 `parseFeedDate` 테스트).

---

## File Structure

| 파일 | 책임 | Task |
|---|---|---|
| `prisma/schema.prisma` (수정) | 신규 모델 9종·enum 7종, `NewsletterSubscriber.lastSentAt` | 1 |
| `prisma/migrations/20261005120000_add_newsletter_distribution/migration.sql` | 수동 DDL + RLS | 1 |
| `src/lib/url-safety.ts` (수정) | `isSafeFeedUrl` 추가 | 2 |
| `src/lib/newsletter/types.ts` | 공용 타입(`KeywordInput`, `CandidateArticle` 등) | 2 |
| `src/lib/newsletter/normalize.ts` | URL 정규화·제목 해시·HTML 정리·매체 도메인 매칭 | 3 |
| `src/lib/newsletter/keyword-filter.ts` | 그룹 AND / 그룹 내 OR / NOT 매칭, 적중률, 네이버 질의어 선택 | 4 |
| `src/lib/newsletter/score-rules.ts` | 1차 규칙 점수(0~100) | 4 |
| `src/lib/newsletter/schedule.ts` | KST 발송 슬롯 계산, 호 기준일 | 5 |
| `src/lib/newsletter/subject.ts` | 제목 템플릿 치환, `(광고)` 강제 | 5 |
| `src/lib/newsletter/defaults.ts` | 기본 지표 5종·기본 제목 템플릿 | 5 |
| `src/lib/newsletter/collect/safe-fetch.ts` | SSRF 가드 fetch + charset 디코딩 | 6 |
| `src/lib/newsletter/collect/naver-news.ts` | 네이버 뉴스 검색 API 클라이언트 | 6 |
| `src/lib/newsletter/collect/rss.ts` | RSS 파싱 | 6 |
| `src/lib/newsletter/issues.ts` | 현재 주기 호(Issue) 찾기/생성 | 7 |
| `src/lib/newsletter/collect/collect-campaign.ts` | 캠페인 1개 수집 오케스트레이션 | 7 |
| `src/lib/resend.ts` (수정) | `headers` 옵션, 성공 시 `id` 반환 | 8 |
| `src/lib/newsletter/templates/ax-weekly.ts` | 메일 HTML/텍스트 렌더 | 8 |
| `src/lib/newsletter/send.ts` | `sendIssue`·`processDueIssues`·`sendTestIssue` | 9 |
| `src/app/api/cron/newsletter-collect/route.ts` | 수집 Cron | 10 |
| `src/app/api/cron/newsletter-send/route.ts` | 발송 Cron | 10 |
| `src/lib/newsletter/campaign-input.ts` | 캠페인 폼 입력 검증·정규화(순수) | 11 |
| `src/lib/newsletter/admin-guard.ts` | 관리자/캠페인 담당자 권한 게이트 | 11 |
| `src/actions/newsletter-campaigns.ts` | 캠페인 CRUD·키워드 미리보기·지금 수집·수동 기사 | 11 |
| `src/actions/newsletter-issues.ts` | 호 편집·미리보기·검토요청·승인·발송·취소·재시도·이력 | 12 |
| `src/app/admin/(panel)/newsletter/layout.tsx` + `NewsletterNav.tsx` | 탭 내비 | 13 |
| `src/app/admin/(panel)/newsletter/campaigns/**` | 캠페인 목록·생성·상세 | 13 |
| `src/app/admin/(panel)/newsletter/campaigns/[id]/articles/**` | 수집 기사 화면 | 14 |
| `src/app/admin/(panel)/newsletter/campaigns/[id]/issues/[issueId]/**` | 선별 편집·미리보기·발송 | 14 |
| `src/app/admin/(panel)/newsletter/history/page.tsx` | 발송 이력 | 14 |
| `scripts/seed-news-sources.ts` | 매체 시드 CSV → `NewsSource` upsert | 15 |
| `e2e/admin-newsletter.spec.ts` | 골든패스 | 15 |
| `vercel.json`·`.env.example`·`CONTENT_GUIDE.md`·`docs/TODO.md`·`docs/PRD.md` (수정) | 설정·문서 | 10·15 |

---

### Task 0: 준비 (코드 아님 — 게이트 전 진행 가능, 사용자 + Claude)

**Files:**
- Create: `docs/superpowers/assets/newsletter/news-sources.csv`

- [ ] **Step 1 (사용자):** 네이버 개발자센터 → 애플리케이션 등록 → 사용 API "검색" → Client ID/Secret을 `.env`에 `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET`로 저장(기존 `NAVER_CLIENT_ID`는 건드리지 않음).
- [x] **Step 2·3 완료(2026-10-04):** 14곳 조사 → 12곳 https RSS 확인. 이데일리는 http 전용(https는 오류 페이지로 302), 디지털데일리는 RSS 경로가 홈으로 302 → 두 곳은 `rssUrl` 비움(도메인 매칭 전용). 전자신문은 속보(Section902, 30건), 매경·한경·서경은 IT 섹션 피드 채택. 아이티조선·블로터는 `pubDate`에 시간대가 없어 Task 6 `parseFeedDate`로 대응.
- [x] **Step 2 (Claude):** IT·경제지 10~15곳 RSS URL 조사(설계 결정 #10 후보: 전자신문·매일경제·서울경제·머니투데이·이데일리·파이낸셜뉴스·아시아경제·이투데이·한국경제·지디넷코리아·아이티조선·디지털데일리·블로터·바이라인네트워크). **https로 응답하는 피드만** `rssUrl`에 기입(http 전용이면 빈칸 → 도메인 매칭 전용).
- [x] **Step 3 (Claude):** 아래 형식으로 CSV 작성. 쉼표가 들어간 값은 쓰지 않는다(파서가 인용부호 미지원). `domain`은 `www.`/`m.` 없는 소문자.

```csv
name,category,homepage,rssUrl,domain,trustWeight,isActive
전자신문,전문일간,https://www.etnews.com,https://rss.etnews.com/Section901.xml,etnews.com,5,true
지디넷코리아,IT전문,https://zdnet.co.kr,,zdnet.co.kr,4,true
```

- [ ] **Step 4 (사용자 확정):** 1호 캠페인 키워드 초안 확정. 권장 시작값:
  - 그룹 1(포함): `AI 도입`(5), `AX`(4), `인공지능 도입`(4), `생성형 AI`(3)
  - 그룹 2(포함): `중소기업`(5), `중견기업`(3), `제조`(2), `SI`(2)
  - 제외: `주가`, `코인`, `채용공고`
- [ ] **Step 5:** Resend 대시보드에서 현재 플랜(무료: 일 100통·월 3,000통)과 `coredxi.com` 도메인 인증 상태 확인.
- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/assets/newsletter/news-sources.csv
git commit -m "docs(newsletter): 매체 시드 CSV(IT·경제지 RSS 조사 결과) 추가"
```

---

### Task 1: 데이터 모델 + 수동 마이그레이션

**Files:**
- Modify: `prisma/schema.prisma` (파일 끝에 추가 + `NewsletterSubscriber`에 1개 컬럼)
- Create: `prisma/migrations/20261005120000_add_newsletter_distribution/migration.sql`

**Interfaces:**
- Produces: Prisma 클라이언트 모델 `prisma.newsletterCampaign` · `newsletterKeyword` · `newsletterSelectionRule` · `newsSource` · `newsletterCampaignSource` · `newsArticle` · `newsletterIssue` · `newsletterIssueArticle` · `newsletterDelivery`, enum 타입 `NewsletterSendType` · `NewsletterCadence` · `KeywordOperator` · `ArticleOrigin` · `IssueStatus` · `DeliveryStatus` (`@/generated/prisma/client`에서 import).

- [ ] **Step 1: 스키마 상단 변경 이력에 한 줄 추가**

```prisma
// v0.6  2026-10-05  AX 뉴스레터 발송 시스템(캠페인·키워드·매체·기사·호·발송이력) 추가
```

- [ ] **Step 2: `NewsletterSubscriber`에 컬럼 추가** (`unsubscribedAt DateTime?` 바로 아래)

```prisma
  lastSentAt       DateTime?
```

- [ ] **Step 3: `prisma/schema.prisma` 파일 끝에 신규 모델 추가**

```prisma
// =====================================================
// AX 뉴스레터 발송 시스템 — docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 5절
// =====================================================
enum NewsletterSendType {
  IMMEDIATE
  SCHEDULED
  REVIEW_THEN_SEND
}

enum NewsletterCadence {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
}

enum KeywordOperator {
  OR
  AND
  NOT
}

enum ArticleOrigin {
  NAVER_API
  RSS
  MANUAL
}

enum IssueStatus {
  COLLECTING
  DRAFT
  REVIEW_REQUESTED
  APPROVED
  SENDING
  SENT
  FAILED
  CANCELED
}

enum DeliveryStatus {
  QUEUED
  SENT
  FAILED
  SKIPPED
}

model NewsletterCampaign {
  id                 String             @id @default(cuid())
  name               String
  subjectTemplate    String
  sendType           NewsletterSendType @default(REVIEW_THEN_SEND)
  cadence            NewsletterCadence  @default(WEEKLY)
  sendDayOfWeek      Int?
  sendHourKst        Int                @default(8)
  activeFrom         DateTime
  activeUntil        DateTime?
  collectDays        Int                @default(7)
  maxArticles        Int                @default(7)
  templateKey        String             @default("ax-weekly")
  audience           String             @default("subscribers")
  internalRecipients String[]           @default([])
  ownerId            String
  coManagerIds       String[]           @default([])
  isActive           Boolean            @default(true)
  isDraft            Boolean            @default(true)
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  keywords NewsletterKeyword[]
  rules    NewsletterSelectionRule[]
  sources  NewsletterCampaignSource[]
  issues   NewsletterIssue[]

  @@index([isActive])
}

model NewsletterKeyword {
  id         String             @id @default(cuid())
  campaignId String
  campaign   NewsletterCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  group      Int
  operator   KeywordOperator    @default(OR)
  term       String
  weight     Int                @default(1)

  @@index([campaignId])
}

model NewsletterSelectionRule {
  id          String             @id @default(cuid())
  campaignId  String
  campaign    NewsletterCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  indicator   String
  label       String
  description String
  weight      Int                @default(1)
  isEnabled   Boolean            @default(true)

  @@unique([campaignId, indicator])
}

model NewsSource {
  id          String                     @id @default(cuid())
  name        String                     @unique
  category    String
  homepage    String
  rssUrl      String?
  domain      String                     @unique
  trustWeight Int                        @default(3)
  isActive    Boolean                    @default(true)
  campaigns   NewsletterCampaignSource[]
  articles    NewsArticle[]
}

model NewsletterCampaignSource {
  campaignId String
  sourceId   String
  campaign   NewsletterCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  source     NewsSource         @relation(fields: [sourceId], references: [id])

  @@id([campaignId, sourceId])
}

model NewsArticle {
  id            String                   @id @default(cuid())
  urlNormalized String                   @unique
  originalUrl   String
  title         String
  snippet       String?
  publishedAt   DateTime
  sourceId      String?
  source        NewsSource?              @relation(fields: [sourceId], references: [id])
  sourceName    String?
  origin        ArticleOrigin
  collectedAt   DateTime                 @default(now())
  titleHash     String
  issueArticles NewsletterIssueArticle[]

  @@index([publishedAt])
  @@index([titleHash])
}

model NewsletterIssue {
  id             String             @id @default(cuid())
  campaignId     String
  campaign       NewsletterCampaign @relation(fields: [campaignId], references: [id])
  issueNo        Int
  issueDate      DateTime
  subject        String
  intro          String?
  status         IssueStatus        @default(COLLECTING)
  scheduledAt    DateTime?
  approvedById   String?
  approvedAt     DateTime?
  sentAt         DateTime?
  recipientCount Int                @default(0)
  editedAt       DateTime?
  lastError      String?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  articles   NewsletterIssueArticle[]
  deliveries NewsletterDelivery[]

  @@unique([campaignId, issueNo])
  @@index([status, scheduledAt])
}

model NewsletterIssueArticle {
  id              String          @id @default(cuid())
  issueId         String
  articleId       String
  issue           NewsletterIssue @relation(fields: [issueId], references: [id], onDelete: Cascade)
  article         NewsArticle     @relation(fields: [articleId], references: [id])
  ruleScore       Int
  llmScore        Int?
  llmReason       String?
  summary         String?
  indicatorScores Json?
  isSelected      Boolean         @default(false)
  sortOrder       Int             @default(0)
  editorNote      String?

  @@unique([issueId, articleId])
}

model NewsletterDelivery {
  id           String          @id @default(cuid())
  issueId      String
  issue        NewsletterIssue @relation(fields: [issueId], references: [id], onDelete: Cascade)
  subscriberId String?
  email        String
  status       DeliveryStatus  @default(QUEUED)
  resendId     String?
  error        String?
  sentAt       DateTime?

  @@unique([issueId, email])
  @@index([issueId, status])
}
```

- [ ] **Step 4: 스키마 검증·클라이언트 생성**

Run: `npx prisma validate ; npx prisma generate`
Expected: `The schema at prisma/schema.prisma is valid` / `Generated Prisma Client`

- [ ] **Step 5: DDL 생성(DB 접속 없이 스키마 간 diff)**

```bash
mkdir -p prisma/migrations/20261005120000_add_newsletter_distribution
git show HEAD:prisma/schema.prisma > "$TMPDIR/schema-before.prisma"
npx prisma migrate diff --from-schema "$TMPDIR/schema-before.prisma" --to-schema prisma/schema.prisma --script > prisma/migrations/20261005120000_add_newsletter_distribution/migration.sql
```

Expected: 파일에 `CREATE TYPE "NewsletterSendType"` … `CREATE TABLE "NewsletterDelivery"` 9개 테이블, `ALTER TABLE "NewsletterSubscriber" ADD COLUMN "lastSentAt"`, FK `ALTER TABLE … ADD CONSTRAINT` 들이 포함됨. **`DROP` 문이 하나라도 있으면 중단**하고 원인(로컬 스키마가 HEAD와 다름)을 확인한다. `$TMPDIR`이 없으면 스크래치 디렉터리 경로를 쓴다.

- [ ] **Step 6: migration.sql 끝에 RLS 블록 추가**

```sql
-- Supabase Security Advisor "RLS Disabled in Public" 예방 — 20260707190000 마이그레이션과 같은 근거.
-- Prisma는 테이블 소유자 연결이라 RLS 영향을 받지 않고, 공개 anon 키의 PostgREST 접근만 막힌다.
ALTER TABLE "NewsletterCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterKeyword" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterSelectionRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterCampaignSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsArticle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterIssue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterIssueArticle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterDelivery" ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 7: 타입체크·기존 테스트 회귀 확인**

Run: `npx tsc --noEmit ; npm run test`
Expected: 오류 0, 기존 테스트 전부 PASS. (`migrate deploy`는 이 Task에서 **실행하지 않는다** — Task 16에서 사용자 확인 후 적용.)

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261005120000_add_newsletter_distribution/migration.sql
git commit -m "feat(newsletter): 뉴스레터 발송 시스템 데이터 모델 9종 + 수동 마이그레이션"
```

---

### Task 2: 공용 타입 + 피드 URL 안전성 검사

**Files:**
- Create: `src/lib/newsletter/types.ts`
- Modify: `src/lib/url-safety.ts` (파일 끝에 추가)
- Test: `src/lib/url-safety.test.ts` (기존 파일에 describe 추가)

**Interfaces:**
- Produces:
  - `type KeywordOperatorValue = "OR" | "AND" | "NOT"`
  - `type KeywordInput = { group: number; operator: KeywordOperatorValue; term: string; weight: number }`
  - `type ArticleOriginValue = "NAVER_API" | "RSS" | "MANUAL"`
  - `type CandidateArticle = { title: string; snippet: string | null; originalUrl: string; publishedAt: Date; origin: ArticleOriginValue }`
  - `type NewsletterActionResult<T extends object = object> = ({ success: true } & T) | { success: false; error: string }`
  - `isSafeFeedUrl(url: string): boolean`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/lib/url-safety.test.ts` 끝에 추가(상단 import에 `isSafeFeedUrl` 추가)

```ts
describe("isSafeFeedUrl", () => {
  it.each([
    "https://rss.etnews.com/Section901.xml",
    "https://www.mk.co.kr/rss/30000001/",
  ])("공개 https 피드는 허용: %s", (url) => {
    expect(isSafeFeedUrl(url)).toBe(true);
  });

  it.each([
    "http://rss.etnews.com/Section901.xml", // https 아님
    "https://localhost/feed",
    "https://127.0.0.1/feed",
    "https://10.0.0.5/feed",
    "https://192.168.0.1/feed",
    "https://172.16.3.4/feed",
    "https://169.254.169.254/latest/meta-data", // 클라우드 메타데이터
    "https://100.64.0.1/feed", // CGNAT
    "https://0.0.0.0/feed",
    "https://2130706433/feed", // 정수형 127.0.0.1
    "https://[::1]/feed",
    "https://user:pass@example.com/feed",
    "https://intranet.internal/feed",
    "not a url",
  ])("차단: %s", (url) => {
    expect(isSafeFeedUrl(url)).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/url-safety.test.ts`
Expected: FAIL — `isSafeFeedUrl is not a function` (또는 import 오류)

- [ ] **Step 3: 구현** — `src/lib/url-safety.ts` 끝에 추가

```ts
/**
 * [홍보팀] 뉴스레터 RSS 피드처럼 관리자가 등록한 외부 URL을 서버가 가져가도 안전한지 검사한다.
 * https만 허용하고, 사설·루프백·링크로컬(클라우드 메타데이터)·CGNAT 대역, 정수형/IPv6 리터럴,
 * 계정정보가 포함된 URL은 모두 막는다(SSRF 방지). 등록 시점과 fetch 시점(리다이렉트 포함) 모두 호출한다.
 */
export function isSafeFeedUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.toLowerCase();
  if (host.startsWith("[") || host.includes(":")) return false; // IPv6 리터럴 전면 차단
  if (/^\d+$/.test(host)) return false; // 정수형 IP 표기
  if (isBlockedHost(host)) return false;
  if (/^(0\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(host)) return false;
  return true;
}
```

- [ ] **Step 4: 공용 타입 파일 작성** — `src/lib/newsletter/types.ts`

```ts
/**
 * types.ts — AX 뉴스레터 발송 시스템 공용 타입
 * [홍보팀] 화면·수집·발송 코드가 함께 쓰는 데이터 모양 정의입니다. 값 자체를 바꾸는 곳은 아닙니다.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md
 */

export type KeywordOperatorValue = "OR" | "AND" | "NOT";

/** 자료검색 키워드 1개. 같은 group 안은 OR, group 간은 AND, operator=NOT은 group 무관 제외어. */
export type KeywordInput = {
  group: number;
  operator: KeywordOperatorValue;
  term: string;
  /** 우선순위 1~5 — 규칙 점수 가중치 */
  weight: number;
};

export type ArticleOriginValue = "NAVER_API" | "RSS" | "MANUAL";

/** 수집 직후(DB 저장 전) 기사. 본문 전문은 담지 않는다(저작권). */
export type CandidateArticle = {
  title: string;
  snippet: string | null;
  originalUrl: string;
  publishedAt: Date;
  origin: ArticleOriginValue;
};

export type NewsletterActionResult<T extends object = object> =
  | ({ success: true } & T)
  | { success: false; error: string };
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/url-safety.test.ts`
Expected: PASS (기존 케이스 포함)

- [ ] **Step 6: Commit**

```bash
git add src/lib/url-safety.ts src/lib/url-safety.test.ts src/lib/newsletter/types.ts
git commit -m "feat(newsletter): RSS 피드 URL SSRF 가드(isSafeFeedUrl)와 공용 타입 추가"
```

---

### Task 3: 정규화 유틸 (URL·제목 해시·HTML 정리·매체 매칭)

**Files:**
- Create: `src/lib/newsletter/normalize.ts`
- Test: `src/lib/newsletter/normalize.test.ts`

**Interfaces:**
- Produces:
  - `normalizeUrl(raw: string): string | null`
  - `decodeEntities(s: string): string`
  - `cleanText(s: string | null | undefined): string`
  - `normalizeTitle(title: string): string`
  - `computeTitleHash(title: string): string` (16자 hex)
  - `hostOf(url: string): string | null`
  - `matchSourceByDomain<T extends { domain: string }>(url: string, sources: readonly T[]): T | null`
  - `SNIPPET_MAX_LENGTH = 200`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/lib/newsletter/normalize.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  cleanText,
  computeTitleHash,
  decodeEntities,
  hostOf,
  matchSourceByDomain,
  normalizeTitle,
  normalizeUrl,
} from "./normalize";

describe("normalizeUrl", () => {
  it("추적 파라미터·해시를 지우고 https·소문자 호스트로 통일한다", () => {
    expect(
      normalizeUrl("http://WWW.Example.com/news/1?utm_source=x&id=7&fbclid=abc#top")
    ).toBe("https://example.com/news/1?id=7");
  });

  it("남은 쿼리는 키 순서로 정렬해 같은 기사를 같은 키로 만든다", () => {
    expect(normalizeUrl("https://a.com/n?b=2&a=1")).toBe(normalizeUrl("https://a.com/n?a=1&b=2"));
  });

  it("모바일 서브도메인과 끝 슬래시를 정리한다", () => {
    expect(normalizeUrl("https://m.example.com/news/1/")).toBe("https://example.com/news/1");
  });

  it("http/https가 아니거나 잘못된 URL은 null", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
});

describe("cleanText / decodeEntities", () => {
  it("네이버 응답의 <b> 태그를 지우고 엔티티를 디코딩한다", () => {
    expect(cleanText("&quot;AI&quot; <b>도입</b> 가속&amp;확산")).toBe('"AI" 도입 가속&확산');
  });

  it("숫자 엔티티와 연속 공백을 처리한다", () => {
    expect(cleanText("A&#39;s  \n &#x4E2D; test")).toBe("A's 中 test");
  });

  it("모르는 엔티티는 그대로 둔다", () => {
    expect(decodeEntities("&unknown;")).toBe("&unknown;");
  });

  it("null/undefined는 빈 문자열", () => {
    expect(cleanText(null)).toBe("");
    expect(cleanText(undefined)).toBe("");
  });
});

describe("normalizeTitle / computeTitleHash", () => {
  it("말머리·괄호·매체명 접미를 제거해 전재 기사를 같은 해시로 묶는다", () => {
    const a = computeTitleHash("[단독] 중소기업 AI 도입 확산 (종합) - 전자신문");
    const b = computeTitleHash("중소기업 AI 도입 확산 | 매일경제");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it("다른 제목은 다른 해시", () => {
    expect(computeTitleHash("AI 도입 확산")).not.toBe(computeTitleHash("AI 도입 둔화"));
  });

  it("정규화 결과가 비어도 서로 다른 제목끼리 충돌하지 않는다", () => {
    expect(normalizeTitle("[속보]")).not.toBe("");
    expect(computeTitleHash("[속보]")).not.toBe(computeTitleHash("[단독]"));
  });
});

describe("hostOf / matchSourceByDomain", () => {
  const sources = [
    { id: "s1", domain: "mk.co.kr" },
    { id: "s2", domain: "etnews.com" },
  ];

  it("www·m 접두를 떼고 호스트를 돌려준다", () => {
    expect(hostOf("https://www.mk.co.kr/news/1")).toBe("mk.co.kr");
    expect(hostOf("bad")).toBeNull();
  });

  it("서브도메인까지 매칭한다", () => {
    expect(matchSourceByDomain("https://news.mk.co.kr/a", sources)?.id).toBe("s1");
    expect(matchSourceByDomain("https://m.etnews.com/b", sources)?.id).toBe("s2");
  });

  it("접미만 같은 다른 도메인은 매칭하지 않는다", () => {
    expect(matchSourceByDomain("https://fakemk.co.kr/a", sources)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/newsletter/normalize.test.ts`
Expected: FAIL — `Cannot find module './normalize'`

- [ ] **Step 3: 구현** — `src/lib/newsletter/normalize.ts`

```ts
/**
 * normalize.ts — 수집 기사 정규화(중복 제거 키·텍스트 정리·매체 매칭). 순수 함수.
 * [홍보팀] 같은 기사가 여러 매체·주소로 들어와도 한 번만 보이게 만드는 규칙입니다.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 6-1
 */
import { createHash } from "crypto";

export const SNIPPET_MAX_LENGTH = 200;

const TRACKING_PARAM = /^(utm_.*|fbclid|gclid|igshid|mc_cid|mc_eid)$/i;
const HOST_PREFIX = /^(www|m|mobile)\./;

export function normalizeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  const kept = [...u.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAM.test(key))
    .sort(([a], [b]) => a.localeCompare(b));

  const host = u.hostname.toLowerCase().replace(HOST_PREFIX, "");
  const path = u.pathname.replace(/\/+$/, "") || "/";
  const query = kept.length
    ? `?${kept.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}`
    : "";
  return `https://${host}${path === "/" ? "" : path}${query}`;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  middot: "·",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#")) {
      const n =
        code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** HTML 태그 제거 → 엔티티 디코딩 → 공백 정리. 결과는 "평문"이며 HTML로 쓸 때는 반드시 escapeHtml 1회. */
export function cleanText(s: string | null | undefined): string {
  if (!s) return "";
  return decodeEntities(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

export function normalizeTitle(title: string): string {
  const base = cleanText(title);
  const stripped = base
    .replace(/\[[^\]]*\]|【[^】]*】|\([^)]*\)/g, " ")
    .replace(/\s[-|–—]\s[^-|–—]{1,20}$/, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
  // 말머리만 있는 제목처럼 정규화 결과가 비면 원문(공백 제거)으로 대체 — 빈 문자열 해시 충돌 방지
  return stripped || base.toLowerCase().replace(/\s+/g, "");
}

export function computeTitleHash(title: string): string {
  return createHash("sha1").update(normalizeTitle(title)).digest("hex").slice(0, 16);
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(HOST_PREFIX, "");
  } catch {
    return null;
  }
}

export function matchSourceByDomain<T extends { domain: string }>(
  url: string,
  sources: readonly T[]
): T | null {
  const host = hostOf(url);
  if (!host) return null;
  return sources.find((s) => host === s.domain || host.endsWith(`.${s.domain}`)) ?? null;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/newsletter/normalize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/newsletter/normalize.ts src/lib/newsletter/normalize.test.ts
git commit -m "feat(newsletter): 기사 URL·제목 정규화와 매체 도메인 매칭 유틸"
```

---

### Task 4: 선별 엔진 — 키워드 필터 + 1차 규칙 점수

**Files:**
- Create: `src/lib/newsletter/keyword-filter.ts`, `src/lib/newsletter/score-rules.ts`
- Test: `src/lib/newsletter/keyword-filter.test.ts`, `src/lib/newsletter/score-rules.test.ts`

**Interfaces:**
- Consumes: `KeywordInput` (Task 2)
- Produces:
  - `type KeywordMatch = { passes: boolean; groupHits: { group: number; bestScore: number; maxScore: number }[] }`
  - `matchKeywords(keywords: readonly KeywordInput[], title: string, snippet: string): KeywordMatch`
  - `keywordHitRate(match: KeywordMatch): number` (0~1)
  - `pickQueryTerms(keywords: readonly KeywordInput[]): string[]`
  - `type RuleScoreInput = { hitRate: number; publishedAt: Date; now: Date; collectDays: number; trustWeight: number | null; dupCount: number }`
  - `computeRuleScore(input: RuleScoreInput): number` (0~100 정수)
  - `recencyFactor`, `credibilityFactor`, `uniquenessFactor` (각 0~1)

- [ ] **Step 1: 키워드 필터 실패 테스트** — `src/lib/newsletter/keyword-filter.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { keywordHitRate, matchKeywords, pickQueryTerms } from "./keyword-filter";
import type { KeywordInput } from "./types";

const KW: KeywordInput[] = [
  { group: 1, operator: "OR", term: "AI 도입", weight: 5 },
  { group: 1, operator: "OR", term: "AX", weight: 4 },
  { group: 2, operator: "OR", term: "중소기업", weight: 5 },
  { group: 2, operator: "OR", term: "제조", weight: 2 },
  { group: 2, operator: "OR", term: "SI", weight: 2 },
  { group: 0, operator: "NOT", term: "주가", weight: 1 },
];

describe("matchKeywords", () => {
  it("모든 그룹에서 하나 이상 적중하면 통과(그룹 간 AND)", () => {
    expect(matchKeywords(KW, "중소기업 AI 도입 가속", "").passes).toBe(true);
  });

  it("한 그룹이라도 적중이 없으면 탈락", () => {
    expect(matchKeywords(KW, "대기업 AI 도입", "").passes).toBe(false);
  });

  it("제외어가 제목이나 요약에 있으면 탈락", () => {
    expect(matchKeywords(KW, "중소기업 AI 도입", "관련주 주가 급등").passes).toBe(false);
  });

  it("대소문자·연속 공백을 무시한다", () => {
    expect(matchKeywords(KW, "중소기업  ai   도입", "").passes).toBe(true);
  });

  it("포함 키워드가 하나도 없으면 아무것도 통과하지 않는다", () => {
    const onlyNot: KeywordInput[] = [{ group: 0, operator: "NOT", term: "주가", weight: 1 }];
    expect(matchKeywords(onlyNot, "아무 기사", "").passes).toBe(false);
  });

  it("빈 문자열 키워드는 무시한다(모든 기사에 적중하는 사고 방지)", () => {
    const withBlank: KeywordInput[] = [{ group: 1, operator: "OR", term: "  ", weight: 5 }];
    expect(matchKeywords(withBlank, "아무 기사", "").passes).toBe(false);
  });
});

describe("keywordHitRate", () => {
  it("제목 적중(×2)은 요약 적중(×1)보다 높다", () => {
    const inTitle = keywordHitRate(matchKeywords(KW, "중소기업 AI 도입", ""));
    const inSnippet = keywordHitRate(matchKeywords(KW, "기사", "중소기업 AI 도입"));
    expect(inTitle).toBe(1);
    expect(inSnippet).toBe(0.5);
  });

  it("가중치가 낮은 키워드로만 적중하면 적중률이 낮다", () => {
    const rate = keywordHitRate(matchKeywords(KW, "제조 AX", ""));
    // 그룹1 best=4*2=8/max10, 그룹2 best=2*2=4/max10 → 12/20
    expect(rate).toBeCloseTo(0.6);
  });

  it("탈락 기사는 0", () => {
    expect(keywordHitRate(matchKeywords(KW, "무관", ""))).toBe(0);
  });
});

describe("pickQueryTerms", () => {
  it("용어 수가 가장 적은 포함 그룹의 용어만 질의한다(AND 결과는 반드시 이 그룹 용어를 포함)", () => {
    expect(pickQueryTerms(KW)).toEqual(["AI 도입", "AX"]);
  });

  it("포함 그룹이 없으면 빈 배열", () => {
    expect(pickQueryTerms([{ group: 0, operator: "NOT", term: "주가", weight: 1 }])).toEqual([]);
  });

  it("중복·공백 용어를 정리한다", () => {
    const kw: KeywordInput[] = [
      { group: 1, operator: "OR", term: " AI ", weight: 1 },
      { group: 1, operator: "OR", term: "AI", weight: 1 },
    ];
    expect(pickQueryTerms(kw)).toEqual(["AI"]);
  });
});
```

- [ ] **Step 2: 점수 실패 테스트** — `src/lib/newsletter/score-rules.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  computeRuleScore,
  credibilityFactor,
  recencyFactor,
  uniquenessFactor,
} from "./score-rules";

const NOW = new Date("2026-10-06T00:00:00Z");
const DAY = 86_400_000;

describe("recencyFactor", () => {
  it("오늘 기사 1.0, 수집기간 끝 0.2로 선형 감쇠", () => {
    expect(recencyFactor(NOW, NOW, 7)).toBe(1);
    expect(recencyFactor(new Date(NOW.getTime() - 7 * DAY), NOW, 7)).toBeCloseTo(0.2);
    expect(recencyFactor(new Date(NOW.getTime() - 3.5 * DAY), NOW, 7)).toBeCloseTo(0.6);
  });

  it("미래 날짜는 1.0, 기간 초과는 0.2로 고정", () => {
    expect(recencyFactor(new Date(NOW.getTime() + DAY), NOW, 7)).toBe(1);
    expect(recencyFactor(new Date(NOW.getTime() - 30 * DAY), NOW, 7)).toBeCloseTo(0.2);
  });

  it("collectDays가 0 이하여도 0으로 나누지 않는다", () => {
    expect(Number.isFinite(recencyFactor(new Date(NOW.getTime() - DAY), NOW, 0))).toBe(true);
  });
});

describe("credibilityFactor / uniquenessFactor", () => {
  it("미등록 매체 0.4, 등록 매체 trustWeight/5", () => {
    expect(credibilityFactor(null)).toBe(0.4);
    expect(credibilityFactor(5)).toBe(1);
    expect(credibilityFactor(9)).toBe(1);
  });

  it("단독 기사 0, 5개 매체 이상 전재 1", () => {
    expect(uniquenessFactor(1)).toBe(0);
    expect(uniquenessFactor(3)).toBe(0.5);
    expect(uniquenessFactor(10)).toBe(1);
  });
});

describe("computeRuleScore", () => {
  it("모든 요소 최대면 100", () => {
    expect(
      computeRuleScore({ hitRate: 1, publishedAt: NOW, now: NOW, collectDays: 7, trustWeight: 5, dupCount: 5 })
    ).toBe(100);
  });

  it("가중합을 반올림한 정수", () => {
    // 40*0.5 + 25*1 + 20*0.4 + 15*0 = 53
    expect(
      computeRuleScore({ hitRate: 0.5, publishedAt: NOW, now: NOW, collectDays: 7, trustWeight: null, dupCount: 1 })
    ).toBe(53);
  });

  it("범위를 벗어난 입력도 0~100으로 고정", () => {
    expect(
      computeRuleScore({ hitRate: 3, publishedAt: NOW, now: NOW, collectDays: 7, trustWeight: 5, dupCount: 99 })
    ).toBe(100);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/newsletter/keyword-filter.test.ts src/lib/newsletter/score-rules.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 4: 키워드 필터 구현** — `src/lib/newsletter/keyword-filter.ts`

```ts
/**
 * keyword-filter.ts — 캠페인 키워드로 기사 통과 여부·적중률 계산. 순수 함수.
 * [홍보팀] "(AI 도입 OR AX) AND (중소기업 OR 제조)" 같은 검색 조건을 실제로 판정하는 규칙입니다.
 * 같은 그룹 안 단어는 하나만 맞아도 되고, 모든 그룹이 맞아야 통과합니다. "제외" 단어가 있으면 탈락.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 5절 NewsletterKeyword, 6-1
 */
import type { KeywordInput } from "./types";

export type KeywordMatch = {
  passes: boolean;
  groupHits: { group: number; bestScore: number; maxScore: number }[];
};

const FAIL: KeywordMatch = { passes: false, groupHits: [] };

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function clampWeight(w: number): number {
  return Math.min(5, Math.max(1, Math.round(w)));
}

function positiveGroups(keywords: readonly KeywordInput[]): Map<number, KeywordInput[]> {
  const groups = new Map<number, KeywordInput[]>();
  for (const k of keywords) {
    if (k.operator === "NOT" || !norm(k.term)) continue;
    const list = groups.get(k.group) ?? [];
    list.push(k);
    groups.set(k.group, list);
  }
  return groups;
}

export function matchKeywords(
  keywords: readonly KeywordInput[],
  title: string,
  snippet: string
): KeywordMatch {
  const t = norm(title);
  const s = norm(snippet);

  for (const k of keywords) {
    const term = norm(k.term);
    if (k.operator === "NOT" && term && (t.includes(term) || s.includes(term))) return FAIL;
  }

  const groups = positiveGroups(keywords);
  if (groups.size === 0) return FAIL;

  const groupHits: KeywordMatch["groupHits"] = [];
  for (const [group, terms] of groups) {
    let best = 0;
    let max = 0;
    for (const k of terms) {
      const term = norm(k.term);
      const w = clampWeight(k.weight);
      max = Math.max(max, w * 2);
      const score = t.includes(term) ? w * 2 : s.includes(term) ? w : 0;
      best = Math.max(best, score);
    }
    if (best === 0) return FAIL;
    groupHits.push({ group, bestScore: best, maxScore: max });
  }
  return { passes: true, groupHits };
}

export function keywordHitRate(match: KeywordMatch): number {
  if (!match.passes) return 0;
  const best = match.groupHits.reduce((acc, g) => acc + g.bestScore, 0);
  const max = match.groupHits.reduce((acc, g) => acc + g.maxScore, 0);
  return max === 0 ? 0 : best / max;
}

/**
 * 네이버 API는 불리언 연산을 지원하지 않으므로, 용어 수가 가장 적은 포함 그룹의 용어만 각각 질의한다.
 * AND 조건을 만족하는 기사는 반드시 이 그룹의 용어 하나를 포함하므로 누락이 없다.
 */
export function pickQueryTerms(keywords: readonly KeywordInput[]): string[] {
  const groups = [...positiveGroups(keywords).values()];
  if (groups.length === 0) return [];
  const smallest = groups.reduce((a, b) => (b.length < a.length ? b : a));
  return [...new Set(smallest.map((k) => k.term.trim()))];
}
```

- [ ] **Step 5: 규칙 점수 구현** — `src/lib/newsletter/score-rules.ts`

```ts
/**
 * score-rules.ts — 1차 규칙 기반 선별 점수(0~100). 순수 함수.
 * [홍보팀] 키워드 적중 40점 + 최신성 25점 + 매체 신뢰도 20점 + "여러 매체가 다룬 큰 뉴스" 15점.
 * 비율을 바꾸려면 RULE_WEIGHTS만 수정하면 됩니다(합계 100 유지).
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 6-2
 */

export const RULE_WEIGHTS = { keyword: 40, recency: 25, credibility: 20, uniqueness: 15 } as const;

const DAY_MS = 86_400_000;

export type RuleScoreInput = {
  hitRate: number;
  publishedAt: Date;
  now: Date;
  collectDays: number;
  trustWeight: number | null;
  dupCount: number;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function recencyFactor(publishedAt: Date, now: Date, collectDays: number): number {
  const days = (now.getTime() - publishedAt.getTime()) / DAY_MS;
  if (days <= 0) return 1;
  const span = Math.max(1, collectDays);
  return 1 - (0.8 * Math.min(days, span)) / span;
}

export function credibilityFactor(trustWeight: number | null): number {
  if (trustWeight == null) return 0.4;
  return Math.min(5, Math.max(1, trustWeight)) / 5;
}

export function uniquenessFactor(dupCount: number): number {
  return clamp01(Math.max(0, dupCount - 1) / 4);
}

export function computeRuleScore(input: RuleScoreInput): number {
  const raw =
    RULE_WEIGHTS.keyword * clamp01(input.hitRate) +
    RULE_WEIGHTS.recency * recencyFactor(input.publishedAt, input.now, input.collectDays) +
    RULE_WEIGHTS.credibility * credibilityFactor(input.trustWeight) +
    RULE_WEIGHTS.uniqueness * uniquenessFactor(input.dupCount);
  return Math.max(0, Math.min(100, Math.round(raw)));
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/lib/newsletter/keyword-filter.test.ts src/lib/newsletter/score-rules.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/newsletter/keyword-filter.ts src/lib/newsletter/keyword-filter.test.ts src/lib/newsletter/score-rules.ts src/lib/newsletter/score-rules.test.ts
git commit -m "feat(newsletter): 키워드 AND/OR/NOT 필터와 1차 규칙 점수 엔진"
```

---

### Task 5: 주기 계산 + 제목 템플릿 + 기본값

**Files:**
- Create: `src/lib/newsletter/schedule.ts`, `src/lib/newsletter/subject.ts`, `src/lib/newsletter/defaults.ts`
- Test: `src/lib/newsletter/schedule.test.ts`, `src/lib/newsletter/subject.test.ts`

**Interfaces:**
- Produces:
  - `type CadenceValue = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY"`
  - `type ScheduleInput = { cadence: CadenceValue; sendDayOfWeek: number | null; sendHourKst: number; activeFrom: Date; activeUntil: Date | null }`
  - `computeNextSendAt(s: ScheduleInput, from: Date): Date | null` — `from`보다 **엄격히 뒤**인 첫 슬롯(UTC Date)
  - `kstDateKey(date: Date): Date` — 그 시각의 KST 날짜 00:00을 UTC 순간으로
  - `formatKstYmd(date: Date): string` — `"2026-10-06"`
  - `kstYmdToUtc(ymd: string, endOfDay?: boolean): Date | null`
  - `renderSubjectTemplate(template: string, vars: { issueNo: number; issueDate: Date }): string`
  - `ensureAdPrefix(subject: string): string`
  - `AD_PREFIX = "(광고)"`, `DEFAULT_SUBJECT_TEMPLATE`, `DEFAULT_SELECTION_RULES: readonly { indicator: string; label: string; description: string; weight: number }[]`, `DEFAULT_SEND_DAY_OF_WEEK = 2`

- [ ] **Step 1: 실패 테스트** — `src/lib/newsletter/schedule.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { computeNextSendAt, formatKstYmd, kstDateKey, kstYmdToUtc, type ScheduleInput } from "./schedule";

// 2026-10-05(월) 12:00 KST = 03:00 UTC
const MON_NOON_KST = new Date("2026-10-05T03:00:00Z");
const base: ScheduleInput = {
  cadence: "WEEKLY",
  sendDayOfWeek: 2,
  sendHourKst: 8,
  activeFrom: new Date("2026-10-01T00:00:00Z"),
  activeUntil: null,
};

describe("computeNextSendAt", () => {
  it("WEEKLY 화 08시 → 다음 날 화요일 08:00 KST(= 월 23:00 UTC)", () => {
    expect(computeNextSendAt(base, MON_NOON_KST)?.toISOString()).toBe("2026-10-05T23:00:00.000Z");
  });

  it("슬롯과 정확히 같은 시각이면 다음 주로 넘어간다(엄격히 이후)", () => {
    const slot = new Date("2026-10-05T23:00:00Z");
    expect(computeNextSendAt(base, slot)?.toISOString()).toBe("2026-10-12T23:00:00.000Z");
  });

  it("DAILY는 다음 08:00 KST", () => {
    expect(computeNextSendAt({ ...base, cadence: "DAILY" }, MON_NOON_KST)?.toISOString()).toBe(
      "2026-10-05T23:00:00.000Z"
    );
  });

  it("BIWEEKLY는 activeFrom 기준 짝수 주에만", () => {
    const s: ScheduleInput = { ...base, cadence: "BIWEEKLY", activeFrom: new Date("2026-10-05T23:00:00Z") };
    expect(computeNextSendAt(s, MON_NOON_KST)?.toISOString()).toBe("2026-10-05T23:00:00.000Z");
    expect(computeNextSendAt(s, new Date("2026-10-06T00:00:00Z"))?.toISOString()).toBe(
      "2026-10-19T23:00:00.000Z"
    );
  });

  it("MONTHLY는 매월 첫째 주 해당 요일", () => {
    const s: ScheduleInput = { ...base, cadence: "MONTHLY" };
    // 10월 첫째 화요일(10/6)은 이미 지났다고 보고 from=10/7 → 11월 첫째 화요일 11/3
    expect(computeNextSendAt(s, new Date("2026-10-07T00:00:00Z"))?.toISOString()).toBe(
      "2026-11-02T23:00:00.000Z"
    );
  });

  it("사용기간 시작 전이면 시작 이후 첫 슬롯", () => {
    const s = { ...base, activeFrom: new Date("2026-10-20T00:00:00Z") };
    expect(computeNextSendAt(s, MON_NOON_KST)?.toISOString()).toBe("2026-10-26T23:00:00.000Z");
  });

  it("사용기간이 끝났으면 null", () => {
    const s = { ...base, activeUntil: new Date("2026-10-05T10:00:00Z") };
    expect(computeNextSendAt(s, MON_NOON_KST)).toBeNull();
  });

  it("요일 미지정 WEEKLY는 화요일 기본값", () => {
    expect(computeNextSendAt({ ...base, sendDayOfWeek: null }, MON_NOON_KST)?.toISOString()).toBe(
      "2026-10-05T23:00:00.000Z"
    );
  });
});

describe("kstDateKey / formatKstYmd / kstYmdToUtc", () => {
  it("UTC 23:00(=KST 다음날 08:00)의 KST 날짜는 다음날", () => {
    const slot = new Date("2026-10-05T23:00:00Z");
    expect(formatKstYmd(slot)).toBe("2026-10-06");
    expect(kstDateKey(slot).toISOString()).toBe("2026-10-05T15:00:00.000Z");
  });

  it("YYYY-MM-DD를 KST 자정/하루 끝으로 변환", () => {
    expect(kstYmdToUtc("2026-12-31")?.toISOString()).toBe("2026-12-30T15:00:00.000Z");
    expect(kstYmdToUtc("2026-12-31", true)?.toISOString()).toBe("2026-12-31T14:59:59.999Z");
    expect(kstYmdToUtc("2026-13-40")).toBeNull();
    expect(kstYmdToUtc("abc")).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 테스트** — `src/lib/newsletter/subject.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { ensureAdPrefix, renderSubjectTemplate } from "./subject";

describe("renderSubjectTemplate", () => {
  it("{{issueDate}}·{{issueNo}}를 KST 날짜·회차로 치환", () => {
    expect(
      renderSubjectTemplate("(광고) [AX 위클리 #{{issueNo}}] {{issueDate}} 소식", {
        issueNo: 3,
        issueDate: new Date("2026-10-05T15:00:00Z"),
      })
    ).toBe("(광고) [AX 위클리 #3] 2026-10-06 소식");
  });
});

describe("ensureAdPrefix", () => {
  it("(광고)가 없으면 앞에 붙인다", () => {
    expect(ensureAdPrefix("[AX 위클리] 소식")).toBe("(광고) [AX 위클리] 소식");
  });

  it("이미 있으면(앞 공백 포함) 중복으로 붙이지 않는다", () => {
    expect(ensureAdPrefix("  (광고) [AX 위클리]")).toBe("(광고) [AX 위클리]");
  });

  it("[테스트] 접두가 있어도 (광고)를 맨 앞에 둔다", () => {
    expect(ensureAdPrefix("[테스트] (광고) 소식")).toBe("(광고) [테스트] 소식");
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/newsletter/schedule.test.ts src/lib/newsletter/subject.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 4: 구현** — `src/lib/newsletter/schedule.ts`

```ts
/**
 * schedule.ts — 뉴스레터 발송 슬롯(KST) 계산. 순수 함수.
 * [홍보팀] "매주 화요일 오전 8시" 같은 캠페인 설정을 실제 발송 시각으로 바꿔 주는 계산기입니다.
 * 한국 시간은 서머타임이 없어 UTC+9 고정으로 계산합니다.
 */
import { DEFAULT_SEND_DAY_OF_WEEK } from "./defaults";

export type CadenceValue = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export type ScheduleInput = {
  cadence: CadenceValue;
  sendDayOfWeek: number | null;
  sendHourKst: number;
  activeFrom: Date;
  activeUntil: Date | null;
};

const KST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;
const SEARCH_DAYS = 70; // 격주·월간 슬롯을 찾기에 충분한 탐색 범위

function kstParts(date: Date) {
  const k = new Date(date.getTime() + KST_OFFSET_MS);
  return { y: k.getUTCFullYear(), m0: k.getUTCMonth(), d: k.getUTCDate(), dow: k.getUTCDay() };
}

function kstToUtc(y: number, m0: number, d: number, h: number): Date {
  return new Date(Date.UTC(y, m0, d, h) - KST_OFFSET_MS);
}

function kstDayNumber(date: Date): number {
  return Math.floor((date.getTime() + KST_OFFSET_MS) / DAY_MS);
}

function matchesCadence(s: ScheduleInput, candidate: Date): boolean {
  if (s.cadence === "DAILY") return true;
  const p = kstParts(candidate);
  if (p.dow !== (s.sendDayOfWeek ?? DEFAULT_SEND_DAY_OF_WEEK)) return false;
  if (s.cadence === "WEEKLY") return true;
  if (s.cadence === "BIWEEKLY") {
    const diffDays = kstDayNumber(candidate) - kstDayNumber(s.activeFrom);
    return Math.floor(diffDays / 7) % 2 === 0;
  }
  return p.d <= 7; // MONTHLY — 첫째 주 해당 요일
}

export function computeNextSendAt(s: ScheduleInput, from: Date): Date | null {
  const start = from < s.activeFrom ? s.activeFrom : from;
  const p = kstParts(start);
  for (let i = -1; i <= SEARCH_DAYS; i++) {
    const candidate = kstToUtc(p.y, p.m0, p.d + i, s.sendHourKst);
    if (candidate <= from || candidate < s.activeFrom) continue;
    if (s.activeUntil && candidate > s.activeUntil) return null;
    if (matchesCadence(s, candidate)) return candidate;
  }
  return null;
}

export function kstDateKey(date: Date): Date {
  const p = kstParts(date);
  return kstToUtc(p.y, p.m0, p.d, 0);
}

export function formatKstYmd(date: Date): string {
  const p = kstParts(date);
  return `${p.y}-${String(p.m0 + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** "YYYY-MM-DD"(KST 달력) → 그 날 00:00:00.000 KST(또는 endOfDay면 23:59:59.999 KST)의 UTC 순간. */
export function kstYmdToUtc(ymd: string, endOfDay = false): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const start = kstToUtc(y, mo, d, 0);
  if (formatKstYmd(start) !== ymd) return null; // 2026-13-40 같은 값 거부
  return endOfDay ? new Date(start.getTime() + DAY_MS - 1) : start;
}
```

- [ ] **Step 5: 구현** — `src/lib/newsletter/defaults.ts`

```ts
/**
 * defaults.ts — 뉴스레터 캠페인 기본값
 * [홍보팀] 새 캠페인을 만들 때 미리 채워지는 값입니다. 제목 앞 "(광고)"는 법적 표기라 지우지 마세요.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 2절 #4·#5·#8·#11
 */

export const DEFAULT_SUBJECT_TEMPLATE = "(광고) [AX 위클리] {{issueDate}} 중소기업 AI 도입 소식";
export const DEFAULT_SEND_DAY_OF_WEEK = 2; // 화요일
export const DEFAULT_SEND_HOUR_KST = 8;
export const DEFAULT_COLLECT_DAYS = 7;
export const DEFAULT_MAX_ARTICLES = 7;

/** 선별지표 5종 — 1단계에선 저장만 하고, 2단계 Claude 점수 프롬프트에 description이 그대로 들어간다. */
export const DEFAULT_SELECTION_RULES = [
  { indicator: "relevance", label: "관련성", description: "중소기업 대표가 AI 도입·AX 전환을 판단하는 데 직접 도움이 되는가", weight: 3 },
  { indicator: "timeliness", label: "시의성", description: "이번 주에 알아야 할 새 소식인가(정책·지원사업 마감 포함)", weight: 2 },
  { indicator: "credibility", label: "신뢰도", description: "출처가 분명하고 과장·홍보성 표현이 적은가", weight: 2 },
  { indicator: "novelty", label: "신규성", description: "이미 널리 알려진 내용의 반복이 아닌가", weight: 1 },
  { indicator: "depth", label: "상세도", description: "사례·수치·방법이 구체적으로 담겨 있는가", weight: 1 },
] as const;
```

- [ ] **Step 6: 구현** — `src/lib/newsletter/subject.ts`

```ts
/**
 * subject.ts — 뉴스레터 메일 제목 생성
 * [홍보팀] 제목 템플릿의 {{issueDate}}(발행일)·{{issueNo}}(회차)를 실제 값으로 바꿉니다.
 * 광고성 정보 표기(정보통신망법 §50) 때문에 발송 직전 항상 "(광고)"를 맨 앞에 강제합니다.
 */
import { formatKstYmd } from "./schedule";

export const AD_PREFIX = "(광고)";

export function renderSubjectTemplate(
  template: string,
  vars: { issueNo: number; issueDate: Date }
): string {
  return template
    .replaceAll("{{issueDate}}", formatKstYmd(vars.issueDate))
    .replaceAll("{{issueNo}}", String(vars.issueNo))
    .trim();
}

export function ensureAdPrefix(subject: string): string {
  const withoutPrefix = subject.replace(/\(광고\)\s*/g, "").trim();
  return `${AD_PREFIX} ${withoutPrefix}`;
}
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest run src/lib/newsletter/schedule.test.ts src/lib/newsletter/subject.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/newsletter/schedule.ts src/lib/newsletter/schedule.test.ts src/lib/newsletter/subject.ts src/lib/newsletter/subject.test.ts src/lib/newsletter/defaults.ts
git commit -m "feat(newsletter): KST 발송 슬롯 계산·제목 템플릿·(광고) 강제·기본값"
```

---

### Task 6: 수집 클라이언트 — 안전 fetch · 네이버 뉴스 API · RSS

**Files:**
- Modify: `package.json` (의존성 `rss-parser`)
- Create: `src/lib/newsletter/collect/safe-fetch.ts`, `src/lib/newsletter/collect/naver-news.ts`, `src/lib/newsletter/collect/rss.ts`
- Test: `src/lib/newsletter/collect/safe-fetch.test.ts`, `src/lib/newsletter/collect/naver-news.test.ts`, `src/lib/newsletter/collect/rss.test.ts`

**Interfaces:**
- Consumes: `isSafeFeedUrl` (Task 2), `cleanText`·`SNIPPET_MAX_LENGTH` (Task 3), `CandidateArticle` (Task 2)
- Produces:
  - `type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>`
  - `class UnsafeUrlError extends Error`
  - `safeFetchText(url: string, opts?: { fetchImpl?: FetchLike }): Promise<string>`
  - `detectCharset(bytes: Uint8Array, contentType: string | null): string`
  - `decodeFeedBody(bytes: Uint8Array, contentType: string | null): string`
  - `NAVER_NEWS_ENDPOINT`, `class NaverNewsError extends Error`
  - `getNaverSearchCredentials(): { clientId: string; clientSecret: string } | null`
  - `searchNaverNews(query: string, opts?: { display?: number; fetchImpl?: FetchLike }): Promise<CandidateArticle[]>`
  - `parseFeedDate(raw: string | undefined): Date | null` (시간대 없는 날짜는 KST)
  - `parseRssXml(xml: string): Promise<CandidateArticle[]>`
  - `fetchRssArticles(rssUrl: string, opts?: { fetchImpl?: FetchLike }): Promise<CandidateArticle[]>`

- [ ] **Step 1: 의존성 설치**

Run: `npm install rss-parser`
Expected: `package.json` dependencies에 `"rss-parser"` 추가, `package-lock.json` 갱신

- [ ] **Step 2: 실패 테스트** — `src/lib/newsletter/collect/safe-fetch.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { UnsafeUrlError, decodeFeedBody, detectCharset, safeFetchText, type FetchLike } from "./safe-fetch";

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("detectCharset / decodeFeedBody", () => {
  it("Content-Type 헤더의 charset이 최우선", () => {
    expect(detectCharset(utf8("<?xml version='1.0'?>"), "text/xml; charset=EUC-KR")).toBe("euc-kr");
  });

  it("헤더에 없으면 XML 선언의 encoding", () => {
    expect(detectCharset(utf8('<?xml version="1.0" encoding="euc-kr"?><rss/>'), "text/xml")).toBe("euc-kr");
  });

  it("둘 다 없으면 utf-8", () => {
    expect(detectCharset(utf8("<rss/>"), null)).toBe("utf-8");
  });

  it("EUC-KR 바이트를 한글로 디코딩한다", () => {
    const bytes = new Uint8Array([0xc7, 0xd1, 0xb1, 0xb9]); // "한국"
    expect(decodeFeedBody(bytes, "text/xml; charset=euc-kr")).toBe("한국");
  });

  it("알 수 없는 charset이면 utf-8로 폴백", () => {
    expect(decodeFeedBody(utf8("가나"), "text/xml; charset=x-unknown")).toBe("가나");
  });
});

describe("safeFetchText", () => {
  it("안전하지 않은 URL은 fetch 없이 거부", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    await expect(safeFetchText("http://example.com/rss", { fetchImpl })).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("리다이렉트 목적지도 매 hop 검사한다(사설 IP로 튀는 리다이렉트 차단)", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest" } })
    );
    await expect(safeFetchText("https://example.com/rss", { fetchImpl })).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("안전한 리다이렉트는 따라가 본문을 돌려준다", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/feed.xml" } }))
      .mockResolvedValueOnce(new Response("<rss/>", { status: 200, headers: { "content-type": "text/xml" } }));
    await expect(safeFetchText("https://example.com/rss", { fetchImpl })).resolves.toBe("<rss/>");
    expect(String(fetchImpl.mock.calls[1][0])).toBe("https://example.com/feed.xml");
  });

  it("리다이렉트가 3번 이상이면 실패", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockImplementation(async () =>
      new Response(null, { status: 302, headers: { location: "https://example.com/again" } })
    );
    await expect(safeFetchText("https://example.com/rss", { fetchImpl })).rejects.toThrow("리다이렉트");
  });

  it("HTTP 오류는 상태코드를 담아 실패", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(new Response("x", { status: 503 }));
    await expect(safeFetchText("https://example.com/rss", { fetchImpl })).rejects.toThrow("503");
  });
});
```

- [ ] **Step 3: 실패 테스트** — `src/lib/newsletter/collect/naver-news.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NaverNewsError, searchNaverNews, type FetchLike } from "./naver-news";

beforeEach(() => {
  process.env.NAVER_SEARCH_CLIENT_ID = "id";
  process.env.NAVER_SEARCH_CLIENT_SECRET = "secret";
});
afterEach(() => {
  delete process.env.NAVER_SEARCH_CLIENT_ID;
  delete process.env.NAVER_SEARCH_CLIENT_SECRET;
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("searchNaverNews", () => {
  it("검색 전용 자격증명 헤더로 최신순 100건을 요청한다", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ items: [] }));
    await searchNaverNews("AI 도입", { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    const u = new URL(String(url));
    expect(u.origin + u.pathname).toBe("https://openapi.naver.com/v1/search/news.json");
    expect(u.searchParams.get("query")).toBe("AI 도입");
    expect(u.searchParams.get("display")).toBe("100");
    expect(u.searchParams.get("sort")).toBe("date");
    expect(new Headers(init?.headers).get("X-Naver-Client-Id")).toBe("id");
  });

  it("<b>·엔티티를 정리하고 originallink를 우선 사용한다", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse({
        items: [
          {
            title: "&quot;중소기업&quot; <b>AI 도입</b>",
            originallink: "https://www.etnews.com/1",
            link: "https://n.news.naver.com/1",
            description: "요약 <b>내용</b>",
            pubDate: "Mon, 05 Oct 2026 09:00:00 +0900",
          },
          {
            title: "원문 링크 없음",
            originallink: "",
            link: "https://n.news.naver.com/2",
            description: "",
            pubDate: "Mon, 05 Oct 2026 10:00:00 +0900",
          },
        ],
      })
    );
    const items = await searchNaverNews("AI", { fetchImpl });
    expect(items[0]).toEqual({
      title: '"중소기업" AI 도입',
      snippet: "요약 내용",
      originalUrl: "https://www.etnews.com/1",
      publishedAt: new Date("2026-10-05T00:00:00Z"),
      origin: "NAVER_API",
    });
    expect(items[1].originalUrl).toBe("https://n.news.naver.com/2");
    expect(items[1].snippet).toBeNull();
  });

  it("날짜를 해석할 수 없는 항목은 버린다", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse({ items: [{ title: "t", originallink: "https://a.com", link: "", description: "", pubDate: "garbage" }] })
    );
    expect(await searchNaverNews("AI", { fetchImpl })).toEqual([]);
  });

  it("자격증명이 없으면 NaverNewsError", async () => {
    delete process.env.NAVER_SEARCH_CLIENT_ID;
    await expect(searchNaverNews("AI", { fetchImpl: vi.fn<FetchLike>() })).rejects.toBeInstanceOf(NaverNewsError);
  });

  it("소셜 로그인용 NAVER_CLIENT_ID만 있으면 사용하지 않는다", async () => {
    delete process.env.NAVER_SEARCH_CLIENT_ID;
    process.env.NAVER_CLIENT_ID = "oauth-id";
    await expect(searchNaverNews("AI", { fetchImpl: vi.fn<FetchLike>() })).rejects.toBeInstanceOf(NaverNewsError);
    delete process.env.NAVER_CLIENT_ID;
  });

  it("HTTP 오류는 상태코드를 담은 NaverNewsError", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ errorMessage: "x" }, 429));
    await expect(searchNaverNews("AI", { fetchImpl })).rejects.toThrow("429");
  });
});
```

- [ ] **Step 4: 실패 테스트** — `src/lib/newsletter/collect/rss.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { parseFeedDate, parseRssXml } from "./rss";

describe("parseFeedDate", () => {
  it("시간대 표기가 있으면 그대로 해석(RFC 822·콜론 오프셋·공백 누락 변형 포함)", () => {
    expect(parseFeedDate("Sat, 03 Oct 2026 11:41:45 +09:00")?.toISOString()).toBe("2026-10-03T02:41:45.000Z");
    expect(parseFeedDate("Sat,3 Oct 2026 13:24:20 +0900")?.toISOString()).toBe("2026-10-03T04:24:20.000Z");
    expect(parseFeedDate("Fri, 02 Oct 2026 09:00:06 +0000")?.toISOString()).toBe("2026-10-02T09:00:06.000Z");
    expect(parseFeedDate("2026-10-03T09:30:00Z")?.toISOString()).toBe("2026-10-03T09:30:00.000Z");
  });

  it("시간대 없는 날짜(아이티조선·블로터 등 ndsoft 계열)는 KST로 해석한다 — 서버 시간대(UTC)와 무관", () => {
    expect(parseFeedDate("2026-10-03 18:30:00")?.toISOString()).toBe("2026-10-03T09:30:00.000Z");
  });

  it("해석 불가면 null", () => {
    expect(parseFeedDate("garbage")).toBeNull();
    expect(parseFeedDate(undefined)).toBeNull();
  });
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>테스트</title>
<item><title><![CDATA[중소기업 <b>AI</b> 도입]]></title><link>https://www.etnews.com/1</link>
<pubDate>Mon, 05 Oct 2026 09:00:00 +0900</pubDate><description><![CDATA[<p>${"가".repeat(300)}</p>]]></description></item>
<item><title>링크 없음</title><pubDate>Mon, 05 Oct 2026 09:00:00 +0900</pubDate></item>
<item><title>날짜 없음</title><link>https://a.com/2</link></item>
</channel></rss>`;

describe("parseRssXml", () => {
  it("제목 정리·200자 요약·RSS origin으로 변환하고 불완전 항목은 버린다", async () => {
    const items = await parseRssXml(XML);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("중소기업 AI 도입");
    expect(items[0].originalUrl).toBe("https://www.etnews.com/1");
    expect(items[0].publishedAt.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(items[0].snippet?.length).toBe(200);
    expect(items[0].origin).toBe("RSS");
  });

  it("잘못된 XML은 예외", async () => {
    await expect(parseRssXml("<not-rss")).rejects.toThrow();
  });
});
```

- [ ] **Step 5: 실패 확인**

Run: `npx vitest run src/lib/newsletter/collect`
Expected: FAIL — 모듈 없음

- [ ] **Step 6: 구현** — `src/lib/newsletter/collect/safe-fetch.ts`

```ts
/**
 * safe-fetch.ts — 관리자 등록 외부 URL(RSS)을 SSRF 가드와 함께 가져온다.
 * [홍보팀] 등록된 언론사 RSS 주소만 안전하게 읽어오는 장치입니다. 내부망 주소로 우회하는 요청은 막습니다.
 * 국내 언론사 RSS 일부가 EUC-KR이라 charset을 직접 판별해 디코딩한다.
 */
import { isSafeFeedUrl } from "@/lib/url-safety";

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class UnsafeUrlError extends Error {}

const MAX_REDIRECTS = 2;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const USER_AGENT = "CoreDXI-NewsletterBot/1.0 (+https://www.coredxi.com)";

export function detectCharset(bytes: Uint8Array, contentType: string | null): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 200));
  const fromXml = head.match(/encoding=["']([\w-]+)["']/i)?.[1];
  return (fromXml ?? "utf-8").toLowerCase();
}

export function decodeFeedBody(bytes: Uint8Array, contentType: string | null): string {
  const charset = detectCharset(bytes, contentType);
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export async function safeFetchText(url: string, opts: { fetchImpl?: FetchLike } = {}): Promise<string> {
  const fetchImpl: FetchLike = opts.fetchImpl ?? fetch;
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeFeedUrl(current)) throw new UnsafeUrlError(`허용되지 않은 URL입니다: ${current}`);

    const res = await fetchImpl(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
      },
      cache: "no-store",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`리다이렉트 응답에 location이 없습니다 (${res.status})`);
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`피드 요청 실패: HTTP ${res.status}`);

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) throw new Error("피드 응답이 너무 큽니다(2MB 초과)");
    return decodeFeedBody(new Uint8Array(buffer), res.headers.get("content-type"));
  }
  throw new Error("리다이렉트가 너무 많습니다");
}
```

- [ ] **Step 7: 구현** — `src/lib/newsletter/collect/naver-news.ts`

```ts
/**
 * naver-news.ts — 네이버 뉴스 검색 API 클라이언트
 * [홍보팀] 캠페인 키워드로 최신 기사를 찾아오는 부분입니다. 기사 본문은 받지 않고 제목·짧은 설명·링크·날짜만 씁니다.
 * 자격증명은 검색 전용 NAVER_SEARCH_CLIENT_ID/SECRET — 소셜 로그인용 NAVER_CLIENT_ID와 다른 앱이다.
 */
import { SNIPPET_MAX_LENGTH, cleanText } from "../normalize";
import type { CandidateArticle } from "../types";
import type { FetchLike } from "./safe-fetch";

export type { FetchLike };

export const NAVER_NEWS_ENDPOINT = "https://openapi.naver.com/v1/search/news.json";

export class NaverNewsError extends Error {}

type NaverNewsItem = {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
};

export function getNaverSearchCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function searchNaverNews(
  query: string,
  opts: { display?: number; fetchImpl?: FetchLike } = {}
): Promise<CandidateArticle[]> {
  const credentials = getNaverSearchCredentials();
  if (!credentials) {
    throw new NaverNewsError("NAVER_SEARCH_CLIENT_ID/SECRET 환경변수가 설정되지 않았습니다.");
  }

  const url = new URL(NAVER_NEWS_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(Math.min(100, Math.max(1, opts.display ?? 100))));
  url.searchParams.set("sort", "date");

  const fetchImpl: FetchLike = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(url, {
    headers: {
      "X-Naver-Client-Id": credentials.clientId,
      "X-Naver-Client-Secret": credentials.clientSecret,
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new NaverNewsError(`네이버 뉴스 API 오류: HTTP ${res.status}`);

  const body = (await res.json()) as { items?: NaverNewsItem[] };
  return (body.items ?? []).flatMap((item): CandidateArticle[] => {
    const originalUrl = item.originallink || item.link;
    const publishedAt = new Date(item.pubDate);
    const title = cleanText(item.title);
    if (!originalUrl || !title || Number.isNaN(publishedAt.getTime())) return [];
    const snippet = cleanText(item.description).slice(0, SNIPPET_MAX_LENGTH);
    return [{ title, snippet: snippet || null, originalUrl, publishedAt, origin: "NAVER_API" }];
  });
}
```

- [ ] **Step 8: 구현** — `src/lib/newsletter/collect/rss.ts`

```ts
/**
 * rss.ts — 언론사 RSS 수집
 * [홍보팀] 매체 목록에서 "RSS 사용"으로 켠 언론사의 최신 기사 목록을 읽어옵니다(본문 전문 저장 안 함).
 */
import Parser from "rss-parser";
import { SNIPPET_MAX_LENGTH, cleanText } from "../normalize";
import type { CandidateArticle } from "../types";
import { safeFetchText, type FetchLike } from "./safe-fetch";

const parser = new Parser();

const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2}|GMT|UTC|KST)\s*$/i;
const NAIVE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * 피드 날짜 해석. ndsoft 계열 국내 매체(아이티조선·블로터 등)는 "2026-10-03 18:30:00"처럼 시간대 없이 주는데,
 * new Date()는 이를 서버 로컬 시간(Vercel=UTC)으로 읽어 9시간 미래가 된다 → 시간대 없는 값은 KST로 고정 해석.
 * (2026-10-04 Task 0 RSS 실측에서 발견)
 */
export function parseFeedDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const naive = HAS_TIMEZONE.test(s) ? null : NAIVE_DATETIME.exec(s);
  if (naive) {
    const [, y, mo, d, h, mi, sec] = naive;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h - 9, +mi, sec ? +sec : 0));
  }
  const date = new Date(s);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function parseRssXml(xml: string): Promise<CandidateArticle[]> {
  const feed = await parser.parseString(xml);
  return feed.items.flatMap((item): CandidateArticle[] => {
    const title = cleanText(item.title);
    // isoDate는 rss-parser가 new Date(pubDate)로 이미 변환한 값이라 시간대 없는 날짜가 틀어져 있다 → 원문 pubDate 우선
    const publishedAt = parseFeedDate(item.pubDate ?? item.isoDate);
    if (!item.link || !title || !publishedAt) return [];
    const snippet = cleanText(item.contentSnippet ?? item.summary ?? item.content ?? "").slice(
      0,
      SNIPPET_MAX_LENGTH
    );
    return [{ title, snippet: snippet || null, originalUrl: item.link, publishedAt, origin: "RSS" }];
  });
}

export async function fetchRssArticles(
  rssUrl: string,
  opts: { fetchImpl?: FetchLike } = {}
): Promise<CandidateArticle[]> {
  return parseRssXml(await safeFetchText(rssUrl, opts));
}
```

- [ ] **Step 9: 통과 확인**

Run: `npx vitest run src/lib/newsletter/collect`
Expected: PASS. EUC-KR 테스트가 실패하면 Node가 small-icu 빌드인 것 — `node -p "new TextDecoder('euc-kr').encoding"`이 `euc-kr`을 출력하는지 확인하고, 실패 시 Node 22+ 공식 빌드로 교체(Vercel 런타임은 full-icu).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/lib/newsletter/collect
git commit -m "feat(newsletter): 네이버 뉴스 검색 API·RSS 수집 클라이언트(SSRF 가드·EUC-KR 대응)"
```

---

### Task 7: 호(Issue) 주기 관리 + 캠페인 수집 오케스트레이터

**Files:**
- Create: `src/lib/newsletter/issues.ts`, `src/lib/newsletter/collect/collect-campaign.ts`
- Test: `src/lib/newsletter/issues.test.ts`, `src/lib/newsletter/collect/collect-campaign.test.ts`

**Interfaces:**
- Consumes: `computeNextSendAt`·`kstDateKey` (Task 5), `renderSubjectTemplate` (Task 5), `normalizeUrl`·`computeTitleHash`·`matchSourceByDomain`·`SNIPPET_MAX_LENGTH` (Task 3), `matchKeywords`·`keywordHitRate`·`pickQueryTerms` (Task 4), `computeRuleScore` (Task 4), `searchNaverNews`·`fetchRssArticles` (Task 6)
- Produces:
  - `EDITABLE_ISSUE_STATUSES: readonly ["COLLECTING", "DRAFT", "REVIEW_REQUESTED"]`
  - `type CampaignForIssue = { id: string; sendType: "IMMEDIATE" | "SCHEDULED" | "REVIEW_THEN_SEND"; subjectTemplate: string } & ScheduleInput`
  - `type CurrentIssue = { id: string; status: IssueStatus; editedAt: Date | null }`
  - `ensureCurrentIssue(campaign: CampaignForIssue, now: Date): Promise<CurrentIssue | null>`
  - `type CollectDeps = { searchNaver: (q: string) => Promise<CandidateArticle[]>; fetchRss: (url: string) => Promise<CandidateArticle[]> }`
  - `type CollectResult = { campaignId: string; fetched: number; stored: number; matched: number; attached: number; issueId: string | null; errors: string[] }`
  - `collectCampaign(campaignId: string, opts?: { now?: Date; deps?: CollectDeps }): Promise<CollectResult>`
  - `scoreArticleForCampaign(...)` 는 내부 함수(비공개)

- [ ] **Step 1: 실패 테스트** — `src/lib/newsletter/issues.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  newsletterIssue: { findFirst: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { ensureCurrentIssue } = await import("./issues");

const campaign = {
  id: "c1",
  sendType: "REVIEW_THEN_SEND" as const,
  subjectTemplate: "(광고) [AX 위클리 #{{issueNo}}] {{issueDate}}",
  cadence: "WEEKLY" as const,
  sendDayOfWeek: 2,
  sendHourKst: 8,
  activeFrom: new Date("2026-10-01T00:00:00Z"),
  activeUntil: null,
};
const NOW = new Date("2026-10-05T03:00:00Z"); // 월 12:00 KST

beforeEach(() => vi.clearAllMocks());

describe("ensureCurrentIssue", () => {
  it("다음 발송일(화) 호가 없으면 다음 회차로 만든다", async () => {
    prismaMock.newsletterIssue.findFirst.mockResolvedValue(null);
    prismaMock.newsletterIssue.aggregate.mockResolvedValue({ _max: { issueNo: 4 } });
    prismaMock.newsletterIssue.create.mockResolvedValue({ id: "i5", status: "COLLECTING", editedAt: null });

    const issue = await ensureCurrentIssue(campaign, NOW);

    expect(issue?.id).toBe("i5");
    expect(prismaMock.newsletterIssue.create).toHaveBeenCalledWith({
      data: {
        campaignId: "c1",
        issueNo: 5,
        issueDate: new Date("2026-10-05T15:00:00Z"),
        subject: "(광고) [AX 위클리 #5] 2026-10-06",
        status: "COLLECTING",
      },
      select: { id: true, status: true, editedAt: true },
    });
  });

  it("같은 발송일 호가 편집 가능 상태면 그대로 돌려준다", async () => {
    prismaMock.newsletterIssue.findFirst.mockResolvedValue({ id: "i4", status: "DRAFT", editedAt: null });
    expect((await ensureCurrentIssue(campaign, NOW))?.id).toBe("i4");
    expect(prismaMock.newsletterIssue.create).not.toHaveBeenCalled();
  });

  it("같은 발송일 호가 이미 승인/발송됐으면 null(덮어쓰지 않음)", async () => {
    prismaMock.newsletterIssue.findFirst.mockResolvedValue({ id: "i4", status: "APPROVED", editedAt: null });
    expect(await ensureCurrentIssue(campaign, NOW)).toBeNull();
  });

  it("사용기간이 끝난 캠페인은 null", async () => {
    expect(await ensureCurrentIssue({ ...campaign, activeUntil: new Date("2026-10-01T00:00:00Z") }, NOW)).toBeNull();
  });

  it("IMMEDIATE 캠페인은 날짜와 무관하게 취소되지 않은 기존 호 하나만 쓴다", async () => {
    prismaMock.newsletterIssue.findFirst.mockResolvedValue({ id: "i1", status: "SENT", editedAt: null });
    expect(await ensureCurrentIssue({ ...campaign, sendType: "IMMEDIATE" }, NOW)).toBeNull();
    expect(prismaMock.newsletterIssue.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campaignId: "c1", status: { not: "CANCELED" } } })
    );
  });

  it("회차 경쟁(P2002)이 나면 다시 조회해 기존 호를 돌려준다", async () => {
    prismaMock.newsletterIssue.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "i5", status: "COLLECTING", editedAt: null });
    prismaMock.newsletterIssue.aggregate.mockResolvedValue({ _max: { issueNo: 4 } });
    prismaMock.newsletterIssue.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    expect((await ensureCurrentIssue(campaign, NOW))?.id).toBe("i5");
  });
});
```

- [ ] **Step 2: 실패 테스트** — `src/lib/newsletter/collect/collect-campaign.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  newsletterCampaign: { findUnique: vi.fn() },
  newsSource: { findMany: vi.fn() },
  newsArticle: { findMany: vi.fn(), upsert: vi.fn() },
  newsletterIssueArticle: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  newsletterIssue: { update: vi.fn() },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const ensureCurrentIssueMock = vi.fn();
vi.mock("../issues", () => ({ ensureCurrentIssue: (...a: unknown[]) => ensureCurrentIssueMock(...a) }));

const { collectCampaign } = await import("./collect-campaign");

const NOW = new Date("2026-10-05T03:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const campaign = {
  id: "c1",
  sendType: "REVIEW_THEN_SEND",
  subjectTemplate: "(광고) t",
  cadence: "WEEKLY",
  sendDayOfWeek: 2,
  sendHourKst: 8,
  activeFrom: new Date("2026-10-01T00:00:00Z"),
  activeUntil: null,
  collectDays: 7,
  maxArticles: 2,
  keywords: [
    { group: 1, operator: "OR", term: "AI 도입", weight: 5 },
    { group: 2, operator: "OR", term: "중소기업", weight: 5 },
    { group: 0, operator: "NOT", term: "주가", weight: 1 },
  ],
  sources: [{ source: { id: "s1", rssUrl: "https://rss.etnews.com/a.xml", isActive: true } }],
};

let upsertSeq = 0;
beforeEach(() => {
  vi.clearAllMocks();
  upsertSeq = 0;
  prismaMock.newsletterCampaign.findUnique.mockResolvedValue(campaign);
  prismaMock.newsSource.findMany.mockResolvedValue([{ id: "s1", domain: "etnews.com", trustWeight: 5 }]);
  prismaMock.newsArticle.findMany.mockResolvedValue([]);
  prismaMock.newsArticle.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
    id: `a${++upsertSeq}`,
    ...create,
    source: create.sourceId ? { trustWeight: 5 } : null,
  }));
  prismaMock.newsletterIssueArticle.findMany.mockResolvedValue([]);
  ensureCurrentIssueMock.mockResolvedValue({ id: "i1", status: "COLLECTING", editedAt: null });
});

function deps(naver: unknown[], rss: unknown[] = []) {
  return {
    searchNaver: vi.fn().mockResolvedValue(naver),
    fetchRss: vi.fn().mockResolvedValue(rss),
  };
}

const art = (title: string, url: string, h = 1, origin = "NAVER_API") => ({
  title,
  snippet: null,
  originalUrl: url,
  publishedAt: hoursAgo(h),
  origin,
});

describe("collectCampaign", () => {
  it("가장 작은 포함 그룹 용어로만 네이버를 질의하고 활성 RSS를 읽는다", async () => {
    const d = deps([]);
    await collectCampaign("c1", { now: NOW, deps: d });
    expect(d.searchNaver).toHaveBeenCalledTimes(1);
    expect(d.searchNaver).toHaveBeenCalledWith("AI 도입");
    expect(d.fetchRss).toHaveBeenCalledWith("https://rss.etnews.com/a.xml");
  });

  it("URL 중복·전재(같은 제목 해시)를 하나로 묶고 키워드 탈락·기간 밖 기사는 붙이지 않는다", async () => {
    const d = deps(
      [
        art("중소기업 AI 도입 확산", "https://www.etnews.com/1?utm_source=naver", 2),
        art("중소기업 AI 도입 확산 - 매일경제", "https://www.mk.co.kr/9", 1), // 전재(더 늦음) → 제외
        art("대기업 AI 도입", "https://a.com/3"), // 그룹2 탈락
        art("중소기업 AI 도입 관련 주가 급등", "https://a.com/4"), // 제외어
        art("중소기업 AI 도입 옛날 기사", "https://a.com/5", 24 * 10), // 기간 밖
      ],
      [art("중소기업 AI 도입 확산", "https://etnews.com/1", 2, "RSS")] // URL 중복
    );
    const result = await collectCampaign("c1", { now: NOW, deps: d });

    expect(prismaMock.newsArticle.upsert).toHaveBeenCalledTimes(3); // 확산·대기업·주가 (옛날 기사는 저장 전 컷)
    expect(result.matched).toBe(1);
    expect(result.attached).toBe(1);
    const created = prismaMock.newsArticle.upsert.mock.calls[0][0].create;
    expect(created.urlNormalized).toBe("https://etnews.com/1");
    expect(created.sourceId).toBe("s1");
  });

  it("상위 maxArticles는 선택, maxArticles×2까지 후보로 붙인다", async () => {
    const d = deps([
      art("중소기업 AI 도입 1", "https://www.etnews.com/1", 1),
      art("중소기업 AI 도입 2", "https://www.etnews.com/2", 2),
      art("중소기업 AI 도입 3", "https://www.etnews.com/3", 3),
      art("중소기업 AI 도입 4", "https://www.etnews.com/4", 4),
      art("중소기업 AI 도입 5", "https://www.etnews.com/5", 5),
    ]);
    const result = await collectCampaign("c1", { now: NOW, deps: d });
    expect(result.attached).toBe(4);
    const upserts = prismaMock.newsletterIssueArticle.upsert.mock.calls.map((c) => c[0].create);
    expect(upserts.filter((u: { isSelected: boolean }) => u.isSelected)).toHaveLength(2);
    expect(prismaMock.newsletterIssue.update).toHaveBeenCalledWith({ where: { id: "i1" }, data: { status: "DRAFT" } });
  });

  it("지난 SENT 호에 실렸던 기사는 후보에서 제외한다", async () => {
    prismaMock.newsletterIssueArticle.findMany.mockImplementation(async (args: { where: { issue?: unknown } }) =>
      args.where.issue ? [{ articleId: "a1" }] : []
    );
    const d = deps([art("중소기업 AI 도입 1", "https://www.etnews.com/1")]);
    const result = await collectCampaign("c1", { now: NOW, deps: d });
    expect(result.attached).toBe(0);
  });

  it("관리자가 편집한 호(editedAt)는 기사만 저장하고 후보를 건드리지 않는다", async () => {
    ensureCurrentIssueMock.mockResolvedValue({ id: "i1", status: "DRAFT", editedAt: new Date() });
    const d = deps([art("중소기업 AI 도입 1", "https://www.etnews.com/1")]);
    const result = await collectCampaign("c1", { now: NOW, deps: d });
    expect(prismaMock.newsArticle.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.newsletterIssueArticle.upsert).not.toHaveBeenCalled();
    expect(result.attached).toBe(0);
  });

  it("네이버·RSS 한쪽이 실패해도 나머지로 계속하고 errors에 남긴다", async () => {
    const d = {
      searchNaver: vi.fn().mockRejectedValue(new Error("HTTP 429")),
      fetchRss: vi.fn().mockResolvedValue([art("중소기업 AI 도입 R", "https://www.etnews.com/r", 1, "RSS")]),
    };
    const result = await collectCampaign("c1", { now: NOW, deps: d });
    expect(result.errors).toEqual([expect.stringContaining("HTTP 429")]);
    expect(result.attached).toBe(1);
  });

  it("DB에 같은 제목 해시 기사가 이미 있으면 새로 만들지 않고 기존 기사를 쓴다", async () => {
    const { computeTitleHash } = await import("../normalize");
    prismaMock.newsArticle.findMany.mockResolvedValue([
      { id: "old", titleHash: computeTitleHash("중소기업 AI 도입 확산"), urlNormalized: "https://mk.co.kr/old", title: "중소기업 AI 도입 확산", snippet: null, publishedAt: hoursAgo(5), source: null },
    ]);
    const d = deps([art("중소기업 AI 도입 확산", "https://www.etnews.com/1")]);
    const result = await collectCampaign("c1", { now: NOW, deps: d });
    expect(prismaMock.newsArticle.upsert).not.toHaveBeenCalled();
    expect(result.attached).toBe(1);
    expect(prismaMock.newsletterIssueArticle.upsert.mock.calls[0][0].create.articleId).toBe("old");
  });

  it("없는 캠페인은 예외 없이 오류 결과", async () => {
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue(null);
    const result = await collectCampaign("nope", { now: NOW, deps: deps([]) });
    expect(result.errors).toEqual(["캠페인을 찾을 수 없습니다."]);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/newsletter/issues.test.ts src/lib/newsletter/collect/collect-campaign.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 4: 구현** — `src/lib/newsletter/issues.ts`

```ts
/**
 * issues.ts — 캠페인의 "현재 주기 호(Issue)"를 찾거나 만든다.
 * [홍보팀] 매일 수집된 기사가 이번 주 발송분(화요일 호) 초안에 쌓이도록 호를 관리하는 부분입니다.
 * 이미 승인·발송된 호는 절대 덮어쓰지 않습니다.
 */
import { prisma } from "@/lib/prisma";
import type { IssueStatus } from "@/generated/prisma/client";
import { computeNextSendAt, kstDateKey, type ScheduleInput } from "./schedule";
import { renderSubjectTemplate } from "./subject";

export const EDITABLE_ISSUE_STATUSES = ["COLLECTING", "DRAFT", "REVIEW_REQUESTED"] as const;

export type CampaignForIssue = {
  id: string;
  sendType: "IMMEDIATE" | "SCHEDULED" | "REVIEW_THEN_SEND";
  subjectTemplate: string;
} & ScheduleInput;

export type CurrentIssue = { id: string; status: IssueStatus; editedAt: Date | null };

const SELECT = { id: true, status: true, editedAt: true } as const;

function isEditable(status: IssueStatus): boolean {
  return (EDITABLE_ISSUE_STATUSES as readonly IssueStatus[]).includes(status);
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";
}

export async function ensureCurrentIssue(
  campaign: CampaignForIssue,
  now: Date
): Promise<CurrentIssue | null> {
  const immediate = campaign.sendType === "IMMEDIATE";
  const slot = immediate ? now : computeNextSendAt(campaign, now);
  if (!slot) return null;
  const issueDate = kstDateKey(slot);

  const where = immediate
    ? { campaignId: campaign.id, status: { not: "CANCELED" as const } }
    : { campaignId: campaign.id, issueDate, status: { not: "CANCELED" as const } };

  const existing = await prisma.newsletterIssue.findFirst({ where, orderBy: { issueNo: "desc" }, select: SELECT });
  if (existing) return isEditable(existing.status) ? existing : null;

  const agg = await prisma.newsletterIssue.aggregate({
    where: { campaignId: campaign.id },
    _max: { issueNo: true },
  });
  const issueNo = (agg._max.issueNo ?? 0) + 1;

  try {
    return await prisma.newsletterIssue.create({
      data: {
        campaignId: campaign.id,
        issueNo,
        issueDate,
        subject: renderSubjectTemplate(campaign.subjectTemplate, { issueNo, issueDate }),
        status: "COLLECTING",
      },
      select: SELECT,
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const raced = await prisma.newsletterIssue.findFirst({ where, orderBy: { issueNo: "desc" }, select: SELECT });
    return raced && isEditable(raced.status) ? raced : null;
  }
}
```

- [ ] **Step 5: 구현** — `src/lib/newsletter/collect/collect-campaign.ts`

```ts
/**
 * collect-campaign.ts — 캠페인 1개 수집: 검색·RSS → 정규화·중복 제거 → 저장 → 키워드 필터·규칙 점수 → 이번 호 후보 부착
 * [홍보팀] 매일 아침 자동으로 돌거나, 관리자 화면의 "지금 수집" 버튼으로 실행되는 부분입니다.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 6-1·6-2
 */
import { prisma } from "@/lib/prisma";
import { ensureCurrentIssue, type CampaignForIssue } from "../issues";
import { keywordHitRate, matchKeywords, pickQueryTerms } from "../keyword-filter";
import { SNIPPET_MAX_LENGTH, computeTitleHash, hostOf, matchSourceByDomain, normalizeUrl } from "../normalize";
import { computeRuleScore } from "../score-rules";
import type { CandidateArticle, KeywordInput } from "../types";
import { searchNaverNews } from "./naver-news";
import { fetchRssArticles } from "./rss";

export type CollectDeps = {
  searchNaver: (query: string) => Promise<CandidateArticle[]>;
  fetchRss: (url: string) => Promise<CandidateArticle[]>;
};

export type CollectResult = {
  campaignId: string;
  fetched: number;
  stored: number;
  matched: number;
  attached: number;
  issueId: string | null;
  errors: string[];
};

const DAY_MS = 86_400_000;
const FUTURE_TOLERANCE_MS = 3_600_000;

const DEFAULT_DEPS: CollectDeps = {
  searchNaver: (q) => searchNaverNews(q),
  fetchRss: (url) => fetchRssArticles(url),
};

type StoredArticle = {
  id: string;
  title: string;
  snippet: string | null;
  publishedAt: Date;
  trustWeight: number | null;
  dupCount: number;
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function collectCampaign(
  campaignId: string,
  opts: { now?: Date; deps?: CollectDeps } = {}
): Promise<CollectResult> {
  const now = opts.now ?? new Date();
  const deps = opts.deps ?? DEFAULT_DEPS;
  const result: CollectResult = { campaignId, fetched: 0, stored: 0, matched: 0, attached: 0, issueId: null, errors: [] };

  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id: campaignId },
    include: { keywords: true, sources: { include: { source: true } } },
  });
  if (!campaign) {
    result.errors.push("캠페인을 찾을 수 없습니다.");
    return result;
  }
  const keywords: KeywordInput[] = campaign.keywords.map((k) => ({
    group: k.group,
    operator: k.operator,
    term: k.term,
    weight: k.weight,
  }));

  // 1) 수집 — 실패한 경로는 errors에 남기고 나머지로 계속
  const jobs: { label: string; run: () => Promise<CandidateArticle[]> }[] = [
    ...pickQueryTerms(keywords).map((term) => ({ label: `네이버 "${term}"`, run: () => deps.searchNaver(term) })),
    ...campaign.sources
      .filter((cs) => cs.source.isActive && cs.source.rssUrl)
      .map((cs) => ({ label: `RSS ${cs.source.rssUrl}`, run: () => deps.fetchRss(cs.source.rssUrl as string) })),
  ];
  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  const raw: CandidateArticle[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") raw.push(...s.value);
    else result.errors.push(`${jobs[i].label}: ${errorMessage(s.reason)}`);
  });
  result.fetched = raw.length;

  // 2) 기간 필터 + URL 중복 제거 + 제목 해시로 전재 묶기(가장 이른 기사만, 묶음 크기=dupCount)
  const windowStart = now.getTime() - campaign.collectDays * DAY_MS;
  const byUrl = new Map<string, CandidateArticle & { urlNormalized: string; titleHash: string }>();
  for (const a of raw) {
    const t = a.publishedAt.getTime();
    if (t < windowStart || t > now.getTime() + FUTURE_TOLERANCE_MS) continue;
    const urlNormalized = normalizeUrl(a.originalUrl);
    if (!urlNormalized) continue;
    const prev = byUrl.get(urlNormalized);
    if (!prev || a.publishedAt < prev.publishedAt) {
      byUrl.set(urlNormalized, { ...a, urlNormalized, titleHash: computeTitleHash(a.title) });
    }
  }
  const byHash = new Map<string, { first: CandidateArticle & { urlNormalized: string; titleHash: string }; count: number }>();
  for (const a of byUrl.values()) {
    const g = byHash.get(a.titleHash);
    if (!g) byHash.set(a.titleHash, { first: a, count: 1 });
    else {
      g.count += 1;
      if (a.publishedAt < g.first.publishedAt) g.first = a;
    }
  }

  // 3) 저장 — DB에 같은 제목 해시가 이미 있으면 그 기사를 재사용(새 행 안 만듦)
  const sources = await prisma.newsSource.findMany({ select: { id: true, domain: true, trustWeight: true } });
  const existing = await prisma.newsArticle.findMany({
    where: { titleHash: { in: [...byHash.keys()] } },
    include: { source: true },
  });
  const existingByHash = new Map(existing.map((e) => [e.titleHash, e]));

  const stored: StoredArticle[] = [];
  for (const [hash, { first, count }] of byHash) {
    const prior = existingByHash.get(hash);
    if (prior) {
      stored.push({
        id: prior.id,
        title: prior.title,
        snippet: prior.snippet,
        publishedAt: prior.publishedAt,
        trustWeight: prior.source?.trustWeight ?? null,
        dupCount: count + 1,
      });
      continue;
    }
    const source = matchSourceByDomain(first.originalUrl, sources);
    const row = await prisma.newsArticle.upsert({
      where: { urlNormalized: first.urlNormalized },
      update: {},
      create: {
        urlNormalized: first.urlNormalized,
        originalUrl: first.originalUrl,
        title: first.title,
        snippet: first.snippet?.slice(0, SNIPPET_MAX_LENGTH) ?? null,
        publishedAt: first.publishedAt,
        sourceId: source?.id ?? null,
        sourceName: source ? null : hostOf(first.originalUrl),
        origin: first.origin,
        titleHash: hash,
      },
      include: { source: true },
    });
    result.stored += 1;
    stored.push({
      id: row.id,
      title: row.title,
      snippet: row.snippet,
      publishedAt: row.publishedAt,
      trustWeight: row.source?.trustWeight ?? null,
      dupCount: count,
    });
  }

  // 4) 키워드 필터 + 규칙 점수
  const scored = stored.flatMap((a) => {
    const match = matchKeywords(keywords, a.title, a.snippet ?? "");
    if (!match.passes) return [];
    const ruleScore = computeRuleScore({
      hitRate: keywordHitRate(match),
      publishedAt: a.publishedAt,
      now,
      collectDays: campaign.collectDays,
      trustWeight: a.trustWeight,
      dupCount: a.dupCount,
    });
    return [{ articleId: a.id, ruleScore }];
  });
  result.matched = scored.length;

  // 5) 이번 호 후보 부착 (관리자가 손댄 호는 건드리지 않음)
  const issue = await ensureCurrentIssue(campaign as CampaignForIssue, now);
  if (!issue) return result;
  result.issueId = issue.id;
  if (issue.editedAt) return result;

  const alreadySent = await prisma.newsletterIssueArticle.findMany({
    where: {
      articleId: { in: scored.map((s) => s.articleId) },
      isSelected: true,
      issue: { campaignId: campaign.id, status: "SENT" },
    },
    select: { articleId: true },
  });
  const sentIds = new Set(alreadySent.map((r) => r.articleId));

  const current = await prisma.newsletterIssueArticle.findMany({
    where: { issueId: issue.id },
    select: { articleId: true, ruleScore: true },
  });
  const merged = new Map(current.map((c) => [c.articleId, c.ruleScore]));
  for (const s of scored) if (!sentIds.has(s.articleId)) merged.set(s.articleId, s.ruleScore);

  const top = [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, campaign.maxArticles * 2);
  const topIds = top.map(([id]) => id);

  await prisma.$transaction([
    prisma.newsletterIssueArticle.deleteMany({ where: { issueId: issue.id, articleId: { notIn: topIds } } }),
    ...top.map(([articleId, ruleScore], index) => {
      const fields = { ruleScore, isSelected: index < campaign.maxArticles, sortOrder: index };
      return prisma.newsletterIssueArticle.upsert({
        where: { issueId_articleId: { issueId: issue.id, articleId } },
        create: { issueId: issue.id, articleId, ...fields },
        update: fields,
      });
    }),
  ]);
  await prisma.newsletterIssue.update({
    where: { id: issue.id },
    data: { status: top.length > 0 ? "DRAFT" : "COLLECTING" },
  });
  result.attached = top.length;
  return result;
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/lib/newsletter/issues.test.ts src/lib/newsletter/collect/collect-campaign.test.ts`
Expected: PASS. "상위 maxArticles" 테스트에서 `$transaction` 모킹이 배열의 Promise를 그대로 기다리는지 확인(위 `prismaMock.$transaction` 정의).

- [ ] **Step 7: Commit**

```bash
git add src/lib/newsletter/issues.ts src/lib/newsletter/issues.test.ts src/lib/newsletter/collect/collect-campaign.ts src/lib/newsletter/collect/collect-campaign.test.ts
git commit -m "feat(newsletter): 캠페인 수집 오케스트레이터(중복 제거·지난 호 재선별 방지)와 호 주기 관리"
```

---

### Task 8: Resend 확장 + "AX 위클리" 메일 양식

**Files:**
- Modify: `src/lib/resend.ts`
- Test: `src/lib/resend.test.ts` (기존 파일에 케이스 추가)
- Create: `src/lib/newsletter/templates/ax-weekly.ts`
- Test: `src/lib/newsletter/templates/ax-weekly.test.ts`

**Interfaces:**
- Consumes: `escapeHtml`, `SALES_SIGNATURE`, `getEmailLogoUrl` (`@/lib/ax-check/catalog`), `formatKstYmd` (Task 5)
- Produces:
  - `SendResendEmailInput.headers?: Record<string, string>`
  - `SendResendEmailResult = { success: true; id?: string } | { success: false; error: string }`
  - `UNSUBSCRIBE_PLACEHOLDER = "{{UNSUBSCRIBE_URL}}"`
  - `type AxWeeklyArticle = { title: string; url: string; sourceName: string | null; publishedAt: Date; summary: string | null; snippet: string | null; editorNote: string | null }`
  - `type AxWeeklyInput = { issueNo: number; issueDate: Date; subject: string; intro: string | null; articles: AxWeeklyArticle[]; siteUrl?: string }`
  - `renderAxWeekly(input: AxWeeklyInput): { subject: string; html: string; text: string }`
  - `withNewsletterUtm(url: string, issueNo: number, siteUrl: string): string`

- [ ] **Step 1: Resend 실패 테스트** — 기존 `src/lib/resend.test.ts`의 `resend` 모킹 구조를 먼저 읽고, 같은 모킹으로 아래 두 케이스를 추가한다(모킹된 `emails.send`가 `{ data: { id: "re_123" }, error: null }`를 돌려주도록 설정).

```ts
it("headers를 Resend 페이로드에 그대로 전달한다", async () => {
  await sendResendEmail({
    to: "a@example.com",
    subject: "s",
    html: "<p>h</p>",
    headers: { "List-Unsubscribe": "<https://www.coredxi.com/unsubscribe/t>" },
  });
  expect(sendMock).toHaveBeenCalledWith(
    expect.objectContaining({ headers: { "List-Unsubscribe": "<https://www.coredxi.com/unsubscribe/t>" } })
  );
});

it("성공 시 Resend 메일 id를 돌려준다", async () => {
  sendMock.mockResolvedValueOnce({ data: { id: "re_123" }, error: null });
  await expect(sendResendEmail({ to: "a@example.com", subject: "s", text: "t" })).resolves.toEqual({
    success: true,
    id: "re_123",
  });
});
```

(기존 파일의 모킹 함수 이름이 `sendMock`이 아니면 그 이름으로 바꿔 쓴다. 기존 `toEqual({ success: true })` 단언이 있다면 `id`가 `undefined`일 때도 통과하도록 구현에서 `id`가 없으면 키를 생략한다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/resend.test.ts`
Expected: FAIL — headers 미전달, id 없음

- [ ] **Step 3: Resend 구현 변경** — `src/lib/resend.ts`

`SendResendEmailInput`에 필드 추가:

```ts
  /** 추가 메일 헤더. 뉴스레터의 List-Unsubscribe 헤더용(2026-10-05). */
  headers?: Record<string, string>;
```

결과 타입 변경:

```ts
export type SendResendEmailResult =
  | { success: true; id?: string }
  | { success: false; error: string };
```

`payload`에 한 줄 추가(`...(input.cc ? …)` 아래):

```ts
      ...(input.headers ? { headers: input.headers } : {}),
```

호출부 변경:

```ts
    const { data, error } = await resend.emails.send(payload);
```

성공 반환 변경:

```ts
    return data?.id ? { success: true, id: data.id } : { success: true };
```

- [ ] **Step 4: Resend 통과 확인**

Run: `npx vitest run src/lib/resend.test.ts ; npx tsc --noEmit`
Expected: PASS, 타입 오류 0 (기존 호출부는 `success`만 보므로 영향 없음)

- [ ] **Step 5: 메일 양식 실패 테스트** — `src/lib/newsletter/templates/ax-weekly.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { UNSUBSCRIBE_PLACEHOLDER, renderAxWeekly, withNewsletterUtm } from "./ax-weekly";

const SITE = "https://www.coredxi.com";
const input = {
  issueNo: 3,
  issueDate: new Date("2026-10-05T15:00:00Z"),
  subject: "[AX 위클리] 2026-10-06 소식",
  intro: "이번 주 소식입니다.",
  siteUrl: SITE,
  articles: [
    {
      title: 'AI "도입" <확산>',
      url: "https://www.etnews.com/1",
      sourceName: "전자신문",
      publishedAt: new Date("2026-10-05T00:00:00Z"),
      summary: "요약 두 문장.",
      snippet: "스니펫",
      editorNote: "꼭 보세요",
    },
    {
      title: "요약 없는 기사",
      url: "javascript:alert(1)",
      sourceName: null,
      publishedAt: new Date("2026-10-04T00:00:00Z"),
      summary: null,
      snippet: "스니펫만 있음",
      editorNote: null,
    },
  ],
};

describe("renderAxWeekly", () => {
  const out = renderAxWeekly(input);

  it("제목에 (광고)를 강제한다", () => {
    expect(out.subject).toBe("(광고) [AX 위클리] 2026-10-06 소식");
  });

  it("헤더에 회차·KST 발행일", () => {
    expect(out.html).toContain("AX 위클리 #3 · 2026-10-06");
  });

  it("기사 제목은 1회만 이스케이프(이중 이스케이프 없음)", () => {
    expect(out.html).toContain("AI &quot;도입&quot; &lt;확산&gt;");
    expect(out.html).not.toContain("&amp;quot;");
  });

  it("요약이 없으면 스니펫, 편집자 코멘트 노출", () => {
    expect(out.html).toContain("요약 두 문장.");
    expect(out.html).toContain("스니펫만 있음");
    expect(out.html).toContain("꼭 보세요");
  });

  it("http(s)가 아닌 기사 링크는 링크로 만들지 않는다", () => {
    expect(out.html).not.toContain("javascript:");
  });

  it("CTA는 utm이 붙은 /ax-check?ref=newsletter", () => {
    expect(out.html).toContain(
      "https://www.coredxi.com/ax-check?ref=newsletter&amp;utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=ax-weekly&amp;utm_content=issue-3"
    );
  });

  it("외부 기사 링크에는 utm을 붙이지 않는다", () => {
    expect(out.html).toContain('href="https://www.etnews.com/1"');
  });

  it("수신거부 자리표시자·회사 정보·발송 사유 문구가 HTML·텍스트 모두에 있다", () => {
    for (const body of [out.html, out.text]) {
      expect(body).toContain(UNSUBSCRIBE_PLACEHOLDER);
      expect(body).toContain("(주)코어디엑스아이");
      expect(body).toContain("뉴스레터 구독 신청에 따라 발송");
    }
  });
});

describe("withNewsletterUtm", () => {
  it("자사 도메인에만 utm을 붙이고 기존 쿼리를 유지한다", () => {
    expect(withNewsletterUtm(`${SITE}/blog/a?x=1`, 2, SITE)).toBe(
      `${SITE}/blog/a?x=1&utm_source=newsletter&utm_medium=email&utm_campaign=ax-weekly&utm_content=issue-2`
    );
    expect(withNewsletterUtm("https://other.com/a", 2, SITE)).toBe("https://other.com/a");
  });
});
```

- [ ] **Step 6: 실패 확인**

Run: `npx vitest run src/lib/newsletter/templates`
Expected: FAIL — 모듈 없음

- [ ] **Step 7: 구현** — `src/lib/newsletter/templates/ax-weekly.ts`

```ts
/**
 * ax-weekly.ts — "AX 위클리" 뉴스레터 메일 양식(HTML + 텍스트)
 * [홍보팀] 메일에 보이는 문구(CTA 문장, 푸터 안내)는 아래 COPY 상수에서 고칠 수 있습니다.
 * 수신거부 링크는 받는 사람마다 다르므로 {{UNSUBSCRIBE_URL}} 자리표시자로 두고 발송 직전에 바꿉니다.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 8절
 */
import { SALES_SIGNATURE, escapeHtml, getEmailLogoUrl } from "@/lib/ax-check/catalog";
import { formatKstYmd } from "../schedule";
import { ensureAdPrefix } from "../subject";

export const UNSUBSCRIBE_PLACEHOLDER = "{{UNSUBSCRIBE_URL}}";

const COPY = {
  ctaLead: "우리 회사 AX 우선과제, 3분이면 진단됩니다.",
  ctaButton: "AX 우선과제 3분 진단 받기 →",
  reason: "이 메일은 coredxi.com 뉴스레터 구독 신청에 따라 발송됩니다.",
  unsubscribe: "수신거부",
  company: "(주)코어디엑스아이",
} as const;

export type AxWeeklyArticle = {
  title: string;
  url: string;
  sourceName: string | null;
  publishedAt: Date;
  summary: string | null;
  snippet: string | null;
  editorNote: string | null;
};

export type AxWeeklyInput = {
  issueNo: number;
  issueDate: Date;
  subject: string;
  intro: string | null;
  articles: AxWeeklyArticle[];
  siteUrl?: string;
};

function isHttpUrl(url: string): boolean {
  try {
    const p = new URL(url).protocol;
    return p === "http:" || p === "https:";
  } catch {
    return false;
  }
}

export function withNewsletterUtm(url: string, issueNo: number, siteUrl: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (u.hostname !== new URL(siteUrl).hostname) return url;
  u.searchParams.set("utm_source", "newsletter");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", "ax-weekly");
  u.searchParams.set("utm_content", `issue-${issueNo}`);
  return u.toString();
}

export function renderAxWeekly(input: AxWeeklyInput): { subject: string; html: string; text: string } {
  const siteUrl = input.siteUrl ?? process.env.NEXTAUTH_URL ?? "https://www.coredxi.com";
  const dateLabel = formatKstYmd(input.issueDate);
  const ctaUrl = withNewsletterUtm(`${siteUrl}/ax-check?ref=newsletter`, input.issueNo, siteUrl);
  const address = SALES_SIGNATURE.addresses[0];

  const articleHtml = input.articles
    .map((a) => {
      const meta = [a.sourceName, formatKstYmd(a.publishedAt)].filter(Boolean).join(" · ");
      const title = escapeHtml(a.title);
      const titleHtml = isHttpUrl(a.url)
        ? `<a href="${escapeHtml(a.url)}" style="color:#1E4E8C;font-weight:bold;text-decoration:none;">${title}</a>`
        : `<span style="font-weight:bold;">${title}</span>`;
      const body = a.summary ?? a.snippet;
      return [
        '<div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 12px;">',
        `<div style="font-size:12px;color:#6b7280;">${escapeHtml(meta)}</div>`,
        `<div style="font-size:16px;margin:4px 0 8px;">${titleHtml}</div>`,
        body ? `<div style="font-size:14px;color:#111111;">${escapeHtml(body)}</div>` : "",
        a.editorNote
          ? `<div style="font-size:13px;color:#1E4E8C;margin-top:8px;">▸ ${escapeHtml(a.editorNote)}</div>`
          : "",
        "</div>",
      ].join("");
    })
    .join("");

  const html = [
    '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111111;max-width:600px;margin:0 auto;">',
    `<img src="${escapeHtml(getEmailLogoUrl())}" alt="CoreDXI" height="28" style="display:block;margin:16px 0;" />`,
    `<div style="font-size:13px;color:#6b7280;">AX 위클리 #${input.issueNo} · ${dateLabel}</div>`,
    input.intro ? `<p style="font-size:14px;white-space:pre-wrap;">${escapeHtml(input.intro)}</p>` : "",
    articleHtml,
    '<div style="background:#f3f6fb;border-radius:12px;padding:16px;margin:16px 0;text-align:center;">',
    `<div style="font-size:14px;margin-bottom:8px;">${COPY.ctaLead}</div>`,
    `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#1E4E8C;color:#ffffff;border-radius:12px;padding:10px 18px;text-decoration:none;font-weight:bold;">${COPY.ctaButton}</a>`,
    "</div>",
    '<div style="font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px;">',
    `${COPY.company} · ${escapeHtml(address)} · ${escapeHtml(SALES_SIGNATURE.email)}<br />`,
    `${COPY.reason} <a href="${UNSUBSCRIBE_PLACEHOLDER}" style="color:#6b7280;">${COPY.unsubscribe}</a>`,
    "</div>",
    "</div>",
  ].join("");

  const text = [
    `AX 위클리 #${input.issueNo} · ${dateLabel}`,
    input.intro ?? "",
    ...input.articles.map((a, i) =>
      [
        `${i + 1}. ${a.title}`,
        `   ${[a.sourceName, formatKstYmd(a.publishedAt)].filter(Boolean).join(" · ")}`,
        isHttpUrl(a.url) ? `   ${a.url}` : "",
        a.summary ?? a.snippet ? `   ${a.summary ?? a.snippet}` : "",
        a.editorNote ? `   ▸ ${a.editorNote}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    ),
    `${COPY.ctaLead}\n${ctaUrl}`,
    `${COPY.company} · ${address} · ${SALES_SIGNATURE.email}`,
    `${COPY.reason} ${COPY.unsubscribe}: ${UNSUBSCRIBE_PLACEHOLDER}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject: ensureAdPrefix(input.subject), html, text };
}
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest run src/lib/newsletter/templates src/lib/resend.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/resend.ts src/lib/resend.test.ts src/lib/newsletter/templates
git commit -m "feat(newsletter): AX 위클리 메일 양식과 Resend headers·id 지원"
```

---

### Task 9: 발송 엔진 (`sendIssue` · `processDueIssues` · `sendTestIssue`)

**Files:**
- Create: `src/lib/newsletter/send.ts`
- Test: `src/lib/newsletter/send.test.ts`

**Interfaces:**
- Consumes: `sendResendEmail` (Task 8), `renderAxWeekly`·`UNSUBSCRIBE_PLACEHOLDER` (Task 8), `ensureAdPrefix` (Task 5), `SALES_SIGNATURE` (catalog)
- Produces:
  - `ISSUE_SEND_LOCK_ERROR: string`
  - `getMaxRecipients(): number` (env `NEWSLETTER_MAX_RECIPIENTS`, 기본 80)
  - `type SendIssueResult = { success: true; sent: number; failed: number; skipped: number } | { success: false; error: string }`
  - `sendIssue(issueId: string, opts?: { allowFrom?: readonly IssueStatus[]; throttleMs?: number }): Promise<SendIssueResult>`
  - `processDueIssues(opts?: { now?: Date; throttleMs?: number }): Promise<{ processed: number; sent: number; failed: number; recovered: number }>`
  - `renderIssueEmail(issueId: string): Promise<{ subject: string; html: string; text: string } | null>` (미리보기·테스트 발송 공용)
  - `sendTestIssue(issueId: string, recipients: string[]): Promise<{ success: true } | { success: false; error: string }>`

- [ ] **Step 1: 실패 테스트** — `src/lib/newsletter/send.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendResendEmailMock = vi.fn();
vi.mock("@/lib/resend", () => ({ sendResendEmail: (...a: unknown[]) => sendResendEmailMock(...a) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const prismaMock = {
  newsletterIssue: { updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  newsletterSubscriber: { findMany: vi.fn(), updateMany: vi.fn() },
  newsletterDelivery: { createMany: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { ISSUE_SEND_LOCK_ERROR, processDueIssues, sendIssue, sendTestIssue } = await import("./send");

const issueRow = {
  id: "i1",
  issueNo: 1,
  issueDate: new Date("2026-10-05T15:00:00Z"),
  subject: "[AX 위클리] 수정된 제목", // 관리자가 (광고)를 지운 상황
  intro: null,
  campaign: { audience: "subscribers", internalRecipients: [] },
  articles: [
    {
      summary: null,
      editorNote: null,
      article: {
        title: "기사",
        originalUrl: "https://www.etnews.com/1",
        snippet: "s",
        publishedAt: new Date("2026-10-05T00:00:00Z"),
        sourceName: null,
        source: { name: "전자신문" },
      },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEWSLETTER_MAX_RECIPIENTS;
  prismaMock.newsletterIssue.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.newsletterIssue.findUnique.mockResolvedValue(issueRow);
  prismaMock.newsletterSubscriber.findMany.mockResolvedValue([
    { id: "u1", email: "a@example.com", unsubscribeToken: "tokA" },
    { id: "u2", email: "b@example.com", unsubscribeToken: "tokB" },
  ]);
  prismaMock.newsletterDelivery.findMany.mockResolvedValue([
    { id: "d1", email: "a@example.com", subscriberId: "u1" },
    { id: "d2", email: "b@example.com", subscriberId: "u2" },
  ]);
  prismaMock.newsletterDelivery.count.mockResolvedValue(2);
  sendResendEmailMock.mockResolvedValue({ success: true, id: "re_1" });
});

describe("sendIssue", () => {
  it("선점 실패 시 발송하지 않는다", async () => {
    prismaMock.newsletterIssue.updateMany.mockResolvedValue({ count: 0 });
    await expect(sendIssue("i1", { throttleMs: 0 })).resolves.toEqual({ success: false, error: ISSUE_SEND_LOCK_ERROR });
    expect(sendResendEmailMock).not.toHaveBeenCalled();
  });

  it("구독자별 수신거부 링크·List-Unsubscribe 헤더·(광고) 제목으로 보내고 SENT로 마감", async () => {
    const result = await sendIssue("i1", { throttleMs: 0 });
    expect(result).toEqual({ success: true, sent: 2, failed: 0, skipped: 0 });

    const first = sendResendEmailMock.mock.calls[0][0];
    expect(first.to).toBe("a@example.com");
    expect(first.subject).toBe("(광고) [AX 위클리] 수정된 제목");
    expect(first.html).toContain("https://www.coredxi.com/unsubscribe/tokA");
    expect(first.html).not.toContain("{{UNSUBSCRIBE_URL}}");
    expect(first.headers).toEqual({ "List-Unsubscribe": "<https://www.coredxi.com/unsubscribe/tokA>" });

    expect(prismaMock.newsletterDelivery.createMany).toHaveBeenCalledWith({
      data: [
        { issueId: "i1", subscriberId: "u1", email: "a@example.com" },
        { issueId: "i1", subscriberId: "u2", email: "b@example.com" },
      ],
      skipDuplicates: true,
    });
    expect(prismaMock.newsletterIssue.update).toHaveBeenLastCalledWith({
      where: { id: "i1" },
      data: expect.objectContaining({ status: "SENT", recipientCount: 2, lastError: null }),
    });
  });

  it("QUEUED 이후 구독 해지한 사람은 SKIPPED", async () => {
    prismaMock.newsletterSubscriber.findMany.mockResolvedValue([
      { id: "u1", email: "a@example.com", unsubscribeToken: "tokA" },
    ]);
    const result = await sendIssue("i1", { throttleMs: 0 });
    expect(result).toEqual({ success: true, sent: 1, failed: 0, skipped: 1 });
    expect(prismaMock.newsletterDelivery.update).toHaveBeenCalledWith({
      where: { id: "d2" },
      data: { status: "SKIPPED" },
    });
  });

  it("일부 실패하면 FAILED + lastError, 재시도 시 QUEUED/FAILED만 다시 조회", async () => {
    sendResendEmailMock.mockResolvedValueOnce({ success: true, id: "re_1" }).mockResolvedValueOnce({ success: false, error: "rate" });
    const result = await sendIssue("i1", { throttleMs: 0 });
    expect(result).toEqual({ success: true, sent: 1, failed: 1, skipped: 0 });
    expect(prismaMock.newsletterDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { issueId: "i1", status: { in: ["QUEUED", "FAILED"] } } })
    );
    expect(prismaMock.newsletterIssue.update).toHaveBeenLastCalledWith({
      where: { id: "i1" },
      data: expect.objectContaining({ status: "FAILED", lastError: "1건 발송 실패" }),
    });
  });

  it("선별 기사가 0건이면 보내지 않고 DRAFT로 되돌린다", async () => {
    prismaMock.newsletterIssue.findUnique.mockResolvedValue({ ...issueRow, articles: [] });
    const result = await sendIssue("i1", { throttleMs: 0 });
    expect(result).toEqual({ success: false, error: "선별된 기사가 없습니다." });
    expect(prismaMock.newsletterIssue.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { status: "DRAFT", lastError: "선별된 기사가 없습니다." },
    });
  });

  it("수신자가 상한을 넘으면 보내지 않고 FAILED", async () => {
    process.env.NEWSLETTER_MAX_RECIPIENTS = "1";
    const result = await sendIssue("i1", { throttleMs: 0 });
    expect(result.success).toBe(false);
    expect(sendResendEmailMock).not.toHaveBeenCalled();
  });

  it("internal 캠페인은 내부 수신자에게 mailto 수신중단 링크로 보낸다", async () => {
    prismaMock.newsletterIssue.findUnique.mockResolvedValue({
      ...issueRow,
      campaign: { audience: "internal", internalRecipients: ["ceo@coredxi.com"] },
    });
    prismaMock.newsletterDelivery.findMany.mockResolvedValue([{ id: "d1", email: "ceo@coredxi.com", subscriberId: null }]);
    await sendIssue("i1", { throttleMs: 0 });
    expect(prismaMock.newsletterSubscriber.findMany).not.toHaveBeenCalled();
    expect(sendResendEmailMock.mock.calls[0][0].html).toContain("mailto:");
  });
});

describe("processDueIssues", () => {
  it("멈춘 SENDING은 FAILED로 회수하고, 예약 시각이 지난 APPROVED만 발송", async () => {
    const now = new Date("2026-10-05T23:05:00Z");
    prismaMock.newsletterIssue.findMany
      .mockResolvedValueOnce([{ id: "stale" }])
      .mockResolvedValueOnce([{ id: "i1" }]);
    const result = await processDueIssues({ now, throttleMs: 0 });
    expect(prismaMock.newsletterIssue.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["stale"] } },
      data: { status: "FAILED", lastError: expect.stringContaining("중단") },
    });
    expect(prismaMock.newsletterIssue.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: "APPROVED", scheduledAt: { lte: now } } })
    );
    expect(result).toEqual({ processed: 1, sent: 1, failed: 0, recovered: 1 });
  });
});

describe("sendTestIssue", () => {
  it("[테스트] 표기 + (광고) 맨 앞, 수신거부는 사이트 주소로, 발송 기록 없음", async () => {
    await sendTestIssue("i1", ["me@coredxi.com"]);
    const call = sendResendEmailMock.mock.calls[0][0];
    expect(call.subject).toBe("(광고) [테스트] [AX 위클리] 수정된 제목");
    expect(call.html).not.toContain("{{UNSUBSCRIBE_URL}}");
    expect(prismaMock.newsletterDelivery.createMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/newsletter/send.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현** — `src/lib/newsletter/send.ts`

```ts
/**
 * send.ts — 뉴스레터 호 발송. 크론(newsletter-send)과 관리자 "즉시 발송"·"재시도"가 모두 sendIssue를 호출한다.
 * [홍보팀] 승인된 뉴스레터를 구독자에게 한 통씩 보내고, 누가 받았는지 발송 이력에 남기는 부분입니다.
 * 중간에 끊겨도 다시 실행하면 아직 못 받은 사람에게만 보냅니다(중복 발송 없음).
 * 패턴: src/lib/ax-check/followup.ts(선점·멈춘 SENDING 회수)
 */
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { SALES_SIGNATURE } from "@/lib/ax-check/catalog";
import type { IssueStatus } from "@/generated/prisma/client";
import { UNSUBSCRIBE_PLACEHOLDER, renderAxWeekly } from "./templates/ax-weekly";
import { ensureAdPrefix } from "./subject";

export const ISSUE_SEND_LOCK_ERROR = "이미 발송 중이거나 발송할 수 없는 상태입니다.";
const NO_ARTICLES_ERROR = "선별된 기사가 없습니다.";
const STALE_SENDING_MS = 15 * 60 * 1000;
const STALE_SENDING_ERROR = "발송 처리 중 프로세스가 중단되어 자동 복구되었습니다. 발송 이력에서 재시도하세요.";
const DEFAULT_THROTTLE_MS = 600; // Resend API 초당 요청 한도 여유
const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.coredxi.com";

export function getMaxRecipients(): number {
  const n = Number(process.env.NEWSLETTER_MAX_RECIPIENTS ?? 80);
  return Number.isFinite(n) && n > 0 ? n : 80;
}

export type SendIssueResult =
  | { success: true; sent: number; failed: number; skipped: number }
  | { success: false; error: string };

type Recipient = { subscriberId: string | null; email: string; unsubscribeUrl: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function internalUnsubscribeUrl(): string {
  return `mailto:${SALES_SIGNATURE.email}?subject=${encodeURIComponent("뉴스레터 수신 중단 요청")}`;
}

async function loadIssue(issueId: string) {
  return prisma.newsletterIssue.findUnique({
    where: { id: issueId },
    include: {
      campaign: true,
      articles: {
        where: { isSelected: true },
        orderBy: { sortOrder: "asc" },
        include: { article: { include: { source: true } } },
      },
    },
  });
}

type LoadedIssue = NonNullable<Awaited<ReturnType<typeof loadIssue>>>;

function render(issue: LoadedIssue) {
  return renderAxWeekly({
    issueNo: issue.issueNo,
    issueDate: issue.issueDate,
    subject: issue.subject,
    intro: issue.intro,
    siteUrl: SITE_URL,
    articles: issue.articles.map((ia) => ({
      title: ia.article.title,
      url: ia.article.originalUrl,
      sourceName: ia.article.source?.name ?? ia.article.sourceName,
      publishedAt: ia.article.publishedAt,
      summary: ia.summary,
      snippet: ia.article.snippet,
      editorNote: ia.editorNote,
    })),
  });
}

async function resolveRecipients(issue: LoadedIssue): Promise<Recipient[]> {
  if (issue.campaign.audience === "internal") {
    return issue.campaign.internalRecipients.map((email) => ({
      subscriberId: null,
      email,
      unsubscribeUrl: internalUnsubscribeUrl(),
    }));
  }
  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { status: "SUBSCRIBED" },
    select: { id: true, email: true, unsubscribeToken: true },
  });
  return subscribers.map((s) => ({
    subscriberId: s.id,
    email: s.email,
    unsubscribeUrl: `${SITE_URL}/unsubscribe/${s.unsubscribeToken}`,
  }));
}

export async function renderIssueEmail(issueId: string) {
  const issue = await loadIssue(issueId);
  return issue ? render(issue) : null;
}

export async function sendIssue(
  issueId: string,
  opts: { allowFrom?: readonly IssueStatus[]; throttleMs?: number } = {}
): Promise<SendIssueResult> {
  const allowFrom = opts.allowFrom ?? (["APPROVED", "FAILED"] as const);
  const throttleMs = opts.throttleMs ?? DEFAULT_THROTTLE_MS;

  const claim = await prisma.newsletterIssue.updateMany({
    where: { id: issueId, status: { in: [...allowFrom] } },
    data: { status: "SENDING" },
  });
  if (claim.count !== 1) return { success: false, error: ISSUE_SEND_LOCK_ERROR };

  try {
    const issue = await loadIssue(issueId);
    if (!issue) return { success: false, error: "호를 찾을 수 없습니다." };
    if (issue.articles.length === 0) {
      await prisma.newsletterIssue.update({
        where: { id: issueId },
        data: { status: "DRAFT", lastError: NO_ARTICLES_ERROR },
      });
      return { success: false, error: NO_ARTICLES_ERROR };
    }

    const recipients = await resolveRecipients(issue);
    const max = getMaxRecipients();
    if (recipients.length > max) {
      const error = `수신자 ${recipients.length}명이 1회 상한(${max}명)을 넘습니다. Resend 일 한도 때문에 Batch 전환(2단계)이 필요합니다.`;
      await prisma.newsletterIssue.update({ where: { id: issueId }, data: { status: "FAILED", lastError: error } });
      return { success: false, error };
    }

    await prisma.newsletterDelivery.createMany({
      data: recipients.map((r) => ({ issueId, subscriberId: r.subscriberId, email: r.email })),
      skipDuplicates: true,
    });

    const rendered = render(issue);
    const byEmail = new Map(recipients.map((r) => [r.email, r]));
    const pending = await prisma.newsletterDelivery.findMany({
      where: { issueId, status: { in: ["QUEUED", "FAILED"] } },
      select: { id: true, email: true, subscriberId: true },
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const sentSubscriberIds: string[] = [];

    for (const [index, d] of pending.entries()) {
      const recipient = byEmail.get(d.email);
      if (!recipient) {
        await prisma.newsletterDelivery.update({ where: { id: d.id }, data: { status: "SKIPPED" } });
        skipped += 1;
        continue;
      }
      if (index > 0 && throttleMs > 0) await sleep(throttleMs);

      const result = await sendResendEmail({
        to: d.email,
        subject: rendered.subject,
        html: rendered.html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, recipient.unsubscribeUrl),
        text: rendered.text.replaceAll(UNSUBSCRIBE_PLACEHOLDER, recipient.unsubscribeUrl),
        headers: { "List-Unsubscribe": `<${recipient.unsubscribeUrl}>` },
      });

      if (result.success) {
        await prisma.newsletterDelivery.update({
          where: { id: d.id },
          data: { status: "SENT", resendId: result.id ?? null, error: null, sentAt: new Date() },
        });
        sent += 1;
        if (d.subscriberId) sentSubscriberIds.push(d.subscriberId);
      } else {
        await prisma.newsletterDelivery.update({
          where: { id: d.id },
          data: { status: "FAILED", error: result.error },
        });
        failed += 1;
      }
    }

    if (sentSubscriberIds.length > 0) {
      await prisma.newsletterSubscriber.updateMany({
        where: { id: { in: sentSubscriberIds } },
        data: { lastSentAt: new Date() },
      });
    }

    const recipientCount = await prisma.newsletterDelivery.count({ where: { issueId, status: "SENT" } });
    await prisma.newsletterIssue.update({
      where: { id: issueId },
      data: {
        status: failed > 0 ? "FAILED" : "SENT",
        sentAt: sent > 0 ? new Date() : undefined,
        recipientCount,
        lastError: failed > 0 ? `${failed}건 발송 실패` : null,
      },
    });
    return { success: true, sent, failed, skipped };
  } catch (e) {
    const message = e instanceof Error ? e.message : "뉴스레터 발송 중 알 수 없는 오류가 발생했습니다.";
    Sentry.captureException(e, { tags: { feature: "newsletter-send" }, extra: { issueId } });
    try {
      await prisma.newsletterIssue.update({ where: { id: issueId }, data: { status: "FAILED", lastError: message } });
    } catch (recoveryError) {
      Sentry.captureException(recoveryError, { tags: { feature: "newsletter-send-recovery" }, extra: { issueId } });
    }
    return { success: false, error: message };
  }
}

export async function processDueIssues(
  opts: { now?: Date; throttleMs?: number } = {}
): Promise<{ processed: number; sent: number; failed: number; recovered: number }> {
  const now = opts.now ?? new Date();

  const stale = await prisma.newsletterIssue.findMany({
    where: { status: "SENDING", updatedAt: { lt: new Date(now.getTime() - STALE_SENDING_MS) } },
    select: { id: true },
  });
  if (stale.length > 0) {
    await prisma.newsletterIssue.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { status: "FAILED", lastError: STALE_SENDING_ERROR },
    });
  }

  const due = await prisma.newsletterIssue.findMany({
    where: { status: "APPROVED", scheduledAt: { lte: now } },
    orderBy: { scheduledAt: "asc" },
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  for (const { id } of due) {
    const result = await sendIssue(id, { allowFrom: ["APPROVED"], throttleMs: opts.throttleMs });
    if (result.success && result.failed === 0) sent += 1;
    else failed += 1;
  }
  return { processed: due.length, sent, failed, recovered: stale.length };
}

export async function sendTestIssue(
  issueId: string,
  recipients: string[]
): Promise<{ success: true } | { success: false; error: string }> {
  const issue = await loadIssue(issueId);
  if (!issue) return { success: false, error: "호를 찾을 수 없습니다." };
  if (recipients.length === 0) return { success: false, error: "테스트 수신자가 없습니다." };

  const rendered = render(issue);
  const unsubscribeUrl = `${SITE_URL}/#newsletter`;
  const result = await sendResendEmail({
    to: recipients,
    subject: ensureAdPrefix(`[테스트] ${rendered.subject}`),
    html: rendered.html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, unsubscribeUrl),
    text: rendered.text.replaceAll(UNSUBSCRIBE_PLACEHOLDER, unsubscribeUrl),
  });
  return result.success ? { success: true } : { success: false, error: result.error };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/newsletter/send.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/newsletter/send.ts src/lib/newsletter/send.test.ts
git commit -m "feat(newsletter): 멱등 발송 엔진(선점·해지자 스킵·수신자 상한·테스트 발송)"
```

---

### Task 10: Cron 라우트 2종 + 설정

**Files:**
- Create: `src/app/api/cron/newsletter-collect/route.ts`, `src/app/api/cron/newsletter-send/route.ts`
- Test: `src/app/api/cron/newsletter-collect/route.test.ts`, `src/app/api/cron/newsletter-send/route.test.ts`
- Modify: `vercel.json`, `.env.example`

**Interfaces:**
- Consumes: `collectCampaign` (Task 7), `processDueIssues` (Task 9)
- Produces: `GET /api/cron/newsletter-collect`, `GET /api/cron/newsletter-send` (Bearer `CRON_SECRET`)

- [ ] **Step 1: 실패 테스트** — `src/app/api/cron/newsletter-collect/route.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const collectCampaignMock = vi.fn();
vi.mock("@/lib/newsletter/collect/collect-campaign", () => ({
  collectCampaign: (...a: unknown[]) => collectCampaignMock(...a),
}));
const captureMessageMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureMessage: (...a: unknown[]) => captureMessageMock(...a) }));
const prismaMock = { newsletterCampaign: { findMany: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { GET } = await import("./route");
const req = (auth?: string) =>
  new Request("https://www.coredxi.com/api/cron/newsletter-collect", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
  prismaMock.newsletterCampaign.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
  collectCampaignMock.mockResolvedValue({ campaignId: "c1", errors: [], attached: 3 });
});

describe("GET /api/cron/newsletter-collect", () => {
  it("Bearer 불일치·시크릿 미설정이면 401이고 수집하지 않는다", async () => {
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer undefined"))).status).toBe(401);
    expect(collectCampaignMock).not.toHaveBeenCalled();
  });

  it("활성·비임시저장·기간 내·비즉시 캠페인을 순서대로 수집한다", async () => {
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(collectCampaignMock).toHaveBeenCalledTimes(2);
    const where = prismaMock.newsletterCampaign.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ isActive: true, isDraft: false, sendType: { not: "IMMEDIATE" } });
  });

  it("캠페인 하나가 예외를 던져도 나머지를 계속하고 Sentry에 남긴다", async () => {
    collectCampaignMock.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ campaignId: "c2", errors: [] });
    const res = await GET(req("Bearer s3cret"));
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(captureMessageMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 테스트** — `src/app/api/cron/newsletter-send/route.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const processDueIssuesMock = vi.fn();
vi.mock("@/lib/newsletter/send", () => ({ processDueIssues: (...a: unknown[]) => processDueIssuesMock(...a) }));
const captureMessageMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureMessage: (...a: unknown[]) => captureMessageMock(...a) }));

const { GET } = await import("./route");
const req = (auth?: string) =>
  new Request("https://www.coredxi.com/api/cron/newsletter-send", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
  processDueIssuesMock.mockResolvedValue({ processed: 1, sent: 1, failed: 0, recovered: 0 });
});

describe("GET /api/cron/newsletter-send", () => {
  it("인증 실패 시 401, 발송 로직 미호출", async () => {
    expect((await GET(req())).status).toBe(401);
    expect(processDueIssuesMock).not.toHaveBeenCalled();
  });

  it("성공 시 결과를 돌려준다", async () => {
    const body = await (await GET(req("Bearer s3cret"))).json();
    expect(body).toMatchObject({ ok: true, processed: 1, sent: 1 });
  });

  it("실패·회수가 있으면 Sentry 경고", async () => {
    processDueIssuesMock.mockResolvedValue({ processed: 1, sent: 0, failed: 1, recovered: 1 });
    await GET(req("Bearer s3cret"));
    expect(captureMessageMock).toHaveBeenCalledWith(expect.stringContaining("newsletter send"), "warning");
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/app/api/cron/newsletter-collect src/app/api/cron/newsletter-send`
Expected: FAIL — `./route` 없음

- [ ] **Step 4: 구현** — `src/app/api/cron/newsletter-collect/route.ts`

```ts
// [홍보팀] 뉴스레터 기사 수집 크론 — 매일 06:00 KST(Vercel Cron "0 21 * * *")에 활성 캠페인의 기사를 모아
// 이번 호 초안에 후보로 붙인다. CRON_SECRET Bearer 토큰으로 보호(없거나 틀리면 401, 수집 안 함).
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { collectCampaign, type CollectResult } from "@/lib/newsletter/collect/collect-campaign";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const campaigns = await prisma.newsletterCampaign.findMany({
    where: {
      isActive: true,
      isDraft: false,
      sendType: { not: "IMMEDIATE" },
      activeFrom: { lte: now },
      OR: [{ activeUntil: null }, { activeUntil: { gte: now } }],
    },
    select: { id: true },
  });

  const results: (CollectResult | { campaignId: string; errors: string[] })[] = [];
  for (const { id } of campaigns) {
    try {
      const r = await collectCampaign(id, { now });
      results.push(r);
      if (r.errors.length > 0) {
        Sentry.captureMessage(`newsletter collect ${id}: ${r.errors.join(" / ")}`, "warning");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ campaignId: id, errors: [message] });
      Sentry.captureMessage(`newsletter collect ${id} crashed: ${message}`, "error");
    }
  }

  return NextResponse.json({ ok: true, results, ranAt: now.toISOString() });
}
```

- [ ] **Step 5: 구현** — `src/app/api/cron/newsletter-send/route.ts`

```ts
// [홍보팀] 뉴스레터 예약 발송 크론 — 매일 08:00 KST(Vercel Cron "0 23 * * *")에 승인되고 예약 시각이 지난 호를 보낸다.
// Hobby 플랜은 크론이 하루 1회라 예약 시각은 사실상 "그날 08시 슬롯"으로 동작한다. CRON_SECRET Bearer 보호.
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { processDueIssues } from "@/lib/newsletter/send";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDueIssues();
  if (result.failed > 0 || result.recovered > 0) {
    Sentry.captureMessage(
      `newsletter send: ${result.failed} failed, ${result.recovered} recovered`,
      "warning"
    );
  }
  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}
```

- [ ] **Step 6: `vercel.json` crons 교체**

```json
  "crons": [
    { "path": "/api/cron/ax-check-followup", "schedule": "30 0 * * *" },
    { "path": "/api/cron/newsletter-collect", "schedule": "0 21 * * *" },
    { "path": "/api/cron/newsletter-send", "schedule": "0 23 * * *" }
  ]
```

- [ ] **Step 7: `.env.example` 끝에 추가**

```bash
# ── AX 뉴스레터 발송 시스템 (docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md) ──
# 네이버 개발자센터 "검색" API 앱 — 소셜 로그인용 NAVER_CLIENT_ID/SECRET과 다른 앱·다른 변수
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
# 1회 발송 수신자 상한(Resend 무료 일 100통 한도 보호, 기본 80)
# NEWSLETTER_MAX_RECIPIENTS=80
# "검토요청(내게 보내기)" 추가 수신자, 쉼표 구분(로그인한 관리자 이메일은 자동 포함)
# NEWSLETTER_TEST_RECIPIENTS=
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest run src/app/api/cron ; npx tsc --noEmit`
Expected: PASS (기존 ax-check-followup 라우트 테스트 포함), 타입 오류 0

- [ ] **Step 9: Commit**

```bash
git add src/app/api/cron/newsletter-collect src/app/api/cron/newsletter-send vercel.json .env.example
git commit -m "feat(newsletter): 수집·발송 Vercel Cron 라우트와 환경변수 예시"
```

---

### Task 11: 권한 게이트 + 캠페인 입력 검증 + 캠페인 Server Actions

**Files:**
- Create: `src/lib/newsletter/admin-guard.ts`, `src/lib/newsletter/campaign-input.ts`, `src/actions/newsletter-campaigns.ts`
- Test: `src/lib/newsletter/admin-guard.test.ts`, `src/lib/newsletter/campaign-input.test.ts`, `src/actions/newsletter-campaigns.test.ts`

**Interfaces:**
- Consumes: `auth` (`@/auth`), `isSafeFeedUrl` (Task 2), `kstYmdToUtc` (Task 5), `DEFAULT_*` (Task 5), `collectCampaign` (Task 7), `ensureCurrentIssue` (Task 7), `searchNaverNews` (Task 6), `matchKeywords`·`keywordHitRate`·`pickQueryTerms` (Task 4), `computeRuleScore` (Task 4), `normalizeUrl`·`computeTitleHash`·`cleanText`·`SNIPPET_MAX_LENGTH` (Task 3)
- Produces:
  - `type NewsletterAdmin = { adminId: string; role: "SUPER_ADMIN" | "EDITOR"; email: string | null }`
  - `requireNewsletterAdmin(): Promise<{ ok: true; admin: NewsletterAdmin } | { ok: false; error: string }>`
  - `requireCampaignManager(campaignId: string): Promise<{ ok: true; admin: NewsletterAdmin } | { ok: false; error: string }>`
  - `canManageCampaign(admin: NewsletterAdmin, campaign: { ownerId: string; coManagerIds: string[] }): boolean`
  - `type CampaignFormInput` / `type NormalizedCampaign` / `validateCampaignInput(input: CampaignFormInput, opts: { draft: boolean }): { ok: true; data: NormalizedCampaign } | { ok: false; error: string }`
  - Server Actions: `listCampaigns()`, `getCampaignForEdit(id)`, `listNewsSources()`, `saveCampaign(input, { draft })`, `setCampaignActive(id, active)`, `deleteDraftCampaign(id)`, `previewKeywordSearch(keywords)`, `collectCampaignNow(id)`, `addManualArticle(campaignId, input)`

- [ ] **Step 1: 실패 테스트** — `src/lib/newsletter/admin-guard.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const prismaMock = { newsletterCampaign: { findUnique: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { requireCampaignManager, requireNewsletterAdmin } = await import("./admin-guard");

const session = (role: string | undefined, id = "adm1") => ({
  user: { id, accountType: "admin", role, email: "me@coredxi.com" },
});

beforeEach(() => vi.clearAllMocks());

describe("requireNewsletterAdmin", () => {
  it("SUPER_ADMIN·EDITOR 허용", async () => {
    authMock.mockResolvedValue(session("EDITOR"));
    expect((await requireNewsletterAdmin()).ok).toBe(true);
  });

  it("VIEWER·비로그인·일반회원 거부", async () => {
    for (const s of [session("VIEWER"), null, { user: { accountType: "user" } }]) {
      authMock.mockResolvedValue(s);
      expect((await requireNewsletterAdmin()).ok).toBe(false);
    }
  });
});

describe("requireCampaignManager", () => {
  it("SUPER_ADMIN은 남의 캠페인도 허용", async () => {
    authMock.mockResolvedValue(session("SUPER_ADMIN"));
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({ ownerId: "other", coManagerIds: [] });
    expect((await requireCampaignManager("c1")).ok).toBe(true);
  });

  it("EDITOR는 owner 또는 coManager일 때만", async () => {
    authMock.mockResolvedValue(session("EDITOR", "adm1"));
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({ ownerId: "other", coManagerIds: [] });
    expect((await requireCampaignManager("c1")).ok).toBe(false);
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({ ownerId: "other", coManagerIds: ["adm1"] });
    expect((await requireCampaignManager("c1")).ok).toBe(true);
  });

  it("없는 캠페인은 거부", async () => {
    authMock.mockResolvedValue(session("SUPER_ADMIN"));
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue(null);
    expect(await requireCampaignManager("c1")).toEqual({ ok: false, error: "캠페인을 찾을 수 없습니다." });
  });
});
```

- [ ] **Step 2: 실패 테스트** — `src/lib/newsletter/campaign-input.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { validateCampaignInput, type CampaignFormInput } from "./campaign-input";

const valid: CampaignFormInput = {
  name: " AX 위클리 ",
  subjectTemplate: "(광고) [AX 위클리] {{issueDate}}",
  sendType: "REVIEW_THEN_SEND",
  cadence: "WEEKLY",
  sendDayOfWeek: 2,
  sendHourKst: 8,
  activeFrom: "2026-10-06",
  activeUntil: "2026-12-31",
  collectDays: 7,
  maxArticles: 7,
  audience: "subscribers",
  internalRecipients: [],
  keywords: [
    { group: 1, operator: "OR", term: " AI 도입 ", weight: 5 },
    { group: 1, operator: "OR", term: "", weight: 3 },
  ],
  rules: [{ indicator: "relevance", label: "관련성", description: "d", weight: 3, isEnabled: true }],
  sourceIds: ["s1", "s1"],
};

describe("validateCampaignInput", () => {
  it("정상 입력을 정규화한다(공백·빈 키워드·중복 매체 제거, KST 날짜 변환)", () => {
    const r = validateCampaignInput(valid, { draft: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.name).toBe("AX 위클리");
    expect(r.data.keywords).toEqual([{ group: 1, operator: "OR", term: "AI 도입", weight: 5 }]);
    expect(r.data.sourceIds).toEqual(["s1"]);
    expect(r.data.activeFrom.toISOString()).toBe("2026-10-05T15:00:00.000Z");
    expect(r.data.activeUntil?.toISOString()).toBe("2026-12-31T14:59:59.999Z");
  });

  it("임시저장은 이름만 있으면 통과", () => {
    const r = validateCampaignInput({ ...valid, keywords: [], subjectTemplate: "" }, { draft: true });
    expect(r.ok).toBe(true);
  });

  it.each([
    [{ name: "  " }, "이름"],
    [{ keywords: [] }, "포함 키워드"],
    [{ sendType: "SCHEDULED" as const }, "2단계"],
    [{ sendHourKst: 24 }, "발송 시각"],
    [{ collectDays: 0 }, "수집기간"],
    [{ maxArticles: 21 }, "기사 수"],
    [{ sendDayOfWeek: null }, "요일"],
    [{ activeUntil: "2026-10-01" }, "사용기간"],
    [{ activeFrom: "2026-02-30" }, "사용기간"],
    [{ audience: "internal" as const, internalRecipients: ["bad"] }, "내부 수신자"],
    [{ subjectTemplate: "" }, "제목"],
  ])("잘못된 입력 거부: %o", (patch, keyword) => {
    const r = validateCampaignInput({ ...valid, ...patch }, { draft: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(keyword);
  });

  it("DAILY는 요일이 없어도 된다", () => {
    expect(validateCampaignInput({ ...valid, cadence: "DAILY", sendDayOfWeek: null }, { draft: false }).ok).toBe(true);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/newsletter/admin-guard.test.ts src/lib/newsletter/campaign-input.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 4: 구현** — `src/lib/newsletter/admin-guard.ts`

```ts
/**
 * admin-guard.ts — 뉴스레터 관리자 권한 확인
 * [홍보팀] 캠페인을 만들 수 있는 사람(SUPER_ADMIN·EDITOR)과, 특정 캠페인을 고치고 발송할 수 있는 사람
 * (SUPER_ADMIN 또는 그 캠페인의 담당자·공동담당자)을 구분합니다.
 */
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type NewsletterAdmin = { adminId: string; role: "SUPER_ADMIN" | "EDITOR"; email: string | null };

type GuardResult = { ok: true; admin: NewsletterAdmin } | { ok: false; error: string };

export async function requireNewsletterAdmin(): Promise<GuardResult> {
  const session = await auth();
  const user = session?.user;
  if (user?.accountType !== "admin" || !user.id) return { ok: false, error: "관리자 로그인이 필요합니다." };
  if (user.role !== "SUPER_ADMIN" && user.role !== "EDITOR") {
    return { ok: false, error: "뉴스레터 권한이 없습니다. EDITOR 이상만 사용할 수 있습니다." };
  }
  return { ok: true, admin: { adminId: user.id, role: user.role, email: user.email ?? null } };
}

export function canManageCampaign(
  admin: NewsletterAdmin,
  campaign: { ownerId: string; coManagerIds: string[] }
): boolean {
  return (
    admin.role === "SUPER_ADMIN" ||
    campaign.ownerId === admin.adminId ||
    campaign.coManagerIds.includes(admin.adminId)
  );
}

export async function requireCampaignManager(campaignId: string): Promise<GuardResult> {
  const gate = await requireNewsletterAdmin();
  if (!gate.ok) return gate;
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id: campaignId },
    select: { ownerId: true, coManagerIds: true },
  });
  if (!campaign) return { ok: false, error: "캠페인을 찾을 수 없습니다." };
  if (!canManageCampaign(gate.admin, campaign)) {
    return { ok: false, error: "이 캠페인의 담당자만 수정·발송할 수 있습니다." };
  }
  return gate;
}
```

- [ ] **Step 5: 구현** — `src/lib/newsletter/campaign-input.ts`

```ts
/**
 * campaign-input.ts — 캠페인 만들기/수정 폼 입력 검증(순수 함수)
 * [홍보팀] 캠페인 저장 시 "이름이 비었어요", "키워드를 넣어 주세요" 같은 안내 문구가 여기서 나옵니다.
 */
import { kstYmdToUtc } from "./schedule";
import type { CadenceValue } from "./schedule";
import type { KeywordInput } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RuleFormInput = { indicator: string; label: string; description: string; weight: number; isEnabled: boolean };

export type CampaignFormInput = {
  id?: string;
  name: string;
  subjectTemplate: string;
  sendType: "IMMEDIATE" | "SCHEDULED" | "REVIEW_THEN_SEND";
  cadence: CadenceValue;
  sendDayOfWeek: number | null;
  sendHourKst: number;
  activeFrom: string;
  activeUntil: string | null;
  collectDays: number;
  maxArticles: number;
  audience: "subscribers" | "internal";
  internalRecipients: string[];
  keywords: KeywordInput[];
  rules: RuleFormInput[];
  sourceIds: string[];
};

export type NormalizedCampaign = Omit<CampaignFormInput, "activeFrom" | "activeUntil" | "id"> & {
  activeFrom: Date;
  activeUntil: Date | null;
};

type Result = { ok: true; data: NormalizedCampaign } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });
const isInt = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

export function validateCampaignInput(input: CampaignFormInput, opts: { draft: boolean }): Result {
  const name = input.name.trim();
  if (!name) return fail("뉴스레터 이름을 입력해 주세요.");

  const keywords = input.keywords
    .map((k) => ({ ...k, term: k.term.trim(), weight: Math.min(5, Math.max(1, Math.round(k.weight))) }))
    .filter((k) => k.term.length > 0);
  const internalRecipients = input.internalRecipients.map((e) => e.trim().toLowerCase()).filter(Boolean);
  const activeFrom = kstYmdToUtc(input.activeFrom);
  const activeUntil = input.activeUntil ? kstYmdToUtc(input.activeUntil, true) : null;
  const subjectTemplate = input.subjectTemplate.trim();

  if (!opts.draft) {
    if (!subjectTemplate) return fail("메일 제목 템플릿을 입력해 주세요.");
    if (!keywords.some((k) => k.operator !== "NOT")) return fail("포함 키워드를 1개 이상 입력해 주세요.");
    if (input.sendType === "SCHEDULED") {
      return fail("승인 없는 스케줄 자동발송은 2단계에서 활성화됩니다. '검토 후 발송'을 선택해 주세요.");
    }
    if (!isInt(input.sendHourKst, 0, 23)) return fail("발송 시각은 0~23시 사이여야 합니다.");
    if (!isInt(input.collectDays, 1, 31)) return fail("수집기간은 1~31일 사이여야 합니다.");
    if (!isInt(input.maxArticles, 1, 20)) return fail("선별 기사 수는 1~20건 사이여야 합니다.");
    if (input.cadence !== "DAILY" && (input.sendDayOfWeek === null || !isInt(input.sendDayOfWeek, 0, 6))) {
      return fail("발송 요일을 선택해 주세요.");
    }
    if (!activeFrom) return fail("사용기간 시작일이 올바르지 않습니다.");
    if (input.activeUntil && (!activeUntil || activeUntil < activeFrom)) {
      return fail("사용기간 종료일이 올바르지 않습니다.");
    }
    if (input.audience === "internal") {
      if (internalRecipients.length === 0 || internalRecipients.length > 20) {
        return fail("내부 수신자는 1~20명이어야 합니다.");
      }
      if (internalRecipients.some((e) => !EMAIL_PATTERN.test(e))) return fail("내부 수신자 이메일 형식을 확인해 주세요.");
    }
  }

  return {
    ok: true,
    data: {
      ...input,
      name,
      subjectTemplate,
      keywords,
      internalRecipients,
      sourceIds: [...new Set(input.sourceIds)],
      activeFrom: activeFrom ?? kstYmdToUtc(new Date().toISOString().slice(0, 10)) ?? new Date(),
      activeUntil,
    },
  };
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/lib/newsletter/admin-guard.test.ts src/lib/newsletter/campaign-input.test.ts`
Expected: PASS

- [ ] **Step 7: 액션 실패 테스트** — `src/actions/newsletter-campaigns.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const guardMock = { requireNewsletterAdmin: vi.fn(), requireCampaignManager: vi.fn() };
vi.mock("@/lib/newsletter/admin-guard", () => guardMock);
const collectCampaignMock = vi.fn();
vi.mock("@/lib/newsletter/collect/collect-campaign", () => ({ collectCampaign: (...a: unknown[]) => collectCampaignMock(...a) }));
const ensureCurrentIssueMock = vi.fn();
vi.mock("@/lib/newsletter/issues", () => ({ ensureCurrentIssue: (...a: unknown[]) => ensureCurrentIssueMock(...a) }));

const prismaMock = {
  newsletterCampaign: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  newsletterKeyword: { deleteMany: vi.fn() },
  newsletterSelectionRule: { deleteMany: vi.fn() },
  newsletterCampaignSource: { deleteMany: vi.fn() },
  newsletterIssue: { count: vi.fn() },
  newsArticle: { upsert: vi.fn() },
  newsletterIssueArticle: { upsert: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock)),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { addManualArticle, collectCampaignNow, deleteDraftCampaign, saveCampaign } = await import("./newsletter-campaigns");

const admin = { adminId: "adm1", role: "EDITOR", email: "me@coredxi.com" };
const input = {
  name: "AX 위클리",
  subjectTemplate: "(광고) t",
  sendType: "REVIEW_THEN_SEND" as const,
  cadence: "WEEKLY" as const,
  sendDayOfWeek: 2,
  sendHourKst: 8,
  activeFrom: "2026-10-06",
  activeUntil: "2026-12-31",
  collectDays: 7,
  maxArticles: 7,
  audience: "subscribers" as const,
  internalRecipients: [],
  keywords: [{ group: 1, operator: "OR" as const, term: "AI", weight: 3 }],
  rules: [],
  sourceIds: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  guardMock.requireNewsletterAdmin.mockResolvedValue({ ok: true, admin });
  guardMock.requireCampaignManager.mockResolvedValue({ ok: true, admin });
});

describe("saveCampaign", () => {
  it("권한이 없으면 저장하지 않는다", async () => {
    guardMock.requireNewsletterAdmin.mockResolvedValue({ ok: false, error: "권한 없음" });
    expect(await saveCampaign(input, { draft: false })).toEqual({ success: false, error: "권한 없음" });
    expect(prismaMock.newsletterCampaign.create).not.toHaveBeenCalled();
  });

  it("신규 캠페인은 로그인 관리자를 owner로, draft 플래그를 그대로 저장", async () => {
    prismaMock.newsletterCampaign.create.mockResolvedValue({ id: "c1" });
    const r = await saveCampaign(input, { draft: true });
    expect(r).toEqual({ success: true, id: "c1" });
    expect(prismaMock.newsletterCampaign.create.mock.calls[0][0].data).toMatchObject({ ownerId: "adm1", isDraft: true });
  });

  it("수정은 캠페인 담당자 게이트를 통과해야 한다", async () => {
    guardMock.requireCampaignManager.mockResolvedValue({ ok: false, error: "담당자만" });
    expect(await saveCampaign({ ...input, id: "c1" }, { draft: false })).toEqual({ success: false, error: "담당자만" });
  });

  it("RSS 매체 URL 검증과 별개로, 검증 실패 입력은 거부", async () => {
    expect((await saveCampaign({ ...input, keywords: [] }, { draft: false })).success).toBe(false);
  });
});

describe("deleteDraftCampaign", () => {
  it("임시저장이 아니거나 호가 있으면 삭제 거부", async () => {
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({ isDraft: false });
    expect((await deleteDraftCampaign("c1")).success).toBe(false);
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({ isDraft: true });
    prismaMock.newsletterIssue.count.mockResolvedValue(1);
    expect((await deleteDraftCampaign("c1")).success).toBe(false);
    expect(prismaMock.newsletterCampaign.delete).not.toHaveBeenCalled();
  });
});

describe("collectCampaignNow", () => {
  it("담당자 게이트 후 수집 결과 요약을 돌려준다", async () => {
    collectCampaignMock.mockResolvedValue({ fetched: 10, stored: 4, matched: 3, attached: 3, issueId: "i1", errors: [] });
    expect(await collectCampaignNow("c1")).toMatchObject({ success: true, attached: 3, issueId: "i1" });
  });
});

describe("addManualArticle", () => {
  it("http(s)가 아닌 URL·빈 제목 거부", async () => {
    expect((await addManualArticle("c1", { url: "javascript:x", title: "t", sourceName: "", publishedAt: "2026-10-05", snippet: "" })).success).toBe(false);
    expect((await addManualArticle("c1", { url: "https://a.com/1", title: " ", sourceName: "", publishedAt: "2026-10-05", snippet: "" })).success).toBe(false);
  });

  it("기사를 저장하고 현재 호에 선택된 후보로 붙인다", async () => {
    prismaMock.newsletterCampaign.findUnique.mockResolvedValue({
      id: "c1", sendType: "REVIEW_THEN_SEND", subjectTemplate: "t", cadence: "WEEKLY", sendDayOfWeek: 2, sendHourKst: 8,
      activeFrom: new Date("2026-10-01T00:00:00Z"), activeUntil: null,
    });
    ensureCurrentIssueMock.mockResolvedValue({ id: "i1", status: "DRAFT", editedAt: null });
    prismaMock.newsArticle.upsert.mockResolvedValue({ id: "a1" });
    prismaMock.newsletterIssueArticle.count.mockResolvedValue(2);
    const r = await addManualArticle("c1", { url: "https://a.com/1", title: "직접 추가", sourceName: "블로터", publishedAt: "2026-10-05", snippet: "요약" });
    expect(r).toEqual({ success: true, issueId: "i1" });
    expect(prismaMock.newsletterIssueArticle.upsert.mock.calls[0][0].create).toMatchObject({ issueId: "i1", articleId: "a1", isSelected: true, sortOrder: 2 });
  });
});
```

- [ ] **Step 8: 실패 확인**

Run: `npx vitest run src/actions/newsletter-campaigns.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 9: 구현** — `src/actions/newsletter-campaigns.ts`

```ts
"use server";

/**
 * newsletter-campaigns.ts — 뉴스레터 캠페인(기준) 관리 Server Actions
 * [홍보팀] /admin/newsletter/campaigns 화면의 저장·미사용·삭제·지금 수집·키워드 미리보기·기사 직접 추가 버튼이 호출합니다.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 3·7절
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCampaignManager, requireNewsletterAdmin } from "@/lib/newsletter/admin-guard";
import { validateCampaignInput, type CampaignFormInput } from "@/lib/newsletter/campaign-input";
import { collectCampaign } from "@/lib/newsletter/collect/collect-campaign";
import { searchNaverNews } from "@/lib/newsletter/collect/naver-news";
import { ensureCurrentIssue, type CampaignForIssue } from "@/lib/newsletter/issues";
import { keywordHitRate, matchKeywords, pickQueryTerms } from "@/lib/newsletter/keyword-filter";
import { SNIPPET_MAX_LENGTH, cleanText, computeTitleHash, hostOf, normalizeUrl } from "@/lib/newsletter/normalize";
import { kstYmdToUtc } from "@/lib/newsletter/schedule";
import type { KeywordInput, NewsletterActionResult } from "@/lib/newsletter/types";

const BASE_PATH = "/admin/newsletter/campaigns";

export async function listCampaigns() {
  const gate = await requireNewsletterAdmin();
  if (!gate.ok) return { success: false as const, error: gate.error };
  const campaigns = await prisma.newsletterCampaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      issues: { orderBy: { issueNo: "desc" }, take: 1, select: { id: true, issueNo: true, status: true, scheduledAt: true, issueDate: true } },
    },
  });
  return { success: true as const, campaigns };
}

export async function getCampaignForEdit(id: string) {
  const gate = await requireCampaignManager(id);
  if (!gate.ok) return { success: false as const, error: gate.error };
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id },
    include: {
      keywords: { orderBy: [{ group: "asc" }, { weight: "desc" }] },
      rules: true,
      sources: true,
      issues: { orderBy: { issueNo: "desc" }, take: 5 },
    },
  });
  if (!campaign) return { success: false as const, error: "캠페인을 찾을 수 없습니다." };
  return { success: true as const, campaign };
}

export async function listNewsSources() {
  const gate = await requireNewsletterAdmin();
  if (!gate.ok) return { success: false as const, error: gate.error };
  const sources = await prisma.newsSource.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  return { success: true as const, sources };
}

export async function saveCampaign(
  input: CampaignFormInput,
  opts: { draft: boolean }
): Promise<NewsletterActionResult<{ id: string }>> {
  const gate = input.id ? await requireCampaignManager(input.id) : await requireNewsletterAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const v = validateCampaignInput(input, opts);
  if (!v.ok) return { success: false, error: v.error };
  const d = v.data;

  const fields = {
    name: d.name,
    subjectTemplate: d.subjectTemplate,
    sendType: d.sendType,
    cadence: d.cadence,
    sendDayOfWeek: d.sendDayOfWeek,
    sendHourKst: d.sendHourKst,
    activeFrom: d.activeFrom,
    activeUntil: d.activeUntil,
    collectDays: d.collectDays,
    maxArticles: d.maxArticles,
    audience: d.audience,
    internalRecipients: d.internalRecipients,
    isDraft: opts.draft,
  };
  const children = {
    keywords: { create: d.keywords.map((k) => ({ group: k.group, operator: k.operator, term: k.term, weight: k.weight })) },
    rules: { create: d.rules.map((r) => ({ indicator: r.indicator, label: r.label, description: r.description, weight: r.weight, isEnabled: r.isEnabled })) },
    sources: { create: d.sourceIds.map((sourceId) => ({ sourceId })) },
  };

  try {
    if (!input.id) {
      const created = await prisma.newsletterCampaign.create({
        data: { ...fields, ownerId: gate.admin.adminId, ...children },
        select: { id: true },
      });
      revalidatePath(BASE_PATH);
      return { success: true, id: created.id };
    }

    const id = input.id;
    await prisma.$transaction(async (tx) => {
      await tx.newsletterKeyword.deleteMany({ where: { campaignId: id } });
      await tx.newsletterSelectionRule.deleteMany({ where: { campaignId: id } });
      await tx.newsletterCampaignSource.deleteMany({ where: { campaignId: id } });
      await tx.newsletterCampaign.update({ where: { id }, data: { ...fields, ...children } });
    });
    revalidatePath(BASE_PATH);
    revalidatePath(`${BASE_PATH}/${id}`);
    return { success: true, id };
  } catch (e) {
    console.error("[saveCampaign]", e);
    return { success: false, error: "캠페인 저장 중 오류가 발생했습니다." };
  }
}

export async function setCampaignActive(id: string, active: boolean): Promise<NewsletterActionResult> {
  const gate = await requireCampaignManager(id);
  if (!gate.ok) return { success: false, error: gate.error };
  await prisma.newsletterCampaign.update({ where: { id }, data: { isActive: active } });
  revalidatePath(BASE_PATH);
  return { success: true };
}

export async function deleteDraftCampaign(id: string): Promise<NewsletterActionResult> {
  const gate = await requireCampaignManager(id);
  if (!gate.ok) return { success: false, error: gate.error };
  const campaign = await prisma.newsletterCampaign.findUnique({ where: { id }, select: { isDraft: true } });
  if (!campaign?.isDraft) return { success: false, error: "임시저장 상태의 캠페인만 삭제할 수 있습니다. 대신 '미사용'으로 바꿔 주세요." };
  if ((await prisma.newsletterIssue.count({ where: { campaignId: id } })) > 0) {
    return { success: false, error: "이미 만들어진 호가 있어 삭제할 수 없습니다. '미사용'으로 바꿔 주세요." };
  }
  await prisma.newsletterCampaign.delete({ where: { id } });
  revalidatePath(BASE_PATH);
  return { success: true };
}

export type KeywordPreviewItem = { title: string; url: string; publishedAt: string; hitRate: number };

/** 위저드 ③단계 "결과 미리보기" — 네이버 API 즉시 조회 후 로컬 필터를 통과한 10건. */
export async function previewKeywordSearch(
  keywords: KeywordInput[]
): Promise<NewsletterActionResult<{ items: KeywordPreviewItem[] }>> {
  const gate = await requireNewsletterAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const terms = pickQueryTerms(keywords);
  if (terms.length === 0) return { success: false, error: "포함 키워드를 먼저 입력해 주세요." };
  try {
    const results = (await Promise.all(terms.slice(0, 3).map((t) => searchNaverNews(t, { display: 50 })))).flat();
    const items = results
      .map((a) => ({ a, m: matchKeywords(keywords, a.title, a.snippet ?? "") }))
      .filter(({ m }) => m.passes)
      .slice(0, 10)
      .map(({ a, m }) => ({ title: a.title, url: a.originalUrl, publishedAt: a.publishedAt.toISOString(), hitRate: keywordHitRate(m) }));
    return { success: true, items };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "미리보기 조회에 실패했습니다." };
  }
}

export async function collectCampaignNow(
  id: string
): Promise<NewsletterActionResult<{ fetched: number; stored: number; matched: number; attached: number; issueId: string | null; errors: string[] }>> {
  const gate = await requireCampaignManager(id);
  if (!gate.ok) return { success: false, error: gate.error };
  const r = await collectCampaign(id);
  revalidatePath(`${BASE_PATH}/${id}`);
  revalidatePath(`${BASE_PATH}/${id}/articles`);
  return { success: true, fetched: r.fetched, stored: r.stored, matched: r.matched, attached: r.attached, issueId: r.issueId, errors: r.errors };
}

export type ManualArticleInput = { url: string; title: string; sourceName: string; publishedAt: string; snippet: string };

/** 관리자가 기사를 직접 추가(origin=MANUAL) → 현재 호에 선택된 후보로 붙인다. */
export async function addManualArticle(
  campaignId: string,
  input: ManualArticleInput
): Promise<NewsletterActionResult<{ issueId: string }>> {
  const gate = await requireCampaignManager(campaignId);
  if (!gate.ok) return { success: false, error: gate.error };

  const urlNormalized = normalizeUrl(input.url);
  const title = cleanText(input.title);
  if (!urlNormalized) return { success: false, error: "기사 URL은 http(s) 주소여야 합니다." };
  if (!title) return { success: false, error: "기사 제목을 입력해 주세요." };
  const publishedAt = kstYmdToUtc(input.publishedAt) ?? new Date();

  const campaign = await prisma.newsletterCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { success: false, error: "캠페인을 찾을 수 없습니다." };
  const issue = await ensureCurrentIssue(campaign as CampaignForIssue, new Date());
  if (!issue) return { success: false, error: "편집 가능한 이번 호가 없습니다(사용기간 종료 또는 이미 승인됨)." };

  const article = await prisma.newsArticle.upsert({
    where: { urlNormalized },
    update: {},
    create: {
      urlNormalized,
      originalUrl: input.url.trim(),
      title,
      snippet: cleanText(input.snippet).slice(0, SNIPPET_MAX_LENGTH) || null,
      publishedAt,
      sourceName: input.sourceName.trim() || hostOf(input.url),
      origin: "MANUAL",
      titleHash: computeTitleHash(title),
    },
    select: { id: true },
  });
  const sortOrder = await prisma.newsletterIssueArticle.count({ where: { issueId: issue.id } });
  await prisma.newsletterIssueArticle.upsert({
    where: { issueId_articleId: { issueId: issue.id, articleId: article.id } },
    create: { issueId: issue.id, articleId: article.id, ruleScore: 100, isSelected: true, sortOrder },
    update: { isSelected: true },
  });
  revalidatePath(`${BASE_PATH}/${campaignId}/articles`);
  return { success: true, issueId: issue.id };
}
```

> 주의: 수동 추가는 `editedAt`을 찍지 **않는다** — 수동 기사는 `ruleScore=100`이라 이후 자동 재선별에서도 상위(선택)에 남으므로, 자동 수집을 계속 살려 둔다. (반면 Task 12 `attachArticleToIssue`는 `ruleScore=0`이라 재선별 때 밀려나지 않도록 `editedAt`을 찍는다.)

> 매체 RSS URL 등록 화면은 1단계 범위 밖(시드 스크립트로만 등록, Task 15). 따라서 "등록 시점" SSRF 검사는 시드 스크립트에서 수행한다.

- [ ] **Step 10: 통과 확인**

Run: `npx vitest run src/actions/newsletter-campaigns.test.ts src/lib/newsletter ; npx tsc --noEmit`
Expected: PASS, 타입 오류 0

- [ ] **Step 11: Commit**

```bash
git add src/lib/newsletter/admin-guard.ts src/lib/newsletter/admin-guard.test.ts src/lib/newsletter/campaign-input.ts src/lib/newsletter/campaign-input.test.ts src/actions/newsletter-campaigns.ts src/actions/newsletter-campaigns.test.ts
git commit -m "feat(newsletter): 캠페인 권한 게이트·입력 검증·관리 Server Actions"
```

---

### Task 12: 호(Issue) Server Actions

**Files:**
- Create: `src/actions/newsletter-issues.ts`
- Test: `src/actions/newsletter-issues.test.ts`

**Interfaces:**
- Consumes: `requireCampaignManager`·`requireNewsletterAdmin` (Task 11), `sendIssue`·`sendTestIssue`·`renderIssueEmail` (Task 9), `computeNextSendAt` (Task 5), `EDITABLE_ISSUE_STATUSES` (Task 7)
- Produces:
  - `type IssueArticleEdit = { id: string; isSelected: boolean; sortOrder: number; editorNote: string | null; summary: string | null }`
  - `getIssueForEdit(issueId)`, `getIssuePreview(issueId): Promise<NewsletterActionResult<{ subject: string; html: string }>>`
  - `updateIssue(issueId, input: { subject: string; intro: string | null; articles: IssueArticleEdit[] }): Promise<NewsletterActionResult>`
  - `attachArticleToIssue(issueId, articleId): Promise<NewsletterActionResult>`
  - `requestIssueReview(issueId): Promise<NewsletterActionResult<{ recipients: string[] }>>`
  - `approveIssue(issueId, scheduledAtIso: string | null): Promise<NewsletterActionResult<{ scheduledAt: string }>>`
  - `unapproveIssue(issueId)`, `cancelIssue(issueId)`, `sendIssueNow(issueId)`, `retryIssue(issueId)`, `listIssueHistory()`

- [ ] **Step 1: 실패 테스트** — `src/actions/newsletter-issues.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const guardMock = { requireNewsletterAdmin: vi.fn(), requireCampaignManager: vi.fn() };
vi.mock("@/lib/newsletter/admin-guard", () => guardMock);
const sendMock = { sendIssue: vi.fn(), sendTestIssue: vi.fn(), renderIssueEmail: vi.fn() };
vi.mock("@/lib/newsletter/send", () => sendMock);

const prismaMock = {
  newsletterIssue: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  newsletterIssueArticle: { count: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { approveIssue, requestIssueReview, sendIssueNow, updateIssue } = await import("./newsletter-issues");

const admin = { adminId: "adm1", role: "EDITOR", email: "me@coredxi.com" };
const issue = {
  id: "i1",
  campaignId: "c1",
  status: "DRAFT",
  campaign: { cadence: "WEEKLY", sendDayOfWeek: 2, sendHourKst: 8, activeFrom: new Date("2026-10-01T00:00:00Z"), activeUntil: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEWSLETTER_TEST_RECIPIENTS;
  guardMock.requireCampaignManager.mockResolvedValue({ ok: true, admin });
  prismaMock.newsletterIssue.findUnique.mockResolvedValue(issue);
  prismaMock.newsletterIssue.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.newsletterIssueArticle.count.mockResolvedValue(3);
});

describe("updateIssue", () => {
  it("편집 불가 상태(APPROVED 등)면 거부", async () => {
    prismaMock.newsletterIssue.findUnique.mockResolvedValue({ ...issue, status: "APPROVED" });
    expect((await updateIssue("i1", { subject: "s", intro: null, articles: [] })).success).toBe(false);
  });

  it("기사 선택·순서·코멘트를 저장하고 editedAt을 찍는다", async () => {
    await updateIssue("i1", {
      subject: " 제목 ",
      intro: "",
      articles: [{ id: "ia1", isSelected: true, sortOrder: 0, editorNote: " 메모 ", summary: "" }],
    });
    expect(prismaMock.newsletterIssueArticle.update).toHaveBeenCalledWith({
      where: { id: "ia1", issueId: "i1" },
      data: { isSelected: true, sortOrder: 0, editorNote: "메모", summary: null },
    });
    expect(prismaMock.newsletterIssue.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: expect.objectContaining({ subject: "제목", intro: null, editedAt: expect.any(Date) }),
    });
  });
});

describe("approveIssue", () => {
  it("선택된 기사가 없으면 거부", async () => {
    prismaMock.newsletterIssueArticle.count.mockResolvedValue(0);
    expect((await approveIssue("i1", null)).success).toBe(false);
  });

  it("예약 시각 미지정이면 캠페인 다음 슬롯으로 APPROVED", async () => {
    const r = await approveIssue("i1", null);
    expect(r.success).toBe(true);
    const call = prismaMock.newsletterIssue.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "i1", status: { in: ["COLLECTING", "DRAFT", "REVIEW_REQUESTED"] } });
    expect(call.data).toMatchObject({ status: "APPROVED", approvedById: "adm1" });
    expect(call.data.scheduledAt.getUTCHours()).toBe(23); // 08:00 KST
  });

  it("과거 예약 시각은 거부", async () => {
    expect((await approveIssue("i1", "2020-01-01T00:00:00.000Z")).success).toBe(false);
  });
});

describe("requestIssueReview", () => {
  it("로그인 관리자 + NEWSLETTER_TEST_RECIPIENTS에게 테스트 발송 후 REVIEW_REQUESTED", async () => {
    process.env.NEWSLETTER_TEST_RECIPIENTS = "sales@coredxi.com, me@coredxi.com";
    sendMock.sendTestIssue.mockResolvedValue({ success: true });
    const r = await requestIssueReview("i1");
    expect(sendMock.sendTestIssue).toHaveBeenCalledWith("i1", ["me@coredxi.com", "sales@coredxi.com"]);
    expect(r).toEqual({ success: true, recipients: ["me@coredxi.com", "sales@coredxi.com"] });
    expect(prismaMock.newsletterIssue.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", status: { in: ["COLLECTING", "DRAFT"] } },
      data: { status: "REVIEW_REQUESTED" },
    });
  });

  it("테스트 발송 실패면 상태를 바꾸지 않는다", async () => {
    sendMock.sendTestIssue.mockResolvedValue({ success: false, error: "설정 안 됨" });
    expect(await requestIssueReview("i1")).toEqual({ success: false, error: "설정 안 됨" });
    expect(prismaMock.newsletterIssue.updateMany).not.toHaveBeenCalled();
  });
});

describe("sendIssueNow", () => {
  it("DRAFT·REVIEW_REQUESTED·APPROVED·FAILED에서 즉시 발송을 허용한다", async () => {
    sendMock.sendIssue.mockResolvedValue({ success: true, sent: 2, failed: 0, skipped: 0 });
    const r = await sendIssueNow("i1");
    expect(sendMock.sendIssue).toHaveBeenCalledWith("i1", { allowFrom: ["DRAFT", "REVIEW_REQUESTED", "APPROVED", "FAILED"] });
    expect(r).toEqual({ success: true, sent: 2, failed: 0, skipped: 0 });
  });

  it("담당자가 아니면 발송하지 않는다", async () => {
    guardMock.requireCampaignManager.mockResolvedValue({ ok: false, error: "담당자만" });
    expect(await sendIssueNow("i1")).toEqual({ success: false, error: "담당자만" });
    expect(sendMock.sendIssue).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/actions/newsletter-issues.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현** — `src/actions/newsletter-issues.ts`

```ts
"use server";

/**
 * newsletter-issues.ts — 뉴스레터 호(발송 단위) 편집·검토·승인·발송 Server Actions
 * [홍보팀] 선별 편집 화면의 "저장 / 검토요청(내게 보내기) / 승인·예약 / 즉시 발송 / 취소"와
 * 발송 이력 화면의 "재시도" 버튼이 호출합니다. 모든 동작은 해당 캠페인 담당자만 할 수 있습니다.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCampaignManager, requireNewsletterAdmin } from "@/lib/newsletter/admin-guard";
import { EDITABLE_ISSUE_STATUSES } from "@/lib/newsletter/issues";
import { computeNextSendAt } from "@/lib/newsletter/schedule";
import { renderIssueEmail, sendIssue, sendTestIssue, type SendIssueResult } from "@/lib/newsletter/send";
import type { NewsletterActionResult } from "@/lib/newsletter/types";

export type IssueArticleEdit = {
  id: string;
  isSelected: boolean;
  sortOrder: number;
  editorNote: string | null;
  summary: string | null;
};

const NOT_EDITABLE = "이미 승인·발송된 호는 수정할 수 없습니다. 먼저 '승인 취소'를 눌러 주세요.";

async function loadIssueWithGate(issueId: string) {
  const issue = await prisma.newsletterIssue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      campaignId: true,
      status: true,
      campaign: { select: { cadence: true, sendDayOfWeek: true, sendHourKst: true, activeFrom: true, activeUntil: true } },
    },
  });
  if (!issue) return { ok: false as const, error: "호를 찾을 수 없습니다." };
  const gate = await requireCampaignManager(issue.campaignId);
  if (!gate.ok) return { ok: false as const, error: gate.error };
  return { ok: true as const, issue, admin: gate.admin };
}

function revalidateIssue(campaignId: string, issueId: string) {
  revalidatePath(`/admin/newsletter/campaigns/${campaignId}/issues/${issueId}`);
  revalidatePath("/admin/newsletter/history");
}

function isEditable(status: string): boolean {
  return (EDITABLE_ISSUE_STATUSES as readonly string[]).includes(status);
}

export async function getIssueForEdit(issueId: string) {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false as const, error: loaded.error };
  const issue = await prisma.newsletterIssue.findUnique({
    where: { id: issueId },
    include: {
      campaign: { select: { id: true, name: true, maxArticles: true } },
      articles: { orderBy: [{ isSelected: "desc" }, { sortOrder: "asc" }], include: { article: { include: { source: true } } } },
    },
  });
  if (!issue) return { success: false as const, error: "호를 찾을 수 없습니다." };
  return { success: true as const, issue };
}

export async function getIssuePreview(issueId: string): Promise<NewsletterActionResult<{ subject: string; html: string }>> {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const rendered = await renderIssueEmail(issueId);
  if (!rendered) return { success: false, error: "호를 찾을 수 없습니다." };
  return { success: true, subject: rendered.subject, html: rendered.html };
}

export async function updateIssue(
  issueId: string,
  input: { subject: string; intro: string | null; articles: IssueArticleEdit[] }
): Promise<NewsletterActionResult> {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  if (!isEditable(loaded.issue.status)) return { success: false, error: NOT_EDITABLE };
  const subject = input.subject.trim();
  if (!subject) return { success: false, error: "메일 제목을 입력해 주세요." };

  await prisma.$transaction([
    ...input.articles.map((a) =>
      prisma.newsletterIssueArticle.update({
        where: { id: a.id, issueId },
        data: {
          isSelected: a.isSelected,
          sortOrder: a.sortOrder,
          editorNote: a.editorNote?.trim() || null,
          summary: a.summary?.trim() || null,
        },
      })
    ),
    prisma.newsletterIssue.update({
      where: { id: issueId },
      data: { subject, intro: input.intro?.trim() || null, editedAt: new Date() },
    }),
  ]);
  revalidateIssue(loaded.issue.campaignId, issueId);
  return { success: true };
}

export async function attachArticleToIssue(issueId: string, articleId: string): Promise<NewsletterActionResult> {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  if (!isEditable(loaded.issue.status)) return { success: false, error: NOT_EDITABLE };
  const sortOrder = await prisma.newsletterIssueArticle.count({ where: { issueId } });
  await prisma.newsletterIssueArticle.upsert({
    where: { issueId_articleId: { issueId, articleId } },
    create: { issueId, articleId, ruleScore: 0, isSelected: true, sortOrder },
    update: { isSelected: true },
  });
  await prisma.newsletterIssue.update({ where: { id: issueId }, data: { editedAt: new Date(), status: "DRAFT" } });
  revalidateIssue(loaded.issue.campaignId, issueId);
  return { success: true };
}

export async function requestIssueReview(issueId: string): Promise<NewsletterActionResult<{ recipients: string[] }>> {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  const extra = (process.env.NEWSLETTER_TEST_RECIPIENTS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const recipients = [...new Set([loaded.admin.email?.toLowerCase(), ...extra].filter((e): e is string => !!e))];

  const result = await sendTestIssue(issueId, recipients);
  if (!result.success) return { success: false, error: result.error };

  await prisma.newsletterIssue.updateMany({
    where: { id: issueId, status: { in: ["COLLECTING", "DRAFT"] } },
    data: { status: "REVIEW_REQUESTED" },
  });
  revalidateIssue(loaded.issue.campaignId, issueId);
  return { success: true, recipients };
}

export async function approveIssue(
  issueId: string,
  scheduledAtIso: string | null
): Promise<NewsletterActionResult<{ scheduledAt: string }>> {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  const selected = await prisma.newsletterIssueArticle.count({ where: { issueId, isSelected: true } });
  if (selected === 0) return { success: false, error: "선별된 기사가 없습니다. 기사를 1건 이상 선택해 주세요." };

  const now = new Date();
  let scheduledAt: Date | null;
  if (scheduledAtIso) {
    scheduledAt = new Date(scheduledAtIso);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= now) {
      return { success: false, error: "예약 시각은 현재 이후여야 합니다. 지금 보내려면 '즉시 발송'을 눌러 주세요." };
    }
  } else {
    scheduledAt = computeNextSendAt(loaded.issue.campaign, now);
    if (!scheduledAt) return { success: false, error: "캠페인 사용기간 안에 남은 발송일이 없습니다." };
  }

  const r = await prisma.newsletterIssue.updateMany({
    where: { id: issueId, status: { in: [...EDITABLE_ISSUE_STATUSES] } },
    data: { status: "APPROVED", scheduledAt, approvedById: loaded.admin.adminId, approvedAt: now, lastError: null },
  });
  if (r.count !== 1) return { success: false, error: NOT_EDITABLE };
  revalidateIssue(loaded.issue.campaignId, issueId);
  return { success: true, scheduledAt: scheduledAt.toISOString() };
}

export async function unapproveIssue(issueId: string): Promise<NewsletterActionResult> {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const r = await prisma.newsletterIssue.updateMany({
    where: { id: issueId, status: "APPROVED" },
    data: { status: "DRAFT", scheduledAt: null, approvedById: null, approvedAt: null },
  });
  if (r.count !== 1) return { success: false, error: "승인 상태가 아닙니다." };
  revalidateIssue(loaded.issue.campaignId, issueId);
  return { success: true };
}

export async function cancelIssue(issueId: string): Promise<NewsletterActionResult> {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const r = await prisma.newsletterIssue.updateMany({
    where: { id: issueId, status: { in: [...EDITABLE_ISSUE_STATUSES, "APPROVED"] } },
    data: { status: "CANCELED" },
  });
  if (r.count !== 1) return { success: false, error: "발송 중이거나 이미 발송된 호는 취소할 수 없습니다." };
  revalidateIssue(loaded.issue.campaignId, issueId);
  return { success: true };
}

export async function sendIssueNow(issueId: string): Promise<SendIssueResult> {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const result = await sendIssue(issueId, { allowFrom: ["DRAFT", "REVIEW_REQUESTED", "APPROVED", "FAILED"] });
  revalidateIssue(loaded.issue.campaignId, issueId);
  return result;
}

export async function retryIssue(issueId: string): Promise<SendIssueResult> {
  const loaded = await loadIssueWithGate(issueId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const result = await sendIssue(issueId, { allowFrom: ["FAILED"] });
  revalidateIssue(loaded.issue.campaignId, issueId);
  return result;
}

export async function listIssueHistory() {
  const gate = await requireNewsletterAdmin();
  if (!gate.ok) return { success: false as const, error: gate.error };
  const issues = await prisma.newsletterIssue.findMany({
    where: { status: { in: ["APPROVED", "SENDING", "SENT", "FAILED", "CANCELED"] } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      campaign: { select: { id: true, name: true } },
      _count: { select: { deliveries: true } },
      deliveries: { where: { status: "FAILED" }, select: { id: true } },
    },
  });
  return { success: true as const, issues };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/actions/newsletter-issues.test.ts ; npx tsc --noEmit`
Expected: PASS, 타입 오류 0

- [ ] **Step 5: Commit**

```bash
git add src/actions/newsletter-issues.ts src/actions/newsletter-issues.test.ts
git commit -m "feat(newsletter): 호 편집·검토요청·승인·즉시발송·재시도 Server Actions"
```

---

### Task 13: 관리자 UI ① — 내비게이션 · 캠페인 목록 · 캠페인 만들기/수정

**Files:**
- Modify: `src/app/admin/(panel)/AdminSidebar.tsx:40` (라벨만)
- Create: `src/app/admin/(panel)/newsletter/layout.tsx`, `src/app/admin/(panel)/newsletter/NewsletterNav.tsx`
- Create: `src/app/admin/(panel)/newsletter/campaigns/page.tsx`
- Create: `src/app/admin/(panel)/newsletter/campaigns/new/page.tsx`
- Create: `src/app/admin/(panel)/newsletter/campaigns/[id]/page.tsx`
- Create: `src/app/admin/(panel)/newsletter/campaigns/CampaignForm.tsx`
- Create: `src/app/admin/(panel)/newsletter/campaigns/[id]/CampaignActions.tsx`

**Interfaces:**
- Consumes: `listCampaigns`·`getCampaignForEdit`·`listNewsSources`·`saveCampaign`·`setCampaignActive`·`deleteDraftCampaign`·`previewKeywordSearch`·`collectCampaignNow` (Task 11), `DEFAULT_*` (Task 5), `formatKstDate` (`@/lib/format-kst-date`)
- Produces: 라우트 `/admin/newsletter/campaigns`, `/new`, `/[id]`; `CampaignForm` props `{ sources: { id: string; name: string; category: string; rssUrl: string | null }[]; initial?: CampaignFormInput }`

- [ ] **Step 1: 사이드바 라벨 변경** — `AdminSidebar.tsx`

```tsx
  { label: "뉴스레터", href: "/admin/newsletter", icon: Send },
```

- [ ] **Step 2: 탭 내비** — `src/app/admin/(panel)/newsletter/NewsletterNav.tsx`

```tsx
/**
 * NewsletterNav.tsx — 뉴스레터 관리 화면 상단 탭(구독자 / 캠페인 / 발송 이력)
 * [홍보팀] 탭 이름을 바꾸려면 TABS의 label만 수정하세요. href는 개발팀 문의.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "구독자", href: "/admin/newsletter", exact: true },
  { label: "캠페인", href: "/admin/newsletter/campaigns", exact: false },
  { label: "발송 이력", href: "/admin/newsletter/history", exact: false },
] as const;

export function NewsletterNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-2 border-b border-gray-200" aria-label="뉴스레터 메뉴">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px rounded-t-xl border-b-2 px-4 py-2 text-sm font-medium ${
              active ? "border-[#1E4E8C] text-[#1E4E8C]" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: 레이아웃** — `src/app/admin/(panel)/newsletter/layout.tsx`

```tsx
// [홍보팀] 뉴스레터 관리 화면 공통 틀 — 모든 하위 화면 위에 탭 메뉴를 보여 줍니다.
import type { ReactNode } from "react";
import { NewsletterNav } from "./NewsletterNav";

export default function NewsletterLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <NewsletterNav />
      {children}
    </div>
  );
}
```

- [ ] **Step 4: 캠페인 목록** — `src/app/admin/(panel)/newsletter/campaigns/page.tsx`

```tsx
// [홍보팀] 뉴스레터 캠페인(기준) 목록 — 이름·주기·최근 호 상태를 한눈에 봅니다. 포스코 "뉴스레터 기준관리" 화면에 해당.
import Link from "next/link";
import { listCampaigns } from "@/actions/newsletter-campaigns";
import { Button } from "@/components/ui/button";
import { formatKstDate } from "@/lib/format-kst-date";

export const dynamic = "force-dynamic";

const CADENCE_LABEL: Record<string, string> = { DAILY: "매일", WEEKLY: "매주", BIWEEKLY: "격주", MONTHLY: "매월" };
const DAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];
const STATUS_LABEL: Record<string, string> = {
  COLLECTING: "수집 중", DRAFT: "초안", REVIEW_REQUESTED: "검토 요청", APPROVED: "승인(예약)",
  SENDING: "발송 중", SENT: "발송 완료", FAILED: "실패", CANCELED: "취소",
};

export default async function NewsletterCampaignsPage() {
  const result = await listCampaigns();
  if (!result.success) return <p className="text-sm text-red-600">{result.error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">뉴스레터 캠페인</h1>
        <Button render={<Link href="/admin/newsletter/campaigns/new" />}>새 캠페인 만들기</Button>
      </div>
      <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">주기</th>
              <th className="px-4 py-3 font-medium">최근 호</th>
              <th className="px-4 py-3 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {result.campaigns.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">아직 캠페인이 없습니다.</td></tr>
            ) : (
              result.campaigns.map((c) => {
                const latest = c.issues[0];
                return (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/newsletter/campaigns/${c.id}`} className="font-medium text-[#1E4E8C] hover:underline">
                        {c.name}
                      </Link>
                      {c.isDraft && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">임시저장</span>}
                      {!c.isActive && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">미사용</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {CADENCE_LABEL[c.cadence]} {c.cadence !== "DAILY" && c.sendDayOfWeek !== null ? `${DAY_LABEL[c.sendDayOfWeek]}요일 ` : ""}
                      {c.sendHourKst}시
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {latest ? `#${latest.issueNo} · ${formatKstDate(latest.issueDate)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{latest ? STATUS_LABEL[latest.status] : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

> `Button`의 `render` prop은 프로젝트 `button.tsx`가 `@base-ui/react` 기반일 때의 링크 렌더 방식이다. 실행자는 `src/components/ui/button.tsx`를 열어 `render`(base-ui) 또는 `asChild`(radix) 중 실제 지원되는 쪽을 쓴다. 다른 관리자 페이지(`/admin/blog/page.tsx`)의 "새 글" 버튼 구현을 그대로 따른다.

- [ ] **Step 5: 캠페인 폼(클라이언트)** — `src/app/admin/(panel)/newsletter/campaigns/CampaignForm.tsx`

```tsx
/**
 * CampaignForm.tsx — 뉴스레터 캠페인 만들기/수정 폼(4개 구역: 기준 · 수신자 · 검색 키워드 · 선별지표)
 * [홍보팀] 포스코 "새뉴스레터 만들기" 화면에 해당합니다. "임시저장"은 필수값이 비어도 저장되며 자동 수집되지 않습니다.
 * "저장"하면 다음 날 아침부터 기사가 자동 수집됩니다. 제목 앞 "(광고)"는 법적 표기라 지우지 마세요.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { previewKeywordSearch, saveCampaign, type KeywordPreviewItem } from "@/actions/newsletter-campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CampaignFormInput, RuleFormInput } from "@/lib/newsletter/campaign-input";
import {
  DEFAULT_COLLECT_DAYS,
  DEFAULT_MAX_ARTICLES,
  DEFAULT_SELECTION_RULES,
  DEFAULT_SEND_DAY_OF_WEEK,
  DEFAULT_SEND_HOUR_KST,
  DEFAULT_SUBJECT_TEMPLATE,
} from "@/lib/newsletter/defaults";
import type { KeywordInput } from "@/lib/newsletter/types";

type SourceOption = { id: string; name: string; category: string; rssUrl: string | null };

const SELECT_CLASS = "h-9 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm";
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function todayKst(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
}

function defaultInput(): CampaignFormInput {
  return {
    name: "",
    subjectTemplate: DEFAULT_SUBJECT_TEMPLATE,
    sendType: "REVIEW_THEN_SEND",
    cadence: "WEEKLY",
    sendDayOfWeek: DEFAULT_SEND_DAY_OF_WEEK,
    sendHourKst: DEFAULT_SEND_HOUR_KST,
    activeFrom: todayKst(),
    activeUntil: `${todayKst().slice(0, 4)}-12-31`,
    collectDays: DEFAULT_COLLECT_DAYS,
    maxArticles: DEFAULT_MAX_ARTICLES,
    audience: "subscribers",
    internalRecipients: [],
    keywords: [{ group: 1, operator: "OR", term: "", weight: 3 }],
    rules: DEFAULT_SELECTION_RULES.map((r) => ({ ...r, isEnabled: true })),
    sourceIds: [],
  };
}

export function CampaignForm({ sources, initial }: { sources: SourceOption[]; initial?: CampaignFormInput }) {
  const router = useRouter();
  const [form, setForm] = useState<CampaignFormInput>(initial ?? defaultInput());
  const [preview, setPreview] = useState<KeywordPreviewItem[] | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof CampaignFormInput>(key: K, value: CampaignFormInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setKeyword = (i: number, patch: Partial<KeywordInput>) =>
    set("keywords", form.keywords.map((k, idx) => (idx === i ? { ...k, ...patch } : k)));
  const setRule = (i: number, patch: Partial<RuleFormInput>) =>
    set("rules", form.rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const maxGroup = Math.max(1, ...form.keywords.filter((k) => k.operator !== "NOT").map((k) => k.group));

  const submit = (draft: boolean) =>
    startTransition(async () => {
      const r = await saveCampaign(form, { draft });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(draft ? "임시저장했습니다." : "저장했습니다. 다음 수집부터 반영됩니다.");
      router.push(`/admin/newsletter/campaigns/${r.id}`);
    });

  const runPreview = () =>
    startTransition(async () => {
      const r = await previewKeywordSearch(form.keywords);
      if (!r.success) toast.error(r.error);
      else setPreview(r.items);
    });

  return (
    <div className="space-y-8">
      {/* ① 기준 */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">① 기준</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="nl-name">뉴스레터 이름</Label>
            <Input id="nl-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nl-subject">메일 제목 템플릿</Label>
            <Input id="nl-subject" value={form.subjectTemplate} onChange={(e) => set("subjectTemplate", e.target.value)} />
            <p className="text-xs text-gray-500">{"{{issueDate}}"}=발행일, {"{{issueNo}}"}=회차</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nl-sendtype">발송 유형</Label>
            <select id="nl-sendtype" className={SELECT_CLASS} value={form.sendType}
              onChange={(e) => set("sendType", e.target.value as CampaignFormInput["sendType"])}>
              <option value="REVIEW_THEN_SEND">검토 후 발송(권장)</option>
              <option value="IMMEDIATE">즉시 발송(1회)</option>
              <option value="SCHEDULED" disabled>스케줄 자동발송(2단계)</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="nl-cadence">주기</Label>
              <select id="nl-cadence" className={SELECT_CLASS} value={form.cadence}
                onChange={(e) => set("cadence", e.target.value as CampaignFormInput["cadence"])}>
                <option value="DAILY">매일</option>
                <option value="WEEKLY">매주</option>
                <option value="BIWEEKLY">격주</option>
                <option value="MONTHLY">매월 첫째 주</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="nl-day">요일</Label>
              <select id="nl-day" className={SELECT_CLASS} disabled={form.cadence === "DAILY"}
                value={form.sendDayOfWeek ?? DEFAULT_SEND_DAY_OF_WEEK}
                onChange={(e) => set("sendDayOfWeek", Number(e.target.value))}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="nl-hour">시각(KST)</Label>
              <Input id="nl-hour" type="number" min={0} max={23} value={form.sendHourKst}
                onChange={(e) => set("sendHourKst", Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="nl-from">사용기간 시작</Label>
              <Input id="nl-from" type="date" value={form.activeFrom} onChange={(e) => set("activeFrom", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nl-until">사용기간 종료</Label>
              <Input id="nl-until" type="date" value={form.activeUntil ?? ""}
                onChange={(e) => set("activeUntil", e.target.value || null)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="nl-days">수집기간(최근 N일)</Label>
              <Input id="nl-days" type="number" min={1} max={31} value={form.collectDays}
                onChange={(e) => set("collectDays", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nl-max">선별 기사 수</Label>
              <Input id="nl-max" type="number" min={1} max={20} value={form.maxArticles}
                onChange={(e) => set("maxArticles", Number(e.target.value))} />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500">예약 발송은 매일 오전 8시(KST)에 한 번 처리됩니다.</p>
      </section>

      {/* ② 수신자 */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">② 수신자</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="nl-audience" checked={form.audience === "subscribers"} onChange={() => set("audience", "subscribers")} />
          구독자 전원(구독 중인 사람만)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="nl-audience" checked={form.audience === "internal"} onChange={() => set("audience", "internal")} />
          내부 지정 수신자
        </label>
        {form.audience === "internal" && (
          <div className="space-y-1">
            <Label htmlFor="nl-internal">내부 수신자 이메일(쉼표 구분, 최대 20명)</Label>
            <Input id="nl-internal" value={form.internalRecipients.join(", ")}
              onChange={(e) => set("internalRecipients", e.target.value.split(","))} />
          </div>
        )}
      </section>

      {/* ③ 검색 키워드 */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">③ 검색 키워드</h2>
        <p className="text-xs text-gray-500">같은 그룹 안의 단어는 하나만 맞아도 되고, 모든 그룹이 맞아야 수집됩니다. "제외" 단어가 들어간 기사는 빠집니다.</p>
        {form.keywords.map((k, i) => (
          <div key={i} className="grid grid-cols-[110px_90px_1fr_80px_auto] items-center gap-2">
            <select aria-label={`키워드 ${i + 1} 구분`} className={SELECT_CLASS}
              value={k.operator === "NOT" ? "NOT" : String(k.group)}
              onChange={(e) =>
                setKeyword(i, e.target.value === "NOT" ? { operator: "NOT", group: 0 } : { operator: "OR", group: Number(e.target.value) })
              }>
              {Array.from({ length: maxGroup + 1 }, (_, g) => g + 1).map((g) => (
                <option key={g} value={g}>포함 그룹 {g}</option>
              ))}
              <option value="NOT">제외</option>
            </select>
            <span className="text-xs text-gray-500">{k.operator === "NOT" ? "이 단어 제외" : "중 하나"}</span>
            <Input aria-label={`키워드 ${i + 1}`} value={k.term} onChange={(e) => setKeyword(i, { term: e.target.value })} />
            <select aria-label={`키워드 ${i + 1} 가중치`} className={SELECT_CLASS} value={k.weight}
              disabled={k.operator === "NOT"} onChange={(e) => setKeyword(i, { weight: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>가중 {w}</option>)}
            </select>
            <Button type="button" variant="outline" size="sm"
              onClick={() => set("keywords", form.keywords.filter((_, idx) => idx !== i))}>삭제</Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm"
            onClick={() => set("keywords", [...form.keywords, { group: 1, operator: "OR", term: "", weight: 3 }])}>
            키워드 추가
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={runPreview}>
            결과 미리보기(네이버 10건)
          </Button>
        </div>
        {preview && (
          <ul className="space-y-1 rounded-xl bg-gray-50 p-3 text-sm">
            {preview.length === 0 ? <li className="text-gray-500">조건에 맞는 최근 기사가 없습니다.</li> : preview.map((p) => (
              <li key={p.url}>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[#1E4E8C] hover:underline">{p.title}</a>
                <span className="ml-2 text-xs text-gray-500">적중 {Math.round(p.hitRate * 100)}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ④ 선별지표 + RSS 매체 */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">④ 선별지표 · RSS 매체</h2>
        <p className="text-xs text-gray-500">선별지표는 2단계(AI 점수)부터 반영됩니다. 지금은 키워드·최신성·매체 신뢰도로 자동 점수를 매깁니다.</p>
        {form.rules.map((r, i) => (
          <div key={r.indicator} className="grid grid-cols-[auto_120px_1fr_90px] items-center gap-2 text-sm">
            <input type="checkbox" aria-label={`${r.label} 사용`} checked={r.isEnabled} onChange={(e) => setRule(i, { isEnabled: e.target.checked })} />
            <span className="font-medium">{r.label}</span>
            <span className="text-gray-500">{r.description}</span>
            <select aria-label={`${r.label} 가중치`} className={SELECT_CLASS} value={r.weight}
              onChange={(e) => setRule(i, { weight: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>가중 {w}</option>)}
            </select>
          </div>
        ))}
        <div className="grid gap-2 pt-2 sm:grid-cols-3">
          {sources.map((s) => (
            <label key={s.id} className={`flex items-center gap-2 text-sm ${s.rssUrl ? "" : "text-gray-400"}`}>
              <input type="checkbox" disabled={!s.rssUrl} checked={form.sourceIds.includes(s.id)}
                onChange={(e) =>
                  set("sourceIds", e.target.checked ? [...form.sourceIds, s.id] : form.sourceIds.filter((id) => id !== s.id))
                } />
              {s.name} <span className="text-xs text-gray-400">{s.rssUrl ? s.category : "RSS 없음"}</span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => submit(true)}>임시저장</Button>
        <Button type="button" disabled={pending} onClick={() => submit(false)}>저장</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 새 캠페인 페이지** — `src/app/admin/(panel)/newsletter/campaigns/new/page.tsx`

```tsx
// [홍보팀] 새 뉴스레터 캠페인 만들기 화면.
import { listNewsSources } from "@/actions/newsletter-campaigns";
import { CampaignForm } from "../CampaignForm";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const result = await listNewsSources();
  if (!result.success) return <p className="text-sm text-red-600">{result.error}</p>;
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">새 캠페인 만들기</h1>
      <CampaignForm sources={result.sources} />
    </div>
  );
}
```

- [ ] **Step 7: 캠페인 상세 액션 버튼** — `src/app/admin/(panel)/newsletter/campaigns/[id]/CampaignActions.tsx`

```tsx
/**
 * CampaignActions.tsx — 캠페인 상세의 "지금 수집 / 미사용·사용 / 삭제" 버튼
 * [홍보팀] "지금 수집"은 아침 자동 수집을 기다리지 않고 바로 기사를 모읍니다. 삭제는 임시저장 캠페인만 가능합니다.
 */
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { collectCampaignNow, deleteDraftCampaign, setCampaignActive } from "@/actions/newsletter-campaigns";
import { Button } from "@/components/ui/button";

export function CampaignActions({ id, isActive, isDraft }: { id: string; isActive: boolean; isDraft: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const collect = () =>
    startTransition(async () => {
      const r = await collectCampaignNow(id);
      if (!r.success) return void toast.error(r.error);
      toast.success(`수집 ${r.fetched}건 → 조건 통과 ${r.matched}건, 이번 호 후보 ${r.attached}건`);
      if (r.errors.length > 0) toast.warning(`일부 수집 실패: ${r.errors.join(" / ")}`);
      router.refresh();
    });

  const toggle = () =>
    startTransition(async () => {
      const r = await setCampaignActive(id, !isActive);
      if (!r.success) return void toast.error(r.error);
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      if (!window.confirm("이 임시저장 캠페인을 삭제할까요?")) return;
      const r = await deleteDraftCampaign(id);
      if (!r.success) return void toast.error(r.error);
      router.push("/admin/newsletter/campaigns");
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={pending} onClick={collect}>지금 수집</Button>
      <Button type="button" variant="outline" disabled={pending} onClick={toggle}>{isActive ? "미사용 처리" : "사용 재개"}</Button>
      {isDraft && <Button type="button" variant="outline" disabled={pending} onClick={remove}>삭제</Button>}
    </div>
  );
}
```

- [ ] **Step 8: 캠페인 상세 페이지** — `src/app/admin/(panel)/newsletter/campaigns/[id]/page.tsx`

```tsx
// [홍보팀] 캠페인 상세 — 최근 호 바로가기, 수집 기사 보기, 설정 수정을 한 화면에서 합니다.
import Link from "next/link";
import { getCampaignForEdit, listNewsSources } from "@/actions/newsletter-campaigns";
import { formatKstDate } from "@/lib/format-kst-date";
import { formatKstYmd } from "@/lib/newsletter/schedule";
import type { CampaignFormInput } from "@/lib/newsletter/campaign-input";
import { CampaignForm } from "../CampaignForm";
import { CampaignActions } from "./CampaignActions";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, sourcesResult] = await Promise.all([getCampaignForEdit(id), listNewsSources()]);
  if (!result.success) return <p className="text-sm text-red-600">{result.error}</p>;
  if (!sourcesResult.success) return <p className="text-sm text-red-600">{sourcesResult.error}</p>;
  const c = result.campaign;

  const initial: CampaignFormInput = {
    id: c.id,
    name: c.name,
    subjectTemplate: c.subjectTemplate,
    sendType: c.sendType,
    cadence: c.cadence,
    sendDayOfWeek: c.sendDayOfWeek,
    sendHourKst: c.sendHourKst,
    activeFrom: formatKstYmd(c.activeFrom),
    activeUntil: c.activeUntil ? formatKstYmd(c.activeUntil) : null,
    collectDays: c.collectDays,
    maxArticles: c.maxArticles,
    audience: c.audience === "internal" ? "internal" : "subscribers",
    internalRecipients: c.internalRecipients,
    keywords: c.keywords.map((k) => ({ group: k.group, operator: k.operator, term: k.term, weight: k.weight })),
    rules: c.rules.map((r) => ({ indicator: r.indicator, label: r.label, description: r.description, weight: r.weight, isEnabled: r.isEnabled })),
    sourceIds: c.sources.map((s) => s.sourceId),
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{c.name}</h1>
        <CampaignActions id={c.id} isActive={c.isActive} isDraft={c.isDraft} />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">최근 호</h2>
          <Link href={`/admin/newsletter/campaigns/${c.id}/articles`} className="text-sm text-[#1E4E8C] hover:underline">수집 기사 보기 →</Link>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {c.issues.length === 0 ? <li className="text-gray-500">아직 호가 없습니다. "지금 수집"을 눌러 보세요.</li> : c.issues.map((i) => (
            <li key={i.id}>
              <Link href={`/admin/newsletter/campaigns/${c.id}/issues/${i.id}`} className="text-[#1E4E8C] hover:underline">
                #{i.issueNo} · {formatKstDate(i.issueDate)} · {i.subject}
              </Link>
              <span className="ml-2 text-xs text-gray-500">{i.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <CampaignForm sources={sourcesResult.sources} initial={initial} />
    </div>
  );
}
```

- [ ] **Step 9: 검증**

Run: `npx tsc --noEmit ; npm run lint`
Expected: 오류 0. 이어서 `npm run dev` → `/admin/newsletter/campaigns/new`에서 임시저장 → 상세 페이지 이동 → 다시 저장 확인(로컬 DB가 운영 DB면 **이 단계는 Task 16 마이그레이션 적용 이후로 미룬다** — 마이그레이션 전엔 테이블이 없어 500).

- [ ] **Step 10: Commit**

```bash
git add "src/app/admin/(panel)/AdminSidebar.tsx" "src/app/admin/(panel)/newsletter"
git commit -m "feat(newsletter): 관리자 캠페인 목록·만들기·상세 화면과 탭 내비"
```

---

### Task 14: 관리자 UI ② — 수집 기사 · 선별 편집/미리보기/발송 · 발송 이력

**Files:**
- Create: `src/app/admin/(panel)/newsletter/campaigns/[id]/articles/page.tsx`
- Create: `src/app/admin/(panel)/newsletter/campaigns/[id]/articles/ManualArticleForm.tsx`
- Create: `src/app/admin/(panel)/newsletter/campaigns/[id]/articles/AttachButton.tsx`
- Create: `src/app/admin/(panel)/newsletter/campaigns/[id]/issues/[issueId]/page.tsx`
- Create: `src/app/admin/(panel)/newsletter/campaigns/[id]/issues/[issueId]/IssueEditor.tsx`
- Create: `src/app/admin/(panel)/newsletter/history/page.tsx`
- Create: `src/app/admin/(panel)/newsletter/history/RetryButton.tsx`

**Interfaces:**
- Consumes: `addManualArticle` (Task 11), `getIssueForEdit`·`getIssuePreview`·`updateIssue`·`attachArticleToIssue`·`requestIssueReview`·`approveIssue`·`unapproveIssue`·`cancelIssue`·`sendIssueNow`·`retryIssue`·`listIssueHistory` (Task 12)

- [ ] **Step 1: 수집 기사 페이지** — `articles/page.tsx`

```tsx
// [홍보팀] 수집 기사 목록(최근 14일, 최대 200건) — 포스코 "자료 수집관리" 화면. "이번 호에 추가"로 후보에 직접 넣을 수 있습니다.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCampaignManager } from "@/lib/newsletter/admin-guard";
import { ensureCurrentIssue, type CampaignForIssue } from "@/lib/newsletter/issues";
import { formatKstDate } from "@/lib/format-kst-date";
import { AttachButton } from "./AttachButton";
import { ManualArticleForm } from "./ManualArticleForm";

export const dynamic = "force-dynamic";

export default async function CampaignArticlesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireCampaignManager(id);
  if (!gate.ok) return <p className="text-sm text-red-600">{gate.error}</p>;

  const campaign = await prisma.newsletterCampaign.findUnique({ where: { id } });
  if (!campaign) return <p className="text-sm text-red-600">캠페인을 찾을 수 없습니다.</p>;
  const issue = await ensureCurrentIssue(campaign as CampaignForIssue, new Date());
  const since = new Date(Date.now() - 14 * 86_400_000);
  const articles = await prisma.newsArticle.findMany({
    where: { collectedAt: { gte: since } },
    orderBy: { publishedAt: "desc" },
    take: 200,
    include: { source: true, issueArticles: { where: { issue: { campaignId: id } }, select: { issueId: true, ruleScore: true, isSelected: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{campaign.name} — 수집 기사</h1>
        {issue && (
          <Link href={`/admin/newsletter/campaigns/${id}/issues/${issue.id}`} className="text-sm text-[#1E4E8C] hover:underline">이번 호 편집 →</Link>
        )}
      </div>
      <ManualArticleForm campaignId={id} />
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">제목</th>
              <th className="px-4 py-3 font-medium">매체</th>
              <th className="px-4 py-3 font-medium">발행일</th>
              <th className="px-4 py-3 font-medium">규칙점수</th>
              <th className="px-4 py-3 font-medium">이번 호</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => {
              const inIssue = issue ? a.issueArticles.find((ia) => ia.issueId === issue.id) : undefined;
              const score = a.issueArticles[0]?.ruleScore;
              return (
                <tr key={a.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    <a href={a.originalUrl} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline">{a.title}</a>
                    {a.snippet && <p className="mt-1 line-clamp-1 text-xs text-gray-500">{a.snippet}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.source?.name ?? a.sourceName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{formatKstDate(a.publishedAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{score ?? "—"}</td>
                  <td className="px-4 py-3">
                    {inIssue ? <span className="text-xs text-[#1E4E8C]">{inIssue.isSelected ? "선택됨" : "후보"}</span>
                      : issue ? <AttachButton issueId={issue.id} articleId={a.id} /> : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 이번 호에 추가 버튼** — `articles/AttachButton.tsx`

```tsx
/**
 * AttachButton.tsx — 수집 기사 한 건을 이번 호 후보(선택됨)로 추가
 * [홍보팀] 자동 선별에서 빠졌지만 꼭 넣고 싶은 기사를 넣을 때 씁니다. 추가하면 그 호는 "관리자 편집됨"이 되어 자동 재선별이 멈춥니다.
 */
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { attachArticleToIssue } from "@/actions/newsletter-issues";
import { Button } from "@/components/ui/button";

export function AttachButton({ issueId, articleId }: { issueId: string; articleId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending}
      onClick={() => startTransition(async () => {
        const r = await attachArticleToIssue(issueId, articleId);
        if (!r.success) return void toast.error(r.error);
        toast.success("이번 호에 추가했습니다.");
        router.refresh();
      })}>
      이번 호에 추가
    </Button>
  );
}
```

- [ ] **Step 3: 기사 직접 추가 폼** — `articles/ManualArticleForm.tsx`

```tsx
/**
 * ManualArticleForm.tsx — 자동 수집에 안 잡힌 기사를 URL·제목으로 직접 추가
 * [홍보팀] 기사 본문을 복사해 붙이지 마세요. 요약은 직접 쓴 한두 문장만 넣습니다(저작권).
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addManualArticle, type ManualArticleInput } from "@/actions/newsletter-campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY: ManualArticleInput = { url: "", title: "", sourceName: "", publishedAt: "", snippet: "" };

export function ManualArticleForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<ManualArticleInput>(EMPTY);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof ManualArticleInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await addManualArticle(campaignId, form);
          if (!r.success) return void toast.error(r.error);
          toast.success("기사를 추가하고 이번 호에 선택했습니다.");
          setForm(EMPTY);
          router.refresh();
        });
      }}
    >
      <h2 className="font-semibold text-gray-900 sm:col-span-2">기사 직접 추가</h2>
      <div className="space-y-1"><Label htmlFor="ma-url">기사 URL</Label><Input id="ma-url" value={form.url} onChange={(e) => set("url", e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="ma-title">기사 제목</Label><Input id="ma-title" value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="ma-source">매체명</Label><Input id="ma-source" value={form.sourceName} onChange={(e) => set("sourceName", e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="ma-date">발행일</Label><Input id="ma-date" type="date" value={form.publishedAt} onChange={(e) => set("publishedAt", e.target.value)} /></div>
      <div className="space-y-1 sm:col-span-2"><Label htmlFor="ma-snippet">한 줄 요약(직접 작성)</Label><Input id="ma-snippet" value={form.snippet} onChange={(e) => set("snippet", e.target.value)} /></div>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>추가</Button></div>
    </form>
  );
}
```

- [ ] **Step 4: 선별 편집기** — `issues/[issueId]/IssueEditor.tsx`

```tsx
/**
 * IssueEditor.tsx — 뉴스레터 한 호의 선별 편집·미리보기·검토요청·승인·발송
 * [홍보팀] 포스코 "선별 자료관리" 화면입니다. 순서: 기사 체크·순서 조정·코멘트 → 저장 → 미리보기 확인 →
 * "검토요청(내게 보내기)"로 내 메일함에서 확인 → "승인(예약)" 또는 "즉시 발송".
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  approveIssue, cancelIssue, getIssuePreview, requestIssueReview, sendIssueNow, unapproveIssue, updateIssue,
  type IssueArticleEdit,
} from "@/actions/newsletter-issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type EditorArticle = IssueArticleEdit & {
  title: string;
  url: string;
  sourceName: string | null;
  publishedLabel: string;
  ruleScore: number;
};

type Props = {
  issueId: string;
  status: string;
  subject: string;
  intro: string | null;
  maxArticles: number;
  scheduledLabel: string | null;
  articles: EditorArticle[];
};

const EDITABLE = ["COLLECTING", "DRAFT", "REVIEW_REQUESTED"];

export function IssueEditor(props: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState(props.subject);
  const [intro, setIntro] = useState(props.intro ?? "");
  const [articles, setArticles] = useState(props.articles);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [pending, startTransition] = useTransition();
  const editable = EDITABLE.includes(props.status);
  const selectedCount = articles.filter((a) => a.isSelected).length;

  const patch = (id: string, p: Partial<EditorArticle>) => setArticles((list) => list.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const move = (index: number, dir: -1 | 1) =>
    setArticles((list) => {
      const next = [...list];
      const target = index + dir;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.success) return void toast.error(r.error ?? "실패했습니다.");
      toast.success(ok);
      router.refresh();
    });

  const save = () =>
    run(
      () => updateIssue(props.issueId, {
        subject,
        intro,
        articles: articles.map((a, i) => ({ id: a.id, isSelected: a.isSelected, sortOrder: i, editorNote: a.editorNote, summary: a.summary })),
      }),
      "저장했습니다."
    );

  const loadPreview = () =>
    startTransition(async () => {
      const r = await getIssuePreview(props.issueId);
      if (!r.success) return void toast.error(r.error);
      setPreviewHtml(r.html);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="is-subject">메일 제목</Label>
          <Input id="is-subject" value={subject} disabled={!editable} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="is-intro">인사말(선택)</Label>
          <Textarea id="is-intro" value={intro} disabled={!editable} onChange={(e) => setIntro(e.target.value)} />
        </div>
        <p className="text-sm text-gray-600">선택 {selectedCount}건 / 권장 {props.maxArticles}건</p>
        <ul className="space-y-3">
          {articles.map((a, i) => (
            <li key={a.id} className={`rounded-xl border p-3 ${a.isSelected ? "border-[#1E4E8C] bg-white" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex items-start gap-2">
                <input type="checkbox" aria-label={`${a.title} 선택`} checked={a.isSelected} disabled={!editable}
                  onChange={(e) => patch(a.id, { isSelected: e.target.checked })} />
                <div className="flex-1">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:underline">{a.title}</a>
                  <p className="text-xs text-gray-500">{[a.sourceName, a.publishedLabel, `점수 ${a.ruleScore}`].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" aria-label="위로" disabled={!editable} onClick={() => move(i, -1)}>▲</Button>
                  <Button type="button" size="sm" variant="outline" aria-label="아래로" disabled={!editable} onClick={() => move(i, 1)}>▼</Button>
                </div>
              </div>
              {a.isSelected && (
                <div className="mt-2 grid gap-2">
                  <Input aria-label={`${a.title} 요약`} placeholder="2문장 요약(직접 작성, 비우면 기사 설명 1줄)" value={a.summary ?? ""}
                    disabled={!editable} onChange={(e) => patch(a.id, { summary: e.target.value })} />
                  <Input aria-label={`${a.title} 코멘트`} placeholder="편집자 한 줄 코멘트(선택)" value={a.editorNote ?? ""}
                    disabled={!editable} onChange={(e) => patch(a.id, { editorNote: e.target.value })} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {editable && <Button type="button" disabled={pending} onClick={save}>저장</Button>}
          <Button type="button" variant="outline" disabled={pending} onClick={loadPreview}>미리보기</Button>
          {editable && (
            <Button type="button" variant="outline" disabled={pending}
              onClick={() => run(() => requestIssueReview(props.issueId), "검토요청 메일을 보냈습니다.")}>
              검토요청(내게 보내기)
            </Button>
          )}
        </div>
        {editable && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 p-3">
            <div className="space-y-1">
              <Label htmlFor="is-schedule">예약 시각(비우면 캠페인 다음 발송일)</Label>
              <Input id="is-schedule" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
            </div>
            <Button type="button" disabled={pending}
              onClick={() => run(() => approveIssue(props.issueId, scheduleAt ? new Date(`${scheduleAt}:00+09:00`).toISOString() : null), "승인했습니다. 예약 시각에 발송됩니다.")}>
              승인(예약)
            </Button>
          </div>
        )}
        {props.status === "APPROVED" && (
          <p className="text-sm text-gray-700">
            승인됨 — 예약 {props.scheduledLabel}.{" "}
            <Button type="button" size="sm" variant="outline" disabled={pending}
              onClick={() => run(() => unapproveIssue(props.issueId), "승인을 취소했습니다.")}>승인 취소</Button>
          </p>
        )}
        {(editable || props.status === "APPROVED" || props.status === "FAILED") && (
          <div className="flex gap-2">
            <Button type="button" variant="destructive" disabled={pending}
              onClick={() => {
                if (!window.confirm("지금 구독자 전원에게 발송합니다. 계속할까요?")) return;
                startTransition(async () => {
                  const r = await sendIssueNow(props.issueId);
                  if (!r.success) return void toast.error(r.error);
                  toast.success(`발송 ${r.sent}건, 실패 ${r.failed}건, 제외 ${r.skipped}건`);
                  router.refresh();
                });
              }}>
              즉시 발송
            </Button>
            {props.status !== "FAILED" && (
              <Button type="button" variant="outline" disabled={pending}
                onClick={() => window.confirm("이 호를 취소할까요?") && run(() => cancelIssue(props.issueId), "취소했습니다.")}>
                호 취소
              </Button>
            )}
          </div>
        )}
        {previewHtml !== null && (
          <iframe title="뉴스레터 미리보기" sandbox="" srcDoc={previewHtml} className="h-[720px] w-full rounded-xl border border-gray-200 bg-white" />
        )}
      </div>
    </div>
  );
}
```

> `Button`에 `variant="destructive"`가 없으면 `src/components/ui/button.tsx`의 variants를 확인해 존재하는 경고 variant를 쓰거나 `variant="outline"` + `className="border-red-300 text-red-700"`로 대체한다(새 색상 토큰 추가 금지 — red는 기존 오류 문구 색과 동일 계열).

- [ ] **Step 5: 선별 편집 페이지** — `issues/[issueId]/page.tsx`

```tsx
// [홍보팀] 뉴스레터 한 호 편집 화면 — 제목·인사말·기사 선택을 고치고 미리보기·검토요청·승인·발송합니다.
import { getIssueForEdit } from "@/actions/newsletter-issues";
import { formatKstDate, formatKstDateLong } from "@/lib/format-kst-date";
import { IssueEditor } from "./IssueEditor";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 즉시 발송(최대 80통 × 600ms 스로틀)

export default async function IssuePage({ params }: { params: Promise<{ id: string; issueId: string }> }) {
  const { issueId } = await params;
  const result = await getIssueForEdit(issueId);
  if (!result.success) return <p className="text-sm text-red-600">{result.error}</p>;
  const issue = result.issue;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{issue.campaign.name} #{issue.issueNo}</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">발행일 {formatKstDate(issue.issueDate)} · 상태 {issue.status}{issue.lastError ? ` · ${issue.lastError}` : ""}</p>
      <IssueEditor
        issueId={issue.id}
        status={issue.status}
        subject={issue.subject}
        intro={issue.intro}
        maxArticles={issue.campaign.maxArticles}
        scheduledLabel={issue.scheduledAt ? formatKstDateLong(issue.scheduledAt) : null}
        articles={issue.articles.map((ia) => ({
          id: ia.id,
          isSelected: ia.isSelected,
          sortOrder: ia.sortOrder,
          editorNote: ia.editorNote,
          summary: ia.summary,
          title: ia.article.title,
          url: ia.article.originalUrl,
          sourceName: ia.article.source?.name ?? ia.article.sourceName,
          publishedLabel: formatKstDate(ia.article.publishedAt),
          ruleScore: ia.ruleScore,
        }))}
      />
    </div>
  );
}
```

> `formatKstDateLong`의 실제 출력 형식(시각 포함 여부)을 `src/lib/format-kst-date.ts`에서 확인한다. 시각이 없으면 예약 표시용으로 `Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" })`를 이 페이지에서 직접 쓴다.

- [ ] **Step 6: 재시도 버튼** — `history/RetryButton.tsx`

```tsx
/**
 * RetryButton.tsx — 발송 실패한 호를 다시 보냄(이미 받은 사람에게는 다시 가지 않음)
 * [홍보팀] 실패 원인(예: 일시적 메일 서버 오류)을 확인한 뒤 누르세요.
 */
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { retryIssue } from "@/actions/newsletter-issues";
import { Button } from "@/components/ui/button";

export function RetryButton({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending}
      onClick={() => startTransition(async () => {
        const r = await retryIssue(issueId);
        if (!r.success) return void toast.error(r.error);
        toast.success(`재발송 ${r.sent}건, 실패 ${r.failed}건`);
        router.refresh();
      })}>
      재시도
    </Button>
  );
}
```

- [ ] **Step 7: 발송 이력 페이지** — `history/page.tsx`

```tsx
// [홍보팀] 뉴스레터 발송 이력 — 호별 수신 인원·실패 건수를 보고, 실패한 호는 재시도합니다.
import Link from "next/link";
import { listIssueHistory } from "@/actions/newsletter-issues";
import { formatKstDate } from "@/lib/format-kst-date";
import { RetryButton } from "./RetryButton";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function NewsletterHistoryPage() {
  const result = await listIssueHistory();
  if (!result.success) return <p className="text-sm text-red-600">{result.error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">발송 이력</h1>
      <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">캠페인 · 회차</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">예약/발송</th>
              <th className="px-4 py-3 font-medium">성공 / 전체</th>
              <th className="px-4 py-3 font-medium">실패</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {result.issues.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">아직 승인·발송된 호가 없습니다.</td></tr>
            ) : result.issues.map((i) => (
              <tr key={i.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/newsletter/campaigns/${i.campaign.id}/issues/${i.id}`} className="text-[#1E4E8C] hover:underline">
                    {i.campaign.name} #{i.issueNo}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{i.status}{i.lastError ? ` — ${i.lastError}` : ""}</td>
                <td className="px-4 py-3 text-gray-600">{formatKstDate(i.sentAt ?? i.scheduledAt ?? i.issueDate)}</td>
                <td className="px-4 py-3 text-gray-600">{i.recipientCount} / {i._count.deliveries}</td>
                <td className="px-4 py-3 text-gray-600">{i.deliveries.length}</td>
                <td className="px-4 py-3">{i.status === "FAILED" && <RetryButton issueId={i.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: 검증**

Run: `npx tsc --noEmit ; npm run lint ; npm run test`
Expected: 오류 0, 전체 테스트 PASS

- [ ] **Step 9: Commit**

```bash
git add "src/app/admin/(panel)/newsletter"
git commit -m "feat(newsletter): 수집 기사·선별 편집(미리보기·검토요청·승인·발송)·발송 이력 화면"
```

---

### Task 15: 매체 시드 스크립트 · E2E 골든패스 · 문서

**Files:**
- Create: `scripts/seed-news-sources.ts`
- Create: `e2e/admin-newsletter.spec.ts`
- Modify: `CONTENT_GUIDE.md` (15번 뉴스레터 절 갱신 + 신규 절), `docs/TODO.md`, `docs/PRD.md`, `docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md` (상태란)

**Interfaces:**
- Consumes: `isSafeFeedUrl` (Task 2), Task 13·14 화면의 레이블 텍스트

- [ ] **Step 1: 시드 스크립트** — `scripts/seed-news-sources.ts`

```ts
/**
 * seed-news-sources.ts — 매체 시드 CSV → NewsSource upsert(이름 기준).
 *
 * 실행: npx tsx scripts/seed-news-sources.ts [csv경로] [--dry-run]
 *   기본 경로: docs/superpowers/assets/newsletter/news-sources.csv
 * CSV 헤더: name,category,homepage,rssUrl,domain,trustWeight,isActive (값에 쉼표 금지)
 * rssUrl은 isSafeFeedUrl(https·공개 호스트)을 통과해야 저장되고, 아니면 null로 저장 후 경고한다
 * — 설계 9절 "등록 시점 SSRF 검사"를 이 스크립트가 담당한다(1단계엔 매체 등록 화면 없음).
 * 패턴: scripts/publish-blog-drafts.ts (dotenv → main()에서 src/lib 동적 import → $disconnect)
 */
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: ".env" });

const DEFAULT_CSV = "docs/superpowers/assets/newsletter/news-sources.csv";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvPath = args.find((a) => !a.startsWith("--")) ?? DEFAULT_CSV;

  const { prisma } = await import("../src/lib/prisma");
  const { isSafeFeedUrl } = await import("../src/lib/url-safety");

  const [header, ...lines] = readFileSync(csvPath, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const cols = header.split(",").map((c) => c.trim());
  const expected = ["name", "category", "homepage", "rssUrl", "domain", "trustWeight", "isActive"];
  if (cols.join(",") !== expected.join(",")) throw new Error(`CSV 헤더가 다릅니다: ${cols.join(",")}`);

  for (const [i, line] of lines.entries()) {
    const v = line.split(",").map((c) => c.trim());
    if (v.length !== expected.length) {
      console.warn(`[skip] ${i + 2}행: 열 개수 ${v.length}`);
      continue;
    }
    const [name, category, homepage, rssRaw, domainRaw, trustRaw, activeRaw] = v;
    const rssUrl = rssRaw && isSafeFeedUrl(rssRaw) ? rssRaw : null;
    if (rssRaw && !rssUrl) console.warn(`[warn] ${name}: RSS URL이 안전 검사에 실패해 비웁니다 (${rssRaw})`);
    const data = {
      name,
      category,
      homepage,
      rssUrl,
      domain: domainRaw.toLowerCase().replace(/^(www|m)\./, ""),
      trustWeight: Math.min(5, Math.max(1, Number(trustRaw) || 3)),
      isActive: activeRaw !== "false",
    };
    console.log(`${dryRun ? "[dry-run] " : ""}${data.name} (${data.domain}) rss=${data.rssUrl ? "Y" : "N"} trust=${data.trustWeight}`);
    if (!dryRun) await prisma.newsSource.upsert({ where: { name }, create: data, update: data });
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: 시드 스크립트 dry-run 확인**

Run: `npx tsx scripts/seed-news-sources.ts --dry-run`
Expected: CSV 각 행이 `[dry-run] 전자신문 (etnews.com) rss=Y trust=5` 형식으로 출력, DB 쓰기 없음. (DB 접속이 필요 없는 dry-run이지만 `src/lib/prisma` import 시 연결 문자열이 없으면 실패할 수 있다 — 그때는 `.env`가 있는 상태에서 실행.)

- [ ] **Step 3: E2E 골든패스** — `e2e/admin-newsletter.spec.ts`

```ts
import { expect, test } from "@playwright/test";
import { loginAsAdmin, skipWithoutAdminCredentials } from "./helpers/admin-auth";

// 실제 네이버 API·구독자 발송은 하지 않는다: 기사는 "직접 추가"로 넣고, 발송은 "검토요청(내게 보내기)"까지만.
test.describe("관리자 뉴스레터 골든패스", () => {
  skipWithoutAdminCredentials(test);

  test("캠페인 생성 → 기사 직접 추가 → 미리보기 → 검토요청", async ({ page }) => {
    const name = `[E2E TEST] 뉴스레터 ${Date.now()}`;
    await loginAsAdmin(page);

    await page.goto("/admin/newsletter/campaigns/new");
    await page.getByLabel("뉴스레터 이름").fill(name);
    await page.getByLabel("키워드 1", { exact: true }).fill("AI");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await page.waitForURL(/\/admin\/newsletter\/campaigns\/[^/]+$/);
    const campaignUrl = page.url();

    await page.getByRole("link", { name: "수집 기사 보기 →" }).click();
    for (const n of [1, 2]) {
      await page.getByLabel("기사 URL").fill(`https://example.com/e2e-${Date.now()}-${n}`);
      await page.getByLabel("기사 제목").fill(`E2E 테스트 기사 ${n}`);
      await page.getByLabel("매체명").fill("E2E매체");
      await page.getByRole("button", { name: "추가", exact: true }).click();
      await expect(page.getByText("기사를 추가하고 이번 호에 선택했습니다.")).toBeVisible();
    }

    await page.getByRole("link", { name: "이번 호 편집 →" }).click();
    await page.getByRole("button", { name: "미리보기" }).click();
    const preview = page.frameLocator('iframe[title="뉴스레터 미리보기"]');
    await expect(preview.getByText("E2E 테스트 기사 1")).toBeVisible();
    await expect(preview.getByText("수신거부")).toBeVisible();

    await page.getByRole("button", { name: "검토요청(내게 보내기)" }).click();
    // RESEND_API_KEY 유무에 따라 성공/설정 안내 중 하나 — 둘 다 "버튼이 서버까지 동작했다"는 증거
    await expect(page.getByText(/검토요청 메일을 보냈습니다|이메일 발송 설정이 완료되지 않았습니다/)).toBeVisible();

    // 정리: 자동 수집 대상에서 빼기
    await page.goto(campaignUrl);
    await page.getByRole("button", { name: "미사용 처리" }).click();
    await expect(page.getByRole("button", { name: "사용 재개" })).toBeVisible();
  });
});
```

- [ ] **Step 4: CONTENT_GUIDE.md 갱신** — 15번 절 제목을 `## 15. 뉴스레터 구독자 확인·뉴스레터 보내기`로 바꾸고, 기존 "발송 파이프라인은 범위 제외" 문단(596행 부근)을 아래로 교체:

```markdown
### 15-1. 뉴스레터 캠페인 만들기 (처음 1회)

1. `/admin/newsletter` → **캠페인** 탭 → **새 캠페인 만들기**.
2. ① 기준: 이름, 메일 제목(앞의 `(광고)`는 법적 표기라 지우지 않기), 발송 유형은 **검토 후 발송**, 매주 화요일 8시가 기본값.
3. ③ 검색 키워드: "포함 그룹"은 같은 그룹 안 단어 중 하나만 맞으면 되고, 모든 그룹이 맞아야 수집됩니다. 광고성·무관 기사를 거르려면 "제외"에 단어를 넣으세요. **결과 미리보기**로 어떤 기사가 잡히는지 바로 확인할 수 있습니다.
4. ④ RSS 매체: 체크한 언론사의 최신 기사도 함께 수집합니다(회색은 RSS 미제공 매체).
5. **저장**하면 다음 날 06시부터 매일 자동 수집됩니다. **임시저장**은 수집되지 않습니다.

### 15-2. 매주 초안 승인하기 (5분)

1. 캠페인 상세 → 최근 호(#번호) 클릭.
2. 자동으로 상위 기사가 체크돼 있습니다. 빼고 싶은 기사는 체크 해제, 순서는 ▲▼, 필요하면 **요약**(직접 쓴 1~2문장 — 기사 문장 복사 금지)과 **코멘트**를 입력 후 **저장**.
3. **미리보기**로 실제 메일 모양 확인 → **검토요청(내게 보내기)**로 내 메일함에서 한 번 더 확인.
4. **승인(예약)**: 비워 두면 캠페인 발송일(화 08시)에 자동 발송. 지금 보내려면 **즉시 발송**.
5. 결과는 **발송 이력** 탭에서 확인. 실패가 있으면 **재시도**(이미 받은 사람에겐 다시 가지 않음).

### 15-3. 주의

- 한 번에 보낼 수 있는 인원은 80명(무료 메일 한도 보호)입니다. 넘으면 발송이 거부되니 개발팀에 Batch 전환을 요청하세요.
- 수집 기사 화면의 **기사 직접 추가**로 자동 수집에 안 잡힌 기사를 넣을 수 있습니다. 호 편집 화면에서 **저장**했거나 수집 기사 화면에서 **이번 호에 추가**를 누른 호는 이후 자동 재선별이 멈춥니다(직접 추가한 기사는 항상 선택 상태로 유지).
- 관련 코드: `src/lib/newsletter/`, `src/actions/newsletter-campaigns.ts`, `src/actions/newsletter-issues.ts`. 문구는 `src/lib/newsletter/templates/ax-weekly.ts`의 `COPY`.
```

- [ ] **Step 5: TODO.md·PRD.md·설계서 상태 갱신**
  - `docs/TODO.md` Phase 1.5 3단계 뉴스레터 항목 아래: `- [x] 뉴스레터 발송 시스템 1단계(MVP) 코드 구현 — 계획 docs/superpowers/plans/2026-10-04-newsletter-distribution-mvp-implementation-plan.md` (구현 완료 시점 날짜 기입)
  - `docs/PRD.md` 데이터 모델 표의 신규 9개 모델 상태를 "설계 확정·미구현" → "구현(1단계)", 외부 서비스 표 네이버 뉴스 검색 API 상태 갱신, 변경 이력 1행 추가.
  - 설계서 상단 `상태:` → `✅ 1단계 구현 완료(YYYY-MM-DD) — 2단계(Claude 점수·스케줄 자동발송)는 1호 발송 2회 안정 후`.

- [ ] **Step 6: 전체 검증**

Run: `npm run lint ; npx tsc --noEmit ; npm run test ; npm run test:e2e`
Expected: lint/tsc 오류 0, Vitest 전부 PASS, Playwright `admin-newsletter.spec.ts` PASS(관리자 자격증명 없으면 skip으로 표시 — 그 경우 사용자에게 skip 사실을 보고). E2E는 Task 16 Step 1(마이그레이션 적용) 이후에만 의미가 있으므로, DB에 테이블이 없으면 이 단계를 Task 16 Step 1 뒤에 다시 실행한다.

- [ ] **Step 7: Commit**

```bash
git add scripts/seed-news-sources.ts e2e/admin-newsletter.spec.ts CONTENT_GUIDE.md docs/TODO.md docs/PRD.md docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md
git commit -m "feat(newsletter): 매체 시드 스크립트·E2E 골든패스·운영 가이드 갱신"
```

---

### Task 16: 배포 · 1호 발송 (사용자 확인 필수 단계 포함)

**Files:** 없음(운영 작업). 각 Step은 **사용자 확인 후** 실행한다 — 운영 DB·실제 메일 발송이 걸린 비가역 작업.

- [ ] **Step 1 (사용자 확인 후): 마이그레이션 적용**

Run: `npx prisma migrate deploy`
Expected: `Applying migration 20261005120000_add_newsletter_distribution` → `All migrations have been successfully applied.` 실패 시 수동 롤백하지 말고 오류 원문을 사용자에게 보고.

- [ ] **Step 2 (사용자 확인 후): 매체 시드 적재**

Run: `npx tsx scripts/seed-news-sources.ts`
Expected: CSV 행 수만큼 upsert 로그, 경고 행은 사용자에게 보고.

- [ ] **Step 3 (사용자): Vercel 환경변수 등록** — Production·Preview에 `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET`, (선택) `NEWSLETTER_TEST_RECIPIENTS`=영업이사 이메일. `CRON_SECRET`은 기존 값 사용.

- [ ] **Step 4: 푸시·배포 후 Cron 등록 확인** — `git push` → Vercel 배포 완료 → 프로젝트 Settings → Cron Jobs에 3개(`ax-check-followup`·`newsletter-collect`·`newsletter-send`)가 보이는지 확인. Hobby 플랜에서 배포가 Cron 관련 오류로 실패하면 스케줄 문자열을 재확인(모두 1일 1회여야 함).

- [ ] **Step 5: 수집 Cron 수동 실행**

Run: `curl -s -H "Authorization: Bearer $CRON_SECRET" https://www.coredxi.com/api/cron/newsletter-collect`
Expected: `{"ok":true,"results":[...]}` — 1호 캠페인 생성(Task 0 Step 4 키워드, **저장**) 후 실행해야 결과가 나온다. `errors`가 있으면 원문 보고(네이버 401 = 자격증명 오류, RSS 오류 = 해당 매체 RSS URL 재확인).

- [ ] **Step 6: 1호 초안 → 내부 테스트** — 관리자 화면에서 초안 선별·요약 입력 → 검토요청(사용자·영업이사 수신) → 두 사람이 Gmail/Naver 메일에서 표시·링크·수신거부 링크·`(광고)` 제목을 확인.

- [ ] **Step 7 (사용자 최종 승인 후): 실제 구독자 1호 발송** — 승인(예약: 화 08시) 또는 즉시 발송 → 발송 이력에서 성공/전체 확인 → Resend 대시보드 발송 로그 대조.

- [ ] **Step 8: 기록** — `fifty-ledger` Skill로 Notion 액션 DB의 "3단계 닫기" 하위 액션 갱신(1단계 구현 완료·1호 발송), 로그 DB에 배운 점·콘텐츠 소재 기록. 메모리 `phase15_ax_check_status.md` 또는 신규 메모리에 뉴스레터 시스템 운영 상태 1줄 추가.

---

## Self-Review 결과

- **설계서 커버리지**: 4절(수집·선별·승인·발송 경로) → Task 6·7·9·10 / 5절 모델 → Task 1 / 6-1·6-2 → Task 3·4·6·7 / 6-3(Claude) → **2단계라 의도적 제외**(설계 11절) / 6-4 발송 → Task 8·9 / 7절 UI 6개 라우트 → Task 13·14 / 8절 양식·UTM → Task 8 / 9절 보안(Cron 보호·SSRF·권한·저작권·광고표기·CSP iframe sandbox) → Task 2·6·10·11·8·14 / 10절 테스트 → 각 Task + Task 15 E2E / 13절 DoD → Task 15·16. 설계 7절 "초안 검토 알림 메일(전날 09시)"·공동관리자 편집·Batch는 설계 11절에서 2단계로 분류돼 있어 제외.
- **설계서와 다르게 정한 것**: 위 "설계서 대비 변경점" 표 참조.
- **타입 일관성**: `KeywordInput`·`CandidateArticle`(Task 2) → Task 4·6·7·11에서 동일 이름 사용. `ensureCurrentIssue`/`CampaignForIssue`(Task 7) → Task 11·14. `sendIssue`의 `allowFrom`(Task 9) → Task 12에서 동일 키. `SendIssueResult` → Task 12·14.
