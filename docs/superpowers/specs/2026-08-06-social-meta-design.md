# 소셜 메타태그(OG/Twitter Card) 강화 설계

> 작성일: 2026-08-06
> 상태: 🚧 착수 (Phase 1 잔여 항목 중 1순위)
> 선행 문서: `docs/superpowers/plans/2026-08-05-phase1-remaining-action-plan.md` (착수 순서 근거)
> 관련 규칙: `docs/PRD.md` 5-5, `docs/TODO.md` 4번, CSP/보안 가이드(`src/lib/csp.ts`, `src/lib/url-safety.ts`)

---

## 1. 목표

카카오톡·X(Twitter)·LinkedIn·Facebook·네이버 등에 링크 공유 시 **콘텐츠별 맞춤 미리보기 카드**(제목·설명·이미지)가 일관되게 렌더링되도록 하여 공유 클릭률(CTR)을 개선한다. 한국 B2B 특성상 **카카오톡 미리보기**가 최우선 검증 채널이다.

**확정된 방향 (2026-08-06 결정)**: 블로그 커버 이미지·성공사례 썸네일을 배경으로 합성한 1200×630 OG 카드 생성 (커버 없으면 기존 배지형 템플릿 폴백).

---

## 2. 현행 감사 결과 (2026-08-06 코드 기준)

### 이미 구현된 것

| 영역 | 구현 내용 |
|------|-----------|
| 전역 기본값 | `src/app/layout.tsx` — OG(`type/locale/siteName/title/description`) + `twitter.card: summary_large_image` + `metadataBase` + 네이버 서치어드바이저 메타 |
| 페이지별 메타 | `src/lib/seo.ts`의 `pageMetadata()` — `/about`, `/solutions`, `/contact`, `/blog`, `/cases` 목록 페이지에 title/description/canonical/OG/Twitter 적용 완료 |
| 동적 메타 | `blog/[slug]`(article + publishedTime + coverImageUrl), `cases/[slug]`(article + thumbnailUrl), `blog/category/[slug]`의 `generateMetadata()` |
| 동적 OG 이미지 | `src/lib/og-image.tsx` + 루트/`blog/[slug]`/`cases/[slug]`의 `opengraph-image.tsx` — 브랜드 배지형 1200×630 카드 |
| 기타 | JSON-LD(Organization/BlogPosting/CaseStudy/Breadcrumb/FAQ), `sitemap.ts`, `robots.ts` |

→ 이번 작업의 성격은 "신규 구현"이 아니라 **"우선순위 충돌 해소 + 이미지 합성 고도화 + 실채널 검증"**이다.

### 발견된 갭

| ID | 우선순위 | 내용 |
|----|----------|------|
| **G1** | **P0** | Next.js는 **파일 기반 메타데이터(`opengraph-image.tsx`)가 config 기반(`openGraph.images`)보다 우선**한다. `blog/[slug]`·`cases/[slug]`는 둘 다 존재하므로, `generateMetadata()`에 넣은 커버/썸네일이 무시되고 항상 배지형 텍스트 카드가 `og:image`로 나갈 가능성이 높음. 또한 `twitter:image`(config, 커버)와 `og:image`(파일, 배지)가 **서로 다른 이미지**가 되어 채널별 미리보기가 불일치할 수 있음. → 착수 시 프로덕션 view-source로 최종 확인 |
| **G2** | P1 | 커버가 나가더라도 원본 비율 그대로(1200×630 보장 안 됨), `og:image:alt`·width/height 누락 |
| **G3** | P1 | `layout.tsx`의 `alternates.canonical: SITE_URL`이 페이지별 metadata가 없는 라우트에 상속 → **`/privacy`·`/terms`의 canonical이 홈(`https://www.coredxi.com`)으로 잘못 지정**됨 |
| **G4** | P2 | `/privacy`, `/terms`에 페이지별 title/description 없음 (전역 기본값 사용) |
| **G5** | P2 | `twitter:site`/`twitter:creator` 핸들 없음(회사 X 계정 보유 여부 확인 필요), `og:image` alt 부재 |
| **G6** | P2 | 카카오톡·X·LinkedIn·Facebook 실채널 렌더링 검증 이력 없음 (카카오는 OG 캐시가 강해 갱신 후 캐시 초기화 필요) |

