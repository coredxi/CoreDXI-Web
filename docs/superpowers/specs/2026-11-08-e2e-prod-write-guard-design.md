# E2E 운영 쓰기 차단 + 관리자 "테스트 데이터 정리" 설계 (2026-11-08)

> 결정: 2026-11-08 사용자 1안("운영에서는 테스트 데이터 쓰기 차단", 비용 0, 작업 작게). E2E 전용 DB(2안)는 미채택.
> 실행 프롬프트: `docs/superpowers/plans/2026-11-08-e2e-prod-write-guard-claude-code-prompt.md`

## 배경 (프롬프트 원문 인용)

> 프롬프트 B 실행 중 Windows npm에서 `npm run test:e2e -- <spec>` 필터가 Playwright에 전달되지 않아 E2E 전체 20건이 운영 DB·Resend 대상으로 실행됨 → 운영에 `[E2E TEST]` 리드 1건(11/10 T1 자동 발송 예약, 게이트 집계 오염 위험 — Cowork가 관리자 화면에서 삭제)과 문의 1건 생성. `/admin/contact`에는 삭제 기능이 없어 8/26·9/11·11/8 E2E 문의(`e2e-…@example.com`, 상태 '대기중')가 계속 누적돼 실제 문의와 섞여 있음.
> 근본 원인: `playwright.config.ts`가 로컬 dev 서버(3100)를 띄우지만 그 서버가 `.env`의 운영 `DATABASE_URL`·Resend 키를 그대로 씀.

## 1. E2E 쓰기 가드 — 기본값 = 운영에 쓰지 않음

### 스펙 분류 (2026-11-08 코드 기준)

| 스펙 | 분류 | 근거 |
|---|---|---|
| `ax-check` | **쓰기** | `AxCheckResponse` 생성, 영업 알림·T0 메일 발송, T1 예약(D+2) |
| `contact-form` | **쓰기** | `contacts` 생성, 문의 알림 메일 발송 |
| `admin-blog-publish` | **쓰기** | `[E2E TEST]` 블로그 글을 **발행** 상태로 생성(공개 `/blog` 노출) — 관리자 계정 필요 |
| `admin-newsletter` | **쓰기** | `[E2E TEST]` 캠페인·기사 생성, 검토요청 메일 발송(끝에 미사용 처리) — 관리자 계정 필요 |
| `password-reset` | **쓰기** | `pg`로 운영 DB 직접 접속(User·토큰 INSERT/DELETE, 비밀번호 재설정 rate limit 기록 전부 삭제), 재설정 메일 발송 |
| `admin-login` | 읽기 | 로그인 시도만. 실패 시 rate limit 기록 1행(부수 기록) |
| `newsletter-unsubscribe` | 읽기 | 잘못된 토큰으로 GET/POST — 해지 대상 없음. rate limit 기록(부수 기록) |
| `blog-attribution` | 읽기 | 페이지 이동·쿠키/ref 확인만, 제출 없음 |
| `blog-social-meta`·`cases-detail`·`csp-violations`·`solutions-brochure` | 읽기 | GET·메타/헤더 검사만 |
| `solutions-safety-case`(PR #11 브랜치) | 읽기 | GET·PDF 응답 확인만 |

rate limit 기록(`RateLimitHit`)은 시간이 지나면 의미가 없어지는 운영 부수 데이터라 읽기로 분류한다.

### 가드 헬퍼 `e2e/helpers/write-guard.ts`

- `skipUnlessWritesAllowed(test)` — 쓰기 스펙의 `test.describe`/테스트 첫 줄에 둔다. 다음을 **모두** 만족할 때만 실행:
  1. `E2E_ALLOW_WRITES === "1"`
  2. `.env`(+ `.env.local`이 있으면 그 값이 우선)의 `DATABASE_URL` 호스트 == `E2E_CONFIRM_DB_HOST`(정확히 일치)
- 그 외에는 skip. 사유에 "현재 DB 호스트: <host>"만 표시하고 사용자명·비밀번호는 출력하지 않는다. 운영에 쓰려면 매번 호스트를 직접 입력해야 하는 2단 확인.
- 판정은 순수 함수(`evaluateWriteGuard`)로 분리해 유닛 테스트로 분기를 고정한다(쓰기 허용 경로를 실제로 실행하지 않음).
- 테스트 본문 로직은 바꾸지 않는다. 데이터 표식은 이미 통일돼 있음(`[E2E TEST]` 접두·`e2e-…@example.com`·`ref=e2e`) — 변경 없음.
- `package.json`에 `test:e2e:readonly`(= `playwright test`) 추가, 기존 `test:e2e` 유지.

## 2. 관리자 "테스트 데이터 정리" (문의 + AX 체크 리드)

- 위치: `/admin/contact`·`/admin/leads` 상단 헤더의 보조 버튼(shadcn `Button variant="outline" size="sm"`). **SUPER_ADMIN만** 노출·실행(EDITOR·VIEWER 불가 — 서버 액션에서도 재검사).
- 대상(AND 조건, 보수적):
  - 문의(`contacts`): 이메일이 `e2e-`로 시작하고 `@example.com`으로 끝남 **그리고** 내용에 `[E2E TEST]` 포함
  - 리드(`AxCheckResponse`): `refCode = 'e2e'` **그리고** 회사명이 `[E2E TEST]`로 시작. 팔로업(T1) 예약은 같은 행의 컬럼이라 행 삭제로 함께 사라진다(기존 "삭제(개인정보 파기)"와 같은 hard delete)
- 흐름: 버튼 → shadcn `AlertDialog`("대상 N건" + 처음 5건 이메일/회사명·제출일) → 확인 → 서버 액션 삭제 → 토스트 "N건 정리됨". 0건이면 버튼 비활성. `window.confirm` 사용 안 함.
- 서버 액션은 대상을 **서버에서 다시 계산**한다(클라이언트 ID 목록 미신뢰). DB 조회 조건 + 같은 순수 함수로 이중 확인 후 삭제.
- 감사 로그 테이블이 없으므로 Sentry breadcrumb로 기록(대상·건수·실행자 역할).
- 고객 데이터 보호를 유닛 테스트로 고정: `e2e-…@example.com`이지만 `[E2E TEST]` 없는 문의, `[E2E TEST]`지만 다른 도메인 문의, `ref=sales-kim` 리드, `ref=e2e`지만 회사명 표식 없는 리드는 대상 아님.
- 범위 밖: E2E가 만든 블로그 글·뉴스레터 캠페인 정리(필요하면 후속).

## 검증

- lint·tsc·vitest(조건 함수·가드 분기·서버 액션 권한/재계산).
- 환경변수 없이 `npx playwright test e2e/contact-form.spec.ts` → skipped, `e2e/solutions-brochure.spec.ts` → 통과.
- 정리 버튼은 Vercel Preview에서 사용자가 확인(이 세션에서 운영 데이터 삭제 금지).
