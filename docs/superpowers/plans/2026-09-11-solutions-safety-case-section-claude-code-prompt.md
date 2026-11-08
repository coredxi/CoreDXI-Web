# Claude Code 실행 프롬프트 — Safety-RAG 사례 PDF 게시 + `/solutions` 사례 섹션 (B안)

작성일: 2026-09-11 · 상위 플랜: `docs/superpowers/plans/2026-09-11-safety-rag-reference-assets-action-plan.md` 4~5절(P2) · 선례: `docs/superpowers/plans/2026-09-03-solutions-brochure-download-claude-code-prompt.md`(소개서 S4 게시)

> 아래 구분선 이후 전체를 Claude Code에 그대로 붙여 넣는다. 사전 작업 1(웹 게시본 PDF 저장)은 사용자가 먼저 한다. PDF가 아직 없어도 프롬프트는 실행 가능하다(코드가 파일 부재를 안전하게 처리하도록 짜여 있고, 아래 "전제 확인"에 분기 규칙이 있음).

---

## 사전 작업 (사용자, Claude Code 실행 전)

1. Safety-RAG 오너 세션에서 만든 **사례 자료 웹 게시본 v1.1**(머리말 "대외비 · CONFIDENTIAL" 제거본, 본문 동일)을 `public/docs/safety-rag-case-study.pdf`로 저장한다. 파일명에 버전 없음 — URL 고정 원칙(결과 화면·T1 메일·`/solutions` 세 곳이 같은 URL을 본다). 2MB 이하.
2. `git status`가 깨끗하고 `main`이 `origin/main`과 같은지 확인한다(09-11 `3f44ebb` 이후 로컬 미푸시 커밋이 있으면 먼저 푸시).

---

## Claude Code 프롬프트 (여기부터 복사)

당신은 CoreDXI-Web(Next.js 15 App Router + Prisma + Supabase, Vercel 배포) 저장소에서 작업합니다. 루트 `CLAUDE.md`의 작업 규칙을 전부 준수하세요. 특히: `prisma migrate dev` 금지(이번 작업은 DB 마이그레이션 없음 — `PageContent` JSON 컬럼에 필드만 늘어남), 브랜드 컬러 `#1E4E8C`/`primary` 토큰·`rounded-xl` 이상, shadcn/ui 우선, 컴포넌트에 `[홍보팀]` 한국어 주석, `any` 금지, Named Export, Conventional Commits. 커밋 트레일러는 세션 지침의 문자열을 그대로 씁니다(서브에이전트를 쓰더라도 트레일러를 매번 명시).

### 목표

① 안전서류 분기(Q9) 결과 화면·T1 메일의 "도입 사례 보기(PDF)" 버튼이 실제 파일을 가리키도록 Safety-RAG 도입 사례 PDF를 `public/docs/`에 게시하고, ② `/solutions` 페이지에 "직접 만들어 운영해 본 AX 사례 — Safety-RAG" 섹션을 추가해 홍보팀이 코드 없이 문구·PDF URL을 바꿀 수 있게 합니다. 설계·결정 근거는 `docs/superpowers/plans/2026-09-11-safety-rag-reference-assets-action-plan.md`의 **3절 결정 사항과 4절 설계 요약**입니다. 작업 전에 이 문서와 스펙 원본 `docs/20260910_전달_사내_SafetyRAG오너_AX체크안전서류분기전달물_v1.md`(3절 문구 축·금지 표현)를 먼저 읽으세요. **스코프 확장 금지** — 여기 적힌 것만 합니다.

### 전제 확인 (먼저)

- `ls -la public/docs`로 `safety-rag-case-study.pdf` 존재·2MB 이하를 확인합니다.
  - **있으면**: 첫 feat 커밋에 포함하고 `caseStudyPdfUrl` 기본값을 `/docs/safety-rag-case-study.pdf`로 둡니다.
  - **없으면**: 중단하지 말고 진행하되 `caseStudyPdfUrl` 기본값을 빈 문자열 `""`로 두고(PDF 버튼 숨김), 마지막 보고에 "PDF 미수령 — 파일 저장 후 `/admin/solutions`에서 URL 입력 필요"를 적습니다. 임의로 다른 PDF를 만들어 넣지 마세요.
