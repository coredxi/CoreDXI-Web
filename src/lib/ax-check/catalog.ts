/**
 * catalog.ts — AX 체크(인터뷰 깔때기) 질문지·과제 카드·등급 규칙 데이터
 *
 * [홍보팀/영업이사] 질문 문구·선택지·과제 카드 문구를 바꾸고 싶으면 이 파일의
 * 텍스트만 수정하면 됩니다(코드 구조 변경 불필요). 수정 방법은
 * CONTENT_GUIDE.md 17번을 참고하세요.
 *
 * ⚠️ v1-draft: 아래 문구는 설계 문서(2026-08-22-sales-funnel-ax-check-design.md) 3번 표를
 * 그대로 옮긴 초안입니다. 영업이사 인터뷰(액션플랜 0-2) 결과를 받으면 이 파일의
 * 데이터만 교체합니다 — 구조 변경 없음.
 *
 * 설계: docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md 3번·4번
 */

export const CATALOG_VERSION = "v1-draft";

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
  { value: "quote", label: "제안서·견적서 작성" },
  { value: "bidding", label: "입찰 공고 탐색·서류 준비(나라장터 등)" },
  { value: "site_report", label: "현장 실사 보고·도면·사진 정리" },
  { value: "maintenance_request", label: "유지보수 민원 응대·이력 관리" },
  { value: "delivery_docs", label: "납품·검수·준공 문서" },
  { value: "client_management", label: "거래처 관리·후속 영업 연락" },
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

/** Q5가 이 값 중 하나면 모든 과제 카드의 firstStep 앞에 "데이터 정리 1주"를 붙인다. */
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
  firstStep: string;
  expectedEffect: string;
};

/** Q3 선택지 → 우선 과제 카드. summarize.ts가 이 데이터를 그대로 화면/메일에 사용한다. */
export const TASK_CARDS: Record<string, AxCheckTaskCard> = {
  quote: {
    title: "제안서·견적서 자동 초안 생성",
    why: "과거 제안서·견적 데이터를 기반으로 반복 작성 시간을 크게 줄일 수 있는 영역입니다.",
    firstStep: "최근 1년 제안서·견적서 20건 정리",
    expectedEffect: "작성 시간 50%↓",
  },
  bidding: {
    title: "입찰 공고 탐색·서류 자동화",
    why: "나라장터 등 입찰 공고를 조건에 맞게 자동 필터링하고 제출 서류 초안을 준비할 수 있습니다.",
    firstStep: "최근 낙찰·유찰 이력 및 참가 자격 요건 정리",
    expectedEffect: "공고 탐색 시간 절감, 입찰 누락 방지",
  },
  site_report: {
    title: "현장 실사 보고 자동 정리",
    why: "현장 사진·도면 자료를 업로드하면 정형화된 보고서 초안을 자동 생성할 수 있습니다.",
    firstStep: "최근 실사 보고서 양식과 사진 자료 정리",
    expectedEffect: "보고서 작성 시간 단축, 항목 누락 방지",
  },
  maintenance_request: {
    title: "유지보수 민원 응대 자동화",
    why: "반복되는 민원 유형을 자동으로 분류하고 처리 이력을 관리할 수 있습니다.",
    firstStep: "최근 6개월 민원 이력을 유형별로 정리",
    expectedEffect: "응대 시간 단축, 이력 누락 방지",
  },
  delivery_docs: {
    title: "납품·준공 문서 자동 생성",
    why: "표준 양식을 기반으로 납품·검수·준공 문서를 자동 생성해 오류를 줄일 수 있습니다.",
    firstStep: "최근 납품·준공 문서 양식 정리",
    expectedEffect: "문서 작성 시간 절감, 서류 오류 감소",
  },
  client_management: {
    title: "거래처 관리·후속 영업 자동화",
    why: "거래처 연락 이력을 자동으로 정리하고, 재계약·후속 영업 타이밍을 놓치지 않게 합니다.",
    firstStep: "주요 거래처 연락 이력 정리",
    expectedEffect: "후속 영업 누락 방지, 재계약률 개선",
  },
  // Q3에서 선택지에 없는 업무를 "기타"로 응답한 경우의 기본 카드.
  other: {
    title: "업무 자동화 후보 진단",
    why: "말씀해 주신 업무는 상담을 통해 구체적인 자동화 방안을 함께 설계해 드립니다.",
    firstStep: "해당 업무의 반복 패턴 정리",
    expectedEffect: "상담 후 구체적인 수치로 안내",
  },
};

/** Q6(기대 효과)에 따라 expectedEffect 문장의 톤을 맞추기 위한 접미사. */
export const EXPECTED_EFFECT_TONE_SUFFIX: Record<string, string> = {
  speed: " (제안·수주 속도 개선 관점)",
  cost: " (인건비·야근 절감 관점)",
  quality: " (납품 품질·오류 감소 관점)",
  skill: " (직원 역량 향상 관점)",
  new_service: " (신규 서비스 발굴 관점)",
};

/** Q5가 흩어져 있음/잘 모름이면 firstStep 앞에 붙이는 공통 선행 단계. */
export const DATA_PREP_PREFIX = "데이터 정리 1주 → ";

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

/**
 * 이메일 초안 서명 블록 — v1-draft 값. 영업이사 실제 이름·연락처로 교체 필요
 * (교체는 이 상수만 수정하면 됨, 코드 변경 불필요).
 */
export const SALES_SIGNATURE = {
  name: "김영업",
  title: "영업이사",
  phone: "010-0000-0000",
  email: "sales@coredxi.com",
} as const;
