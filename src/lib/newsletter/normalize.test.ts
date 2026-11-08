import { describe, expect, it } from "vitest";
import {
  cleanText,
  computeTitleHash,
  decodeEntities,
  hostOf,
  matchSourceByDomain,
  normalizeTitle,
  normalizeUrl,
} from "./normalize";

describe("normalizeUrl", () => {
  it("추적 파라미터·해시를 지우고 https·소문자 호스트로 통일한다", () => {
    expect(
      normalizeUrl("http://WWW.Example.com/news/1?utm_source=x&id=7&fbclid=abc#top")
    ).toBe("https://example.com/news/1?id=7");
  });

  it("남은 쿼리는 키 순서로 정렬해 같은 기사를 같은 키로 만든다", () => {
    expect(normalizeUrl("https://a.com/n?b=2&a=1")).toBe(normalizeUrl("https://a.com/n?a=1&b=2"));
  });

  it("모바일 서브도메인과 끝 슬래시를 정리한다", () => {
    expect(normalizeUrl("https://m.example.com/news/1/")).toBe("https://example.com/news/1");
  });

  it("http/https가 아니거나 잘못된 URL은 null", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
});

describe("cleanText / decodeEntities", () => {
  it("네이버 응답의 <b> 태그를 지우고 엔티티를 디코딩한다", () => {
    expect(cleanText("&quot;AI&quot; <b>도입</b> 가속&amp;확산")).toBe('"AI" 도입 가속&확산');
  });

  it("숫자 엔티티와 연속 공백을 처리한다", () => {
    expect(cleanText("A&#39;s  \n &#x4E2D; test")).toBe("A's 中 test");
  });

  it("모르는 엔티티는 그대로 둔다", () => {
    expect(decodeEntities("&unknown;")).toBe("&unknown;");
  });

  it("null/undefined는 빈 문자열", () => {
    expect(cleanText(null)).toBe("");
    expect(cleanText(undefined)).toBe("");
  });
});

describe("normalizeTitle / computeTitleHash", () => {
  it("말머리·괄호·매체명 접미를 제거해 전재 기사를 같은 해시로 묶는다", () => {
    const a = computeTitleHash("[단독] 중소기업 AI 도입 확산 (종합) - 전자신문");
    const b = computeTitleHash("중소기업 AI 도입 확산 | 매일경제");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it("다른 제목은 다른 해시", () => {
    expect(computeTitleHash("AI 도입 확산")).not.toBe(computeTitleHash("AI 도입 둔화"));
  });

  it("정규화 결과가 비어도 서로 다른 제목끼리 충돌하지 않는다", () => {
    expect(normalizeTitle("[속보]")).not.toBe("");
    expect(computeTitleHash("[속보]")).not.toBe(computeTitleHash("[단독]"));
  });
});

describe("hostOf / matchSourceByDomain", () => {
  const sources = [
    { id: "s1", domain: "mk.co.kr" },
    { id: "s2", domain: "etnews.com" },
  ];

  it("www·m 접두를 떼고 호스트를 돌려준다", () => {
    expect(hostOf("https://www.mk.co.kr/news/1")).toBe("mk.co.kr");
    expect(hostOf("bad")).toBeNull();
  });

  it("서브도메인까지 매칭한다", () => {
    expect(matchSourceByDomain("https://news.mk.co.kr/a", sources)?.id).toBe("s1");
    expect(matchSourceByDomain("https://m.etnews.com/b", sources)?.id).toBe("s2");
  });

  it("접미만 같은 다른 도메인은 매칭하지 않는다", () => {
    expect(matchSourceByDomain("https://fakemk.co.kr/a", sources)).toBeNull();
  });
});