- 현재 브랜치가 `main`이고 `origin/main`과 동일하며 `git status`가 깨끗한지 확인합니다.
- 09-10 Q9 구현이 이미 `main`에 있는지 확인합니다: `src/lib/ax-check/catalog.ts`에 `SAFETY_DOCS_BRANCH_COPY`, `SAFETY_DOCS_DEMO_SOURCE`, `getSafetyDocsCaseStudyUrl()`이 존재해야 합니다. 없으면 중단하고 보고하세요(이번 작업은 그 위에 얹는 것입니다).

### 작업 순서

1. **브랜치**: `main`에서 `feat/solutions-safety-case-section`을 새로 만듭니다(기존 feat 브랜치에서 분기 금지).

2. **CMS 필드 추가** — `src/lib/page-content/solutions.ts`
   - `SolutionsContent` 타입에 다음을 추가합니다(각 필드에 `[홍보팀]` 주석):
     - `caseStudyEyebrow: string` — 섹션 라벨. 기본값 `"직접 만들어 운영해 본 AX 사례"`
     - `caseStudyTitle: string` — 섹션 제목. 기본값 `"Safety-RAG — 안전서류 3종 세트를 현장·공종에 맞춰 순서대로 초안 생성"`. **비우면 섹션 전체를 숨깁니다.**
     - `caseStudyParagraphs: string[]` — 본문 문단. 기본값은 아래 3문단 **원문 그대로**(플랜 4절):
       1. `2026년 6월부터 위험성평가는 5인 이상 사업장의 법적 의무입니다. 문제는 평가표 한 장이 아니라, 원청에 낼 위험성평가표·표준작업계획서·TBM일지 세 종류를 현장·공종마다 매번 새로 만들어야 한다는 데 있습니다.`
       2. `코어디엑스아이는 이 문제를 텔레그램 봇으로 직접 구현했습니다. 현장 정보를 입력하면 KICA·KRAS 표준 행렬법을 따르는 3종 문서 초안이 순서대로 생성되고, 엑셀로 바로 내려받습니다. 정부 공식 서식과의 정합, 인용 근거 자동 검증까지 실제로 배포하고 검증했습니다.`
       3. `이건 슬라이드가 아니라 저희가 직접 만들어서 지금 돌리고 있는 시스템입니다. 도입 시에는 이 구조를 귀사의 실제 서식·공종에 맞춰 새로 구축해 드립니다.`
     - `caseStudyPdfLabel: string` — 기본값 `"도입 사례 PDF 보기"`
     - `caseStudyPdfUrl: string` — 기본값은 전제 확인 결과에 따라 `/docs/safety-rag-case-study.pdf` 또는 `""`. 비우면 PDF 버튼만 숨김(`brochureUrl` 관례 동일)
     - `caseStudyDemoLabel: string` — 기본값 `"10분 데모 신청"`
   - 데모 CTA의 링크 대상은 CMS에 두지 않습니다. 코드에서 `SAFETY_DOCS_DEMO_SOURCE`(`src/lib/ax-check/catalog.ts`)를 import해 `` `/contact?source=${SAFETY_DOCS_DEMO_SOURCE}` ``로 고정합니다 — 이 쿼리가 `/contact` 문의 유형 자동 설정·데모 신청 집계 키이므로 홍보팀이 바꾸면 안 됩니다.
   - `src/lib/page-content.ts`의 `getPageContent`는 얕은 병합(`{...defaults, ...row.content}`)이라 기존 DB 행에 없는 신규 키는 기본값으로 채워집니다 — 그대로 동작하는지 `src/lib/page-content.test.ts`에 케이스로 고정합니다(아래 7번). 단, DB에 `caseStudyParagraphs`가 빈 배열로 저장될 수 있으니 페이지 렌더에서 빈 배열은 "문단 없음"으로 정상 처리합니다.

