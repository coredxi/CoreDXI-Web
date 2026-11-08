# Claude Code 실행 프롬프트 D — PR #11·#17 병합 전 점검 → 병합 → 운영 검증

작성일: 2026-11-08 · 노션 액션: "안전서류 사례 웹 반영(B안) 재일정"(PR #11), "E2E 운영 쓰기 차단 가드 + 테스트 데이터 정리"(PR #17)
원칙: **병합·환경변수 등록·운영 데이터 삭제는 각각 실행 직전에 사용자에게 채팅으로 확인을 받는다.** 확인 없이 진행하지 않는다.

---

## Claude Code 프롬프트 (여기부터 복사)

당신은 CoreDXI-Web 저장소에서 작업합니다. 루트 `CLAUDE.md` 규칙을 지키세요. 이번 작업은 **새 코드를 쓰지 않습니다** — 열린 PR 2건(#11 안전서류 사례 섹션, #17 E2E 쓰기 가드·테스트 데이터 정리)을 점검·병합하고 운영에서 확인하는 일만 합니다. 문제가 보이면 고치지 말고 멈춰서 보고하세요.

**E2E 규칙:** 한 스펙만 돌릴 때는 `npx playwright test e2e/<파일>.spec.ts`. 쓰기 스펙(`E2E_ALLOW_WRITES`)은 이번 작업에서 절대 실행하지 않습니다.

### 0. 작업 폴더 정리

- 현재 `feat/e2e-write-guard-and-test-cleanup`에 체크아웃돼 있을 수 있습니다. `git status`가 깨끗한지 확인 후 `git checkout main && git pull`.

### 1. 병합 전 점검 (읽기만)

두 PR 각각:
- `gh pr view <번호> --json state,mergeable,mergeStateStatus,statusCheckRollup,headRefName` — 열림·병합 가능·CI 통과 확인.
- `gh pr diff <번호> --name-only`로 변경 파일을 보고, 두 PR의 변경 파일이 겹치는지 확인(겹치면 병합 순서와 충돌 가능성을 보고).
- PR #11: 사례 섹션 문구가 9/11 최종본(`737e507`)과 같은지, 금지 표현("AI로 위험성평가표를 만들어")·개인 직함("이사"/"대표"/"부장")이 공개 화면 문구에 없는지 `gh pr diff 11`로 재확인.
- PR #17: 정리 대상 조건이 보수적 AND 조건(문의: `e2e-` 접두 + `@example.com` + 내용 `[E2E TEST]` / 리드: `refCode='e2e'` + 회사명 `[E2E TEST]` 접두)이고 서버에서 재계산하는지, 권한이 SUPER_ADMIN 전용인지 코드로 확인.
- 각 PR의 Vercel Preview URL을 PR 코멘트/체크에서 찾아, **읽기 전용** 확인을 합니다(로그인·제출·버튼 실행 금지):
  - #11 Preview `/solutions`: 사례 섹션 제목 노출, PDF 버튼 `href`가 200 + `application/pdf`, 데모 CTA `href`가 `/contact?source=safety_docs`.
  - #17 Preview: 공개 페이지 회귀만 간단히(`/`, `/contact` 200).
  - 방법은 `curl -sI`/`curl -s` 또는 Playwright 읽기 스크립트(임시 파일, 커밋 금지). Preview에 Vercel 인증 보호가 걸려 접근이 막히면 건너뛰고 "사용자 확인 필요"로 표시.
- 여기까지 결과를 표로 보고하고 **"병합해도 될까요? (#17 → #11 순서 권장)"라고 묻고 기다립니다.**

### 2. 병합 (사용자 승인 후)

- 승인 시 `gh pr merge 17 --squash --delete-branch` → main 배포 완료 대기(`gh pr checks`/Vercel 배포 상태) → `gh pr merge 11 --merge --delete-branch`(#11은 이미 main을 merge 커밋으로 합친 브랜치라 이력 보존). 저장소 기본 병합 방식이 다르면 기본값을 따르고 보고.
- 각 병합 후 `git checkout main && git pull`, `npm run test` 1회.

### 3. 환경변수 (사용자 승인 후)

- `AX_CHECK_SAFETY_CASE_STUDY_URL=https://www.coredxi.com/docs/safety-rag-case-study.pdf`를 Production·Preview에 등록해야 합니다.
- `vercel` CLI가 이 저장소에 링크돼 있고 로그인돼 있으면, 등록 명령(`vercel env add AX_CHECK_SAFETY_CASE_STUDY_URL production` 등)을 보여 주고 **승인 후 실행**, 이어서 운영 재배포(`vercel --prod` 또는 대시보드 Redeploy 안내).
- CLI를 쓸 수 없으면 대시보드 경로(Project → Settings → Environment Variables)와 값만 안내하고, 사용자가 등록·재배포했다고 알려 줄 때까지 4단계를 기다립니다.

### 4. 운영 검증 (읽기 전용)

`https://www.coredxi.com` 기준:
- `/solutions` 사례 섹션 노출, 사례 PDF 200·`application/pdf`(파일 크기 약 74KB), 데모 CTA `href`.
- `/contact?source=safety_docs` 진입 시 문의 유형이 "안전서류 AI 도입 데모 신청"으로 자동 선택되는지(Playwright로 페이지만 열어 확인, **제출 금지**).
- `/ax-check` 결과 화면의 Q9 PDF 버튼은 제출이 필요하므로 **실행하지 말고**, 대신 `src/lib/ax-check/catalog.ts`의 `getSafetyDocsCaseStudyUrl()`이 환경변수를 읽는 경로를 코드로 확인하고 "실제 버튼 확인은 사용자가 internal-test로 1회"라고 보고.
- 375px 모바일 뷰포트 스크린샷 1장(`/solutions` 사례 섹션)을 임시 폴더에 저장해 경로만 보고(커밋 금지).

### 5. 운영 테스트 데이터 정리 안내 (실행은 사용자)

- PR #17이 운영에 반영되면 `/admin/contact`·`/admin/leads`의 "테스트 데이터 정리" 버튼은 **사용자가 관리자 화면에서 직접** 미리보기 건수를 보고 실행합니다. Claude Code는 운영 DB에 직접 쿼리·삭제하지 않습니다.

### 6. 문서·보고

- `docs/TODO.md`: 사례 섹션 "PR #11 병합 대기" → "✅ 운영 게시(날짜)", E2E 가드·정리 기능 ✅, 환경변수 등록 여부 반영. 커밋 `docs: PR #11·#17 병합과 운영 확인 반영` → push.
- 최종 보고: 병합 커밋 해시, 배포 확인, 환경변수 처리 방식, 운영 검증 결과표, 사용자에게 남은 일(정리 버튼 실행, internal-test로 Q9 PDF 버튼 1회 확인 후 테스트 리드 삭제 — 이 리드도 정리 버튼 대상이 아니므로 개별 삭제).
