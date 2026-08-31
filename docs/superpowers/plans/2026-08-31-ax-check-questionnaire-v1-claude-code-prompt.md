# Claude Code 작업 지시 — AX 체크 질문지 v1 확정 (액션플랜 0-3)

참고 문서: `docs/superpowers/specs/2026-08-31-sales-director-interview-response.md`(영업이사 인터뷰 회신 B절)
대상 파일: `src/lib/ax-check/catalog.ts` — 데이터만 수정, 구조 변경 없음(파일 상단 주석 참고)

## 변경 사항

### 1. Q3_REPETITIVE_TASKS — 라벨을 실제 고객 용어로 교체 + 2개 항목 추가

```ts
export const Q3_REPETITIVE_TASKS: readonly AxCheckOption[] = [
  { value: "quote", label: "견적·내역서·투찰 서류 작성" },
  { value: "bidding", label: "나라장터 입찰 공고 탐색·적격심사 서류 준비" },
  { value: "site_report", label: "현장 답사·사진/보고서 정리" },
  { value: "maintenance_request", label: "A/S·하자보수·월정기 점검 이력 관리" },
  { value: "delivery_docs", label: "준공 도서·검수 서류·완공계 작성" },
  { value: "client_management", label: "영업 롤링·바이어 관리" },
  { value: "warranty_report", label: "하자보수/정기점검 보고서 작성" },
  { value: "inspection_checklist", label: "감리·시공 체크리스트 정리" },
  { value: "other", label: "기타" },
] as const;
```

(라벨만 교체, `value`는 그대로 유지 — 기존 응답 데이터·등급 규칙과의 호환성 유지. `warranty_report`·`inspection_checklist`는 신규 value)

### 2. TASK_CARDS — 신규 2개 항목 카드 추가 (기존 6개 카드 문구는 유지, 신규만 추가)

```ts
  warranty_report: {
    title: "하자보수·정기점검 보고서 자동 작성",
    why: "정기점검·하자보수 현장 기록을 표준 양식 보고서로 자동 정리할 수 있는 영역입니다.",
    roadmap: [
      "최근 점검·하자보수 보고서 양식과 사례 정리",
      "표준 보고서 템플릿 확정 후 2~3건 파일럿 적용",
      "전 현장 적용, 작성 시간·누락 항목 정기 점검",
    ],
    expectedEffect: "보고서 작성 시간 30~50%↓, 누락 항목 방지",
  },
  inspection_checklist: {
    title: "감리·시공 체크리스트 자동 정리",
    why: "감리·시공 단계별 체크 항목을 표준화하고 누락 없이 자동 정리할 수 있습니다.",
    roadmap: [
      "현재 사용 중인 감리·시공 체크리스트 정리",
      "표준 체크리스트 확정 후 현장 2~3건 파일럿 적용",
      "전 현장 적용, 체크리스트 누락·오류 정기 점검",
    ],
    expectedEffect: "체크 누락 방지, 감리 대응 시간 단축",
  },
```

### 3. INDUSTRY_TASK_EXAMPLES — network/av/it_si/maintenance_ops 4개 업종에 신규 2개 task 예시 문장 추가

각 업종 블록에 `warranty_report`, `inspection_checklist` 키를 추가한다. 기존 `maintenance_request`(A/S) 예시와 톤을 맞추되 정기점검·감리 관점으로 문구를 새로 쓴다(업종 4개 × 2 task = 8줄). 정확한 문구는 Claude Code가 기존 6개 예시 패턴을 참고해 작성.

### 4. TASK_CARDS "other" 등 기존 6개 카드는 변경 없음. Q1~Q2, Q4~Q8 문항·선택지도 이번 회신에서 다루지 않았으므로 변경 없음.

### 5. CATALOG_VERSION

현재 `"v2-draft"` → `"v2"`로 변경(v1-draft에서 8/30 경험 개선으로 이미 v2-draft가 됐고, 이번이 인터뷰 반영까지 끝난 확정판이므로 draft 접미사 제거).

## 완료 후

- `pnpm lint`, `pnpm test`(summarize.test.ts가 TASK_CARDS/Q3 값 참조하는지 확인 — 신규 value 추가로 매핑 함수 동작에 문제없는지 검증)
- 커밋 메시지: `content: AX 체크 질문지 v1 확정 — 영업이사 인터뷰 반영(용어 교체·업무 2건 추가)` (Conventional Commits, post-commit 훅이 Notion에 기록)
- `docs/TODO.md`·`docs/superpowers/plans/2026-08-22-sales-enablement-action-plan.md` 0-3 행을 ✅로 갱신(AI 비서 세션이 선반영해둔 상태 — 실제 구현 커밋 해시만 채워 넣으면 됨)

## 범위 밖 (별도 트랙)

- D-1(카카오톡 실시간 알림), D-2(리드 목록 필드 확장: 발송일·열람시각·대표/담당자 구분·메모)는 `/admin/leads` 개선 백로그. 이번 커밋에 포함하지 않는다.
- 소개서(0-4)·인트로 카피(C-1/C-2) 반영은 별도 트랙(브로슈어 액션플랜) — 이 프롬프트 범위 아님.
