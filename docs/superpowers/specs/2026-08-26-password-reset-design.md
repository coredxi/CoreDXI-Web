# 비밀번호 재설정(이메일 링크) 설계

> 작성일: 2026-08-26
> 배경: 영업이사 EDITOR 계정을 만들면서 확인됨 — 관리자(Admin)·일반 회원(User) 둘 다
> 로그인 후 비밀번호를 바꿀 방법이 전혀 없다(`src/app/admin/actions.ts`의 `createAdmin`은
> placeholder 비밀번호만 만들고 재설정 경로가 없음). Admin·User 공통의 "이메일 링크 기반"
> 비밀번호 재설정 플로우를 신설한다.
> 브랜치: `feat/password-reset-flow` (main에서 분리, AX 체크 브랜치와 독립적으로 배포)

## 1. 범위

- Admin(`SUPER_ADMIN`/`EDITOR`/`VIEWER`)과 User(일반 회원) 계정 공통 1개의 재설정 플로우
- 이메일 링크 방식(6자리 코드 아님) — 회원가입 OTP(`src/lib/otp.ts`, `/api/auth/send-otp`,
  `/api/auth/verify-otp`)의 검증·rate limit·Resend 발송 패턴을 재사용하되, 코드 대신
  추측 불가능한 랜덤 토큰을 담은 링크를 보낸다(뉴스레터 `unsubscribeToken`,
  AX 체크 `resultToken`과 동일한 `randomBytes(24).toString("hex")` 패턴)
- 로그인 중인 상태에서의 "현재 비밀번호 확인 후 변경"은 이번 범위에 넣지 않는다
  (로그인조차 안 되는 상황을 푸는 게 우선 — "비밀번호를 잊었을 때" 플로우만 구현)

