import { describe, expect, it } from "vitest";
import { getSupabaseStorageHost, isAllowedOgBackgroundUrl, isBlockedHost, isSafeFeedUrl } from "./url-safety";

describe("isBlockedHost", () => {
  it.each([
    "localhost",
    "LOCALHOST",
    "127.0.0.1",
    "::1",
    "192.168.0.1",
    "192.168.1.100",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "service.internal",
    "printer.local",
  ])("blocks %s", (host) => {
    expect(isBlockedHost(host)).toBe(true);
  });

  it.each([
    "example.com",
    "images.unsplash.com",
    "172.15.0.1", // just outside the 172.16-31 private range
    "172.32.0.1", // just outside the 172.16-31 private range
    "8.8.8.8",
    "sub.example.com",
  ])("allows %s", (host) => {
    expect(isBlockedHost(host)).toBe(false);
  });
});

describe("isAllowedOgBackgroundUrl", () => {
  const allowedHost = "abcxyz.supabase.co";

  it("allows an https URL on the whitelisted host", () => {
    expect(
      isAllowedOgBackgroundUrl(
        `https://${allowedHost}/storage/v1/object/public/blog-images/cover.jpg`,
        allowedHost
      )
    ).toBe(true);
  });

  it("blocks http (non-https) URLs even on the whitelisted host", () => {
    expect(
      isAllowedOgBackgroundUrl(`http://${allowedHost}/cover.jpg`, allowedHost)
    ).toBe(false);
  });

  it("blocks URLs on a different host", () => {
    expect(
      isAllowedOgBackgroundUrl("https://evil.example.com/cover.jpg", allowedHost)
    ).toBe(false);
  });

  it("blocks malformed URLs", () => {
    expect(isAllowedOgBackgroundUrl("not-a-url", allowedHost)).toBe(false);
  });

  it("blocks when allowedHost is not configured", () => {
    expect(
      isAllowedOgBackgroundUrl(`https://${allowedHost}/cover.jpg`, null)
    ).toBe(false);
  });
});

describe("getSupabaseStorageHost", () => {
  it("derives the hostname from NEXT_PUBLIC_SUPABASE_URL", () => {
    const original = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcxyz.supabase.co";

    expect(getSupabaseStorageHost()).toBe("abcxyz.supabase.co");

    process.env.NEXT_PUBLIC_SUPABASE_URL = original;
  });

  it("returns null when the env var is missing or malformed", () => {
    const original = process.env.NEXT_PUBLIC_SUPABASE_URL;

    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    expect(getSupabaseStorageHost()).toBeNull();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
    expect(getSupabaseStorageHost()).toBeNull();

    process.env.NEXT_PUBLIC_SUPABASE_URL = original;
  });
});

describe("isSafeFeedUrl", () => {
  it.each([
    "https://rss.etnews.com/Section901.xml",
    "https://www.mk.co.kr/rss/30000001/",
    "https://100.64.example.com/feed", // 도메인 차용은 허용 (IP 범위만 차단)
  ])("공개 https 피드는 허용: %s", (url) => {
    expect(isSafeFeedUrl(url)).toBe(true);
  });

  it.each([
    "http://rss.etnews.com/Section901.xml", // https 아님
    "https://localhost/feed",
    "https://localhost./feed", // 후행 점 제거 필요
    "https://127.0.0.1/feed",
    "https://127.0.0.2/feed", // 127.0.0.0/8 범위 전체 차단
    "https://0x7f.1/feed", // 정수형/16진 IP 표기
    "https://10.0.0.5/feed",
    "https://192.168.0.1/feed",
    "https://172.16.3.4/feed",
    "https://169.254.169.254/latest/meta-data", // 클라우드 메타데이터
    "https://100.64.0.1/feed", // CGNAT
    "https://0.0.0.0/feed",
    "https://2130706433/feed", // 정수형 127.0.0.1
    "https://[::1]/feed",
    "https://user:pass@example.com/feed",
    "https://intranet.internal/feed",
    "https://foo.internal./x", // 후행 점 제거 필요
    "not a url",
  ])("차단: %s", (url) => {
    expect(isSafeFeedUrl(url)).toBe(false);
  });
});
