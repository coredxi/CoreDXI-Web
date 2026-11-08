# `/solutions` Safety-RAG 사례 섹션 + 사례 PDF 게시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/ax-check` 안전서류 분기(Q9) 결과 화면·T1 메일의 "도입 사례 보기(PDF)" 버튼이 실제 파일을 가리키도록 Safety-RAG 사례 PDF를 게시하고, `/solutions` 페이지에 CMS로 편집 가능한 "직접 만들어 운영해 본 AX 사례 — Safety-RAG" 섹션을 추가한다.

**Architecture:** 기존 "소개서 PDF 다운로드" 기능(`brochureUrl`/`brochureLabel` 패턴, 2026-09-03 선례)을 그대로 복제해 `SolutionsContent`에 사례 섹션용 6개 필드를 추가한다. `getPageContent`의 얕은 병합 특성 덕분에 기존 DB 행은 자동으로 신규 필드 기본값을 채운다. 공개 페이지는 제목이 비면 섹션을 숨기고, PDF URL이 비면 버튼만 숨긴다. 데모 CTA 링크는 GA4/문의유형 집계 키이므로 CMS가 아닌 `catalog.ts`의 코드 상수(`SAFETY_DOCS_DEMO_SOURCE`)로 고정한다.

**Tech Stack:** Next.js 15 App Router (Server Component 페이지 + Server Action 저장) · Prisma `PageContent` JSON 컬럼(마이그레이션 없음) · Vitest · Playwright

**Spec:** `docs/superpowers/plans/2026-09-11-solutions-safety-case-section-claude-code-prompt.md` (실행 프롬프트), `docs/superpowers/plans/2026-09-11-safety-rag-reference-assets-action-plan.md` 3~4절(결정 사항·설계 요약)

## Global Constraints

- `prisma migrate dev` 사용 금지 — 이번 작업은 DB 마이그레이션이 필요 없음(`PageContent` JSON 컬럼에 필드만 추가).
- 브랜드 컬러 `#1E4E8C`/`primary` 토큰, 코너 반경 `rounded-xl` 이상, shadcn/ui 컴포넌트 우선 — 새 색상·새 아이콘 세트 추가 금지.
- 컴포넌트에 `[홍보팀]` 한국어 주석 필수, `any` 타입 금지, Named Export 유지.
- Conventional Commits 형식 유지. 커밋 메시지·PR 본문 끝에 세션 지침의 어트리뷰션 트레일러를 그대로 포함.
- 금지 표현: "AI로 위험성평가표를 만들어 드립니다"(정부 KRAS 무료 제공과 겹침). 화자는 항상 "코어디엑스아이", 개인 직함("이사"/"대표"/"부장") 사용 금지. 법령 수치(시행일·과태료)는 웹 본문에 넣지 않는다.
- 데모 CTA 링크 대상(`/contact?source=safety_docs`)은 GA4·문의유형 집계 키이므로 CMS로 노출하지 않고 `SAFETY_DOCS_DEMO_SOURCE` 코드 상수로 고정한다.
- 스코프 확장 금지: 솔루션 카드 개수·순서·구조 변경, 단일 오퍼 재편, 소개자료 10p 게시, 가격 노출, `/cases` 성공사례 등록, `catalog.ts`의 분기 문구·임계값 수정, 퍼널 계산 로직 변경, 새 이벤트 분석 SDK, DB 마이그레이션, `@tiptap/*` 등 의존성 변경, `/solutions` 메타 description 변경은 이번 작업에 포함하지 않는다.
- **main 병합은 하지 않는다** — PR만 생성하고 종료.

---

## File Structure

| 파일 | 역할 |
|---|---|
| `public/docs/safety-rag-case-study.pdf` | 이미 저장됨(73KB, 2MB 이하) — 첫 feat 커밋에 포함 |
| `src/lib/page-content/solutions.ts` (수정) | `SolutionsContent` 타입·기본값에 사례 섹션 6개 필드 추가 |
| `src/app/admin/(panel)/solutions/actions.ts` (수정) | 저장 검증(`validate`)·정규화(`normalize`)에 신규 필드 반영 |
| `src/app/solutions/page.tsx` (수정) | 카드 섹션과 프로세스 섹션 사이에 사례 섹션 렌더 추가 |
| `src/app/admin/(panel)/solutions/SolutionsContentForm.tsx` (수정) | "AX 사례 섹션 (Safety-RAG)" 편집 폼 블록 추가 |
| `.env.example` (수정) | `AX_CHECK_SAFETY_CASE_STUDY_URL` 프로덕션 값 예시 주석 |
| `src/components/admin/dashboard/Ga4FunnelPanel.tsx` (수정) | 주석에 신규 GA4 location 2종 추가(로직 변경 없음) |
| `src/app/admin/(panel)/solutions/actions.test.ts` (수정) | 신규 필드 검증 테스트 추가 |
| `src/lib/page-content.test.ts` (수정) | 레거시 DB 행(신규 키 없음) 병합 케이스 추가 |
| `src/lib/page-content/solutions.test.ts` (신규) | 금지 표현·화자·직함 회귀 테스트 |
| `e2e/solutions-safety-case.spec.ts` (신규) | 사례 섹션 골든패스 E2E |
| `CONTENT_GUIDE.md` (수정) | 19번 신설 |
| `docs/TODO.md` (수정) | 헤더 날짜·1-B 진행 표기 |
| `docs/PRD.md` (수정) | 5-1·5-3·AX 체크 행에 한 구절씩 |
| `docs/superpowers/plans/2026-09-11-safety-rag-reference-assets-action-plan.md` (수정) | 7절 문서 반영 목록 체크 |

`src/lib/ax-check/catalog.ts`(`SAFETY_DOCS_BRANCH_COPY`/`SAFETY_DOCS_DEMO_SOURCE`/`getSafetyDocsCaseStudyUrl`)는 **읽기만 하고 수정하지 않는다** — 09-10 Q9 구현이 이미 `main`(`3f44ebb`)에 있음을 확인했다.

---

## Task 0: 사전 확인 · 브랜치 생성

**Files:** 없음(확인 전용)

- [ ] **Step 1: PDF·git 상태 재확인**

```bash
ls -la public/docs/safety-rag-case-study.pdf   # 존재·2MB 이하 확인(현재 73KB 확인됨)
git status                                       # main, origin/main과 동기화, 작업트리 클린
git rev-parse HEAD                               # 3f44ebb 이후인지 확인
```

