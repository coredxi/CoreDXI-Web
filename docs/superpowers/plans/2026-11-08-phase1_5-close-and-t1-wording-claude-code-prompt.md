# Claude Code 실행 프롬프트 A — Phase 1.5 종료 반영 + T1 발송 시각 문구 정리

작성일: 2026-11-08 · 노션 액션: "[CoreDXI-Web] T1 발송 시각 안내 문구 정리·TODO/액션플랜 반영·운영 규칙 문서 저장", "Phase 1.5 영업 지원 트랙"(11/8 종료)
실행 순서: **이 프롬프트 A → 프롬프트 B**(`2026-11-08-solutions-safety-case-run-claude-code-prompt.md`). A는 `main`에 docs/문구 커밋만 하므로 B의 기능 브랜치보다 먼저 끝낸다.

> 아래 구분선 이후 전체를 Claude Code에 그대로 붙여 넣는다.
> 운영 규칙 원문(`20261015_D운영전환_패키지_v1.md`)이 있으면 함께 첨부한다. 없으면 4단계는 건너뛰고 보고만 한다.

---

## Claude Code 프롬프트 (여기부터 복사)

당신은 CoreDXI-Web 저장소에서 작업합니다. 루트 `CLAUDE.md` 규칙을 전부 지키세요(Conventional Commits, `[홍보팀]` 주석, `any` 금지, 스코프 확장 금지). 커밋 트레일러는 세션 지침 문자열을 그대로 씁니다. 이번 작업은 **문서·문구 정리만** 합니다 — 크론 스케줄·발송 로직·DB는 바꾸지 않습니다.

### 0. 전제 확인

- `git status`, `git log --oneline -3`. 현재 `main`, `origin/main`과 동일해야 합니다.
- `.git/index.lock`이 남아 있으면(원격 세션 잔재) 다른 git 프로세스가 없는 것을 확인한 뒤 삭제하고 진행합니다.
- 작업 트리에 다음 변경/미추적 파일이 있는 것이 정상입니다:
  - 수정: `docs/superpowers/plans/2026-10-31-phase1_5-stage3-close-report-draft.md`(11/8 Cowork 세션이 빈칸 기입 — 내용 수정하지 말 것)
  - 미추적: `docs/superpowers/plans/2026-09-11-*.md` 2건, `2026-09-15-solutions-safety-case-section-implementation-plan.md`, `2026-10-24-newsletter-unsubscribe-merge-and-stage3-close-claude-code-prompt.md`, `2026-11-08-*.md` 2건(이 파일 포함), `docs/superpowers/assets/sales-followup/*` 4건
  - 미추적이지만 **이번 커밋 제외**: `public/docs/safety-rag-case-study.pdf`(프롬프트 B 첫 feat 커밋에 포함), `Claude outputs/`(커밋 금지 — `.gitignore`에 `Claude outputs/` 한 줄 추가)

### 1. 종료 보고 확정 커밋

- 1번 목록의 docs 파일과 수정된 종료 보고를 커밋합니다: `docs: Phase 1.5 종료 보고 확정(게이트 3/5·HOT 1/1 미충족, 업종 확장 보류) 및 미추적 계획 문서 정리`
- `.gitignore` 수정은 별도 `chore:` 커밋.

### 2. T1 발송 시각 — 원인 확인(코드 변경 없음)

- `vercel.json`의 `/api/cron/ax-check-followup` 스케줄 `30 0 * * *`(UTC 00:30 = KST 09:30)를 확인합니다.
- 실제 발송이 10:25 전후로 반복된 원인(Vercel Hobby 플랜 크론은 지정 시각이 아닌 해당 시간대 안에서 실행 — 공식 문서 확인 후 근거 링크 기록)을 `docs/TODO.md` 1-B에 한 줄로 남깁니다.
- 결정(2026-10-08 A안): **'오전 10시대 발송' 수용, 외부 크론·Pro 미채택. 스케줄은 바꾸지 않는다.**

### 3. '09:30' 정시 표현 정리

