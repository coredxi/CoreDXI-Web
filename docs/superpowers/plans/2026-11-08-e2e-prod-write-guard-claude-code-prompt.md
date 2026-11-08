# Claude Code 실행 프롬프트 C — E2E 운영 쓰기 차단 + 테스트 데이터 일괄 정리

작성일: 2026-11-08 · 결정: 2026-11-08 사용자 1안("운영에서는 테스트 데이터 쓰기 차단", 비용 0, 작업 작게)
배경: 프롬프트 B 실행 중 Windows npm에서 `npm run test:e2e -- <spec>` 필터가 Playwright에 전달되지 않아 E2E 전체 20건이 운영 DB·Resend 대상으로 실행됨 → 운영에 `[E2E TEST]` 리드 1건(11/10 T1 자동 발송 예약, 게이트 집계 오염 위험 — Cowork가 관리자 화면에서 삭제)과 문의 1건 생성. `/admin/contact`에는 삭제 기능이 없어 8/26·9/11·11/8 E2E 문의(`e2e-…@example.com`, 상태 '대기중')가 계속 누적돼 실제 문의와 섞여 있음.
근본 원인: `playwright.config.ts`가 로컬 dev 서버(3100)를 띄우지만 그 서버가 `.env`의 운영 `DATABASE_URL`·Resend 키를 그대로 씀. E2E 전용 DB는 이번에 만들지 않는다(2안 미채택).

> 아래 구분선 이후 전체를 Claude Code에 그대로 붙여 넣는다. 선행: PR #11 처리 여부와 무관(파일 충돌 없음). `main`에서 새 브랜치.

---

## Claude Code 프롬프트 (여기부터 복사)

당신은 CoreDXI-Web 저장소에서 작업합니다. 루트 `CLAUDE.md` 규칙을 전부 지키세요(PRD/TODO 선반영·`docs/superpowers/specs/` 설계 문서 선행, `prisma migrate dev` 금지 — 이번 작업은 마이그레이션 없음, `[홍보팀]` 주석, `any` 금지, Named Export, Conventional Commits, 커밋 트레일러는 세션 지침 그대로). **스코프 확장 금지** — 아래 2가지만 합니다.

**E2E 실행 주의(이번 작업 자체에도 적용):** 이 작업 중 E2E를 돌릴 때는 반드시 `npx playwright test e2e/<파일>.spec.ts` 형식으로 파일을 직접 지정하세요. `npm run test:e2e -- <필터>`는 Windows에서 필터가 전달되지 않습니다. 가드(1번)가 들어가기 전에는 쓰기 스펙을 실행하지 마세요.

### 0. 설계 문서·계획 선반영

- `docs/superpowers/specs/2026-11-08-e2e-prod-write-guard-design.md`에 아래 1·2번 설계를 1페이지로 먼저 적고 커밋(`docs:`). 배경은 이 프롬프트 상단 그대로 인용.
- `docs/TODO.md`에 항목 추가(🚧), `docs/PRD.md`의 테스트/운영 절에 "E2E 쓰기 스펙은 기본 차단, 명시적 허용 시에만 실행" 요구사항 한 줄.

### 1. E2E 쓰기 가드 (기본값 = 운영에 쓰지 않음)

1. **쓰기 스펙 분류**: `e2e/` 각 스펙을 읽고 DB·외부 발송에 쓰기가 일어나는 스펙을 표로 정리(설계 문서에 포함). 현재 확인된 후보: `ax-check`(리드 생성·알림 메일·T1 예약), `contact-form`(문의 생성·알림 메일), `admin-blog-publish`, `admin-newsletter`, `password-reset`(DB 직접 접속). 읽기 전용 스펙(`solutions-*`, `blog-social-meta`, `blog-attribution`, `csp-violations`, `cases-detail`, `newsletter-unsubscribe`, `admin-login` 등)은 실제 코드를 보고 확정.
2. **가드 헬퍼** `e2e/helpers/write-guard.ts`(Named Export, 한국어 주석):
   - `skipUnlessWritesAllowed(test)` — `process.env.E2E_ALLOW_WRITES !== "1"`이면 `test.skip(true, "쓰기 E2E는 기본 차단: E2E_ALLOW_WRITES=1 과 E2E_CONFIRM_DB_HOST 확인이 필요합니다")`.
   - `E2E_ALLOW_WRITES=1`이어도, `.env`(+ `.env.local` 있으면)의 `DATABASE_URL` 호스트를 파싱해 `process.env.E2E_CONFIRM_DB_HOST`와 **정확히 같을 때만** 실행. 다르거나 비어 있으면 skip 사유에 "현재 DB 호스트: <host>"를 표시(비밀번호·사용자명은 절대 출력하지 않음). 즉 운영에 쓰려면 매번 호스트를 직접 타이핑해야 하는 2단 확인.
   - 기존 `admin-auth.ts`의 `skipWithoutAdminCredentials`와 같은 스타일로.
