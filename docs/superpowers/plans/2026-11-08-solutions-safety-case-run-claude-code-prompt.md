# Claude Code 실행 프롬프트 B — `/solutions` Safety-RAG 사례 섹션 최신화·PR·병합 준비 (재일정)

작성일: 2026-11-08 · 노션 액션: "[CoreDXI-Web] 안전서류 사례 웹 반영(B안) 재일정"
선행: 프롬프트 A(`2026-11-08-phase1_5-close-and-t1-wording-claude-code-prompt.md`) 완료·푸시.

> **11/8 확인 결과 — 구현은 이미 끝나 있고 병합만 안 된 상태.** 2026-09-15 계획대로 `feat/solutions-safety-case-section` 브랜치에 커밋 10건(`0a775e1` ~ `737e507`, 마지막 09-11 14:09)이 있고 `origin`에도 푸시돼 있으나 `origin/main`에는 없음. 그래서 공개 `/solutions`에 섹션이 안 보였던 것. 사례 PDF는 `main` 작업 트리에 미추적 파일로만 존재(`public/docs/safety-rag-case-study.pdf`, 74KB) — 브랜치 커밋에 포함됐는지 확인 필요.
> 범위: 사례 섹션만. `/solutions` 단일 오퍼 재편(2-3)·`/about` 축약(2-4)은 2026-09-06 결정대로 **CMS 문구 작업**(코드 없음)이라 여기 넣지 않는다.

---

## Claude Code 프롬프트 (여기부터 복사)

당신은 CoreDXI-Web 저장소에서 작업합니다. 루트 `CLAUDE.md` 규칙을 전부 지키세요. 커밋 트레일러는 세션 지침 문자열을 그대로 씁니다.

### 0. 선행 — T1 크론 스케줄을 KST 10시대로 (main 직접 커밋, 2026-11-08 사용자 결정)

- 배경: 프롬프트 A 보고 — Vercel Hobby 크론은 지정 시각이 속한 1시간 안 임의 시각에 실행된다. 현재 `30 0 * * *`(KST 09:00~09:59 창)이면 09:00~09:29에 돌 때 `processDueFollowups()`의 `followupScheduledAt <= now` 조건에 그날 09:30 예약 건이 걸리지 않아 하루 늦게 나간다.
- 조치: `main`에서 `vercel.json`의 `/api/cron/ax-check-followup` 스케줄만 `"0 1 * * *"`(UTC 01:00 = KST 10:00~10:59 창)로 바꾼다. 발송 로직·예약 시각 계산(`business-days.ts`의 09:30)·뉴스레터 크론은 건드리지 않는다. 10/8 A안("오전 10시대 발송")과 일치.
- `docs/TODO.md` 1-B의 "원인 미확인" 줄 아래에 "11/8 스케줄 0 1 * * * 로 변경 — 09:30 예약 건이 같은 날 항상 포함되도록" 한 줄 추가.
- `npm run test`(크론 라우트·followup 테스트 회귀) 통과 후 커밋 `fix(cron): T1 팔로업 크론을 KST 10시대로 옮겨 당일 누락 방지` → `git push origin main`. 이후 1단계로.

### 1. 현황 확인

- `git fetch origin`, `git log --oneline origin/main..origin/feat/solutions-safety-case-section`(10건 예상)
- `gh pr list --state all --head feat/solutions-safety-case-section`로 PR 존재 여부 확인. 열린 PR이 있으면 그 PR을 갱신하고, 닫혔으면 사유(코멘트)를 보고에 적은 뒤 새 PR을 만듭니다.
- `git show --stat origin/feat/solutions-safety-case-section -- public/docs/`로 사례 PDF가 브랜치에 커밋돼 있는지 확인합니다.

### 2. 최신 main 반영

- 브랜치를 체크아웃하고 `git merge origin/main`(rebase 아님 — 이미 푸시된 브랜치라 이력 보존)으로 9/11 이후 `main` 변경(뉴스레터 시스템, PR #12·#13·#14·#16, 프롬프트 A 커밋)을 합칩니다.
- 충돌이 나면 `main` 쪽 동작을 우선 보존하면서 사례 섹션을 얹는 방향으로 해결하고, 해결 내역을 보고에 적습니다. 특히 `src/app/solutions/page.tsx`, `src/lib/page-content/solutions.ts`, `SolutionsContentForm.tsx`, `CONTENT_GUIDE.md`(19번 번호가 다른 절과 겹치지 않는지), `docs/TODO.md`, `Ga4FunnelPanel.tsx` 주석, `.env.example`.
- 사례 PDF가 브랜치에 없으면 `main` 작업 트리의 `public/docs/safety-rag-case-study.pdf`를 이 브랜치에 커밋합니다(`feat(solutions): Safety-RAG 사례 PDF 게시`). 파일명 변경 금지.

### 3. 재검증

- `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run test:e2e -- solutions-safety-case`, 회귀로 `npm run test:e2e -- ax-check`.
- 계획(`docs/superpowers/plans/2026-09-15-solutions-safety-case-section-implementation-plan.md`) Global Constraints 재확인: 금지 표현("AI로 위험성평가표를 만들어"), 화자 "코어디엑스아이", 개인 직함 금지, 데모 CTA `/contact?source=safety_docs` 코드 고정. **기능 추가·문구 변경 금지** — 9/11 최종 리뷰본 그대로.

### 4. 푸시·PR

- `git push origin feat/solutions-safety-case-section`. PR을 생성(또는 갱신)하고 **병합은 하지 않습니다.** 사용자가 Vercel Preview에서 확인 후 병합합니다.
- PR 본문 하단에 사용자 체크리스트:
  - [ ] Vercel Preview에서 `/solutions` 사례 섹션·PDF 열림·데모 CTA 확인(모바일 375px 포함)
  - [ ] PR 병합 → 운영 배포 확인
  - [ ] Vercel 환경변수 `AX_CHECK_SAFETY_CASE_STUDY_URL=https://www.coredxi.com/docs/safety-rag-case-study.pdf`(Production·Preview) 등록 후 재배포
  - [ ] `/ax-check?ref=internal-test`로 Q9 '월 4~8시간' 응답 → 결과 화면 "도입 사례 보기(PDF)" 동작 확인 → 테스트 리드 삭제
  - [ ] `/contact?source=safety_docs` 문의 유형 자동 선택 확인

### 5. 보고

PR 번호·URL, 병합 충돌 해결 내역, PDF 커밋 여부, 테스트 결과.
