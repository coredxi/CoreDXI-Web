import { describe, expect, it } from "vitest";
import { UNSUBSCRIBE_PLACEHOLDER, renderAxWeekly, withNewsletterUtm } from "./ax-weekly";

const SITE = "https://www.coredxi.com";
const input = {
  issueNo: 3,
  issueDate: new Date("2026-10-05T15:00:00Z"),
  subject: "[AX 위클리] 2026-10-06 소식",
  intro: "이번 주 소식입니다.",
  siteUrl: SITE,
  articles: [
    {
      title: 'AI "도입" <확산>',
      url: "https://www.etnews.com/1",
      sourceName: "전자신문",
      publishedAt: new Date("2026-10-05T00:00:00Z"),
      summary: "요약 두 문장.",
      snippet: "스니펫",
      editorNote: "꼭 보세요",
    },
    {
      title: "요약 없는 기사",
      url: "javascript:alert(1)",
      sourceName: null,
      publishedAt: new Date("2026-10-04T00:00:00Z"),
      summary: null,
      snippet: "스니펫만 있음",
      editorNote: null,
    },
  ],
};

describe("renderAxWeekly", () => {
  const out = renderAxWeekly(input);

  it("제목에 (광고)를 강제한다", () => {
    expect(out.subject).toBe("(광고) [AX 위클리] 2026-10-06 소식");
  });

  it("헤더에 회차·KST 발행일", () => {
    expect(out.html).toContain("AX 위클리 #3 · 2026-10-06");
  });

  it("기사 제목은 1회만 이스케이프(이중 이스케이프 없음)", () => {
    expect(out.html).toContain("AI &quot;도입&quot; &lt;확산&gt;");
    expect(out.html).not.toContain("&amp;quot;");
  });

  it("요약이 없으면 스니펫, 편집자 코멘트 노출", () => {
    expect(out.html).toContain("요약 두 문장.");
    expect(out.html).toContain("스니펫만 있음");
    expect(out.html).toContain("꼭 보세요");
  });

  it("http(s)가 아닌 기사 링크는 링크로 만들지 않는다", () => {
    expect(out.html).not.toContain("javascript:");
  });

  it("CTA는 utm이 붙은 /ax-check?ref=newsletter", () => {
    expect(out.html).toContain(
      "https://www.coredxi.com/ax-check?ref=newsletter&amp;utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=ax-weekly&amp;utm_content=issue-3"
    );
  });

  it("외부 기사 링크에는 utm을 붙이지 않는다", () => {
    expect(out.html).toContain('href="https://www.etnews.com/1"');
  });

  it("수신거부 자리표시자·회사 정보·발송 사유 문구가 HTML·텍스트 모두에 있다", () => {
    for (const body of [out.html, out.text]) {
      expect(body).toContain(UNSUBSCRIBE_PLACEHOLDER);
      expect(body).toContain("(주)코어디엑스아이");
      expect(body).toContain("뉴스레터 구독 신청에 따라 발송");
    }
  });
});

describe("withNewsletterUtm", () => {
  it("자사 도메인에만 utm을 붙이고 기존 쿼리를 유지한다", () => {
    expect(withNewsletterUtm(`${SITE}/blog/a?x=1`, 2, SITE)).toBe(
      `${SITE}/blog/a?x=1&utm_source=newsletter&utm_medium=email&utm_campaign=ax-weekly&utm_content=issue-2`
    );
    expect(withNewsletterUtm("https://other.com/a", 2, SITE)).toBe("https://other.com/a");
  });
});