3. 1번에서 쓰기로 분류한 모든 스펙의 `test.describe`(또는 파일 최상단)에 `skipUnlessWritesAllowed(test)`를 적용. 테스트 본문 로직은 바꾸지 않는다.
4. **쓰기 데이터 표식 통일**(정리 기능이 확실히 잡도록): 테스트가 만드는 데이터는 이미 대부분 `[E2E TEST]` 접두와 `e2e-…@example.com`을 쓴다. 빠진 곳만 맞춘다. `ax-check`는 ref를 `e2e`로 고정(이미 그렇다면 유지).
5. `package.json`에 스크립트 추가: `"test:e2e:readonly": "playwright test"`(가드 덕분에 기본 실행이 곧 읽기 전용임을 이름으로 드러냄) — 기존 `test:e2e`는 유지.
6. `CLAUDE.md` 5번 테스트/검증 줄과 `CONTENT_GUIDE.md`(개발자 절이 없으면 `docs/TODO.md` 운영 메모)에 다음 3줄을 추가:
   - 기본 `npm run test:e2e`는 쓰기 스펙을 건너뛴다(운영 DB 보호).
   - 한 스펙만: `npx playwright test e2e/<파일>.spec.ts` (Windows에서 `npm run … -- <필터>` 사용 금지).
   - 쓰기 스펙을 꼭 돌려야 하면 `E2E_ALLOW_WRITES=1 E2E_CONFIRM_DB_HOST=<호스트>`를 주고, 끝나면 관리자 화면 "테스트 데이터 정리"로 지운다.

### 2. 관리자 "테스트 데이터 정리" (문의 + AX 체크 리드)

- **위치**: `/admin/contact` 목록 상단과 `/admin/leads` 목록 상단에 각각 작은 보조 버튼 "테스트 데이터 정리"(shadcn `Button variant="outline" size="sm"`, 브랜드 토큰만). ADMIN 권한만 노출·실행(EDITOR 불가 — 기존 권한 체크 패턴 재사용).
- **대상 조건(둘 다 보수적으로, AND 조건)**:
  - 문의(`contacts` — Supabase 직접 생성 테이블, 기존 문의 조회 코드와 같은 접근 방식 사용): 이메일이 `e2e-` 로 시작하고 `@example.com`으로 끝나며, **그리고** 내용에 `[E2E TEST]`가 포함된 건. 과거 건 중 내용 표식이 없는 E2E 문의가 있다면 설계 문서에 건수만 보고하고 조건을 넓히지 말 것(사용자 판단).
  - AX 체크 리드(`AxCheckResponse`): `refCode = 'e2e'` **그리고** 회사명이 `[E2E TEST]`로 시작. 관련 팔로업 예약이 있으면 함께 정리되는지(현재 개별 "삭제(개인정보 파기)"와 같은 경로 재사용) 확인.
- **흐름**: 버튼 → shadcn `AlertDialog`에 "대상 N건"과 처음 5건의 이메일/회사명·제출일 미리보기 → 확인 시 서버 액션으로 삭제 → 토스트 "N건 정리됨". 0건이면 버튼 비활성 또는 "정리할 테스트 데이터가 없습니다". `window.confirm` 사용 금지.
- 서버 액션은 대상 조건을 **서버에서 다시 계산**(클라이언트가 보낸 ID 목록을 믿지 않음). 감사 로그가 있으면 기존 패턴으로 기록, 없으면 Sentry breadcrumb 수준.
- 실제 고객 데이터가 조건에 걸리지 않음을 유닛 테스트로 고정: `e2e-…@example.com`이지만 `[E2E TEST]`가 없는 건, `[E2E TEST]`지만 다른 도메인인 건, ref가 `sales-kim`인 리드는 대상 아님.

### 3. 검증

- `npm run lint`, `npx tsc --noEmit`, `npm run test`(조건 함수·서버 액션 유닛 테스트 추가 포함).
- 가드 확인: 환경변수 없이 `npx playwright test e2e/contact-form.spec.ts` → **skipped**로 끝나는지, `npx playwright test e2e/solutions-brochure.spec.ts` → 정상 통과하는지. 쓰기 허용 경로는 실제로 실행하지 않는다(운영에 쓰게 되므로) — 대신 가드 함수의 분기를 유닛 테스트로 검증.
- 정리 버튼은 Vercel Preview에서 사용자가 확인한다(이 세션에서 운영 데이터 삭제 금지).

### 4. 마무리

- 브랜치 `feat/e2e-write-guard-and-test-cleanup`, PR 생성(병합은 사용자). PR 본문 체크리스트:
  - [ ] Preview `/admin/contact`에서 "테스트 데이터 정리" 미리보기 건수 확인(8/26·9/11·11/8 E2E 문의만 잡히는지) → 운영 병합 후 실행
  - [ ] `/admin/leads`에서 0건 표시 확인(11/8 테스트 리드는 이미 삭제됨)
  - [ ] 로컬에서 `npm run test:e2e`가 쓰기 스펙을 skip하는지 확인
- 보고: 쓰기/읽기 스펙 분류표, 정리 대상 조건에 걸리는 현재 건수(조회만), 커밋·PR 번호, 테스트 결과.
