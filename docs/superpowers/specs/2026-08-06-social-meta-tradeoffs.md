# 소셜 메타태그(OG/Twitter Card) 강화 — 트레이드오프 문서

> 작성일: 2026-08-06
> 목적: **Claude Code 구현 세션용 핸드오프 문서.** 각 설계 지점의 대안·트레이드오프·확정 결정을 정리해, 구현 중 재질문 없이 진행할 수 있도록 한다.
> 짝 문서: `docs/superpowers/specs/2026-08-06-social-meta-design.md` (설계·WBS·DoD) — 이 문서와 결정이 충돌하면 **이 문서(트레이드오프)가 우선**
> 선행 문서: `docs/superpowers/plans/2026-08-05-phase1-remaining-action-plan.md`

---

## 0. 구현 시 반드시 지킬 프로젝트 제약 (요약)

- 스키마 변경 없음 → Prisma 마이그레이션 이슈 해당 없음 (만약 범위가 확장돼 스키마를 건드리게 되면 **`prisma migrate dev` 절대 금지**, 수동 `migration.sql` + `prisma migrate deploy`)
- 커밋: Conventional Commits (`feat:`/`fix:`/`test:`/`docs:`) — post-commit 훅이 Notion Tasks에 자동 기록
- `@tiptap/*`는 `3.13.0` 고정 — 이번 작업과 무관, 버전 건드리지 말 것
- 테스트: Vitest 유닛 + Playwright E2E 골든패스 유지 (기존 101개 테스트 깨지지 않아야 함)
- 외부 URL 처리: `src/lib/url-safety.ts` 패턴 준수 (SSRF 방지)
- CSP nonce·Sentry 20% 샘플링: 신규 HTML 라우트 없음 → 추가 설정 불필요 (단, 기존 정책을 깨지 말 것)
- 개발 서버: 포트 3100 (`pnpm dev`)

---

## 1. 결정 요약표 (Claude Code는 이 표만 봐도 착수 가능)

| # | 결정 지점 | 확정안 | 상태 |
|---|-----------|--------|------|
| T1 | OG 이미지 전략 | 커버 합성형 (커버 없으면 배지형 폴백) | ✅ 확정 (2026-08-06, 사용자) |
| T2 | 파일 기반 vs config 기반 이미지 충돌 | 파일 기반(`opengraph-image.tsx`)으로 일원화, `generateMetadata()`의 images 지정 제거 | ✅ 확정 |
| T3 | `twitter:image` 처리 | 명시하지 않고 `og:image` 크롤러 폴백에 위임 | ✅ 확정 |
| T4 | 배경 이미지 로드 방식 | 서버에서 fetch → ArrayBuffer(data URI) 임베드, 실패 시 배지형 폴백 | ✅ 확정 |
| T5 | 배경 URL 검증 범위 | `https:` + 자사 Supabase Storage 호스트 화이트리스트 | ✅ 확정 |
| T6 | canonical 상속 버그 해결 | `/privacy`·`/terms`에 `pageMetadata()` 추가 + 전역 canonical은 유지 | ✅ 확정 |
| T7 | 런타임 | `nodejs` 유지 | ✅ 확정 |
| T8 | alt 텍스트 | `generateImageMetadata`로 글 제목 기반 동적 alt | ✅ 확정 |
| T9 | `twitter:site` 핸들 | **기본: 추가하지 않음.** 마케팅팀이 X 계정을 확인해주면 후속 커밋으로 추가 | ⏸️ 보류 (블로커 아님) |
| T10 | 테스트 전략 | 합성/폴백 판단 로직을 순수 함수로 분리해 유닛 테스트 + E2E 1개 | ✅ 확정 |

---

## 2. 트레이드오프 상세

### T1. OG 이미지 전략

| 대안 | 장점 | 단점 |
|------|------|------|
| A. 배지형 템플릿 유지 | 구현 0, 브랜드 일관성, 렌더 비용 최소 | 모든 글이 같은 룩 → 피드에서 구분 안 됨, 클릭률 개선 여지 없음. TODO의 "커스텀 이미지" 목표 미달 |
| B. 커버 원본을 그대로 og:image로 | 구현 작음(파일 규약 제거만) | 비율 제각각(1200×630 미보장 → 카카오/X에서 크롭 왜곡), 브랜드 요소 없음, 텍스트 없는 이미지면 맥락 전달 실패 |
| **C. 커버 합성형 (확정)** | 1200×630 보장 + 브랜드 일관성 + 글별 차별화, 커버 없는 글도 배지형으로 안전 | 렌더 비용 증가(이미지 fetch), 실패 폴백 로직 필요, 구현 공수 최대 |

**결정: C.** 근거 — 목표가 공유 클릭률 개선이고, B의 비율 왜곡은 주 채널인 카카오톡에서 치명적. 비용 리스크는 T4의 폴백으로 흡수.