---

## 3. 설계

### 3-1. OG 이미지 커버 합성 — `src/lib/og-image.tsx` 확장

```
createOgImageResponse({ badge, title, subtitle, footer, backgroundImageUrl? })
```

- `backgroundImageUrl` 있을 때: 배경 이미지(1200×630 object-fit cover) 위에 **어두운 그라데이션 오버레이**(하단 진하게 → 상단 옅게, 예: `rgba(15,23,42,0.88)` → `rgba(15,23,42,0.35)`)를 깔고 기존 로고·제목·부제 레이아웃 유지 → 흰색 텍스트 가독성(WCAG AA 대비) 확보
- 없거나 로드 실패 시: **현행 배지형 그대로 폴백** (동작 변화 없음)
- 배경 이미지 fetch는 서버사이드에서 try/catch — 타임아웃·404·비이미지 응답 시 예외를 삼키고 배지형 반환 (OG 이미지 라우트가 500을 반환하면 공유 카드 자체가 깨지므로 폴백이 필수)
- **URL 검증 (가이드라인 5-4 준수)**: `coverImageUrl`/`thumbnailUrl`은 관리자 입력값이므로 `src/lib/url-safety.ts` 패턴을 따라 `https:` + 허용 호스트(자사 Supabase Storage 도메인, 필요 시 화이트리스트 상수) 검증 후에만 fetch. 검증 실패 시 배지형 폴백
- `runtime = "nodejs"` 유지 (Prisma 조회 때문), 폰트·레이아웃 변경 없음

### 3-2. 메타데이터 일원화 (G1 해소)

- `blog/[slug]/opengraph-image.tsx`: `coverImageUrl`도 함께 조회해 합성형 렌더
- `cases/[slug]/opengraph-image.tsx`: `thumbnailUrl` 조회해 합성형 렌더
- `generateMetadata()`의 `openGraph.images`/`twitter.images`에서 **커버 직접 지정 제거** → 파일 기반 이미지 하나로 일원화. `twitter:image` 미지정 시 크롤러가 `og:image`로 폴백하므로 모든 채널에서 동일 카드 보장
- alt: 파일 규약의 `generateImageMetadata`(또는 정적 `alt` export 개선)로 글 제목 기반 alt 제공

### 3-3. 부속 수정 (G3~G5)

- `/privacy`, `/terms`에 `pageMetadata()` 적용 (title/description/canonical) → G3·G4 동시 해소
- `layout.tsx`의 전역 `alternates.canonical`은 홈 전용이므로, 홈 canonical을 유지하면서 잘못된 상속이 남지 않는지 확인 (모든 공개 라우트가 자체 canonical을 갖게 되면 유지해도 무해)
- `twitter:site` 핸들: **회사 X 계정 보유 여부 마케팅팀 확인 후** 있으면 layout 전역 추가, 없으면 생략 (열린 질문 ①)

### 3-4. 테스트 (기존 스택 유지)

- **Vitest**: `seo.test.ts` 확장 — 이미지 미지정 시 DEFAULT_OG_IMAGE 폴백 유지 확인 / og-image URL 검증 함수(허용 호스트·프로토콜) 단위 테스트 / 합성·폴백 분기 로직을 순수 함수로 분리해 테스트
- **Playwright E2E 골든패스 1개 추가**: 블로그 상세 응답 `<head>`에 `og:title`·`og:image`·`twitter:card` 존재 + `og:image` URL이 200/`image/png` 응답하는지 확인
- **수동 검증 (배포 후, G6)**:
  1. 프로덕션 view-source로 실제 `og:image` 값 확인 (G1 검증)
  2. 카카오톡 공유 디버거 — https://developers.kakao.com/tool/debugger/sharing (검증 + **캐시 초기화** 필수)
  3. X Card Validator / Facebook Sharing Debugger / LinkedIn Post Inspector
  4. 실기기 카카오톡 방에 대표 URL 3종(홈/블로그 글/성공사례) 공유해 육안 확인