3. **저장 액션 검증** — `src/app/admin/(panel)/solutions/actions.ts`
   - `validate()`: `caseStudyPdfUrl`에 기존 `isSafeBrochureUrl()`을 그대로 적용(함수명은 유지하되 주석에 "사례 PDF URL에도 사용"을 덧붙임). `caseStudyTitle`이 비어 있지 않으면 `caseStudyParagraphs`가 1개 이상이고 각 문단이 공백이 아니어야 함(제목이 비면 섹션이 숨겨지므로 문단 검증 생략).
   - `normalize()`: 신규 6개 필드 `trim()`, `caseStudyParagraphs`는 `trim()` 후 빈 문단 제거.

4. **공개 페이지 섹션** — `src/app/solutions/page.tsx`
   - 솔루션 카드 3종 섹션(`content.solutions.map(...)`)과 "도입 프로세스" 섹션 **사이**에 `<section>` 하나를 추가합니다. `content.caseStudyTitle.trim()`이 비면 섹션을 렌더하지 않습니다.
   - 구성: 상단 라벨(`caseStudyEyebrow`, 기존 `solutionsLabel`과 같은 스타일) → 제목(`caseStudyTitle`, h2) → 문단들(`caseStudyParagraphs.map`, `text-muted-foreground leading-relaxed`) → 버튼 행(`flex-col gap-2 sm:flex-row`):
     - PDF 버튼: 기존 `BrochureDownloadButton`(`src/components/solutions/BrochureDownloadButton.tsx`) 재사용, `href={content.caseStudyPdfUrl}`, `label={content.caseStudyPdfLabel}`, `location="solutions_safety_case_download"`. `caseStudyPdfUrl`이 비면 렌더하지 않음.
     - 데모 CTA: 기존 `TrackedCtaLink`, `href={`/contact?source=${SAFETY_DOCS_DEMO_SOURCE}`}`, `location="solutions_safety_demo"`, 기존 히어로 주 버튼과 같은 primary 스타일(`rounded-xl bg-primary ... text-white`).
   - 섹션 배경은 기존 섹션 교대 패턴(`bg-secondary/20` 등 이미 쓰는 토큰) 안에서만 고릅니다. 새 색상·새 아이콘 세트 추가 금지. 카드 3종 섹션과 프로세스 섹션의 마크업은 손대지 않습니다.
   - 섹션 컴포넌트 상단에 `[홍보팀]` 주석: "문구·PDF URL은 관리자 → 솔루션 관리(/admin/solutions)에서 수정. 제목을 비우면 섹션이 숨겨짐. 데모 신청 링크는 집계 키라 코드 고정."
   - 모바일(375px)에서 문단·버튼 줄바꿈이 깨지지 않는지 확인.

5. **관리자 폼** — `src/app/admin/(panel)/solutions/SolutionsContentForm.tsx`
   - "소개서 다운로드" 섹션 아래에 **"AX 사례 섹션 (Safety-RAG)"** 섹션을 추가: `caseStudyEyebrow`, `caseStudyTitle`, `caseStudyParagraphs`(문단 추가/삭제 가능한 textarea 목록 — 기존 `features`/`processSteps` 편집 UI 패턴 재사용), `caseStudyPdfLabel`, `caseStudyPdfUrl`, `caseStudyDemoLabel`.
   - 도움말 문구 2개: "제목을 비우면 홈페이지에서 섹션 전체가 숨겨집니다." / "PDF 파일을 교체할 때는 같은 파일명(`safety-rag-case-study.pdf`)으로 덮어쓰면 URL이 유지됩니다. 데모 신청 버튼의 링크는 집계용이라 코드에서 고정되어 있습니다."
   - 기존 필드들과 동일한 저장 흐름·토스트.

