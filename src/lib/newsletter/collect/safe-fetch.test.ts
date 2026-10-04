import { describe, expect, it, vi } from "vitest";
import { UnsafeUrlError, decodeFeedBody, detectCharset, safeFetchText, type FetchLike } from "./safe-fetch";

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("detectCharset / decodeFeedBody", () => {
  it("Content-Type 헤더의 charset이 최우선", () => {
    expect(detectCharset(utf8("<?xml version='1.0'?>"), "text/xml; charset=EUC-KR")).toBe("euc-kr");
  });

  it("헤더에 없으면 XML 선언의 encoding", () => {
    expect(detectCharset(utf8('<?xml version="1.0" encoding="euc-kr"?><rss/>'), "text/xml")).toBe("euc-kr");
  });

  it("둘 다 없으면 utf-8", () => {
    expect(detectCharset(utf8("<rss/>"), null)).toBe("utf-8");
  });

  it("EUC-KR 바이트를 한글로 디코딩한다", () => {
    const bytes = new Uint8Array([0xc7, 0xd1, 0xb1, 0xb9]); // "한국"
    expect(decodeFeedBody(bytes, "text/xml; charset=euc-kr")).toBe("한국");
  });

  it("알 수 없는 charset이면 utf-8로 폴백", () => {
    expect(decodeFeedBody(utf8("가나"), "text/xml; charset=x-unknown")).toBe("가나");
  });
});

describe("safeFetchText", () => {
  it("안전하지 않은 URL은 fetch 없이 거부", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    await expect(safeFetchText("http://example.com/rss", { fetchImpl })).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("리다이렉트 목적지도 매 hop 검사한다(사설 IP로 튀는 리다이렉트 차단)", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest" } })
    );
    await expect(safeFetchText("https://example.com/rss", { fetchImpl })).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("안전한 리다이렉트는 따라가 본문을 돌려준다", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/feed.xml" } }))
      .mockResolvedValueOnce(new Response("<rss/>", { status: 200, headers: { "content-type": "text/xml" } }));
    await expect(safeFetchText("https://example.com/rss", { fetchImpl })).resolves.toBe("<rss/>");
    expect(String(fetchImpl.mock.calls[1][0])).toBe("https://example.com/feed.xml");
  });

  it("리다이렉트가 3번 이상이면 실패", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockImplementation(async () =>
      new Response(null, { status: 302, headers: { location: "https://example.com/again" } })
    );
    await expect(safeFetchText("https://example.com/rss", { fetchImpl })).rejects.toThrow("리다이렉트");
  });

  it("HTTP 오류는 상태코드를 담아 실패", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(new Response("x", { status: 503 }));
    await expect(safeFetchText("https://example.com/rss", { fetchImpl })).rejects.toThrow("503");
  });
});
