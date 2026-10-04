/**
 * keyword-filter.ts — 캠페인 키워드로 기사 통과 여부·적중률 계산. 순수 함수.
 * [홍보팀] "(AI 도입 OR AX) AND (중소기업 OR 제조)" 같은 검색 조건을 실제로 판정하는 규칙입니다.
 * 같은 그룹 안 단어는 하나만 맞아도 되고, 모든 그룹이 맞아야 통과합니다. "제외" 단어가 있으면 탈락.
 * 설계: docs/superpowers/specs/2026-09-28-newsletter-distribution-design.md 5절 NewsletterKeyword, 6-1
 */
import type { KeywordInput } from "./types";

export type KeywordMatch = {
  passes: boolean;
  groupHits: { group: number; bestScore: number; maxScore: number }[];
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function isAsciiOnly(s: string): boolean {
  return /^[a-z0-9\s]+$/.test(s);
}

function containsTerm(haystack: string, term: string): boolean {
  if (!isAsciiOnly(term)) {
    return haystack.includes(term);
  }
  const idx = haystack.indexOf(term);
  if (idx === -1) return false;
  const before = idx === 0 || !/[a-z0-9]/.test(haystack[idx - 1]);
  const after = idx + term.length === haystack.length || !/[a-z0-9]/.test(haystack[idx + term.length]);
  return before && after;
}

function clampWeight(w: number): number {
  return Math.min(5, Math.max(1, Math.round(w)));
}

function positiveGroups(keywords: readonly KeywordInput[]): Map<number, KeywordInput[]> {
  const groups = new Map<number, KeywordInput[]>();
  for (const k of keywords) {
    if (k.operator === "NOT" || !norm(k.term)) continue;
    const list = groups.get(k.group) ?? [];
    list.push(k);
    groups.set(k.group, list);
  }
  return groups;
}

export function matchKeywords(
  keywords: readonly KeywordInput[],
  title: string,
  snippet: string
): KeywordMatch {
  const t = norm(title);
  const s = norm(snippet);

  for (const k of keywords) {
    const term = norm(k.term);
    if (k.operator === "NOT" && term && (containsTerm(t, term) || containsTerm(s, term))) {
      return { passes: false, groupHits: [] };
    }
  }

  const groups = positiveGroups(keywords);
  if (groups.size === 0) return { passes: false, groupHits: [] };

  const groupHits: KeywordMatch["groupHits"] = [];
  for (const [group, terms] of groups) {
    let best = 0;
    let max = 0;
    for (const k of terms) {
      const term = norm(k.term);
      const w = clampWeight(k.weight);
      max = Math.max(max, w * 2);
      const score = containsTerm(t, term) ? w * 2 : containsTerm(s, term) ? w : 0;
      best = Math.max(best, score);
    }
    if (best === 0) return { passes: false, groupHits: [] };
    groupHits.push({ group, bestScore: best, maxScore: max });
  }
  return { passes: true, groupHits };
}

export function keywordHitRate(match: KeywordMatch): number {
  if (!match.passes) return 0;
  const best = match.groupHits.reduce((acc, g) => acc + g.bestScore, 0);
  const max = match.groupHits.reduce((acc, g) => acc + g.maxScore, 0);
  return max === 0 ? 0 : best / max;
}

/**
 * 네이버 API는 불리언 연산을 지원하지 않으므로, 용어 수가 가장 적은 포함 그룹의 용어만 각각 질의한다.
 * AND 조건을 만족하는 기사는 반드시 이 그룹의 용어 하나를 포함하므로 누락이 없다.
 */
export function pickQueryTerms(keywords: readonly KeywordInput[]): string[] {
  const groups = [...positiveGroups(keywords).values()];
  if (groups.length === 0) return [];
  const smallest = groups.reduce((a, b) => (b.length < a.length ? b : a));
  return [...new Set(smallest.map((k) => k.term.trim()))];
}