Expected: 파일 존재, `git status`가 clean(단 `Claude outputs/`·계획 문서·PDF는 untracked — 정상), `HEAD`가 `origin/main`과 일치.

- [ ] **Step 2: Q9 구현이 이미 main에 있는지 확인**

```bash
grep -n "SAFETY_DOCS_BRANCH_COPY\|SAFETY_DOCS_DEMO_SOURCE\|getSafetyDocsCaseStudyUrl" src/lib/ax-check/catalog.ts
```

Expected: 3개 심볼 모두 출력됨(이미 확인 완료 — `catalog.ts:499,510,520`). 없으면 여기서 중단하고 보고한다.

- [ ] **Step 3: 브랜치 생성**

```bash
git checkout main
git pull origin main
git checkout -b feat/solutions-safety-case-section
```

Expected: 새 브랜치로 전환됨.

- [ ] **Step 4: 첫 feat 커밋 — PDF 포함**

```bash
git add public/docs/safety-rag-case-study.pdf
git commit -m "feat(solutions): Safety-RAG 사례 PDF 게시

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Expected: 커밋 성공. (이후 코드 변경 커밋은 Task 6에서 별도로 만든다 — 이 커밋은 파일 게시 자체를 기록으로 남기기 위함.)

---

## Task 1: CMS 필드 추가 — `SolutionsContent` 타입·기본값

**Files:**
- Modify: `src/lib/page-content/solutions.ts`
- Test: `src/lib/page-content/solutions.test.ts` (신규, Task 4에서 작성)

**Interfaces:**
- Produces: `SolutionsContent` 타입에 6개 신규 필드 — `caseStudyEyebrow: string`, `caseStudyTitle: string`, `caseStudyParagraphs: string[]`, `caseStudyPdfLabel: string`, `caseStudyPdfUrl: string`, `caseStudyDemoLabel: string`. `SOLUTIONS_CONTENT_DEFAULTS`에 각 필드의 기본값.

- [ ] **Step 1: 타입에 필드 추가**

`src/lib/page-content/solutions.ts`의 `SolutionsContent` 타입, `brochureUrl: string;` 다음에 추가:

```typescript
  /** [홍보팀] AX 사례 섹션(Safety-RAG) 라벨. 예: "직접 만들어 운영해 본 AX 사례" */
  caseStudyEyebrow: string;
  /** [홍보팀] AX 사례 섹션 제목. 비우면 섹션 전체를 숨긴다. */
  caseStudyTitle: string;
  /** [홍보팀] AX 사례 섹션 본문 문단(순서대로 렌더). 빈 배열이면 문단 없이 렌더한다. */
  caseStudyParagraphs: string[];
  /** [홍보팀] 사례 PDF 다운로드 버튼 문구. */
  caseStudyPdfLabel: string;
  /** [홍보팀] 사례 PDF 경로("/"로 시작하는 상대 경로) 또는 절대 URL. 비우면 PDF 버튼만 숨긴다. */
  caseStudyPdfUrl: string;
  /** [홍보팀] 데모 신청 CTA 버튼 문구. 링크 대상은 집계 키라 코드에 고정되어 있다(CMS 아님). */
  caseStudyDemoLabel: string;
```

- [ ] **Step 2: 기본값 추가**

`SOLUTIONS_CONTENT_DEFAULTS`의 `brochureUrl: "/docs/coredxi-ax-consulting-brochure.pdf",` 다음에 추가:

```typescript
  caseStudyEyebrow: "직접 만들어 운영해 본 AX 사례",
  caseStudyTitle:
    "Safety-RAG — 안전서류 3종 세트를 현장·공종에 맞춰 순서대로 초안 생성",
  caseStudyParagraphs: [
    "2026년 6월부터 위험성평가는 5인 이상 사업장의 법적 의무입니다. 문제는 평가표 한 장이 아니라, 원청에 낼 위험성평가표·표준작업계획서·TBM일지 세 종류를 현장·공종마다 매번 새로 만들어야 한다는 데 있습니다.",
    "코어디엑스아이는 이 문제를 텔레그램 봇으로 직접 구현했습니다. 현장 정보를 입력하면 KICA·KRAS 표준 행렬법을 따르는 3종 문서 초안이 순서대로 생성되고, 엑셀로 바로 내려받습니다. 정부 공식 서식과의 정합, 인용 근거 자동 검증까지 실제로 배포하고 검증했습니다.",
    "이건 슬라이드가 아니라 저희가 직접 만들어서 지금 돌리고 있는 시스템입니다. 도입 시에는 이 구조를 귀사의 실제 서식·공종에 맞춰 새로 구축해 드립니다.",
  ],
  caseStudyPdfLabel: "도입 사례 PDF 보기",
  caseStudyPdfUrl: "/docs/safety-rag-case-study.pdf",
  caseStudyDemoLabel: "10분 데모 신청",
```

Task 0에서 PDF가 이미 존재함을 확인했으므로 `caseStudyPdfUrl` 기본값은 빈 문자열이 아닌 실제 경로를 쓴다.

- [ ] **Step 3: 타입체크로 확인**

Run: `npx tsc --noEmit`
Expected: 이 단계에서는 아직 `actions.ts`/`page.tsx`/`SolutionsContentForm.tsx`가 `SolutionsContent`를 다루므로 에러가 없어야 한다(타입에 필드를 추가만 했고 사용처는 구조 분해 안 하므로 컴파일 통과). 만약 어딘가에서 `SolutionsContent`를 명시적으로 전체 나열하는 곳이 있으면 여기서 에러가 난다 — 있다면 그 파일도 이 Task 범위에 포함해 고친다.

- [ ] **Step 4: 커밋 없이 다음 Task로 진행**

(이 Task는 Task 2~3과 함께 하나의 feat 커밋으로 묶는다 — Task 3 Step 마지막에서 커밋한다.)

---

## Task 2: 저장 액션 검증 — `actions.ts`

**Files:**
- Modify: `src/app/admin/(panel)/solutions/actions.ts`

**Interfaces:**
- Consumes: `SolutionsContent`(Task 1에서 6개 필드 추가됨), 기존 `isSafeBrochureUrl(url: string): boolean`.
- Produces: `validate()`·`normalize()`가 신규 6개 필드를 처리 — 이후 Task는 `saveSolutionsContent(data: SolutionsContent): Promise<{ success: boolean; message: string }>` 시그니처가 그대로임을 전제로 한다.

- [ ] **Step 1: `isSafeBrochureUrl` 주석 갱신**

기존 함수 주석(`src/app/admin/(panel)/solutions/actions.ts:8-11`)에 사례 PDF URL에도 사용됨을 덧붙인다:

```typescript
/**
 * [홍보팀] 소개서 다운로드 URL 검증 — "/"로 시작하는 상대 경로 또는 "https://" 절대 URL만
 * 허용한다("javascript:" 등 위험한 스킴, "//" 프로토콜 상대 URL 차단). 빈 문자열은 버튼을
 * 숨기는 용도로 허용한다. src/lib/url-safety.ts의 허용 목록 패턴과 동일한 취지.
 * AX 사례 섹션의 사례 PDF URL(caseStudyPdfUrl) 검증에도 그대로 재사용한다.
 */
