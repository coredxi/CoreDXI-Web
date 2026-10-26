# 블로그 → AX 체크 유입 측정·카테고리 정리 설계 메모 (2026-10-26)

> 블로그 콘텐츠 재건 트랙(2026-10-26 착수, 8주)의 첫 코드 작업. 상시 콘텐츠 운영(Phase 1 DoD 미포함).
> 목적: 영업 링크·블로그 유입이 3분 AX 체크 응답으로 이어지는지 ref 코드로 측정하고, 빈 카테고리로 사이트가 비어 보이는 문제를 줄인다.
> 새 기능 동결 게이트(2026-09-06)와 충돌하지 않도록 측정 장치·표시 정리로 범위를 한정한다. **DB 스키마 변경 없음.**

## 1. 사전 조사 결과 (0단계)

| # | 항목 | 결과 |
|---|---|---|
| 1 | `/ax-check` ref 흐름 | `page.tsx`가 `searchParams.ref`(배열이면 첫 값)를 `AxCheckForm`에 prop으로 전달 → `submitAxCheck`가 `trim()`만 해서 `AxCheckResponse.refCode`에 저장(형식 검증·길이 제한 없음). `/admin/leads`는 목록·상세·CSV에 ref를 **표시만** 하고 ref별 필터·집계는 없었음. GA4 `ax_check_submit`의 `source` 파라미터로도 ref 전송 |
| 2 | 진행 표시 "1 / 10" | 인트로가 아니라 **9문항 + 연락처·동의 1단계**가 분모(`TOTAL_STEPS = 문항 수 + 1`). 실제 질문은 9개 |
| 3 | 블로그 카테고리 목록 | `BlogCategory` 테이블(CMS `/admin/blog/topics`)에서 `listBlogCategories()`로 조회, 공개 블로그·관리자 화면이 같은 함수 사용. 카테고리별 공개 글 수는 계산하지 않았음 |
| 4 | `/cases` 샘플 의심 사례 | 시드 파일·스크립트에 해당 문구 없음 → 관리자 CMS(`/admin/portfolio`)에서 입력된 데이터. **`Portfolio` 모델에 공개/비공개 필드가 없음**(목록 조회는 전체 반환) |
| 5 | GA4 커스텀 이벤트 | `cta_click`(`cta_location`) / `contact_submit` / `newsletter_subscribe`(`source`) / `scroll_depth`(`percent`) / `ax_check_submit`(`source`=ref) 5종 |

## 2. ref 측정 장치

### 2-1. 블로그 CTA ref 자동 부여
- `withBlogRef(href, slug)` — 상대경로 또는 `coredxi.com`/`www.coredxi.com` 호스트의 `/ax-check`(경로 정확히 일치, `/ax-check/result/*` 제외) 링크에 `ref`가 없으면 `ref=blog-{slug}`를 붙인다. 작성자가 넣은 `ref`·외부 링크는 그대로.
- 적용 위치: 본문 HTML 렌더(`blogContentToHtml(content, { blogSlug })`, 서버 렌더 시점 변환 — DB 원문은 바꾸지 않음) + 하단 CTA(`BlogPostCta`).
- **하단 CTA 변경**: 기존 "문의하기(/contact)" → "3분 AX 체크 시작하기(/ax-check?ref=blog-{slug})". PRD의 "블로그 글의 단일 CTA는 3분 AX 체크" 요구사항에 맞춤. GA4 `cta_location=blog_post_bottom`은 유지.

### 2-2. 첫 방문 ref 유지
- 저장소: **`sessionStorage`(탭 단위)**, 키 `coredxi:first-ref`. 쿠키를 쓰지 않으므로 서버로 전송되지 않고 탭을 닫으면 사라짐 → 개인정보처리방침 영향 없음(식별자가 아닌 캠페인 코드만 보관).
- `FirstRefCapture`(루트 layout에 1회 마운트, 렌더 없음)가 경로 변경 시 `?ref=`를 읽어 **최초 1회만** 보관(이후 다른 ref로 덮어쓰지 않음, `/admin` 제외).
- `AxCheckForm` 우선순위: **URL의 ref > 세션 보관 ref**. 저장소 접근은 모두 try/catch — 실패해도 ref 없이(direct) 정상 진행.
- **예외(2026-10-26 후속)**: URL ref가 블로그 CTA 자동 ref(`blog-*`)이고 세션에 최초 유입 ref가 있으면 최초 ref를 우선한다(영업 링크 → 블로그 → CTA 경로를 영업 성과로 집계). 최초 ref가 없을 때만 `blog-*`, 사람이 직접 넣은 `blog-*` 외 URL ref는 그대로 URL 우선.
- CSP: 인라인 스크립트 추가 없음(클라이언트 컴포넌트의 `useEffect`만 사용).

