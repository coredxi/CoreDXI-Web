# 뉴스레터 구독 기능 설계

> 작성일: 2026-08-08
> 상태: 🚧 착수 (Phase 1 잔여 항목, 마지막 순서)
> 선행 문서: `docs/superpowers/plans/2026-08-05-phase1-remaining-action-plan.md` (B. 뉴스레터 구독 절)
> 관련 규칙: `docs/PRD.md` 5-5, `CLAUDE.md`, 프로젝트 지침 5-1~5-4 (문서 우선, `prisma migrate dev` 금지, rate limiting/URL 안전 패턴 재사용)

---

## 1. 목표

블로그 독자가 이메일 주소만으로 신규 콘텐츠 소식을 구독할 수 있게 한다. 구독 정보는 자체 DB에 1차 저장(신뢰 가능한 단일 소스)하고, `RESEND_AUDIENCE_ID`가 설정되어 있으면 Resend Audiences에도 동기화해 향후 다이제스트 발송에 바로 활용할 수 있게 한다.

**이번 작업 범위(MVP)**: 구독 폼 → 저장 → 확인 메일 → 손쉬운 구독 해지, 여기까지다.

**범위 제외 결정(2026-08-08, 확정)**: 실제 뉴스레터 발행(콘텐츠를 어떻게 만들지, 신규 글 자동 알림 vs 주간 다이제스트, 발송 주기)은 **본 프로젝트(AX Growth Engine Phase 1~3)에서 다루지 않는다.** 구독자를 모으는 것까지가 이 항목의 완료 기준이며, 발송 파이프라인은 완전히 별도의 프로젝트/트랙으로 분리해 추후 재검토한다. (액션플랜 B 문단 "발행 주기" 열린 질문은 이 결정으로 종료됨 — 재검토 시점이 되면 새 설계 문서를 별도로 작성한다)

---

## 2. 결정 사항 (선행 열린 질문에 대한 답)

액션플랜(`2026-08-05-phase1-remaining-action-plan.md`) 4번에 남아있던 즉시 결정 필요 질문에 대해, 이번 착수 시점에 아래와 같이 실용적 기본값으로 확정한다. 마케팅 리드가 다른 결정을 원하면 후속 커밋으로 쉽게 조정 가능한 구조로 설계했다.

| 질문 | 결정 | 근거 |
|------|------|------|
| 구독 폼 배치 | **Footer(전체 페이지 공통 하단)** | 액션플랜이 이미 "팝업보다 하단 상시 배치" 권장. Footer는 모든 공개 페이지에 이미 렌더링되고 있어 블로그 목록/상세에도 자동 노출됨 |
| 옵트인 방식 | **단일 단계 + 필수 동의 체크박스** (더블 옵트인 아님) | 회원가입 OTP와 달리 마케팅 수신 목적이라 이메일 인증 지연보다 즉시 확인 메일(수신 확인 + 해지 링크 포함)로 대체. 정보통신망법상 핵심 요건인 "명시적 동의 확보 + 손쉬운 수신거부"는 체크박스 동의 + 구독 즉시 해지 링크 발송으로 충족 |
| Resend Audiences 요금제 | **선택적 연동** — `RESEND_AUDIENCE_ID` 미설정 시 로컬 DB에만 저장(기능은 100% 동작), 설정 시에만 Resend Audience에도 동기화 | 요금제 확인은 경영진 소관이라 개발 착수를 막지 않도록 그레이스풀 디그레이드 패턴(`resend.ts`의 `getResendApiKey() ?? null` 패턴과 동일)으로 설계 |
| 발행 주기 | **이번 범위 밖** | 구독 "수집" 기능까지만. 발송 파이프라인은 후속 항목으로 분리 |

---

## 3. 데이터 모델

`contacts`/`contact_settings`처럼 Supabase 직접 테이블이 아니라 **Prisma 관리 테이블**로 신설한다 (관리자 기능 확장 시 Prisma 관계·마이그레이션 이력을 그대로 활용하기 위함). `RateLimitHit`과 동일하게 순수 신규 테이블이라 기존 Supabase 직접 생성 테이블과 충돌 없음.

```prisma
enum NewsletterSubscriberStatus {
  SUBSCRIBED
  UNSUBSCRIBED
}

model NewsletterSubscriber {
  id               String                      @id @default(cuid())
  email            String                      @unique
  status           NewsletterSubscriberStatus  @default(SUBSCRIBED)
  unsubscribeToken String                      @unique
  resendContactId  String?
  source           String?
  subscribedAt     DateTime                    @default(now())
  unsubscribedAt   DateTime?
  createdAt        DateTime                    @default(now())
  updatedAt        DateTime                    @updatedAt

  @@index([status])
}
```

**마이그레이션 주의(가이드라인 5-2 준수)**: `prisma migrate dev` 사용 금지. 수동으로 `prisma/migrations/20260808120000_add_newsletter_subscriber/migration.sql`을 작성했고, 배포 시 `prisma migrate deploy`만 사용한다.

---

## 4. 서버 로직

