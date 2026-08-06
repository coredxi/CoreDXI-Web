import { describe, expect, it } from "vitest";
import { getSupabaseStorageHost, isAllowedOgBackgroundUrl, isBlockedHost } from "./url-safety";

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