### 2-3. ref 검증
- 기존 허용 패턴이 없었으므로 신규 정의: `^[a-z0-9-]{1,80}$`(입력은 trim + 소문자화 후 검사).
- 프롬프트 기본값 40자 대신 **80자**: 블로그 slug가 최대 72자(+중복 접미사 `-n`)라 `blog-` 접두어를 붙이면 40자를 넘는다. `blogRefCode()`는 80자로 자르고 끝 하이픈을 정리해 항상 유효한 값을 만든다.
- 서버 `submitAxCheck`도 같은 함수로 정규화 — 패턴에 맞지 않는 ref는 `null`(direct)로 저장. 기존 사용 ref(`sales-kim`, `newsletter`, `internal-test`, `e2e` 등)는 모두 패턴에 맞음.

### 2-4. `/admin/leads` ref 필터
- 새 페이지·테이블 없이 기존 목록 위에 select 1개: 전체 / 블로그 전체(`blog-*`) / ref 없음 / 개별 ref(건수 내림차순), 각 건수 표시. CSV 내보내기는 기존대로 전체 리드.

## 3. 빈 카테고리 숨김 (A안, 2026-10-26 사용자 결정)
- `listPublicBlogCategories()` — `_count.posts(where: PUBLISHED)`가 0인 카테고리를 공개 블로그 사이드바에서 제외.
- 관리자 CMS는 기존 `listBlogCategories()` 그대로(전체 표시). 직접 URL `/blog/category/{slug}`는 기존 빈 상태 화면 유지(404 아님).
- 사이트맵(`sitemap.ts`)도 같은 `listPublicBlogCategories()`로 빈 카테고리 제외(2026-10-26 후속).

## 4. `/cases` 샘플 사례 — 사용자가 관리자 화면에서 직접 삭제(2026-10-26 결정)
- `Portfolio`에 공개 여부 컬럼이 없어 **스키마 변경 없이 "삭제가 아닌 비공개"를 구현할 방법이 없음**. 관리자 화면에도 공개 토글 없음 → 실행할 UPDATE SQL도 없음.
- `Portfolio.isPublished` 컬럼은 "실제 사례 첫 등록 시" 도입하는 백로그로 둔다(TODO 1-C).
- 공개 사례가 0건이 되면: `/cases`는 "등록된 성공사례가 없습니다." 빈 상태 카드 표시(깨지지 않음), 홈의 성공사례 미리보기(`CasesPreview`)는 섹션 자체가 숨겨짐. 상단 메뉴·`/solutions`의 "성공사례 보기"는 빈 상태 페이지로 연결됨.

## 5. AX 체크 진행 표시
- 분모가 "문항 9 + 연락처 1"이었으므로(인트로 아님) 질문 단계는 "질문 n / 9", 연락처 단계는 "마지막 단계"로 표기. 진행 바 비율은 기존 10단계 기준 유지. 안내 문구("3분, 9개 질문")는 변경 없음.

## 6. 테스트
- Vitest: `src/lib/ax-check/ref.test.ts`(검증·우선순위·저장소 실패·blog ref·링크 변환·필터), `src/lib/blog-content-html.test.ts`(본문 링크 ref 부여), `src/lib/blog-categories.test.ts`(빈 카테고리 필터).
- Playwright: `e2e/blog-attribution.spec.ts` — `/blog/{slug}` → CTA 클릭 → `/ax-check?ref=blog-{slug}` 및 hidden input 반영, `/?ref=internal-test` → `/ax-check` 세션 ref 유지. 제출하지 않으므로 리드 데이터 생성 없음.