6. **환경 변수·메일 쪽 확인 (코드 변경 최소)**
   - `.env.example`의 `AX_CHECK_SAFETY_CASE_STUDY_URL` 주석에 프로덕션 값 예시 `https://www.coredxi.com/docs/safety-rag-case-study.pdf` 한 줄을 추가합니다(기존 `AX_CHECK_BROCHURE_URL` 주석 형식과 동일).
   - `src/lib/ax-check/catalog.ts`의 `getSafetyDocsCaseStudyUrl()`·`SAFETY_DOCS_BRANCH_COPY`는 **수정하지 않습니다.** 결과 화면·T1 메일 버튼은 Vercel 환경변수 등록만으로 살아납니다(사용자 배포 후 작업).
   - GA4 퍼널: `Ga4FunnelPanel.tsx`(또는 퍼널 계산 근처)의 "`solutions_brochure_download` 포함" 주석 줄에 `solutions_safety_case_download`, `solutions_safety_demo`를 덧붙입니다. 계산 로직 변경 금지.

7. **테스트**
   - Vitest
     - `src/app/admin/(panel)/solutions/actions.test.ts`: (a) `caseStudyPdfUrl` 정상 상대경로 통과, `javascript:`·`//` 거부 (b) 제목 있고 문단 0개면 거부, 제목 비면 문단 검증 생략 (c) `normalize`가 빈 문단을 제거.
     - `src/lib/page-content.test.ts`: DB 행에 신규 6개 키가 없을 때 기본값으로 채워지는 케이스.
     - `src/lib/page-content/solutions.test.ts`(신규, `catalog.test.ts`의 금지 표현 테스트와 같은 방식): `SOLUTIONS_CONTENT_DEFAULTS`의 `caseStudy*` 문자열·문단 전체에 `"AI로 위험성평가표를 만들어"`가 없고, `"코어디엑스아이"` 화자로만 쓰였으며 개인 직함 표기(`"이사"`, `"대표"`, `"부장"`)가 없어야 함.
   - Playwright: `e2e/solutions-safety-case.spec.ts` 신규 — `/solutions` 방문 → 사례 섹션 제목 노출 → 데모 CTA `href`가 `/contact?source=safety_docs`인지 → PDF 버튼이 있으면 `href`로 `request.get` → 200 + `content-type`에 `application/pdf`(PDF 미수령 상태면 버튼 부재를 확인하고 PDF 검사만 skip). 골든패스 1개, `e2e/solutions-brochure.spec.ts` 스타일 참고.
   - `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run test:e2e -- solutions-safety-case` 전부 통과. 기존 `e2e/ax-check.spec.ts`도 한 번 돌려 Q9 회귀가 없는지 확인.

