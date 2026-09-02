/**
 * catalog.ts — AX 체크(인터뷰 깔때기) 질문지·과제 카드·등급 규칙 데이터
 *
 * [홍보팀/영업이사] 질문 문구·선택지·과제 카드 문구를 바꾸고 싶으면 이 파일의
 * 텍스트만 수정하면 됩니다(코드 구조 변경 불필요). 수정 방법은
 * CONTENT_GUIDE.md 17번을 참고하세요.
 *
 * ✅ v2: 영업이사 인터뷰(액션플랜 0-2, 2026-08-31 회신) 반영 완료 — 실제 고객 용어로 라벨 교체,
 * 반복 업무 2건(하자보수/정기점검 보고서, 감리·시공 체크리스트) 추가.
 * 참고: docs/superpowers/specs/2026-08-31-sales-director-interview-response.md
 *
 * 설계: docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md 3번·4번
 */

export const CATALOG_VERSION = "v2";

export type AxCheckOption = { value: string; label: string };

export type AxCheckSingleQuestion = {
  id: "q1" | "q2" | "q4" | "q5" | "q6" | "q7" | "q8";
  type: "single";
  prompt: string;
  options: readonly AxCheckOption[];
  allowOther?: boolean;
};

export type AxCheckMultiQuestion = {
  id: "q3";
  type: "multi";
  prompt: string;
  options: readonly AxCheckOption[];
  maxSelect: number;
  allowOther?: boolean;
};

export type AxCheckQuestion = AxCheckSingleQuestion | AxCheckMultiQuestion;

// Q1 — 주력 사업 (업종 확장 지점: 새 업종은 이 배열에 옵션만 추가하면 됨)
export const Q1_INDUSTRY: readonly AxCheckOption[] = [
  { value: "network", label: "네트워크·통신 인프라 구축" },
  { value: "av", label: "영상·음향(AV) 시스템 구축" },
  { value: "it_si", label: "IT 인프라·SI" },
  { value: "maintenance_ops", label: "유지보수·운영 서비스" },
  { value: "mixed", label: "위 복합" },
  { value: "other", label: "기타" },
] as const;

// Q2 — 임직원 규모
export const Q2_COMPANY_SIZE: readonly AxCheckOption[] = [
  { value: "under_10", label: "10명 미만" },
  { value: "10_to_30", label: "10~30명" },
  { value: "30_to_100", label: "30~100명" },
  { value: "over_100", label: "100명 이상" },
] as const;

// Q3 — 가장 시간이 많이 드는 반복 업무 (최대 3개) — 우선 과제 매핑의 핵심 입력
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

export const Q3_MAX_SELECT = 3;

// Q4 — 현재 AI 도구 활용 수준
export const Q4_AI_MATURITY: readonly AxCheckOption[] = [
  { value: "none", label: "전혀 없음" },
  { value: "personal", label: "직원 일부가 개인적으로 ChatGPT 등 사용" },
  { value: "team", label: "팀 단위로 일부 업무에 사용" },
  { value: "integrated", label: "업무 시스템과 연동해 사용" },
] as const;

// Q5 — 업무 데이터 위치 (첫 단계 제안 분기: 정리 선행 여부)
export const Q5_DATA_LOCATION: readonly AxCheckOption[] = [
  { value: "files", label: "엑셀·한글 파일(개인 PC·공유폴더)" },
  { value: "erp", label: "그룹웨어·ERP" },
  { value: "scattered", label: "메신저·메일에 흩어져 있음" },
  { value: "unknown", label: "잘 모르겠음" },
] as const;

/** Q5가 이 값 중 하나면 로드맵 1주차 앞에 "데이터 정리 1주"를 붙인다(summarize.ts). */
export const Q5_NEEDS_DATA_PREP = new Set(["scattered", "unknown"]);

// Q6 — AI 도입으로 가장 기대하는 효과 (메시지 톤 결정)
export const Q6_EXPECTED_BENEFIT: readonly AxCheckOption[] = [
  { value: "speed", label: "제안·수주 속도" },
  { value: "cost", label: "인건비·야근 절감" },
  { value: "quality", label: "납품 품질·오류 감소" },
  { value: "skill", label: "직원 역량 향상" },
  { value: "new_service", label: "신규 서비스 발굴" },
] as const;

// Q7 — 도입 검토 시점 (내부 용도: Timing)
export const Q7_TIMING: readonly AxCheckOption[] = [
  { value: "within_3_months", label: "3개월 내" },
  { value: "this_year", label: "올해 안" },
  { value: "next_year", label: "내년 이후" },
  { value: "info_gathering", label: "아직 정보 수집 단계" },
] as const;

