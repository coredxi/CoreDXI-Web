/**
 * naver-news.ts — 네이버 뉴스 검색 API 클라이언트
 * [홍보팀] 캠페인 키워드로 최신 기사를 찾아오는 부분입니다. 기사 본문은 받지 않고 제목·짧은 설명·링크·날짜만 씁니다.
 * 자격증명은 검색 전용 NAVER_SEARCH_CLIENT_ID/SECRET — 소셜 로그인용 NAVER_CLIENT_ID와 다른 앱이다.
 */
import { SNIPPET_MAX_LENGTH, cleanText } from "../normalize";
import type { CandidateArticle } from "../types";
import type { FetchLike } from "./safe-fetch";

export type { FetchLike };

export const NAVER_NEWS_ENDPOINT = "https://openapi.naver.com/v1/search/news.json";

export class NaverNewsError extends Error {}

type NaverNewsItem = {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
};

export function getNaverSearchCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function searchNaverNews(
  query: string,
  opts: { display?: number; fetchImpl?: FetchLike } = {}
): Promise<CandidateArticle[]> {
  const credentials = getNaverSearchCredentials();
  if (!credentials) {
    throw new NaverNewsError("NAVER_SEARCH_CLIENT_ID/SECRET 환경변수가 설정되지 않았습니다.");
  }

  const url = new URL(NAVER_NEWS_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(Math.min(100, Math.max(1, opts.display ?? 100))));
  url.searchParams.set("sort", "date");

  const fetchImpl: FetchLike = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(url, {
    headers: {
      "X-Naver-Client-Id": credentials.clientId,
      "X-Naver-Client-Secret": credentials.clientSecret,
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new NaverNewsError(`네이버 뉴스 API 오류: HTTP ${res.status}`);

  const body = (await res.json()) as { items?: NaverNewsItem[] };
  return (body.items ?? []).flatMap((item): CandidateArticle[] => {
    const originalUrl = item.originallink || item.link;
    const publishedAt = new Date(item.pubDate);
    const title = cleanText(item.title);
    if (!originalUrl || !title || Number.isNaN(publishedAt.getTime())) return [];
    const snippet = cleanText(item.description).slice(0, SNIPPET_MAX_LENGTH);
    return [{ title, snippet: snippet || null, originalUrl, publishedAt, origin: "NAVER_API" }];
  });
}
