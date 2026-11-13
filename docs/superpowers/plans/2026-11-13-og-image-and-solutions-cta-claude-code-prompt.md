# Claude Code 실행 프롬프트 — 링크 미리보기 이미지 수치 교체 + /solutions 보조 버튼 정리

작성일: 2026-11-13 · 노션 액션: "[CoreDXI-Web] 2단계 보강 — /solutions 단일 오퍼 재편·/about 축약"의 코드 잔여분
배경: 2026-11-13 CMS 문구 교체(`web/2026-11-13-solutions-about-cms-copy-table.md`, 프로젝트 문서)로 홈·/about·/solutions의
근거 없는 수치(50+ 도입 기업·98% 고객 만족도·3배)를 운영에서 걷어냈다. 그런데 같은 수치가 **링크 미리보기 이미지에 코드로 박혀 있어**
영업이사가 카톡으로 보내는 `/ax-check` 링크 미리보기에 계속 노출된다. 또 /solutions 상단 "성공사례 보기" 버튼이 사례 0건인 `/cases`로 연결된다.

> 아래 구분선 이후 전체를 Claude Code에 그대로 붙여 넣는다.

---

## Claude Code 프롬프트 (여기부터 복사)

당신은 CoreDXI-Web 저장소에서 작업합니다. 루트 `CLAUDE.md` 규칙을 전부 지키세요(Conventional Commits, `[홍보팀]` 주석, `any` 금지, 스코프 확장 금지, 새 색상 추가 금지). 커밋 트레일러는 세션 지침 문자열을 그대로 씁니다. 이번 작업은 **표시 문구 4곳만** 바꿉니다 — DB·CMS 스키마·라우트는 건드리지 않습니다.

### 0. 전제 확인
- `git status`, `git log --oneline -3`. `main`이 `origin/main`과 같아야 합니다(로컬에 앞선 커밋이 있으면 먼저 `git push origin main`).
- `.git/index.lock`·`.git/HEAD.lock`이 남아 있으면 다른 git 프로세스가 없는 것을 확인한 뒤 삭제합니다.

### 1. 링크 미리보기 이미지 — `src/app/opengraph-image.tsx`
- 하단 "수치 배지" 3개를 아래로 교체합니다(레이아웃·색·크기는 그대로):
  - `20년` / `구축·운영 현장 경력`
  - `3분` / `무료 AX 체크`
  - `4단계` / `진단→검증→정착`
- 헤드라인 아래 보조 문구 `복잡한 협업은 심플하게, 변화는 단단하게.` → `IT·통신·영상음향 구축 기업을 위한 AX 전환 컨설팅`
- 헤드라인("비즈니스의 중심을 / AI로 깨우다")과 로고·URL은 유지합니다.
- 배지 라벨이 한 줄에 들어가는지 `/opengraph-image`를 로컬에서 열어 눈으로 확인합니다(1200×630).

### 2. CMS 기본값(폴백) 맞추기
운영 CMS 값은 이미 바뀌었고, DB 값이 없을 때 쓰는 기본값만 같게 맞춥니다.
- `src/lib/page-content/home.ts`, `src/lib/page-content/about.ts`의 `stats` 3개:
  - `{ value: "20년", label: "IT 시스템 구축·운영 현장 경력" }`
  - `{ value: "3분", label: "무료 AX 체크로 우선 과제 확인" }`
  - `{ value: "4단계", label: "진단 → 로드맵 → 검증 → 정착" }`
- 다른 기본값 문구는 이번에 바꾸지 않습니다.

### 3. /solutions 히어로 보조 버튼 — `src/app/solutions/page.tsx`
- `href="/cases"` "성공사례 보기" 버튼을 `href="/ax-check"` **"3분 AX 체크 먼저 해보기"**로 바꿉니다. 스타일은 그대로 두고, 기존 `TrackedCtaLink` 패턴이 맞으면 `location="solutions_hero_axcheck"`로 추적합니다(맞지 않으면 기존 `Link` 유지).
- `[홍보팀]` 주석에 "성공사례가 다시 쌓이면 `/cases`로 되돌릴 수 있음(2026-11-13)" 한 줄을 남깁니다.

### 3-1. AX 체크 메일 속 진행 단계 문구 (2026-11-13 추가)
소개서·/solutions·블로그는 4단계를 "현황 진단 → 로드맵 수립 → PoC 검증 → 확산·정착"으로 쓰는데, 자동 메일 문구만 옛 이름("진단(2주) → 설계 → 구축 → 교육")이 남아 있습니다.
- `src/lib/ax-check/catalog.ts` 466행, `src/lib/ax-check/email-draft.ts` 134행의 `진단(2주) → 설계 → 구축 → 교육`을 `현황 진단 → 로드맵 수립 → PoC 검증 → 확산·정착`으로 바꿉니다(문장의 나머지는 유지).
- `src/lib/ax-check/email-draft.test.ts` 81행의 기대 문자열도 같은 새 문구로 갱신합니다.
- 다른 곳에 같은 옛 문구가 있는지 `grep -rn "진단(2주)" src`로 확인합니다.

### 4. 검증·커밋
- `npm run lint`, `npx tsc --noEmit`, `npm run test` 통과. E2E는 기본 `npm run test:e2e`(읽기 전용)만, 필요하면 `npx playwright test e2e/<파일>.spec.ts`로 한 파일만.
- 커밋 2건: `fix(seo): 링크 미리보기·기본값의 근거 없는 수치 교체, /solutions 보조 버튼을 AX 체크로` + `fix(ax-check): 메일 속 진행 단계 문구를 소개서 4단계로 통일`
- `main`에 직접 커밋 후 `git push origin main`. Vercel 배포 완료 확인.

### 5. 보고
- 커밋 해시, 바뀐 파일·라인, 미리보기 이미지 확인 결과, 테스트 결과.

---

## 배포 후 사용자가 할 일 (프롬프트 밖)
- 카카오톡은 링크 미리보기를 캐시합니다. **카카오 개발자 "공유 디버거"**(developers.kakao.com → 도구 → 공유 디버거)에 `https://www.coredxi.com/ax-check?ref=sales-kim`과 `https://www.coredxi.com`을 넣고 "캐시 초기화"를 누른 뒤, 나와의 채팅에 링크를 보내 새 이미지가 뜨는지 확인합니다.
