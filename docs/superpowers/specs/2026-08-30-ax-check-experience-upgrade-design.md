# AX 체크 경험 개선 설계 — 인트로 화면 · 피드백 구체화 · 이메일 초안 워크플로우

> 작성일: 2026-08-30
> 선행 문서: `docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md`(원 설계),
> `docs/superpowers/plans/2026-08-30-ax-check-experience-upgrade-action-plan.md`(요구사항)
> 관련 규칙: 프로젝트 지침 5-1(문서 우선), 5-2(`prisma migrate dev` 금지),
> 5-3(브랜드 컬러·코너 반경·shadcn/ui), 5-4(rate limiting·CSP nonce·Sentry 예외 없음)

## 1. 배경

영업채널 고도화의 목적은 AX 전환 컨설팅을 소개하고 고객사가 AI·AX에 대한 거부감을 덜
느끼게 하는 것이다. 현재 `/ax-check`는 소개 없이 설문이 바로 시작되고, 결과 카드가
형식적이며, 원 설계의 "상세본 자동 메일 발송"은 **첫 링크를 발송하면 곧바로 거짓 안내가
되는 리스크**를 안고 있다(영업이사가 결과를 검토·수정할 기회 없이 자동 발송됨).

## 2. 변경 사항 요약

| # | 항목 | 기존 | 변경 |
|---|------|------|------|
| C | 이메일 워크플로우 | 제출 즉시 고객에게 상세본 자동 발송 | 자동 발송 **제거**. 조회 시점에 초안을 생성해 영업이사 알림 메일에 동봉 + `/admin/leads`에서 복사해 수동 발송 |
| A | 인트로 화면 | 없음(설문 즉시 시작) | 같은 페이지 상단에 컨설팅 소개 + 거부감 완화 섹션, 앵커 스크롤로 설문 진입 |
| B | 결과 피드백 | Q3+Q5+Q6만 반영, 카드당 4문장 | Q1(업종)·Q2(규모)·Q4(성숙도) 추가 반영, 답변 인용(echo)·업종 예시·3단계 로드맵으로 확장 |

## 3. 아키텍처

파이프라인은 그대로: `catalog.ts`(데이터) → `summarize.ts`(순수 함수, LLM 없음) →
`ax-check.ts`(서버 액션) → UI. 신규 모듈 `email-draft.ts`는 `summarize.ts`의 출력
(`AxCheckSummary`)을 받아 이메일 초안을 만드는 순수 함수이며, **DB에 저장하지 않고
조회 시점에 매번 생성**한다 — 카탈로그를 개선하면 이미 접수된 미발송 리드의 초안도
자동으로 좋아진다는 트레이드오프를 의도적으로 택함(발송 이력은 영업이사 메일함으로
갈음, `catalogVersion`은 응답에 이미 저장되어 있어 추적 가능).

## 4. 데이터 모델 변경 (스키마 변경 없음)

`AxCheckResponse.summary`(JSON 컬럼)에 저장되는 `priorities` 배열의 원소 타입이
바뀐다:

```
// 기존
{ title, why, firstStep, expectedEffect }
// 신규
{ title, why, echo, industryExample: string | null, roadmap: [string, string, string], expectedEffect }
```

마이그레이션 불필요(JSON 컬럼, 런타임 검증 없음). 이미 접수된 리드가 없는 상태에서
착수하므로 구버전 호환 처리는 이번 스코프에서 생략한다(첫 링크 미발송 확인 완료).

## 5. 이메일 초안 워크플로우

- `buildCustomerEmailDraft(answers, summary, contact) → { subject, body }` 순수 함수.
- 영업이사 알림 메일(자동 발송 유지)의 본문 하단에 초안 전문을 동봉.
- `/admin/leads` 리드 상세에 "이메일 초안" 패널: 미리보기 + 복사 버튼(주 경로) +
  `mailto:` 링크(보조 경로).
- 결과 화면 문구: "상세 진단서는 담당 이사가 직접 검토해 1영업일 내 메일로
  보내드립니다."로 통일(인트로·결과 화면·이메일 초안 안내 문구 정합).

