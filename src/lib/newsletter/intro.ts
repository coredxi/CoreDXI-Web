/**
 * intro.ts — 뉴스레터 인사말 자동 초안(규칙 기반, AI 미사용)
 * [홍보팀] 매일 수집 때 이번 호에 선택된 기사로 인사말 첫 초안을 만듭니다. 편집 화면에서 저장하면 더는 자동으로 바뀌지 않습니다.
 * 마지막 문장은 아래 INTRO_COPY에서 고칠 수 있습니다.
 */
import { textContainsTerm } from "./keyword-filter";
import type { KeywordInput } from "./types";

const INTRO_COPY = {
  closing: "각 기사 요약을 보시며 우리 회사에 바로 적용할 수 있는 부분을 찾아보세요.",
} as const;

const MAX_TERMS = 3;
const TITLE_MAX = 40;

export type IntroArticle = { title: string; snippet: string | null };

/** 선택 기사(점수순)와 캠페인 키워드로 인사말 세 문장을 만든다. 기사가 없으면 null. */
export function buildAutoIntro(articles: readonly IntroArticle[], keywords: readonly KeywordInput[]): string | null {
  if (articles.length === 0) return null;

  const terms = [...new Set(keywords.filter((k) => k.operator !== "NOT").map((k) => k.term.trim()).filter(Boolean))];
  const ranked = terms
    .map((term, order) => ({
      term,
      order,
      hits: articles.filter((a) => textContainsTerm(`${a.title} ${a.snippet ?? ""}`, term)).length,
    }))
    .filter((t) => t.hits > 0)
    .sort((x, y) => y.hits - x.hits || x.order - y.order)
    .slice(0, MAX_TERMS)
    .map((t) => t.term);

  const topic = ranked.length > 0 ? `${ranked.join("·")} 관련 ` : "";
  const lead = articles[0].title.trim();
  const headline = lead.length > TITLE_MAX ? `${lead.slice(0, TITLE_MAX)}…` : lead;

  return [
    `이번 주 AX 위클리는 ${topic}기사 ${articles.length}건을 골랐습니다.`,
    `가장 눈에 띈 소식은 "${headline}"입니다.`,
    INTRO_COPY.closing,
  ].join(" ");
}
