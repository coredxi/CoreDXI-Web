# Claude Code 작업 지시 — 수신거부 수정 병합·운영 검증 + 3단계 종료 보고 초안 (2026-10-24, A안)

## 배경
- 브랜치 `fix/newsletter-unsubscribe-confirm`(커밋 `fbc0658`, origin에 push 완료)는 뉴스레터 수신거부를
  "GET 링크 즉시 해지" → "확인 화면 + 「구독 해지」 버튼(서버 액션 POST)" + RFC 8058 원클릭 헤더
  (`List-Unsubscribe` = `/api/newsletter/unsubscribe/{token}`, `List-Unsubscribe-Post: List-Unsubscribe=One-Click`)로 바꾼 수정이다.
- 원격 세션에서 vitest 571개·lint는 통과했지만, Prisma 엔진을 내려받지 못해 **tsc는 미검증**이다(로컬 생성 클라이언트가 오래돼서 뉴스레터 기존 파일에 타입 오류가 났음 — 이번 변경 파일엔 오류 없음).
- `main`(99f9af7)은 그 뒤로 바뀌지 않았다. 목표: 이 브랜치를 검증·병합·배포하고, 10/31 '3단계 닫기' 종료 보고 초안을 준비한다.
- 관련 문서: `docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md`(수신거부 2026-10-20 개정 항목), `docs/TODO.md`(3단계 닫기 하위), `CONTENT_GUIDE.md`(뉴스레터 구독 해지 안내).

## 반드시 지킬 것
- `prisma migrate dev` 사용 금지(이번 작업은 스키마 변경 없음 — 마이그레이션 만들지 말 것).
- 커밋은 Conventional Commits. 신규 라우트도 CSP nonce·Sentry 정책 예외 없음(미들웨어 matcher가 `/api/newsletter/*`를 덮는지 확인만).
- **main 병합(머지 버튼)과 운영 배포 확인은 단계마다 나에게 확인받고 진행**. 실제 구독자에게 뉴스레터를 보내는 작업(Task 16 Step 7)은 절대 하지 말 것 — 게이트(AX 체크 실응답 5건) 미충족.
- 운영 DB의 구독자 데이터를 직접 수정하지 말 것.

## 1단계 — 로컬 검증 (브랜치 `fix/newsletter-unsubscribe-confirm`)
1. `git fetch origin` 후 브랜치가 `origin/main` 위에 있는지 확인(뒤처졌으면 rebase, 충돌 시 멈추고 보고).
2. `pnpm install --frozen-lockfile` → `pnpm prisma generate`
3. `pnpm tsc --noEmit` / `pnpm lint` / `pnpm test` — 전부 통과해야 한다. 실패하면 원인·수정안을 먼저 보고.
4. 변경 리뷰(diff `origin/main...HEAD`) — 특히 아래를 점검하고 문제가 있으면 수정 커밋:
   - `src/app/unsubscribe/[token]/page.tsx`: GET 렌더링만으로 DB가 바뀌지 않는지, `force-dynamic`·noindex 적용
   - `src/actions/newsletter.ts`: `confirmUnsubscribe`(rate limit 20/시간, redirect), `getUnsubscribeTarget`(읽기 전용, 이메일 가림)
   - `src/app/api/newsletter/unsubscribe/[token]/route.ts`: POST + 본문 `List-Unsubscribe=One-Click`일 때만 해지, GET은 303
   - `src/lib/newsletter/send.ts`: 구독자 = 원클릭 헤더 2개, 내부 수신자(mailto) = `List-Unsubscribe`만
5. 로컬 `pnpm dev`로 `/unsubscribe/아무토큰` 접속 → "링크를 확인할 수 없습니다" 화면이 뜨는지만 확인(실제 토큰 사용 금지).
6. E2E 골든패스 영향 여부: `e2e/`에 구독 해지 관련 시나리오가 있으면 새 흐름(확인 버튼)으로 갱신·실행. 없으면 "없음"으로 보고(신규 E2E 추가는 선택 — 간단하면 잘못된 토큰 화면 1건 정도).