// Q8 — 도입 결정 구조 (내부 용도: Authority)
export const Q8_AUTHORITY: readonly AxCheckOption[] = [
  { value: "self_decide", label: "제가 결정합니다" },
  { value: "ceo_report", label: "대표(경영진) 보고가 필요합니다" },
  { value: "undecided", label: "아직 정해지지 않았습니다" },
] as const;

export const AX_CHECK_QUESTIONS: readonly AxCheckQuestion[] = [
  { id: "q1", type: "single", prompt: "귀사의 주력 사업은 무엇인가요?", options: Q1_INDUSTRY, allowOther: true },
  { id: "q2", type: "single", prompt: "임직원 규모는?", options: Q2_COMPANY_SIZE },
  {
    id: "q3",
    type: "multi",
    prompt: "가장 시간이 많이 드는 반복 업무는? (최대 3개)",
    options: Q3_REPETITIVE_TASKS,
    maxSelect: Q3_MAX_SELECT,
    allowOther: true,
  },
  { id: "q4", type: "single", prompt: "현재 AI 도구 활용 수준은?", options: Q4_AI_MATURITY },
  { id: "q5", type: "single", prompt: "업무 데이터는 주로 어디에 있나요?", options: Q5_DATA_LOCATION },
  { id: "q6", type: "single", prompt: "AI 도입으로 가장 기대하는 효과는?", options: Q6_EXPECTED_BENEFIT },
  { id: "q7", type: "single", prompt: "도입 검토 시점은?", options: Q7_TIMING },
  { id: "q8", type: "single", prompt: "도입 결정은 어떻게 이뤄지나요?", options: Q8_AUTHORITY },
] as const;

/** id로 문항 정의를 찾는다 (관리자 상세 화면에서 답변 코드값을 라벨로 바꿀 때 사용). */
export function getQuestionById(id: string): AxCheckQuestion | undefined {
  return AX_CHECK_QUESTIONS.find((q) => q.id === id);
}

/** 문항 정의 + 선택값 → 사람이 읽는 라벨. 매칭되는 옵션이 없으면 원본 값을 그대로 반환한다. */
export function getOptionLabel(question: AxCheckQuestion | undefined, value: string): string {
  if (!question) return value;
  return question.options.find((o) => o.value === value)?.label ?? value;
}

export type AxCheckTaskCard = {
  title: string;
  why: string;
  /** 미니 로드맵 원본 3단계: [첫 1주, 첫 1개월, 3개월]. Q2·Q4·Q5 분기로 접두어가 붙는다(summarize.ts). */
  roadmap: readonly [string, string, string];
  expectedEffect: string;
};

