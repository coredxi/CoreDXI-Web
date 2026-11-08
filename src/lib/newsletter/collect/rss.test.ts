import { describe, expect, it } from "vitest";
import { parseFeedDate, parseRssXml } from "./rss";

describe("parseFeedDate", () => {
  it("시간대 표기가 있으면 그대로 해석(RFC 822·콜론 오프셋·공백 누락 변형 포함)", () => {
    expect(parseFeedDate("Sat, 03 Oct 2026 11:41:45 +09:00")?.toISOString()).toBe("2026-10-03T02:41:45.000Z");
    expect(parseFeedDate("Sat,3 Oct 2026 13:24:20 +0900")?.toISOString()).toBe("2026-10-03T04:24:20.000Z");
    expect(parseFeedDate("Fri, 02 Oct 2026 09:00:06 +0000")?.toISOString()).toBe("2026-10-02T09:00:06.000Z");
    expect(parseFeedDate("2026-10-03T09:30:00Z")?.toISOString()).toBe("2026-10-03T09:30:00.000Z");
  });

  it("시간대 없는 날짜(아이티조선·블로터 등 ndsoft 계열)는 KST로 해석한다 — 서버 시간대(UTC)와 무관", () => {
    expect(parseFeedDate("2026-10-03 18:30:00")?.toISOString()).toBe("2026-10-03T09:30:00.000Z");
  });

  it("해석 불가면 null", () => {
    expect(parseFeedDate("garbage")).toBeNull();
    expect(parseFeedDate(undefined)).toBeNull();
  });
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>테스트</title>
<item><title><![CDATA[중소기업 <b>AI</b> 도입]]></title><link>https://www.etnews.com/1</link>
<pubDate>Mon, 05 Oct 2026 09:00:00 +0900</pubDate><description><![CDATA[<p>${"가".repeat(300)}</p>]]></description></item>
<item><title>링크 없음</title><pubDate>Mon, 05 Oct 2026 09:00:00 +0900</pubDate></item>
<item><title>날짜 없음</title><link>https://a.com/2</link></item>
</channel></rss>`;

describe("parseRssXml", () => {
  it("제목 정리·200자 요약·RSS origin으로 변환하고 불완전 항목은 버린다", async () => {
    const items = await parseRssXml(XML);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("중소기업 AI 도입");
    expect(items[0].originalUrl).toBe("https://www.etnews.com/1");
    expect(items[0].publishedAt.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(items[0].snippet?.length).toBe(200);
    expect(items[0].origin).toBe("RSS");
  });

  it("잘못된 XML은 예외", async () => {
    await expect(parseRssXml("<not-rss")).rejects.toThrow();
  });
});