function isSafeBrochureUrl(url: string): boolean {
```

- [ ] **Step 2: `validate()`에 사례 섹션 검증 추가**

`validate` 함수의 `if (!isSafeBrochureUrl(data.brochureUrl.trim())) { ... }` 블록 다음, `return null;` 앞에 추가:

```typescript
  if (!isSafeBrochureUrl(data.caseStudyPdfUrl.trim())) {
    return "사례 PDF URL은 '/'로 시작하는 상대 경로 또는 'https://' 절대 URL만 허용됩니다.";
  }
  if (
    data.caseStudyTitle.trim() &&
    (data.caseStudyParagraphs.length === 0 ||
      data.caseStudyParagraphs.some((p) => !p.trim()))
  ) {
    return "AX 사례 섹션 제목을 입력했다면 본문 문단을 1개 이상 입력해 주세요.";
  }
```

제목이 비어 있으면(섹션이 숨겨지므로) 문단 검증을 건너뛴다.

- [ ] **Step 3: `normalize()`에 사례 섹션 필드 추가**

`normalize` 함수의 반환 객체, `brochureUrl: data.brochureUrl.trim(),` 다음에 추가:

```typescript
    caseStudyEyebrow: data.caseStudyEyebrow.trim(),
    caseStudyTitle: data.caseStudyTitle.trim(),
    caseStudyParagraphs: data.caseStudyParagraphs
      .map((p) => p.trim())
      .filter((p) => p !== ""),
    caseStudyPdfLabel: data.caseStudyPdfLabel.trim(),
    caseStudyPdfUrl: data.caseStudyPdfUrl.trim(),
    caseStudyDemoLabel: data.caseStudyDemoLabel.trim(),
```

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS (이제 `SolutionsContentForm.tsx`가 `initial: SolutionsContent`를 그대로 통과시키는 구조라 아직 에러 없음).

---

## Task 3: 공개 페이지 사례 섹션 렌더 — `page.tsx`

**Files:**
- Modify: `src/app/solutions/page.tsx`

**Interfaces:**
- Consumes: `content: SolutionsContent`(`getPageContent("solutions", SOLUTIONS_CONTENT_DEFAULTS)`의 반환값), 기존 `BrochureDownloadButton({ href, label, location, className? })`, 기존 `TrackedCtaLink`(Link의 모든 props + `location: string`), `SAFETY_DOCS_DEMO_SOURCE`(from `@/lib/ax-check/catalog`).
- Produces: `/solutions` 페이지에 새 `<section>` — 카드 섹션과 "도입 프로세스" 섹션 사이. `content.caseStudyTitle.trim()`이 빈 문자열이면 렌더하지 않는다.

- [ ] **Step 1: import 추가**

`src/app/solutions/page.tsx` 상단, 기존 import들 다음에 추가:

```typescript
import { SAFETY_DOCS_DEMO_SOURCE } from "@/lib/ax-check/catalog";
```

- [ ] **Step 2: 사례 섹션 마크업 추가**

`{/* ── 도입 프로세스 ─────────────────────────────────────── */}` 섹션 **바로 앞**(카드 섹션의 닫는 `</section>` 다음)에 추가:

```tsx
        {/* ── AX 사례 (Safety-RAG) ──────────────────────────────
            [홍보팀] 문구·PDF URL은 관리자 → 솔루션 관리(/admin/solutions)에서 수정.
            제목을 비우면 섹션이 숨겨짐. 데모 신청 링크는 집계 키라 코드 고정. */}
        {content.caseStudyTitle.trim() && (
          <section className="bg-secondary/20 px-6 py-20">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold text-primary">
                {content.caseStudyEyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                {content.caseStudyTitle}
              </h2>
              <div className="mt-6 space-y-4 text-left">
                {content.caseStudyParagraphs.map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-base leading-relaxed text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
                {content.caseStudyPdfUrl && (
                  <BrochureDownloadButton
                    href={content.caseStudyPdfUrl}
                    label={content.caseStudyPdfLabel}
                    location="solutions_safety_case_download"
                    className="w-auto"
                  />
                )}
                <TrackedCtaLink
                  href={`/contact?source=${SAFETY_DOCS_DEMO_SOURCE}`}
                  location="solutions_safety_demo"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90"
                >
                  {content.caseStudyDemoLabel}
                </TrackedCtaLink>
              </div>
            </div>
          </section>
        )}

```

주의: `BrochureDownloadButton`의 기본 클래스가 `w-full`이라 카드 안에서는 문제없지만, 이 섹션은 카드 밖 중앙 정렬 버튼 행이므로 `className="w-auto"`로 전체폭을 해제한다(`cn()`이 뒤에 오는 클래스를 병합하므로 `w-full`을 덮어씀 — `src/components/solutions/BrochureDownloadButton.tsx:32-36`의 `cn(buttonVariants(...), "w-full gap-2 rounded-xl", className)` 순서상 `className`이 마지막에 병합되어 `w-auto`가 우선 적용됨을 확인했다).

- [ ] **Step 3: 모바일 레이아웃 확인**

Run: `npm run dev` 후 브라우저 375px 너비로 `/solutions` 접속, 사례 섹션 문단·버튼이 줄바꿈 없이 깨지지 않는지 육안 확인. (자동화된 스텝은 아니며, Task 5의 Playwright 골든패스로 회귀 방지)

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Task 1~3을 하나의 feat 커밋으로 묶기**

```bash
git add src/lib/page-content/solutions.ts src/app/admin/\(panel\)/solutions/actions.ts src/app/solutions/page.tsx
git commit -m "feat(solutions): Safety-RAG 사례 섹션 및 CMS 필드 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: 관리자 폼 — `SolutionsContentForm.tsx`

**Files:**
- Modify: `src/app/admin/(panel)/solutions/SolutionsContentForm.tsx`

**Interfaces:**
- Consumes: `values: SolutionsContent`(Task 1에서 확장됨), 기존 `updateField<K extends keyof SolutionsContent>(key: K, value: SolutionsContent[K])`, 기존 `updateAt<T>(list: T[], index: number, value: T): T[]`.
- Produces: 문단 배열 편집을 위한 로컬 핸들러 `updateCaseStudyParagraph(index, value)`, `addCaseStudyParagraph()`, `removeCaseStudyParagraph(index)` — 이 Task 내부에서만 쓰임, 다른 Task는 의존하지 않음.

- [ ] **Step 1: 문단 편집 핸들러 추가**

`updateProcessStep` 함수 다음에 추가:

```typescript
  function updateCaseStudyParagraph(index: number, value: string) {
    updateField(
      "caseStudyParagraphs",
      updateAt(values.caseStudyParagraphs, index, value)
    );
  }

  function addCaseStudyParagraph() {
    updateField("caseStudyParagraphs", [...values.caseStudyParagraphs, ""]);
  }

  function removeCaseStudyParagraph(index: number) {
    updateField(
      "caseStudyParagraphs",
      values.caseStudyParagraphs.filter((_, i) => i !== index)
    );
  }
```

- [ ] **Step 2: 폼 섹션 추가**

"소개서 다운로드" 섹션(`</div>` 닫히는 지점, `sol-brochure-url` Input을 포함한 블록의 바로 다음)과 "하단 CTA 섹션" 사이에 추가:

```tsx
      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700">
          AX 사례 섹션 (Safety-RAG)
        </h2>
        <p className="text-xs text-gray-500">
          제목을 비우면 홈페이지에서 섹션 전체가 숨겨집니다. PDF 파일을 교체할
          때는 같은 파일명(safety-rag-case-study.pdf)으로 덮어쓰면 URL이
          유지됩니다. 데모 신청 버튼의 링크는 집계용이라 코드에서 고정되어
          있습니다.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sol-case-eyebrow">섹션 라벨</Label>
            <Input
              id="sol-case-eyebrow"
              value={values.caseStudyEyebrow}
              onChange={(e) => updateField("caseStudyEyebrow", e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sol-case-title">섹션 제목 (비우면 섹션 숨김)</Label>
            <Input
              id="sol-case-title"
              value={values.caseStudyTitle}
              onChange={(e) => updateField("caseStudyTitle", e.target.value)}
              disabled={pending}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>본문 문단</Label>
          {values.caseStudyParagraphs.map((paragraph, pi) => (
            <div key={pi} className="flex gap-2">
              <Textarea
                value={paragraph}
                onChange={(e) => updateCaseStudyParagraph(pi, e.target.value)}
                rows={2}
                disabled={pending}
                aria-label={`AX 사례 문단 ${pi + 1}`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => removeCaseStudyParagraph(pi)}
                disabled={pending}
                className="rounded-xl"
              >
                삭제
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addCaseStudyParagraph}
            disabled={pending}
            className="rounded-xl"
          >
            문단 추가
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sol-case-pdf-label">PDF 버튼 문구</Label>
            <Input
              id="sol-case-pdf-label"
              value={values.caseStudyPdfLabel}
              onChange={(e) => updateField("caseStudyPdfLabel", e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sol-case-pdf-url">사례 PDF URL</Label>
            <Input
              id="sol-case-pdf-url"
              value={values.caseStudyPdfUrl}
              onChange={(e) => updateField("caseStudyPdfUrl", e.target.value)}
              disabled={pending}
              placeholder="/docs/safety-rag-case-study.pdf"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sol-case-demo-label">데모 신청 버튼 문구</Label>
          <Input
            id="sol-case-demo-label"
            value={values.caseStudyDemoLabel}
            onChange={(e) => updateField("caseStudyDemoLabel", e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

```

`Button`은 이미 이 파일 상단에서 import되어 있으므로(`import { Button } from "@/components/ui/button";`) 추가 import 불필요.

- [ ] **Step 3: 타입체크·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add src/app/admin/\(panel\)/solutions/SolutionsContentForm.tsx
git commit -m "feat(admin): 솔루션 관리 화면에 AX 사례 섹션 편집 폼 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: 환경 변수 주석·GA4 퍼널 주석

**Files:**
- Modify: `.env.example`
- Modify: `src/components/admin/dashboard/Ga4FunnelPanel.tsx`

**Interfaces:** 없음(문자열·주석 변경만, 런타임 동작 불변).

- [ ] **Step 1: `.env.example` 주석 추가**

`.env.example`의 `# AX_CHECK_SAFETY_CASE_STUDY_URL=` 줄(현재 100~103번째 줄) 위에, 기존 `AX_CHECK_BROCHURE_URL` 블록과 동일한 형식으로 프로덕션 값 예시를 한 줄 추가:

```diff
 # (선택) 안전서류 분기(Q9 월 4시간 이상) 결과 화면·T1 메일에 넣을 Safety-RAG 도입 사례 PDF 링크.
 # 미설정 시 "도입 사례 보기(PDF)" 버튼이 통째로 빠진다("10분 데모 신청" 버튼은 그대로 노출).
+# 프로덕션 예시: https://www.coredxi.com/docs/safety-rag-case-study.pdf
 # 참고: docs/20260910_전달_사내_SafetyRAG오너_AX체크안전서류분기전달물_v1.md
 # AX_CHECK_SAFETY_CASE_STUDY_URL=
```

- [ ] **Step 2: GA4 퍼널 패널 주석 갱신**

`src/components/admin/dashboard/Ga4FunnelPanel.tsx:38-39`의 주석을 다음으로 교체(계산 로직은 건드리지 않는다):

```diff
-          {/* [홍보팀] "CTA 클릭" 단계의 cta_click에는 /solutions 소개서 다운로드 클릭
-              (cta_location: "solutions_brochure_download")도 포함됩니다(2026-09-03 결정). */}
+          {/* [홍보팀] "CTA 클릭" 단계의 cta_click에는 /solutions 소개서 다운로드 클릭
+              (cta_location: "solutions_brochure_download")과 AX 사례 섹션의 PDF 다운로드·
+              데모 신청 클릭(cta_location: "solutions_safety_case_download" /
+              "solutions_safety_demo")도 포함됩니다(2026-09-03 결정, 2026-09-15 사례 섹션 추가). */}
```

- [ ] **Step 3: 커밋**

```bash
git add .env.example src/components/admin/dashboard/Ga4FunnelPanel.tsx
git commit -m "docs(solutions): env 예시·GA4 퍼널 주석에 AX 사례 섹션 반영

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Vitest — 저장 액션·페이지 콘텐츠 병합·금지 표현 회귀

**Files:**
- Modify: `src/app/admin/(panel)/solutions/actions.test.ts`
- Modify: `src/lib/page-content.test.ts`
- Test (신규): `src/lib/page-content/solutions.test.ts`

**Interfaces:**
- Consumes: `saveSolutionsContent`(Task 2), `SOLUTIONS_CONTENT_DEFAULTS`(Task 1), `getPageContent`(기존, 시그니처 불변).

- [ ] **Step 1: `actions.test.ts`에 사례 섹션 검증 테스트 추가**

`src/app/admin/(panel)/solutions/actions.test.ts`의 마지막 `it` 블록(`"rejects a protocol-relative brochure URL"`) 다음, `});`(describe 닫는 괄호) 앞에 추가:

```typescript
  it("rejects a javascript: caseStudyPdfUrl", async () => {
    const result = await saveSolutionsContent({
      ...SOLUTIONS_CONTENT_DEFAULTS,
      caseStudyPdfUrl: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
    expect(savePageContentMock).not.toHaveBeenCalled();
  });

  it("accepts an empty caseStudyPdfUrl to hide the PDF button", async () => {
    const result = await saveSolutionsContent({
      ...SOLUTIONS_CONTENT_DEFAULTS,
      caseStudyPdfUrl: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-empty caseStudyTitle with zero paragraphs", async () => {
    const result = await saveSolutionsContent({
      ...SOLUTIONS_CONTENT_DEFAULTS,
      caseStudyParagraphs: [],
    });
    expect(result.success).toBe(false);
    expect(savePageContentMock).not.toHaveBeenCalled();
  });

  it("skips paragraph validation when caseStudyTitle is empty", async () => {
    const result = await saveSolutionsContent({
      ...SOLUTIONS_CONTENT_DEFAULTS,
      caseStudyTitle: "",
      caseStudyParagraphs: [],
    });
    expect(result.success).toBe(true);
  });

  it("trims caseStudyParagraphs and drops blank entries on normalize", async () => {
    const result = await saveSolutionsContent({
      ...SOLUTIONS_CONTENT_DEFAULTS,
      caseStudyParagraphs: ["  문단1  ", "", "  문단2  "],
    });
    expect(result.success).toBe(true);
    expect(savePageContentMock).toHaveBeenCalledWith(
      "solutions",
      expect.objectContaining({ caseStudyParagraphs: ["문단1", "문단2"] })
    );
  });
```

- [ ] **Step 2: Run 테스트로 확인(구현 전이면 실패 확인)**

Run: `npm run test -- src/app/admin/\(panel\)/solutions/actions.test.ts`
Expected: Task 2를 이미 완료했다면 PASS. (TDD 순서를 엄격히 지키고 싶다면 Task 2 이전에 이 Step을 먼저 실행해 FAIL을 확인한 뒤 Task 2로 돌아가도 된다 — 이 플랜은 구현 Task를 먼저 배치했으므로 여기서는 회귀 확인 성격.)

- [ ] **Step 3: `page-content.test.ts`에 레거시 병합 케이스 추가**

`src/lib/page-content.test.ts`의 `"fills brochureLabel/brochureUrl from defaults when a legacy stored solutions row lacks them"` 테스트 다음, `});`(describe 닫는 괄호) 앞에 추가:

```typescript
  it("fills caseStudy* fields from defaults when a legacy stored solutions row lacks them", async () => {
    // [홍보팀] 사례 섹션 필드 추가 전 저장된 기존 PageContent JSON을 흉내낸다 —
    // caseStudy* 6개 필드가 없어도 기본값과 병합돼 안전하게 채워져야 한다.
    const {
      caseStudyEyebrow,
      caseStudyTitle,
      caseStudyParagraphs,
      caseStudyPdfLabel,
      caseStudyPdfUrl,
      caseStudyDemoLabel,
      ...legacyStoredContent
    } = SOLUTIONS_CONTENT_DEFAULTS;
    void caseStudyEyebrow;
    void caseStudyTitle;
    void caseStudyParagraphs;
    void caseStudyPdfLabel;
    void caseStudyPdfUrl;
    void caseStudyDemoLabel;
    findUnique.mockResolvedValue({ content: legacyStoredContent });
    const result = await getPageContent("solutions", SOLUTIONS_CONTENT_DEFAULTS);
    expect(result.caseStudyTitle).toBe(SOLUTIONS_CONTENT_DEFAULTS.caseStudyTitle);
    expect(result.caseStudyParagraphs).toEqual(
      SOLUTIONS_CONTENT_DEFAULTS.caseStudyParagraphs
    );
    expect(result.caseStudyPdfUrl).toBe(SOLUTIONS_CONTENT_DEFAULTS.caseStudyPdfUrl);
  });
```

- [ ] **Step 4: 신규 파일 `src/lib/page-content/solutions.test.ts` 작성 — 금지 표현 회귀**

`src/lib/ax-check/catalog.test.ts`의 `"SAFETY_DOCS_BRANCH_COPY — 금지 표현 회귀 테스트"`와 같은 방식으로 신규 파일 작성:

```typescript
import { describe, expect, it } from "vitest";
import { SOLUTIONS_CONTENT_DEFAULTS } from "./solutions";

const FORBIDDEN_PHRASE = "AI로 위험성평가표를 만들어";
const PERSONAL_TITLES = ["이사", "대표", "부장"];

describe("SOLUTIONS_CONTENT_DEFAULTS.caseStudy* — 금지 표현·화자 회귀 테스트", () => {
  const allCaseStudyText = [
    SOLUTIONS_CONTENT_DEFAULTS.caseStudyEyebrow,
    SOLUTIONS_CONTENT_DEFAULTS.caseStudyTitle,
    ...SOLUTIONS_CONTENT_DEFAULTS.caseStudyParagraphs,
    SOLUTIONS_CONTENT_DEFAULTS.caseStudyPdfLabel,
    SOLUTIONS_CONTENT_DEFAULTS.caseStudyDemoLabel,
  ].join("\n");

  it("정부 KRAS 무료 제공 문구와 겹치는 금지 표현을 포함하지 않는다", () => {
    expect(allCaseStudyText).not.toContain(FORBIDDEN_PHRASE);
  });

  it("화자는 코어디엑스아이이고 개인 직함을 쓰지 않는다", () => {
    expect(allCaseStudyText).toContain("코어디엑스아이");
    for (const title of PERSONAL_TITLES) {
      expect(allCaseStudyText).not.toContain(title);
    }
  });

  it("법령 수치(시행일·과태료)를 인용하지 않는다", () => {
    expect(allCaseStudyText).not.toMatch(/과태료/);
    expect(allCaseStudyText).not.toMatch(/\d+천만\s*원/);
  });
});
```

- [ ] **Step 5: 전체 Vitest 실행**

Run: `npm run test`
Expected: 전체 PASS, 신규·수정 테스트 포함 카운트 증가.

- [ ] **Step 6: 커밋**

```bash
git add src/app/admin/\(panel\)/solutions/actions.test.ts src/lib/page-content.test.ts src/lib/page-content/solutions.test.ts
git commit -m "test: solutions 사례 섹션 검증·병합·금지 표현 회귀 테스트 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Playwright E2E 골든패스

**Files:**
- Test (신규): `e2e/solutions-safety-case.spec.ts`

**Interfaces:**
- Consumes: 프로덕션 빌드/dev 서버에서 서빙되는 `/solutions` 페이지, `SAFETY_DOCS_DEMO_SOURCE = "safety_docs"`(고정값, `catalog.ts`에서 재확인 가능).

- [ ] **Step 1: `e2e/solutions-brochure.spec.ts` 스타일로 신규 스펙 작성**

```typescript
import { expect, test } from "@playwright/test";

/**
 * [홍보팀] `/solutions` AX 사례 섹션(Safety-RAG) 골든패스.
 *
 * (1) `/solutions` 방문 → 사례 섹션 제목이 노출된다.
 * (2) 데모 신청 CTA의 href가 `/contact?source=safety_docs`다(집계 키 회귀 방지).
 * (3) PDF 버튼이 있으면 그 href를 직접 요청해 200 + `application/pdf`를 확인한다.
 *     PDF가 아직 게시되지 않은 상태(caseStudyPdfUrl 빈 문자열)라면 버튼 부재를 확인하고
 *     PDF 검사는 건너뛴다.
 */
test("솔루션 페이지 AX 사례 섹션(Safety-RAG) 골든패스", async ({ page, request }) => {
  await page.goto("/solutions");

  const caseStudyHeading = page.getByRole("heading", {
    name: /Safety-RAG/,
  });
  await expect(caseStudyHeading).toBeVisible();

  const demoLink = page.getByRole("link", { name: /데모 신청/ });
  await expect(demoLink).toBeVisible();
  const demoHref = await demoLink.getAttribute("href");
  expect(demoHref).toBe("/contact?source=safety_docs");

  const pdfLink = page.getByRole("link", { name: /사례.*PDF|PDF.*사례/ });
  const pdfLinkCount = await pdfLink.count();
  if (pdfLinkCount > 0) {
    const href = await pdfLink.first().getAttribute("href");
    expect(href).toBeTruthy();
    const response = await request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"] ?? "").toContain("application/pdf");
  }
});
```

- [ ] **Step 2: E2E 실행**

Run: `npm run test:e2e -- solutions-safety-case`
Expected: PASS.

- [ ] **Step 3: 기존 골든패스 회귀 확인**

Run: `npm run test:e2e -- solutions-brochure`
Run: `npm run test:e2e -- ax-check`
Expected: 둘 다 PASS(Q9 회귀 없음, 소개서 버튼 회귀 없음).

- [ ] **Step 4: 커밋**

```bash
git add e2e/solutions-safety-case.spec.ts
git commit -m "test(e2e): solutions AX 사례 섹션 골든패스 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: 전체 검증 (lint·tsc·전체 테스트)

**Files:** 없음(검증 전용)

- [ ] **Step 1: lint**

Run: `npm run lint`
Expected: 에러 0건.

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 3: 전체 Vitest**

Run: `npm run test`
Expected: 전체 PASS, 실패 0건.

- [ ] **Step 4: 전체 Playwright**

Run: `npm run test:e2e`
Expected: 전체 PASS(기존 골든패스 포함 회귀 없음). 결과에서 통과 개수를 기록해 마지막 보고에 쓴다.

---

## Task 9: 문서 갱신

**Files:**
- Modify: `CONTENT_GUIDE.md`
- Modify: `docs/TODO.md`
- Modify: `docs/PRD.md`
- Modify: `docs/superpowers/plans/2026-09-11-safety-rag-reference-assets-action-plan.md`

**Interfaces:** 없음(문서 전용).

- [ ] **Step 1: `CONTENT_GUIDE.md`에 19번 신설**

`## 18. 소개서 PDF 교체·문구 수정 방법` 섹션이 끝나는 지점(717번째 줄 `### 리드(응답) 확인하기` 앞, 또는 18번 섹션 전체 다음 — 현재 파일 구조상 18번 안에 "리드 확인" 소절이 있으므로, 그 소절이 끝나는 지점 다음)에 추가:

```markdown
## 19. Safety-RAG 사례 섹션 문구·PDF 교체 방법

> **2026-09-15 추가** — `/solutions` 솔루션 카드와 "도입 프로세스" 사이의 "직접 만들어
> 운영해 본 AX 사례 — Safety-RAG" 섹션. 설계·경위:
> `docs/superpowers/plans/2026-09-11-safety-rag-reference-assets-action-plan.md`

- **문구 수정**: 관리자 → 솔루션 관리(`/admin/solutions`)의 "AX 사례 섹션 (Safety-RAG)"
  섹션에서 라벨·제목·본문 문단·PDF 버튼 문구/URL·데모 버튼 문구를 코드 수정 없이 바로
  바꿀 수 있습니다.
- **섹션 전체 숨기기**: "섹션 제목"을 비워 저장하면 `/solutions`에서 섹션 전체가
  사라집니다. 다시 채우면 원래대로 노출됩니다.
- **PDF 버튼만 숨기기**: "사례 PDF URL"만 비워 저장하면 본문·데모 버튼은 그대로 두고
  PDF 버튼만 사라집니다.
- **PDF 파일 자체를 새 버전으로 교체**: 개발팀에 `public/docs/safety-rag-case-study.pdf`
  파일을 새 PDF로 덮어써 달라고 요청해 주세요. 같은 파일명으로 덮어쓰면 URL이 그대로
  유지되므로, `/ax-check` 결과 화면·T1 메일의 "도입 사례 보기(PDF)" 버튼도 함께
  살아 있습니다(세 곳이 같은 URL을 봅니다).
- **데모 신청 버튼**: 링크 대상(`/contact?source=safety_docs`)은 GA4 집계·문의 유형
  분류 키라서 관리자 화면에서 바꿀 수 없고 코드에 고정되어 있습니다. 버튼 문구만
  바꿀 수 있습니다.
- **문구를 고칠 때 지킬 축**:
  - "AI로 위험성평가표를 만들어 드립니다" 금지(정부 KRAS가 무료로 제공하는 서비스와
    겹칩니다).
  - 화자는 항상 "코어디엑스아이", 개인 직함(이사/대표 등)은 쓰지 않습니다.
  - 법령 수치(시행일·과태료)는 사례 PDF에만 두고, 웹 본문(이 섹션)에는 넣지 않습니다.
  - 위 17번 "안전서류 분기(Q9)" 소절과 문구 축이 같습니다 — 함께 참고해 주세요.
```

- [ ] **Step 2: `docs/TODO.md` 헤더·1-B 항목 갱신**

`docs/TODO.md:3`의 헤더:

```diff
-> 최종 업데이트: 2026-09-06
+> 최종 업데이트: 2026-09-15
```

1-B 섹션의 "`/solutions` 재편은 CMS 텍스트 범위 우선" 문장이 있는 줄(121번째 줄) 끝에 이어서 문장 추가:

```diff
-  블로그 1편은 08-31 영업이사 인터뷰 "자주 받는 질문" 기반으로 사용자 + AI 비서가 작성(소싱 정책 16번). ✅ Vercel env(`SALES_NOTIFY_EMAIL` 변경·`SALES_NOTIFY_CC_EMAIL` 신규) 등록·재배포·테스트 리드 1건 제출로 확인 완료(2026-09-06 저녁, 사용자 확인 — 영업이사 메일함 To·기술이사 메일함 Cc 양쪽 정상 수신). ✅ Playwright `ax-check.spec.ts` 재실행 완료(2026-09-06, 위 1-B 항목 참고 — 테스트 코드 노후화 수정 후 PASS)
+  블로그 1편은 08-31 영업이사 인터뷰 "자주 받는 질문" 기반으로 사용자 + AI 비서가 작성(소싱 정책 16번). ✅ Vercel env(`SALES_NOTIFY_EMAIL` 변경·`SALES_NOTIFY_CC_EMAIL` 신규) 등록·재배포·테스트 리드 1건 제출로 확인 완료(2026-09-06 저녁, 사용자 확인 — 영업이사 메일함 To·기술이사 메일함 Cc 양쪽 정상 수신). ✅ Playwright `ax-check.spec.ts` 재실행 완료(2026-09-06, 위 1-B 항목 참고 — 테스트 코드 노후화 수정 후 PASS). **첫 조각 = Safety-RAG 사례 섹션 ✅ 2026-09-15(커밋 해시는 PR 참고)** — 사례 PDF 웹 게시본 v1.1 `public/docs/safety-rag-case-study.pdf` 게시 완료, Vercel env(`AX_CHECK_SAFETY_CASE_STUDY_URL`) 등록은 사용자 몫(배포 후). 09-10 Q9 항목 반영일은 2026-09-11 노션 기록 완료.
```

(PDF가 이미 게시되어 있으므로 "코드 준비 완료, 파일 대기" 문구는 쓰지 않는다.)

- [ ] **Step 3: `docs/PRD.md` 세 곳에 한 구절씩 추가**

`docs/PRD.md:69`(5-1 솔루션 페이지 행) 끝에 이어서:

```diff
-| 솔루션 | `/solutions` | AI 협업 자동화·AX 컨설팅·엔터프라이즈 AI 플랫폼 3종 카드, 4단계 도입 프로세스, AX 컨설팅 카드에 소개서 PDF 다운로드 버튼(CMS 편집 가능, 2026-09-03). **2026-09 재편 예정(Phase 1.5 2단계)**: "중소기업 AI 도입·AX 전환 컨설팅" 단일 오퍼 — 진단→설계→구축→교육 4단계 + 대상 업종 블록 + AX 체크 CTA |
+| 솔루션 | `/solutions` | AI 협업 자동화·AX 컨설팅·엔터프라이즈 AI 플랫폼 3종 카드, 4단계 도입 프로세스, AX 컨설팅 카드에 소개서 PDF 다운로드 버튼(CMS 편집 가능, 2026-09-03), 카드 섹션과 프로세스 섹션 사이 Safety-RAG 사례 섹션(CMS 편집, 사례 PDF·10분 데모 CTA, 2026-09-15). **2026-09 재편 예정(Phase 1.5 2단계)**: "중소기업 AI 도입·AX 전환 컨설팅" 단일 오퍼 — 진단→설계→구축→교육 4단계 + 대상 업종 블록 + AX 체크 CTA |
```

`docs/PRD.md:70`(AX 체크 행) 끝에 이어서:

```diff
-| AX 체크(인터뷰 깔때기) | `/ax-check` | **신규(Phase 1.5 1단계, 2026-09-05 목표)** 8문항 전부 선택지·3분 질문지, 상단 컨설팅 소개 인트로, `?ref=` 영업이사 식별, 제출 즉시 화면에 "AX 우선 과제 3가지"(규칙 기반, 업종 예시·3단계 로드맵 포함). **팔로업 메일 자동 발송(2026-09-02 결정, 8/30 수동 발송 대체)**: 제출 즉시 결과 요약 메일(T0) + 영업일 기준 D+2 09:30 KST 상세 진단 메일(T1, Vercel Cron) — 관리자가 발송 전 보류·수정·즉시 발송 가능, 영업이사는 HOT 리드 통화만. 선택 동의 시 뉴스레터 구독 연동. 설계: `docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md`, `docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md`(인트로·피드백), `docs/superpowers/specs/2026-09-02-ax-check-auto-followup-design.md`(자동 팔로업) |
+| AX 체크(인터뷰 깔때기) | `/ax-check` | **신규(Phase 1.5 1단계, 2026-09-05 목표)** 8문항 전부 선택지·3분 질문지, 상단 컨설팅 소개 인트로, `?ref=` 영업이사 식별, 제출 즉시 화면에 "AX 우선 과제 3가지"(규칙 기반, 업종 예시·3단계 로드맵 포함). **팔로업 메일 자동 발송(2026-09-02 결정, 8/30 수동 발송 대체)**: 제출 즉시 결과 요약 메일(T0) + 영업일 기준 D+2 09:30 KST 상세 진단 메일(T1, Vercel Cron) — 관리자가 발송 전 보류·수정·즉시 발송 가능, 영업이사는 HOT 리드 통화만. 선택 동의 시 뉴스레터 구독 연동. Q9 안전서류 작성 시간 문항 + 월 4시간 이상 분기(2026-09-10) — 결과 화면·T1 메일에 Safety-RAG 사례 PDF·10분 데모 CTA 노출. 설계: `docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md`, `docs/superpowers/specs/2026-08-30-ax-check-experience-upgrade-design.md`(인트로·피드백), `docs/superpowers/specs/2026-09-02-ax-check-auto-followup-design.md`(자동 팔로업) |
```

`docs/PRD.md:103`(5-3 솔루션 편집 행) 끝에 이어서:

```diff
-| 솔루션 편집 | `/admin/solutions` | ✅ 완료 | 히어로·솔루션 카드 3종·프로세스 4단계·CTA·소개서 다운로드 버튼 문구/URL 편집 (`PageContent`). 카드 개수·순서 등 구조 편집은 범위 밖(3번 결정 완료 항목 참고) |
+| 솔루션 편집 | `/admin/solutions` | ✅ 완료 | 히어로·솔루션 카드 3종·프로세스 4단계·CTA·소개서 다운로드 버튼 문구/URL·AX 사례 섹션(Safety-RAG) 문구·PDF URL 편집 (`PageContent`). 카드 개수·순서 등 구조 편집은 범위 밖(3번 결정 완료 항목 참고) |
```

- [ ] **Step 4: 액션 플랜 7절 체크 표시**

`docs/superpowers/plans/2026-09-11-safety-rag-reference-assets-action-plan.md`의 7절 표에서 `⬜ P2에서 Claude Code`/`⬜ P2` 3곳을 커밋 후 실제 커밋 해시로 교체(예: `✅ 2026-09-15 (abc1234)`).

- [ ] **Step 5: 커밋**

```bash
git add CONTENT_GUIDE.md docs/TODO.md docs/PRD.md docs/superpowers/plans/2026-09-11-safety-rag-reference-assets-action-plan.md
git commit -m "docs: CONTENT_GUIDE 19번·TODO·PRD에 Safety-RAG 사례 섹션 반영

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: PR 생성

**Files:** 없음

- [ ] **Step 1: 최종 전체 검증 재실행**

Run: `npm run lint && npx tsc --noEmit && npm run test && npm run test:e2e`
Expected: 전부 PASS. 실패 시 여기서 멈추고 원인 수정 후 재실행(커밋 추가).

- [ ] **Step 2: 원격 브랜치 push**

```bash
git push -u origin feat/solutions-safety-case-section
```

- [ ] **Step 3: PR 생성**

```bash
gh pr create --base main \
  --title "feat: /solutions Safety-RAG 사례 섹션 + 사례 PDF 게시 (Phase 1.5 2단계 보강 · Safety-RAG 레퍼런스 자산 반영)" \
  --body "$(cat <<'EOF'
## 변경 요약
- `public/docs/safety-rag-case-study.pdf` 게시(웹 게시본 v1.1, 73KB)
- `/solutions` 카드 섹션과 도입 프로세스 섹션 사이에 "직접 만들어 운영해 본 AX 사례 — Safety-RAG" 섹션 추가(CMS 편집 가능)
- `/admin/solutions`에 "AX 사례 섹션 (Safety-RAG)" 편집 폼 추가
- `ax-check` 결과 화면·T1 메일의 "도입 사례 보기(PDF)" 버튼은 Vercel 환경변수 등록 후 살아남(아래 체크리스트)

## 스크린샷
(데스크톱·모바일 1장씩, Vercel Preview URL에서 캡처해 첨부)

## 배포 후 사용자 체크리스트
- [ ] Vercel Production/Preview에 `AX_CHECK_SAFETY_CASE_STUDY_URL=https://www.coredxi.com/docs/safety-rag-case-study.pdf` 등록 후 재배포
- [ ] 프로덕션 `/docs/safety-rag-case-study.pdf` 200 확인
- [ ] `/ax-check?ref=internal-test`에서 Q9 "월 16시간 이상" 제출 → 결과 화면에 사례 PDF·데모 버튼 2개 노출 확인
- [ ] `/admin/leads` Q9 집계 반영 확인 → 테스트 리드 삭제
- [ ] GA4 실시간에서 `cta_click` / `cta_location=solutions_safety_demo` 수신 확인
- [ ] 보류 중인 T1 초안이 있으면 `/admin/leads`에서 다시 열어 저장(환경변수 등록 전 저장본엔 PDF 링크가 없을 수 있음)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL 출력됨. **main에 병합하지 않는다.**

- [ ] **Step 4: 마지막 보고 작성**

다음 5개 항목만 간결하게 정리해 보고한다: 변경 파일 목록 / PDF 포함 여부(수령됨) / 테스트 결과(lint·tsc·vitest 개수·E2E) / PR URL·Preview URL / 사용자가 해야 할 배포 후 체크리스트.

---

## 하지 않을 것 (재확인)

솔루션 카드 개수·순서·구조 변경, 단일 오퍼 재편, 소개자료 10p PDF 게시, 가격(380/480만원) 노출, `/cases` 성공사례 등록, `catalog.ts` 분기 문구·임계값 수정, 퍼널 계산 로직 변경, 새 이벤트 분석 SDK, DB 마이그레이션, `@tiptap/*` 등 의존성 변경, `/solutions` 메타 description 변경, main 병합.