## 2. 데이터 모델

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  email     String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([email])
}
```

- `accountType`(admin/user) 컬럼을 두지 않는다. 기존에 이미 이메일이 `Admin`·`User`
  테이블에 걸쳐 유일함이 보장되어 있으므로(가입 API·`createAdmin`이 양쪽 다 중복 체크),
  토큰 소비 시 Admin → User 순으로 조회해 일치하는 쪽만 갱신하면 충분하다.
- 이메일당 활성 토큰은 1개만 유지한다(`OtpCode`와 동일하게 재요청 시 기존 토큰 전부 삭제
  후 새로 생성).
- 만료(TTL): 1시간(회원가입 OTP의 5분보다 길게 — 이메일 링크는 코드보다 늦게 열어볼 수
  있다는 점을 감안).
- 마이그레이션: `prisma/migrations/20260826120000_add_password_reset_token/migration.sql`
  (수동 SQL, `prisma migrate dev` 금지 원칙 동일 적용).

## 3. 라우트·서버 액션

| 경로 | 종류 | 내용 |
|------|------|------|
| `/forgot-password` | 공개 | 이메일 입력 → 제출 시 항상 동일한 안내 문구(계정 존재 여부 미노출) |
| `/reset-password/[token]` | 공개 | 토큰 유효성을 서버에서 먼저 확인 후, 유효하면 새 비밀번호 입력 폼 렌더 |

`src/actions/password-reset.ts`:

- `requestPasswordReset(email)`
  1. 이메일 형식 검증
  2. rate limit: `password-reset-request-ip:{ip}`(1시간 5회) +
     `password-reset-request-email:{email}`(1시간 3회) — `user-login-rate-limit.ts`의
     이중 키 패턴과 동일한 목적(같은 이메일로 여러 IP에서 스팸 발송 방지)
  3. Admin → User 순으로 조회. 있으면 기존 토큰 삭제 후 새 토큰 생성 + 메일 발송,
     없으면 아무 것도 하지 않음
  4. 계정 존재 여부와 무관하게 **항상 동일한 성공 메시지**를 반환한다(이메일 열거 공격 방지)
- `getPasswordResetTokenStatus(token)` — 토큰 존재·만료 여부만 확인(비밀번호 폼을
  보여줄지 판단하는 용도, 페이지의 서버 컴포넌트에서 호출)
- `resetPasswordWithToken(token, newPassword)`
  1. rate limit: `password-reset-consume-ip:{ip}`(1시간 10회) — 토큰 자체가 추측
     불가능하므로 이건 심층 방어 목적
  2. 토큰 조회 → 없거나 만료면 실패
  3. 새 비밀번호 검증(8자 이상, `register/route.ts`와 동일 기준)
  4. Admin에 있으면 Admin 갱신, 없고 User에 있으면 User 갱신(각각 `bcrypt.hash(.., 10)` —
     `api/auth/register/route.ts`와 동일 rounds)
  5. 토큰 삭제(1회용) 후 `{ success: true, accountType: "admin" | "user" }` 반환 —
     클라이언트가 이 값으로 로그인 페이지를 `/admin/login` 또는 `/login` 중 골라 안내

메일 발송은 `sendResendEmail`(`src/lib/resend.ts`) 재사용, 실패해도 토큰 발급 자체는
성공으로 처리하지 않는다(발송 실패 시 사용자가 링크를 받지 못하므로 이 경우는
`contact.ts`의 "메일 실패해도 진행" 원칙과 다르게 실패로 반환 — 재요청을 유도해야 함).

## 4. UI

- `/forgot-password`: `/login`·`/signup`과 동일한 카드형 미니멀 레이아웃(Logo + Card),
  이메일 입력 1개 + 제출 버튼. 제출 후에는 폼을 성공 안내 문구로 교체(재발송 가능하도록
  60초 쿨다운 후 다시 보낼 수 있는 버튼 유지는 이번 범위에서 생략 — 굳이 필요하면 사용자가
  `/forgot-password`를 다시 방문하면 되고, 이메일 rate limit이 스팸을 막아준다)
- `/reset-password/[token]`: 서버 컴포넌트가 토큰을 먼저 검증 → 무효/만료면
  "링크가 만료되었거나 유효하지 않습니다" + `/forgot-password`로 돌아가는 링크만 표시,
  유효하면 새 비밀번호 입력 폼(회원가입 3단계와 동일하게 단일 필드 + 8자 이상 안내 문구,
  확인 필드는 기존 컨벤션에 없으므로 추가하지 않음) 렌더
- 로그인 페이지 진입점 2곳에 링크 추가:
  - `UserCredentialsLoginForm.tsx` 비밀번호 입력 단계에 "비밀번호를 잊으셨나요?" 링크
  - `admin/login/page.tsx` 비밀번호 입력란 아래 "비밀번호를 잊으셨나요?" 링크

## 5. 보안 체크 (지침 5-4)

- rate limiting: 요청·소비 두 단계 모두 적용(위 3번)
- 이메일 열거 공격 방지: `requestPasswordReset`는 계정 존재 여부와 무관하게 동일 응답
- 토큰: `randomBytes(24)` 기반 추측 불가능한 값, 1회용, 1시간 만료, DB에는 평문 저장하되
  URL에도 평문으로 노출되는 값이라 별도 해시 저장은 하지 않음(기존 `unsubscribeToken`·
  `resultToken`과 동일한 트레이드오프)
- CSP nonce·Sentry 20%는 전역 설정 그대로 적용, 신규 라우트에 인라인 스크립트 없음
- `generateStaticParams()`는 두 라우트 모두 사용하지 않음(동적 렌더, `/blog/[slug]`
  DYNAMIC_SERVER_USAGE 재발 방지 원칙 유지)

## 6. 테스트

- Vitest: `password-reset-token.test.ts`(토큰 생성 형식), `password-reset.test.ts`
  (`contact.test.ts`/`ax-check.test.ts` 모킹 패턴 — 이메일 검증·rate limit·Admin/User
  우선순위·토큰 만료·1회성 소비·항상 동일한 요청 응답)
- Playwright: `password-reset.spec.ts` — `/forgot-password` 제출 → (테스트 환경에서
  DB의 `PasswordResetToken`을 직접 조회할 수 없으므로) 서버 액션을 테스트 훅으로 노출하기보다,
  **관리자 계정 기준** 골든패스로 작성: `E2E_ADMIN_EMAIL`이 설정된 경우에만 실행 —
  1) `requestPasswordReset` 성공 메시지 확인, 2) DB에서 직접 토큰을 가져올 수 없는 한계상
  **토큰 조회용 테스트 전용 엔드포인트는 만들지 않고**, 대신 Vitest 단위 테스트로
  `resetPasswordWithToken`의 실제 갱신 로직을 충분히 커버하고, E2E는 `/forgot-password`
  폼 제출까지의 화면 동작(성공 문구 노출)만 검증한다. 실제 링크 클릭 후 재설정까지의
  E2E는 이메일 수신을 가로챌 방법이 없어 이번 범위에서는 생략하고 수동 테스트로 대체.

## 7. 완료 기준

- [x] `PasswordResetToken` 마이그레이션 작성 (`prisma/migrations/20260826120000_add_password_reset_token/`) — **배포는 `prisma migrate deploy` 실행 권한이 없어 사용자 직접 실행 필요**
- [x] `requestPasswordReset`/`resetPasswordWithToken` 구현 + Vitest 20개 통과
- [x] `/forgot-password`, `/reset-password/[token]` 페이지 구현
- [x] 로그인 페이지 2곳(`/login`, `/admin/login`)에 링크 추가
- [x] lint/tsc/vitest(155개) 통과, Playwright 골든패스 2개(성공·만료 토큰) 추가
- [x] `docs/PRD.md` 5-2·6-2, `docs/TODO.md` 반영
- [ ] main 병합·배포, 실제 메일 발송·재설정 수동 확인 — DB 마이그레이션 배포 후 진행
