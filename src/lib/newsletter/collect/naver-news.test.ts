import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NaverNewsError, searchNaverNews, type FetchLike } from "./naver-news";

beforeEach(() => {
  process.env.NAVER_SEARCH_CLIENT_ID = "id";
  process.env.NAVER_SEARCH_CLIENT_SECRET = "secret";
});
afterEach(() => {
  delete process.env.NAVER_SEARCH_CLIENT_ID;
  delete process.env.NAVER_SEARCH_CLIENT_SECRET;
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("searchNaverNews", () => {
  it("검색 전용 자격증명 헤더로 최신순 100건을 요청한다", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ items: [] }));
    await searchNaverNews("AI 도입", { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    const u = new URL(String(url));
    expect(u.origin + u.pathname).toBe("https://openapi.naver.com/v1/search/news.json");
    expect(u.searchParams.get("query")).toBe("AI 도입");
    expect(u.searchParams.get("display")).toBe("100");
    expect(u.searchParams.get("sort")).toBe("date");
    expect(new Headers(init?.headers).get("X-Naver-Client-Id")).toBe("id");
  });

  it("<b>·엔티티를 정리하고 originallink를 우선 사용한다", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse({
        items: [
          {
            title: "&quot;중소기업&quot; <b>AI 도입</b>",
            originallink: "https://www.etnews.com/1",
            link: "https://n.news.naver.com/1",
            description: "요약 <b>내용</b>",
            pubDate: "Mon, 05 Oct 2026 09:00:00 +0900",
          },
          {
            title: "원문 링크 없음",
            originallink: "",
            link: "https://n.news.naver.com/2",
            description: "",
            pubDate: "Mon, 05 Oct 2026 10:00:00 +0900",
          },
        ],
      })
    );
    const items = await searchNaverNews("AI", { fetchImpl });
    expect(items[0]).toEqual({
      title: '"중소기업" AI 도입',
      snippet: "요약 내용",
      originalUrl: "https://www.etnews.com/1",
      publishedAt: new Date("2026-10-05T00:00:00Z"),
      origin: "NAVER_API",
    });
    expect(items[1].originalUrl).toBe("https://n.news.naver.com/2");
    expect(items[1].snippet).toBeNull();
  });

  it("날짜를 해석할 수 없는 항목은 버린다", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse({ items: [{ title: "t", originallink: "https://a.com", link: "", description: "", pubDate: "garbage" }] })
    );
    expect(await searchNaverNews("AI", { fetchImpl })).toEqual([]);
  });

  it("자격증명이 없으면 NaverNewsError", async () => {
    delete process.env.NAVER_SEARCH_CLIENT_ID;
    await expect(searchNaverNews("AI", { fetchImpl: vi.fn<FetchLike>() })).rejects.toBeInstanceOf(NaverNewsError);
  });

  it("소셜 로그인용 NAVER_CLIENT_ID만 있으면 사용하지 않는다", async () => {
    delete process.env.NAVER_SEARCH_CLIENT_ID;
    process.env.NAVER_CLIENT_ID = "oauth-id";
    await expect(searchNaverNews("AI", { fetchImpl: vi.fn<FetchLike>() })).rejects.toBeInstanceOf(NaverNewsError);
    delete process.env.NAVER_CLIENT_ID;
  });

  it("HTTP 오류는 상태코드를 담은 NaverNewsError", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ errorMessage: "x" }, 429));
    await expect(searchNaverNews("AI", { fetchImpl })).rejects.toThrow("429");
  });
});