### T2. 파일 기반 vs config 기반 이미지 충돌 해소

현황: `blog/[slug]`·`cases/[slug]`에 `opengraph-image.tsx`(파일)와 `generateMetadata().openGraph.images`(config)가 **둘 다** 존재. Next.js는 파일 기반이 우선하므로 config의 커버 지정은 사실상 죽은 코드이고, `twitter:image`(config)와 `og:image`(파일)가 서로 다른 이미지를 가리키는 불일치 상태.

| 대안 | 장점 | 단점 |
|------|------|------|
| A. 파일 삭제, config로 커버 직접 지정 | 코드 단순 | = T1-B의 단점 전부 + 커버 없는 글의 폴백 이미지를 별도 관리해야 함 |
| **B. 파일 기반으로 일원화 (확정)** | 우선순위 규칙과 싸우지 않음, alt/size/contentType 규약 제공, 커버 유무 분기가 한 곳에 모임 | opengraph-image에서 DB 조회 중복(1회 추가 쿼리) |
| C. 현상 유지 + 문서화만 | 공수 0 | 불일치 방치 — 목표 미달 |

**결정: B.** `generateMetadata()`에서 `openGraph.images`·`twitter.images` 지정을 **제거**하고, 이미지는 각 라우트의 `opengraph-image.tsx`가 단독 책임진다. DB 조회 1회 추가는 ISR 캐싱으로 상쇄.

⚠️ 구현 주의: `src/lib/seo.ts`의 `pageMetadata()`는 목록/정적 페이지용으로 `DEFAULT_OG_IMAGE`를 계속 지정한다 — 이들 라우트에는 파일 기반 이미지가 없으므로(루트 제외) 건드리지 말 것. 제거 대상은 `blog/[slug]/page.tsx`와 `cases/[slug]/page.tsx`의 images 지정뿐이다.

### T3. `twitter:image` 명시 여부

| 대안 | 장점 | 단점 |
|------|------|------|
| A. `twitter-image.tsx` 파일 규약 추가 | 명시적 | 동일 이미지를 두 라우트로 이중 생성(렌더 비용 2배), 유지보수 지점 2배 |
| **B. 미지정 → og:image 폴백 (확정)** | X·카카오·LinkedIn·FB 모두 og:image 폴백 지원, 단일 소스 보장 | 폴백 동작에 의존 (실채널 검증으로 커버) |

**결정: B.** `twitter.card: summary_large_image`는 유지(전역 + 페이지), images만 미지정.

### T4. 배경 이미지 로드 방식 (`og-image.tsx` 내부)

| 대안 | 장점 | 단점 |
|------|------|------|
| A. `<img src={외부URL}>`로 satori에 위임 | 코드 최소 | 실패 제어 불가 — 이미지 fetch 실패 시 OG 라우트 전체가 500 → **공유 카드 자체가 깨짐** (최악 시나리오) |
| **B. 사전 fetch → data URI 임베드 (확정)** | try/catch로 실패 시 배지형 폴백 가능, 타임아웃(예: 3초) 직접 제어, 비이미지 응답 거부 가능 | 코드 증가, 메모리에 이미지 적재 |

**결정: B.** OG 이미지는 "항상 뭐라도 나가는 것"이 최우선. fetch 실패·타임아웃·`content-type`이 `image/*` 아님 → 모두 배지형 폴백.

### T5. 배경 URL 검증 범위

| 대안 | 장점 | 단점 |
|------|------|------|
| A. `https:`만 검증 | 유연 | 관리자 계정 탈취 시 내부망 URL을 OG 라우트가 서버사이드 fetch하는 SSRF 벡터 |
| **B. https + Supabase Storage 호스트 화이트리스트 (확정)** | SSRF 원천 차단, 기존 `url-safety.ts` 철학과 일치 | 외부 CDN 커버를 쓰게 되면 화이트리스트 갱신 필요 |

**결정: B.** 허용 호스트는 `NEXT_PUBLIC_SUPABASE_URL`에서 파생(하드코딩 금지). 검증 실패 → 배지형 폴백 (에러 아님). 검증 함수는 `url-safety.ts`에 추가하거나 인접 모듈로 분리해 **유닛 테스트 필수**.

### T6. canonical 상속 버그 (`/privacy`·`/terms` → 홈 canonical)

| 대안 | 장점 | 단점 |
|------|------|------|
| A. layout 전역 `alternates.canonical` 제거 | 상속 버그 원천 제거 | 홈(`/`)이 canonical을 잃음 → 홈에 별도 metadata 추가 필요, 변경 반경 큼 |
| **B. 두 페이지에 `pageMetadata()` 추가 (확정)** | 변경 최소, title/description 부재(G4)도 동시 해소 | 전역 canonical이 남아 있어 미래에 metadata 없는 공개 페이지를 추가하면 같은 버그 재발 가능 |