## 6. 인트로 화면

같은 페이지 상단 섹션(별도 게이트 아님) — 완료율 보호를 위해 클릭 한 번 늘리지 않고
앵커 스크롤(`#ax-check-form`)로 설문 진입. 카피는 `catalog.ts`의 `INTRO_COPY` 상수.

## 7. 결과 피드백 구체화 (규칙 기반 유지)

2026-08-22 결정(응답 20건 누적 전 LLM 금지)을 유지. `catalog.ts`에 다음을 추가:
- `INDUSTRY_TASK_EXAMPLES`: Q1×Q3 업종별 예시 문장
- `TASK_CARDS[*].roadmap`: 기존 `firstStep` 단일 문장을 3단계(첫 1주/첫 1개월/3개월)로 확장
- `NO_AI_EXPERIENCE`(Q4)·`SMALL_TEAM_SIZE`(Q2) 분기 상수
- `EFFECT_DISCLAIMER`: 모든 기대 효과에 공통으로 붙는 면책 문구

`summarize.ts`의 `buildPriority`가 답변 인용(echo) 문장을 생성하고 위 데이터를
조합한다. `CATALOG_VERSION`을 `v2-draft`로 올린다(구조 변경 반영, 문구는 여전히
영업이사 인터뷰 대기 중이라 draft 유지).

## 8. 보안·정책 체크 (지침 5-4)

- 신규 서버 코드 없음(email-draft.ts는 순수 함수, DB/외부 호출 없음) — rate limit
  영향 없음.
- `/admin/leads`의 복사 버튼은 클라이언트 컴포넌트의 `navigator.clipboard` 호출이며
  인라인 `<script>`나 `javascript:` URL을 쓰지 않으므로 CSP `script-src` nonce 정책과
  무관.
- `/privacy` 제2조·제3조의 AX 체크 관련 문구("진단 결과 발송 후 1년간 보관",
  "결과 안내를 위한 담당자 연락")는 "담당자 검토 후 발송" 구조와 모순되지 않음을
  확인(Task 5에서 재확인, 자동 발송을 명시하는 문구가 없어 수정 불필요).

## 9. 테스트 계획

- `email-draft.test.ts`(신규), `summarize.test.ts`(echo·업종·Q2/Q4 분기 케이스 추가),
  `ax-check.test.ts`(고객 자동 발송 제거 반영).
- Playwright: `e2e/ax-check.spec.ts` 결과 화면 문구 갱신. 인트로 삽입 후에도 폼 셀렉터는
  영향받지 않음(Playwright `getByRole`은 스크롤 위치 무관).
- 모바일 뷰포트(Galaxy S9+) Playwright 스크린샷으로 인트로 1.5화면 이내 확인(수동 검토).

## 10. 완료 기준 (Definition of Done)

- [ ] 제출 시 고객에게 자동 발송되는 메일이 없다
- [ ] 영업이사 알림 메일에 리드 요약 + 고객용 초안 전문이 담긴다
- [ ] `/admin/leads`에서 초안 복사가 가능하다
- [ ] 결과 화면·인트로 문구가 서로 모순되지 않는다
- [ ] 서로 다른 Q1·Q2·Q4 조합 3세트가 눈에 띄게 다른 카드 결과를 낸다
- [ ] `npm run lint && npx tsc --noEmit && npm run test` 통과, E2E 골든패스 통과
- [ ] `docs/PRD.md`·`docs/TODO.md`·`CONTENT_GUIDE.md` 17번 갱신

## 11. 열린 리스크

- 초안 방치 리스크: 자동 발송이 없으므로 영업이사가 안 보내면 고객은 아무것도 못 받음
  → 알림 메일에 초안을 동봉해 최소한의 안전망 확보(2단계에서 "N일 미발송" 표시 검토).
- 영업이사 서명 블록(`SALES_SIGNATURE`)은 실제 정보 입력 전까지 v1-draft 값.