/** Q3 선택지 → 우선 과제 카드. summarize.ts가 이 데이터를 그대로 화면/메일에 사용한다. */
export const TASK_CARDS: Record<string, AxCheckTaskCard> = {
  quote: {
    title: "제안서·견적서 자동 초안 생성",
    why: "과거 제안서·견적 데이터를 기반으로 반복 작성 시간을 크게 줄일 수 있는 영역입니다.",
    roadmap: [
      "최근 1년 제안서·견적서 20건 정리",
      "표준 템플릿 3종 확정 후 AI 초안 도구로 파일럿 5건 작성",
      "실제 제안 건에 적용해 작성 시간 정착, 월별 절감 시간 측정",
    ],
    expectedEffect: "작성 시간 40~60%↓",
  },
  bidding: {
    title: "입찰 공고 탐색·서류 자동화",
    why: "나라장터 등 입찰 공고를 조건에 맞게 자동 필터링하고 제출 서류 초안을 준비할 수 있습니다.",
    roadmap: [
      "최근 낙찰·유찰 이력 및 참가 자격 요건 정리",
      "관심 공고 키워드·조건 설정 후 자동 필터링 파일럿 운영",
      "제출 서류 초안 자동화까지 확장, 참가율·낙찰률 추적",
    ],
    expectedEffect: "공고 탐색 시간 30~50%↓, 입찰 누락 방지",
  },
  site_report: {
    title: "현장 실사 보고 자동 정리",
    why: "현장 사진·도면 자료를 업로드하면 정형화된 보고서 초안을 자동 생성할 수 있습니다.",
    roadmap: [
      "최근 실사 보고서 양식과 사진 자료 정리",
      "표준 보고서 템플릿 확정 후 현장 2~3건 파일럿 적용",
      "전 현장 적용, 작성 시간·누락 항목 정기 점검",
    ],
    expectedEffect: "보고서 작성 시간 30~50%↓, 항목 누락 방지",
  },
  maintenance_request: {
    title: "유지보수 민원 응대 자동화",
    why: "반복되는 민원 유형을 자동으로 분류하고 처리 이력을 관리할 수 있습니다.",
    roadmap: [
      "최근 6개월 민원 이력을 유형별로 정리",
      "민원 유형 자동 분류 규칙 확정 후 파일럿 운영",
      "전체 민원 채널 적용, 응대 시간·재발률 추적",
    ],
    expectedEffect: "응대 시간 20~40%↓, 이력 누락 방지",
  },
  delivery_docs: {
    title: "납품·준공 문서 자동 생성",
    why: "표준 양식을 기반으로 납품·검수·준공 문서를 자동 생성해 오류를 줄일 수 있습니다.",
    roadmap: [
      "최근 납품·준공 문서 양식 정리",
      "표준 양식 확정 후 신규 건 2~3건 파일럿 적용",
      "전 건 적용, 서류 오류·반려율 정기 점검",
    ],
    expectedEffect: "문서 작성 시간 30~50%↓, 서류 오류 감소",
  },
  client_management: {
    title: "거래처 관리·후속 영업 자동화",
    why: "거래처 연락 이력을 자동으로 정리하고, 재계약·후속 영업 타이밍을 놓치지 않게 합니다.",
    roadmap: [
      "주요 거래처 연락 이력 정리",
      "재계약·후속 영업 타이밍 알림 규칙 설정 후 파일럿 운영",
      "전체 거래처 적용, 재계약률·후속 연락 누락률 추적",
    ],
    expectedEffect: "후속 영업 누락 방지, 재계약률 개선",
  },
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
  // Q3에서 선택지에 없는 업무를 "기타"로 응답한 경우의 기본 카드.
  other: {
    title: "업무 자동화 후보 진단",
    why: "말씀해 주신 업무는 상담을 통해 구체적인 자동화 방안을 함께 설계해 드립니다.",
    roadmap: [
      "해당 업무의 반복 패턴 정리",
      "상담을 통해 자동화 방식 설계 및 소규모 파일럿",
      "적용 범위 확대 및 효과 측정",
    ],
    expectedEffect: "상담 후 구체적인 범위로 안내",
  },
};

/**
 * Q1(업종) × Q3(업무) → 업종 특화 예시 1문장. 없으면(업종 "위 복합"/"기타" 등)
 * 결과 화면에서 이 줄을 생략한다(summarize.ts).
 */
export const INDUSTRY_TASK_EXAMPLES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  network: {
    quote: "예: BOM·회선 구성 기반 제안 초안 자동 생성",
    bidding: "예: 통신 인프라 관련 입찰 공고 자동 필터링",
    site_report: "예: 회선·장비 설치 현장 사진 기반 시공 보고서 자동 정리",
    maintenance_request: "예: 회선 장애·품질 민원 자동 분류 및 이력 관리",
    delivery_docs: "예: 회선 개통·준공 확인서 자동 생성",
    client_management: "예: 통신사·대리점 재계약 시점 자동 알림",
    warranty_report: "예: 회선·장비 정기점검 결과 보고서 자동 정리",
    inspection_checklist: "예: 통신 인프라 시공 감리 체크리스트 자동 정리",
  },
  av: {
    quote: "예: 장비 구성표·시공 내역 기반 견적 초안 자동 생성",
    bidding: "예: AV 관련 입찰 공고 자동 필터링",
    site_report: "예: 장비 설치 현장 사진·도면 기반 시공 보고서 자동 정리",
    maintenance_request: "예: 장비 고장·A/S 민원 자동 분류 및 이력 관리",
    delivery_docs: "예: 장비 납품·준공 확인서 자동 생성",
    client_management: "예: 유지보수 계약 갱신 시점 자동 알림",
    warranty_report: "예: AV 장비 정기점검·하자보수 보고서 자동 정리",
    inspection_checklist: "예: AV 시공 감리 체크리스트 자동 정리",
  },
  it_si: {
    quote: "예: 시스템 구성도·라이선스 기반 제안 초안 자동 생성",
    bidding: "예: SI 관련 입찰 공고 자동 필터링",
    site_report: "예: 구축 현장 점검 결과 기반 보고서 자동 정리",
    maintenance_request: "예: 장애·헬프데스크 문의 자동 분류 및 이력 관리",
    delivery_docs: "예: 시스템 납품·검수 확인서 자동 생성",
    client_management: "예: 유지보수·SLA 계약 갱신 시점 자동 알림",
    warranty_report: "예: 시스템 정기점검·하자보수 보고서 자동 정리",
    inspection_checklist: "예: 구축 현장 감리 체크리스트 자동 정리",
  },
  maintenance_ops: {
    quote: "예: 정기 점검·운영 범위 기반 견적 초안 자동 생성",
    bidding: "예: 운영 위탁 관련 입찰 공고 자동 필터링",
    site_report: "예: 정기 점검 결과 기반 보고서 자동 정리",
    maintenance_request: "예: 운영 중 발생 민원 자동 분류 및 이력 관리",
    delivery_docs: "예: 정기 점검·운영 보고서 자동 생성",
    client_management: "예: 운영 계약 갱신·SLA 점검 시점 자동 알림",
    warranty_report: "예: 정기점검·하자보수 결과 보고서 자동 정리",
    inspection_checklist: "예: 운영·시공 감리 체크리스트 자동 정리",
  },
} as const;

