import { describe, expect, it } from "vitest";
import {
  buildListUnsubscribeHeaders,
  maskEmail,
  oneClickUnsubscribeUrl,
  unsubscribePageUrl,
} from "./newsletter-unsubscribe";

describe("newsletter-unsubscribe", () => {
  it("확인 화면·원클릭 주소를 만든다(끝 슬래시 정리)", () => {
    expect(unsubscribePageUrl("https://www.coredxi.com/", "tok")).toBe(
      "https://www.coredxi.com/unsubscribe/tok"
    );
    expect(oneClickUnsubscribeUrl("https://www.coredxi.com", "tok")).toBe(
      "https://www.coredxi.com/api/newsletter/unsubscribe/tok"
    );
  });

  it("https 주소에는 RFC 8058 원클릭 헤더를 함께 붙인다", () => {
    expect(buildListUnsubscribeHeaders("https://www.coredxi.com/api/newsletter/unsubscribe/tok")).toEqual({
      "List-Unsubscribe": "<https://www.coredxi.com/api/newsletter/unsubscribe/tok>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("mailto 주소에는 List-Unsubscribe만 붙인다", () => {
    expect(buildListUnsubscribeHeaders("mailto:a@coredxi.com")).toEqual({
      "List-Unsubscribe": "<mailto:a@coredxi.com>",
    });
  });

  it("이메일을 가린다", () => {
    expect(maskEmail("user@example.com")).toBe("us***@example.com");
    expect(maskEmail("ab@example.com")).toBe("a***@example.com");
    expect(maskEmail("broken")).toBe("***");
  });
});