- `grep -rn "09:30\|9:30\|9시 30분" src e2e docs/CONTENT_GUIDE.md CONTENT_GUIDE.md 2>/dev/null`로 위치를 모두 찾습니다.
- **고객·관리자에게 보이는 문구**만 정시 표현을 피하도록 바꿉니다. 원칙: "D+2 영업일 오전 중(보통 오전 10시 전후)". 예:
  - 영업이사 알림 메일의 "상세 진단 메일 예정: 2026-09-04(금) 09:30" → "상세 진단 메일 예정: 2026-09-04(금) 오전 중"
  - `/admin/leads`의 "T1 예정 시각" 표시 → 날짜 + "오전 중(실제 발송 시각은 아래 'T1 발송 시각'에 기록)" 수준
- **바꾸지 않는 것**: 내부 계산(`business-days.ts`의 09:30 KST 기준 시각, 크론 스케줄), 해당 단위 테스트의 계산 기대값. 표시용 포맷 함수만 고치고, 그 함수를 검증하는 테스트(`ax-check.test.ts`의 문자열 기대값 등)는 새 문구에 맞게 갱신합니다.
- 영업이사 매뉴얼 PDF/docx(`docs/superpowers/assets/sales-followup/*`)는 **수정하지 말고** 정시 표현이 있는 위치(파일·쪽)만 보고에 적습니다.

### 4. 운영 규칙 문서 저장 (원문이 첨부된 경우만)

- 첨부된 `20261015_D운영전환_패키지_v1.md`의 "/admin/leads 운영 규칙" 절을 `docs/superpowers/specs/2026-10-15-admin-leads-operating-rules.md`로 저장합니다(원문 그대로, 상단에 "2026-10-15 사용자 승인, 10/19 시행, HOT 대행 기한 = 다음 영업일" 메타 한 줄).
- `CONTENT_GUIDE.md`의 AX 체크/리드 관리 절에 이 문서 링크 한 줄 추가.
- 원문이 없으면 이 단계를 건너뛰고 보고에 "운영 규칙 원문 미첨부 — 저장 보류"라고 적습니다. 원문을 추측해 작성하지 마세요.

### 5. 문서 상태 반영

- `docs/TODO.md` 1-B(Phase 1.5): 트랙 **종료(2026-11-08)** 표기, 종료 보고 링크, 이월 항목(뉴스레터 1호 실제 발송·E 2차·2-1 완료율 점검 — 게이트 연동 / `/solutions` 재편·`/about` 축약·안전서류 사례 섹션·NCP 검색 키 — 게이트 무관), 10/5 범위 재정의(E 분리·D 축소)·10/8 A안(T1 오전 10시대 수용) 반영.
- `docs/superpowers/plans/2026-09-02-sales-channel-auto-followup-action-plan.md` 하단 "변경 이력"에 10/5·10/8·11/8 세 줄.
- `CLAUDE.md` 2번 "이번 분기 목표"·8번 백로그의 Phase 1.5 항목을 "종료(2026-11-08), 게이트 미충족 항목은 이월"로 갱신. 업종 확장은 "현 타깃 유지, 2027년 1분기 재검토"로.

### 6. 검증·커밋

- `npm run lint`, `npx tsc --noEmit`, `npm run test` 통과. 3단계에서 문구를 바꿨으면 `npm run test:e2e -- ax-check`도 1회.
- 커밋 단위: `fix(ax-check): T1 발송 예정 표시를 '오전 중'으로 정리` / `docs: TODO·액션플랜·CLAUDE.md에 Phase 1.5 종료와 T1 A안 반영` (+4단계 했으면 `docs: /admin/leads 운영 규칙 저장`).
- `main`에 직접 커밋 후 `git push origin main`. Vercel 배포 완료를 확인합니다.

### 7. 보고

- 커밋 해시 목록, 문구를 바꾼 위치(파일:라인), 매뉴얼 PDF의 정시 표현 위치, 4단계 수행 여부, 테스트 결과.