### 3-5. 보안·성능·정책 확인

- OG 이미지 라우트는 이미지 응답이므로 CSP nonce 무관 — 신규 HTML 라우트 없음, CSP 예외 불필요
- Sentry 트레이스 20% 샘플링은 기존 라우트 확장이므로 추가 설정 불필요
- 커버 이미지는 업로드 시 이미 압축됨(`compress-image-for-upload.ts`) — 합성 응답 시간 과다 시 Vercel 함수 타임아웃만 모니터링
- 스키마 변경 **없음** → 마이그레이션 리스크 없음

---

## 4. 작업 순서 (WBS, 예상 3일)

| 단계 | 작업 | 커밋 (Conventional Commits) |
|------|------|------|
| D1 | ✅ 감사 + 본 설계 문서 + PRD/TODO 반영 | `docs: 소셜 메타태그 강화 설계 문서 및 PRD/TODO 반영` |
| D1 | 프로덕션 view-source로 G1 확정 (배지형이 나가는지 확인) | — |
| D1~2 | `og-image.tsx` 합성 확장 + URL 검증 + blog/cases `opengraph-image.tsx` 연결 + `generateMetadata` 이미지 일원화 | `feat: OG 이미지 커버 합성 및 소셜 메타 일원화` |
| D2 | `/privacy`·`/terms` pageMetadata + canonical 정리 + alt | `fix: 정적 페이지 canonical 및 소셜 메타 보완` |
| D2~3 | Vitest 확장 + E2E 골든패스 추가 | `test: 소셜 메타태그 검증 테스트 추가` |
| D3 | 배포 → 디버거 4종 검증 → 카카오 OG 캐시 초기화 | — |
| D3 | `CONTENT_GUIDE.md`에 "커버 이미지가 공유 미리보기 배경으로 사용됨 — 권장: 가로형·1200×630 이상·핵심 피사체 중앙 배치" 안내 추가, TODO.md ✅ 전환, 노션 업무 DB 갱신 | `docs: CONTENT_GUIDE 커버 이미지 공유 미리보기 안내 추가` |

---

## 5. 완료 기준 (Definition of Done)

- [ ] 블로그 글(커버 있음)·성공사례 공유 시 커버 합성 카드가, 커버 없는 글·정적 페이지는 배지형 카드가 렌더링
- [ ] `og:image`와 `twitter:image`가 모든 라우트에서 동일 (채널 간 불일치 없음)
- [ ] `/privacy`·`/terms` 포함 전 공개 페이지 canonical 정확
- [ ] 카카오톡 실기기 + 디버거 3종(X/FB/LinkedIn) 검증 통과, 카카오 캐시 초기화 완료
- [ ] Vitest 전체 통과 + E2E 골든패스 통과, lint/typecheck 통과
- [ ] `CONTENT_GUIDE.md`·`docs/TODO.md`·노션 업무 DB 갱신

---

## 6. 결정 사항 및 열린 질문

**확정 (2026-08-06)**
- OG 이미지 전략: 커버 합성형 (커버 없으면 배지형 폴백)

**열린 질문**
1. 회사 공식 X(Twitter) 계정 보유 여부 → 있으면 `twitter:site` 추가 (마케팅팀 확인)
2. 성공사례 썸네일은 필수 필드라 항상 합성형이 되는데, 특정 사례를 배지형으로 강제할 필요가 있는지 (기본: 불필요, 요구 발생 시 관리자 필드 추가 검토)