8. **문서 갱신** (코드와 같은 브랜치에서)
   - `CONTENT_GUIDE.md`에 **19번 "Safety-RAG 사례 섹션 문구·PDF 교체 방법"** 추가(18번과 같은 톤): (a) 관리자 → 솔루션 관리에서 라벨·제목·문단·PDF 라벨/URL·데모 버튼 문구 수정, (b) 섹션 숨기기 = 제목 비우기, PDF 버튼만 숨기기 = URL 비우기, (c) 파일 교체는 개발팀에 `public/docs/safety-rag-case-study.pdf` 덮어쓰기 요청(URL 유지 — 결과 화면·T1 메일도 같은 파일), (d) 문구를 고칠 때 지킬 축: "AI로 위험성평가표를 만들어 드립니다" 금지(정부 KRAS 무료 제공과 겹침), 화자는 "코어디엑스아이", 개인 직함 없음, 법령 수치(시행일·과태료)는 사례 PDF에만 두고 웹 본문엔 넣지 않음. 17번의 "안전서류 분기(Q9)" 소절에서 19번을 상호 참조.
   - `docs/TODO.md`: 헤더 "최종 업데이트"를 오늘로. 1-B 2단계 보강 항목의 "`/solutions` 단일 오퍼 재편"에 "**첫 조각 = Safety-RAG 사례 섹션 ✅ 2026-09-15(커밋 해시)**"를 덧붙이고, 09-10 Q9 항목의 후속 ①을 "사례 PDF 웹 게시본 v1.1 `public/docs/safety-rag-case-study.pdf` 게시 완료 → Vercel env 등록은 사용자(배포 후)"로, ②를 "반영일 2026-09-11 노션 기록 완료"로 정정(PDF 미수령이면 ①은 그대로 두고 "코드 준비 완료, 파일 대기"로).
   - `docs/PRD.md`: 5-1 솔루션 페이지 행에 "Safety-RAG 사례 섹션(CMS 편집, 사례 PDF·10분 데모 CTA)" 한 구절, 5-3 "솔루션 편집(`/admin/solutions`)" 행에 "AX 사례 섹션 문구·PDF URL" 한 구절, AX 체크 관련 행에 "Q9 안전서류 작성 시간 문항 + 월 4시간 이상 분기(2026-09-10)" 한 구절 추가. PRD는 요구사항만 — 경위 서사는 쓰지 않습니다.
   - `docs/superpowers/plans/2026-09-11-safety-rag-reference-assets-action-plan.md` 7절 문서 반영 목록의 ⬜ 항목을 ✅ + 커밋 해시로.

9. **커밋·PR**
   - 커밋은 의미 단위로: `feat(solutions): Safety-RAG 사례 섹션 및 CMS 필드 추가 (사례 PDF 게시)` (PDF 파일 포함), `test: solutions 사례 섹션 검증·골든패스 E2E 추가`, `docs: CONTENT_GUIDE 19번·TODO·PRD Safety-RAG 사례 섹션 반영`.
   - `gh pr create` — base `main`, 제목 `feat: /solutions Safety-RAG 사례 섹션 + 사례 PDF 게시 (Phase 1.5 2단계 보강 · Safety-RAG 레퍼런스 자산 반영)`. 본문: ①변경 요약 ②스크린샷(데스크톱·모바일 1장씩, Vercel Preview URL) ③배포 후 사용자 체크리스트 — Vercel Production/Preview에 `AX_CHECK_SAFETY_CASE_STUDY_URL=https://www.coredxi.com/docs/safety-rag-case-study.pdf` 등록·재배포, 프로덕션 `/docs/safety-rag-case-study.pdf` 200 확인, `/ax-check?ref=internal-test`에서 Q9 "월 16시간 이상" 제출 → 결과 화면에 사례 PDF·데모 버튼 2개 노출 확인 → `/admin/leads` Q9 집계 반영 → 테스트 리드 삭제, GA4 실시간에서 `cta_click`/`cta_location=solutions_safety_demo` 수신 확인, 보류 중인 T1 초안이 있으면 `/admin/leads`에서 다시 열어 저장(환경변수 등록 전 저장본엔 PDF 링크가 없음).
   - **main 병합은 하지 않습니다.** PR URL과 Preview URL을 보고하고 종료.

### 하지 않을 것

- 솔루션 카드 개수·순서·구조 변경, 단일 오퍼 재편(2단계 별건), 소개자료 10p PDF 게시, 가격(380/480만원) 노출, `/cases` 성공사례 등록(관리자 화면에서 사용자가 별도 판단), `catalog.ts` 분기 문구·임계값 수정, 퍼널 계산 로직 변경, 새 이벤트 분석 SDK, DB 마이그레이션, `@tiptap/*` 등 의존성 변경, `/solutions` 메타 description 변경.

### 마지막 보고 형식

변경 파일 목록 / PDF 포함 여부(수령·미수령) / 테스트 결과(lint·tsc·vitest 개수·E2E) / PR URL·Preview URL / 사용자가 해야 할 배포 후 체크리스트 — 이 다섯 항목만 간결하게.