/** Q4가 "전혀 없음"이면 로드맵 1주차 앞에 붙는 문구. */
export const NO_AI_EXPERIENCE = new Set(["none"]);
export const NO_AI_EXPERIENCE_STEP_LABEL = "임직원 기초 교육(2시간)";

/** Q2가 "10명 미만"이면 로드맵 1개월차 앞에 붙는 문구. */
export const SMALL_TEAM_SIZE = new Set(["under_10"]);
export const SMALL_TEAM_STEP_LABEL = "전담자 없이 쓸 수 있는 SaaS 도구부터 시작";

/** Q5가 흩어져 있음/잘 모름이면 로드맵 1주차 앞에 붙는 문구. */
export const DATA_PREP_STEP_LABEL = "데이터 정리 1주";

/** 모든 기대 효과 뒤에 공통으로 붙는 면책 문구 — 확정 수치·보장 표현 금지 규칙 대응. */
export const EFFECT_DISCLAIMER = " (일반적 도입 사례 기준, 실제 효과는 상담 후 안내)";

/** Q6(기대 효과)에 따라 expectedEffect 문장의 톤을 맞추기 위한 접미사. */
export const EXPECTED_EFFECT_TONE_SUFFIX: Record<string, string> = {
  speed: " (제안·수주 속도 개선 관점)",
  cost: " (인건비·야근 절감 관점)",
  quality: " (납품 품질·오류 감소 관점)",
  skill: " (직원 역량 향상 관점)",
  new_service: " (신규 서비스 발굴 관점)",
};

export const LEAD_GRADES = ["HOT", "WARM", "COLD"] as const;
export type CatalogLeadGrade = (typeof LEAD_GRADES)[number];

/** 등급별 정렬용 기본 점수 (score = base + min(선택 업무 수, 3) * 10). */
export const GRADE_BASE_SCORE: Record<CatalogLeadGrade, number> = {
  HOT: 300,
  WARM: 200,
  COLD: 100,
};

/** Q7 값 중 HOT/WARM 판정에 쓰이는 "임박한 시점" 집합. */
export const TIMING_NEAR_TERM = new Set(["within_3_months", "this_year"]);
/** Q7 값 중 WARM 판정까지 포함하는 "검토 의사가 있는 시점" 집합(정보 수집 단계 제외). */
export const TIMING_CONSIDERING = new Set(["within_3_months", "this_year", "next_year"]);
/** Q8 값 중 HOT 판정에 필요한 "의사결정 권한이 있는" 집합. */
export const AUTHORITY_DECISIVE = new Set(["self_decide", "ceo_report"]);

export const SALES_SIGNATURE = {
  name: "김문건",
  title: "이사(Sales)",
  company: "(주)코어디엑스아이 | CoreDXI",
  phone: "010-7192-0532",
  email: "obaamg1017@coredxi.com",
  tagline: "기업의 AI Digital workplace 여정을 함께하는 신뢰의 기술 파트너, CoreDXI",
  addresses: [
    "서울시 서초동 사임당로 27 평화빌딩 4층",
    "울산광역시 남구 달삼로 76 3층 307호",
  ],
} as const;

/**
 * 이메일 본문에 넣는 5줄 서명 블록. buildCustomerEmailDraft·buildT0Email이 공용으로 쓴다.
 * [홍보팀] 서명 내용을 바꾸려면 위 SALES_SIGNATURE만 수정하면 이 함수 출력도 같이 바뀝니다.
 */
