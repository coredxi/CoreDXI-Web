/**
 * types.ts — AX 뉴스레터 발송 시스템 공용 타입
 * [홍보팀] 화면·수집·발송 코드가 함께 쓰는 데이터 모양 정의입니다. 값 자체를 바꾸는 곳은 아닙니다.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md
 */

export type KeywordOperatorValue = "OR" | "AND" | "NOT";

/** 자료검색 키워드 1개. 같은 group 안은 OR, group 간은 AND, operator=NOT은 group 무관 제외어. */
export type KeywordInput = {
  group: number;
  operator: KeywordOperatorValue;
  term: string;
  /** 우선순위 1~5 — 규칙 점수 가중치 */
  weight: number;
};

export type ArticleOriginValue = "NAVER_API" | "RSS" | "MANUAL";

/** 수집 직후(DB 저장 전) 기사. 본문 전문은 담지 않는다(저작권). */
export type CandidateArticle = {
  title: string;
  snippet: string | null;
  originalUrl: string;
  publishedAt: Date;
  origin: ArticleOriginValue;
};

export type NewsletterActionResult<T extends object = object> =
  | ({ success: true } & T)
  | { success: false; error: string };

/** 임시저장 캠페인에서 호 생성·편집·발송을 막을 때 쓰는 공용 안내 문구 */
export const DRAFT_CAMPAIGN_ERROR = "임시저장 캠페인은 먼저 저장을 완료해 주세요";
