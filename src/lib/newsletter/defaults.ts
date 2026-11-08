/**
 * defaults.ts — 뉴스레터 캠페인 기본값
 * [홍보팀] 새 캠페인을 만들 때 미리 채워지는 값입니다. 제목 앞 "(광고)"는 법적 표기라 지우지 마세요.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 2절 #4·#5·#8·#11
 */

export const DEFAULT_SUBJECT_TEMPLATE = "(광고) [AX 위클리] {{issueDate}} 중소기업 AI 도입 소식";
export const DEFAULT_SEND_DAY_OF_WEEK = 2; // 화요일
export const DEFAULT_SEND_HOUR_KST = 8;
/** 1단계 고정 발송 시각. Vercel Hobby Cron이 하루 1회(23:00 UTC = 08:00 KST)만 돌아 다른 시각은 지킬 수 없다. */
export const FIXED_SEND_HOUR_KST = DEFAULT_SEND_HOUR_KST;
export const DEFAULT_COLLECT_DAYS = 7;
export const DEFAULT_MAX_ARTICLES = 7;

/** 선별지표 5종 — 1단계에선 저장만 하고, 2단계 Claude 점수 프롬프트에 description이 그대로 들어간다. */
export const DEFAULT_SELECTION_RULES = [
  { indicator: "relevance", label: "관련성", description: "중소기업 대표가 AI 도입·AX 전환을 판단하는 데 직접 도움이 되는가", weight: 3 },
  { indicator: "timeliness", label: "시의성", description: "이번 주에 알아야 할 새 소식인가(정책·지원사업 마감 포함)", weight: 2 },
  { indicator: "credibility", label: "신뢰도", description: "출처가 분명하고 과장·홍보성 표현이 적은가", weight: 2 },
  { indicator: "novelty", label: "신규성", description: "이미 널리 알려진 내용의 반복이 아닌가", weight: 1 },
  { indicator: "depth", label: "상세도", description: "사례·수치·방법이 구체적으로 담겨 있는가", weight: 1 },
] as const;