## 2단계 — PR·병합 (확인 후)
1. `gh pr create --base main --head fix/newsletter-unsubscribe-confirm` — 본문에 변경 요약, 보안 사유(사내 메일 링크 검사기 오작동), 테스트 결과, 배포 후 점검 항목을 적는다.
2. Vercel Preview가 뜨면 Preview URL로 아래 3가지를 curl로 확인하고 결과를 보고:
   - `GET {preview}/api/newsletter/unsubscribe/invalid-token` → **303**, `Location`이 `/unsubscribe/invalid-token`
   - `POST` 같은 주소, 본문 `List-Unsubscribe=One-Click`, `Content-Type: application/x-www-form-urlencoded` → **404**(잘못된 토큰)
   - `POST` 본문 없이 → **400**
   - (Preview에 Vercel 인증 보호가 걸려 있으면 이 단계는 운영 배포 후로 미루고 그렇게 보고)
3. **나에게 병합 승인 요청** → 승인 시 Squash merge, 브랜치 삭제.

## 3단계 — 운영 배포 확인 (확인 후)
1. Vercel 운영 배포 완료 확인 후 `https://www.coredxi.com`에 대해 2단계 2번의 curl 3가지를 다시 실행.
2. 응답 헤더에 `Content-Security-Policy`가 붙는지 확인.
3. 이후 **내가 직접 할 실메일 점검 절차**를 짧게 정리해 출력:
   - 개인 Gmail 주소로 홈페이지 푸터에서 구독 → 구독 완료 메일의 해지 링크 클릭 → 확인 화면(가린 이메일) 표시 → 「구독 해지」 → 해지 완료 화면 → `/admin/newsletter`에서 해지 1건 확인
   - 다시 구독 후, 내부 캠페인이 아닌 실제 발송 메일에서만 Gmail 「구독 취소」 버튼이 보이므로 이번에는 **헤더 동작은 curl 결과로 갈음**한다는 점 명시(실구독자 발송 금지 때문)

## 4단계 — 문서·장부 갱신
1. `docs/TODO.md` 3단계 하위 "수신거부 방식 변경" 줄에 병합 커밋·배포일·tsc 검증 완료를 추가(`docs:` 커밋, main에 직접 또는 같은 PR 이전에 포함).
2. post-commit 훅이 Notion Tasks에 기록하지 못하면(httpx 미설치 등) 실패 사실만 보고 — 노션 액션 DB 갱신은 Cowork에서 따로 한다.

## 5단계 — 3단계 종료 보고 초안 (코드 아님)
`docs/superpowers/plans/2026-10-31-phase1_5-stage3-close-report-draft.md`를 새로 만든다(커밋은 나에게 확인 후). 내용:
1. 범위와 결과 — 뉴스레터 발송 시스템: 설계(9/28) → 0단계(10/4~5) → MVP 구현·운영 배포(10/4) → 내부 시험 발송(10/5) → 수신거부 개선(이번 병합). 커밋·문서 링크는 `git log`와 `docs/`에서 실제 값으로 채울 것(추측 금지).
2. 1호 실제 발송 상태 — "시스템 준비 완료·발송 대기", 게이트 현황은 `[실응답 __/5건, HOT __/1건 — 10/31 기준 사용자 기입]` 빈칸으로 둔다(10/8 기록은 3/5·1/1).
3. 운영 제약 — 수집은 RSS 12곳(B안, 네이버 검색 키 미발급), 발송 크론 하루 1회(Hobby), 일 80통 상한(Resend 무료 100통 보호).
4. 업종 확장 결정 — `[10/31 응답 데이터로 사용자 결정]` 빈칸 + 판단 기준 2~3줄 제안.
5. 다음 단계 후보 — 게이트 충족 시 1호 발송 절차(Task 16 Step 7), NCP·NAVER API HUB 키 발급, 후속 개선 묶음 잔여(기사 저장 묶음 처리·네이버 미리보기 버튼·승인 시점 수신대상 스냅샷·즉시 발송 발송자 기록·편집기 새로고침·수집 화면 열람 시 호 생성), E 구현 2차(동결 유지).

## 끝나면 보고할 것
- 1~3단계 각 검증 결과(tsc/lint/test 개수, curl 응답 코드), PR 번호, 병합 커밋 해시, 배포 시각
- 내가 해야 할 실메일 점검 절차(3단계 3번)
- 종료 보고 초안 파일 경로와 내가 채워야 할 빈칸 목록