export function renderSignatureBlock(): string {
  return [
    `${SALES_SIGNATURE.name} ${SALES_SIGNATURE.title}`,
    SALES_SIGNATURE.company,
    `${SALES_SIGNATURE.phone} | ${SALES_SIGNATURE.email}`,
    `"${SALES_SIGNATURE.tagline}"`,
    SALES_SIGNATURE.addresses.join(" · "),
  ].join("\n");
}

/**
 * FOLLOWUP_COPY — T0(제출 즉시)·T1(D+2 영업일) 자동 발송 메일 문구.
 * [홍보팀] 문구만 바꾸고 싶으면 이 객체 안의 문자열/템플릿만 수정하면 됩니다(코드 구조 변경 불필요).
 * 안 1(정돈된 컨설턴트 톤) 확정본 — docs/superpowers/plans/2026-09-02-ax-check-followup-email-drafts.md
 */
export const FOLLOWUP_COPY = {
  optOutNotice:
    "이 메일은 AX 체크 진단 신청에 따른 결과 안내입니다. 추가 안내를 원치 않으시면 이 메일에 회신으로\n알려주세요.",
  t0: {
    subject: (company: string, count: number) =>
      `[CoreDXI] ${company} AX 체크 결과 — 우선 과제 ${count}가지 정리본`,
    greeting: (company: string, name: string) => `${company} ${name}님, 안녕하세요. CoreDXI입니다.`,
    introLine1: (company: string, count: number) =>
      `AX 체크에 참여해 주셔서 감사합니다. 방금 화면에서 확인하신 ${company}의 AX 우선 과제 ${count}가지를`,
    introLine2: "다시 볼 수 있도록 정리해 보내드립니다.",
    followupNotice:
      "답변해 주신 내용을 바탕으로 과제별 배경과 첫 1주·1개월·3개월 로드맵을 정리한 상세 진단 메일을\n영업일 기준 2~3일 내에 보내드리겠습니다. 우선 과제가 뚜렷한 경우에는 담당 이사가 직접 연락드립니다.",
  },
  t1: {
    subject: (company: string, count: number) =>
      `[CoreDXI] ${company} AX 체크 상세 진단 — 우선 과제 ${count}가지와 3개월 로드맵`,
    greeting: (company: string, name: string) => `${company} ${name}님, 안녕하세요. CoreDXI입니다.`,
    introLine: (industry: string, count: number) =>
      `지난 AX 체크에서 답변해 주신 내용을 바탕으로 ${industry} 기준의 우선 과제 ${count}가지를 정리했습니다.`,
    introLine2:
      "각 과제마다 왜 지금 이 과제인지, 첫 1주·1개월·3개월에 무엇을 하면 되는지, 기대 효과를 함께 적었습니다.",
    processParagraph:
      "CoreDXI는 진단(2주) → 설계 → 구축 → 교육 순서로 프로젝트를 진행합니다. 도구를 소개하는 데서 끝나지 않고,\n반복 업무가 실제로 줄어드는 것까지 함께 챙깁니다.",
    callToAction: (company: string) =>
      `이 메일에 회신해 주시면 편하신 시간에 30분 통화로 ${company}의 상황에 맞춰 자세히 설명드리겠습니다.`,
  },
} as const;

/**
 * /ax-check 페이지 상단 인트로 섹션 문구 — v1-draft. 홍보팀이 이 상수만 수정하면
 * 화면에 바로 반영된다(CONTENT_GUIDE.md 17번 참고).
 */
export const INTRO_COPY = {
  eyebrow: "CoreDXI AX 전환 컨설팅",
  headline:
    "코어디엑스아이는 중소기업의 AI 도입·AX 전환을 설계부터 교육까지 함께하는 컨설팅 회사입니다.",
  description:
    "복잡한 협업은 심플하게, 반복 업무는 줄이는 일 — 진단부터 설계·구축·교육까지 4단계로 함께합니다.",
  steps: ["진단", "설계", "구축", "교육"],
  reassurances: [
    "AI를 몰라도 됩니다 — 모든 질문이 선택지로 되어 있습니다.",
    "3분, 8개 질문이면 끝납니다.",
    "제출한다고 영업 전화가 자동으로 가지 않습니다 — 결과는 화면에서 바로 확인하시고, 상세 진단 메일은 영업일 기준 2~3일 내 자동으로 발송됩니다. 우선 과제가 뚜렷한 경우 담당 이사가 직접 연락드립니다.",
  ],
  previewLabel: "제출 즉시 화면에서 바로 확인",
  previewExample: "예: '제안서·견적서 자동 초안 생성' — 최근 1년 제안서 20건 정리부터 시작",
  cta: "3분 진단 시작하기",
} as const;
