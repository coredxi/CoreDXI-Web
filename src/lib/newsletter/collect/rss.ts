/**
 * rss.ts — 언론사 RSS 수집
 * [홍보팀] 매체 목록에서 "RSS 사용"으로 켠 언론사의 최신 기사 목록을 읽어옵니다(본문 전문 저장 안 함).
 */
import Parser from "rss-parser";
import { SNIPPET_MAX_LENGTH, cleanText } from "../normalize";
import type { CandidateArticle } from "../types";
import { safeFetchText, type FetchLike } from "./safe-fetch";

const parser = new Parser();

const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2}|GMT|UTC|KST)\s*$/i;
const NAIVE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * 피드 날짜 해석. ndsoft 계열 국내 매체(아이티조선·블로터 등)는 "2026-10-03 18:30:00"처럼 시간대 없이 주는데,
 * new Date()는 이를 서버 로컬 시간(Vercel=UTC)으로 읽어 9시간 미래가 된다 → 시간대 없는 값은 KST로 고정 해석.
 * (2026-10-04 Task 0 RSS 실측에서 발견)
 */
export function parseFeedDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const naive = HAS_TIMEZONE.test(s) ? null : NAIVE_DATETIME.exec(s);
  if (naive) {
    const [, y, mo, d, h, mi, sec] = naive;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h - 9, +mi, sec ? +sec : 0));
  }
  const date = new Date(s);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function parseRssXml(xml: string): Promise<CandidateArticle[]> {
  const feed = await parser.parseString(xml);
  return feed.items.flatMap((item): CandidateArticle[] => {
    const title = cleanText(item.title);
    // isoDate는 rss-parser가 new Date(pubDate)로 이미 변환한 값이라 시간대 없는 날짜가 틀어져 있다 → 원문 pubDate 우선
    const publishedAt = parseFeedDate(item.pubDate ?? item.isoDate);
    if (!item.link || !title || !publishedAt) return [];
    const snippet = cleanText(item.contentSnippet ?? item.summary ?? item.content ?? "").slice(
      0,
      SNIPPET_MAX_LENGTH
    );
    return [{ title, snippet: snippet || null, originalUrl: item.link, publishedAt, origin: "RSS" }];
  });
}

export async function fetchRssArticles(
  rssUrl: string,
  opts: { fetchImpl?: FetchLike } = {}
): Promise<CandidateArticle[]> {
  return parseRssXml(await safeFetchText(rssUrl, opts));
}