- `src/lib/newsletter-token.ts` — 구독 해지용 랜덤 토큰 생성 (`crypto.randomBytes`, OTP처럼 예측 불가능한 값)
- `src/lib/resend-audience.ts` — Resend Audience contact upsert/remove. `RESEND_AUDIENCE_ID` 미설정 시 no-op(`{ synced: false }`) 반환 — `resend.ts`의 그레이스풀 디그레이드 패턴 재사용
- `src/actions/newsletter.ts` (Server Action, `contact.ts`와 동일한 구조)
  - `subscribeNewsletter(email, source?)`
    1. 이메일 형식 검증
    2. rate limit: `checkRateLimit("newsletter-subscribe:{ip}", { max: 5, windowMs: 1h })` — `contact.ts`와 동일 패턴(가이드라인 5-4)
    3. `NewsletterSubscriber` upsert (이미 해지 상태로 재구독하면 status를 SUBSCRIBED로 복구)
    4. Resend Audience 동기화 (실패해도 구독 자체는 성공 처리 — 알림 실패가 핵심 기능을 막지 않도록 `contact.ts`의 알림 메일 실패 처리와 동일 원칙)
    5. 확인 메일 발송(`sendResendEmail`) — 구독 확인 + 구독 해지 링크(`/unsubscribe/{token}`) 포함
  - `unsubscribeNewsletterByToken(token)` — 토큰으로 조회 후 status를 UNSUBSCRIBED로 변경, Resend Audience에서도 제거
  - `listNewsletterSubscribers()` / `getNewsletterSubscriberStats()` — 관리자 전용(`requireAdmin` 게이트, `contact.ts`의 `requireAdmin()`과 동일 패턴)

---

## 5. UI

- `src/components/newsletter/NewsletterSubscribeForm.tsx` — 이메일 입력 + 필수 동의 체크박스 + 제출 버튼. shadcn/ui `Input`/`Button`/`Checkbox` 사용, 브랜드 컬러(`#1E4E8C`)·코너 반경 `0.75rem`(`rounded-xl`) 준수. `ContactPageClient.tsx`와 동일하게 `useState` + 직접 서버 액션 호출 패턴(react-hook-form 등 신규 의존성 추가 없음)
- `Footer.tsx`에 임베드 — 전체 공개 페이지 공통 노출
- `src/app/unsubscribe/[token]/page.tsx` — 이메일 링크 클릭 시 열리는 서버 컴포넌트 페이지. 클릭 즉시 해지 처리 후 결과 안내(재구독 링크 포함)
- 관리자: `src/app/admin/(panel)/newsletter/page.tsx` — 구독자 수 통계 + 최근 구독자 테이블(이메일/상태/구독일), `/admin/settings`에 메뉴 카드 추가. 홍보팀이 별도로 편집하는 CMS 콘텐츠가 아니라 조회 전용이므로 `CONTENT_GUIDE.md` 갱신 대상은 아니고, README/CONTENT_GUIDE에는 "구독자 확인은 관리자 패널에서" 안내만 추가

---

## 6. 보안·정책 체크 (가이드라인 5-4 준수)

- rate limiting: `RateLimitHit` 테이블 기반 기존 패턴 재사용 (IP당 1시간 5회, 문의 폼과 동일 기준)
- 외부 서비스 연동(Resend Audiences)은 서버에서만 API 키 사용, 클라이언트에 노출 없음 — SSRF 대상 아님(사용자 입력 URL을 fetch하지 않으므로 `url-safety.ts` 패턴 해당 없음)
- 구독 해지 토큰은 이메일과 별개의 랜덤 값(추측 불가) — URL에 이메일이 직접 노출되지 않음
- Sentry 20% 트레이스 샘플링·CSP nonce 정책은 신규 라우트(`/unsubscribe/[token]`)에도 별도 설정 없이 기존 전역 설정이 그대로 적용됨 (인라인 스크립트 추가 없음)
- `/privacy`에 뉴스레터 이메일 수집 항목·목적·보유기간(해지 시 즉시 파기) 조항 추가

---

## 7. 테스트

- Vitest: `src/actions/newsletter.test.ts` — `contact.test.ts` 패턴 그대로(이메일 검증, rate limit, Prisma/Resend 모킹) 적용
- Playwright E2E: 이번 1차 커밋에는 미포함(범위 확대 시 골든패스 추가 예정) — Footer 폼 렌더링은 기존 E2E 골든패스가 모든 페이지에서 Footer를 통과하므로 회귀는 낮음. 후속 커밋에서 "구독 → 확인 메일 mock → 해지" 골든패스 추가 검토

---

## 8. 완료 기준 (Definition of Done)

- [ ] `docs/PRD.md`/`docs/TODO.md` 갱신 (🚧 → 구현 완료 표시, 실배포·테스트 통과는 별도 체크)
- [ ] `prisma migrate deploy`로 마이그레이션 적용 확인 (로컬 개발자가 실행 — 이 세션은 DB 연결 권한 없음)
- [ ] lint/typecheck/vitest 통과 (로컬 개발자 확인 필요 — 이 세션은 전체 의존성 설치 환경 아님)
- [ ] `.env`에 `RESEND_AUDIENCE_ID` 설정 시 Resend 대시보드에 구독자가 실제로 동기화되는지 수동 확인
- [ ] `/privacy` 갱신 반영 확인
- [ ] 노션 업무 DB·작업로그 갱신

## 9. 이 세션에서의 한계 (투명성 고지)

이 구현은 Cowork 세션에서 사용자 컴퓨터의 로컬 저장소에 파일을 작성한 것이며, **다음은 사용자(또는 Claude Code 세션)가 직접 수행해야 한다**:

1. `pnpm install` 후 `pnpm lint && pnpm typecheck && pnpm vitest run` 실행 및 통과 확인
2. `prisma migrate deploy` 실행(실제 Supabase DB 접근 권한이 이 세션에는 없음)
3. Resend 대시보드에서 Audience 생성 → `RESEND_AUDIENCE_ID`를 `.env`/Vercel 환경변수에 추가(선택 사항, 없어도 기능은 동작)
4. Git 커밋(Conventional Commits) 및 배포
