import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

describe("buildCsp", () => {
  it("includes the nonce in script-src", () => {
    const csp = buildCsp("abc123==");
    expect(csp).toContain("'nonce-abc123=='");
  });

  it("includes strict-dynamic alongside the nonce in script-src", () => {
    const csp = buildCsp("abc123==");
    expect(csp).toMatch(/script-src[^;]*'strict-dynamic'/);
  });

  it("restricts default-src to self", () => {
    expect(buildCsp("n")).toContain("default-src 'self'");
  });

  it("allows https: images for hotlinked blog content", () => {
    expect(buildCsp("n")).toMatch(/img-src[^;]*https:/);
  });

  it("allows the GA4 script host and beacon hosts", () => {
    const csp = buildCsp("n");
    expect(csp).toContain("https://www.googletagmanager.com");
    expect(csp).toMatch(/connect-src[^;]*google-analytics\.com/);
  });

  it("allows GA4 collect endpoints on analytics.google.com and www.google.com", () => {
    const csp = buildCsp("n");
    expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.analytics\.google\.com/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/www\.google\.com(?=[ ;])/);
    // google.com 전체 와일드카드는 열지 않는다
    expect(csp).not.toMatch(/connect-src[^;]*https:\/\/\*\.google\.com/);
  });

  it("allows YouTube and Vimeo frame embeds", () => {
    const csp = buildCsp("n");
    expect(csp).toContain("https://www.youtube.com");
    expect(csp).toContain("https://player.vimeo.com");
  });

  it("blocks object-src entirely", () => {
    expect(buildCsp("n")).toContain("object-src 'none'");
  });

  it("restricts form-action and frame-ancestors to self", () => {
    const csp = buildCsp("n");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
  });

  it("points report-uri at the csp-report route", () => {
    expect(buildCsp("n")).toContain("report-uri /api/csp-report");
  });

  it("produces a different policy string for different nonces", () => {
    expect(buildCsp("aaa")).not.toEqual(buildCsp("bbb"));
  });
});