**결정: B** + 재발 방지로 코드 주석 한 줄(layout.tsx canonical 옆에 "새 공개 페이지는 반드시 pageMetadata() 사용") 추가. `/login`·`/signup`은 공유 대상이 아니므로 이번 범위 제외.

### T7. 런타임 (edge vs nodejs)

Prisma 조회가 필요하고 기존 파일들이 이미 `runtime = "nodejs"` — **변경 없음**. edge 전환은 성능 이득보다 Prisma 호환 리스크가 큼.

### T8. alt 텍스트

정적 `export const alt`는 라우트당 고정 문자열이라 글 제목 반영 불가 → **`generateImageMetadata`** 사용해 `alt: post.title` 형태로 동적 생성. 폴백 시에도 alt는 유지.

### T9. `twitter:site` 핸들 — ⏸️ 유일한 보류 항목

회사 공식 X 계정 보유 여부 미확인 (마케팅팀 확인 대기). **구현 블로커 아님** — 기본값은 "추가하지 않음"으로 진행하고, 계정이 확인되면 `layout.tsx` 전역 twitter에 `site: "@핸들"` 한 줄 추가하는 후속 `feat:` 커밋으로 처리. 이 항목 때문에 작업을 멈추지 말 것.

### T10. 테스트 전략

`ImageResponse` 자체는 픽셀 스냅샷 테스트 비용이 높음 → **판단 로직과 렌더를 분리**한다.

- 유닛 (Vitest): ① 배경 URL 검증 함수(허용/차단 케이스), ② "합성 vs 배지" 분기 결정 함수(URL 유무·fetch 결과 주입), ③ 기존 `seo.test.ts` 회귀(blog/cases에서 images 제거 후에도 pageMetadata 폴백 동작 유지)
- E2E (Playwright) 1개: 블로그 상세 `<head>`에 `og:title`·`og:image`·`twitter:card` 존재 + `og:image` URL GET → 200 & `image/png`
- 수동 (배포 후): 프로덕션 view-source로 G1 최종 확인 → 카카오 공유 디버거(캐시 초기화 필수) → X/FB/LinkedIn 디버거 → 실기기 카카오톡 3종 URL(홈/블로그 글/성공사례)

---

## 3. 변경 파일 목록 (예상)

| 파일 | 변경 |
|------|------|
| `src/lib/og-image.tsx` | `backgroundImageUrl` 옵션 + fetch/폴백 로직 (판단 로직은 순수 함수로 분리) |
| `src/lib/url-safety.ts` (또는 인접 신규 모듈) | OG 배경 URL 화이트리스트 검증 함수 |
| `src/app/blog/[slug]/opengraph-image.tsx` | `coverImageUrl` 조회 + 합성형 렌더 + `generateImageMetadata` |
| `src/app/cases/[slug]/opengraph-image.tsx` | `thumbnailUrl` 조회 + 합성형 렌더 + `generateImageMetadata` |
| `src/app/blog/[slug]/page.tsx` | `openGraph.images`·`twitter.images` 지정 제거 |
| `src/app/cases/[slug]/page.tsx` | 동일 |
| `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` | `pageMetadata()` 적용 |
| `src/app/layout.tsx` | canonical 재발 방지 주석 (+ T9 확정 시 twitter.site) |
| `src/lib/seo.test.ts` 등 | 유닛 테스트 추가/갱신 |
| `e2e/` | 소셜 메타 골든패스 1개 |
| `CONTENT_GUIDE.md` | 커버 이미지 = 공유 미리보기 배경 안내 (권장: 가로형, 1200×630 이상, 핵심 피사체 중앙) |
| `docs/TODO.md` | 완료 시 🚧 → ✅ |

**건드리지 말 것**: `src/lib/seo.ts`의 `pageMetadata()` 이미지 폴백 로직(목록/정적 페이지용), `prisma/schema.prisma`, CSP 설정(`src/lib/csp.ts`), Tiptap 관련 일체.

---

## 4. 커밋 계획

1. `feat: OG 이미지 커버 합성 및 소셜 메타 일원화` — T1·T2·T3·T4·T5·T7·T8
2. `fix: 정적 페이지 canonical 및 소셜 메타 보완` — T6
3. `test: 소셜 메타태그 검증 테스트 추가` — T10
4. `docs: CONTENT_GUIDE 커버 이미지 공유 미리보기 안내 추가` — 문서 마감 (TODO.md ✅ 포함)

각 커밋 전 `lint` + `tsc` + `vitest` 통과 확인. 완료 기준은 설계 문서 5번(DoD) 참고.
