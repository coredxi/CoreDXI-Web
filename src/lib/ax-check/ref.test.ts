import { describe, expect, it } from "vitest";
import {
  FIRST_REF_STORAGE_KEY,
  blogRefCode,
  buildRefFilterOptions,
  matchesRefFilter,
  normalizeRefCode,
  readStoredRef,
  resolveRefCode,
  storeFirstRef,
  withBlogRef,
} from "./ref";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    data,
  };
}

const throwingStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("normalizeRefCode", () => {
  it("영소문자·숫자·하이픈만 허용하고 소문자로 정규화한다", () => {
    expect(normalizeRefCode("sales-kim")).toBe("sales-kim");
    expect(normalizeRefCode("  Sales-Kim ")).toBe("sales-kim");
    expect(normalizeRefCode("internal-test")).toBe("internal-test");
  });

  it("허용 패턴 밖이면 null", () => {
    expect(normalizeRefCode("")).toBeNull();
    expect(normalizeRefCode("sales kim")).toBeNull();
    expect(normalizeRefCode("<script>")).toBeNull();
    expect(normalizeRefCode("영업")).toBeNull();
    expect(normalizeRefCode("a".repeat(81))).toBeNull();
    expect(normalizeRefCode(undefined)).toBeNull();
    expect(normalizeRefCode(["sales-kim"])).toBeNull();
  });
});

describe("resolveRefCode", () => {
  it("URL ref가 세션 ref보다 우선한다", () => {
    expect(resolveRefCode("sales-kim", "blog-foo")).toBe("sales-kim");
  });

  it("URL ref가 없거나 잘못되면 세션 ref를 쓴다", () => {
    expect(resolveRefCode(undefined, "sales-kim")).toBe("sales-kim");
    expect(resolveRefCode("bad ref", "sales-kim")).toBe("sales-kim");
  });

  it("URL ref가 블로그 CTA 자동 ref(blog-*)면 보관된 최초 유입 ref가 우선한다", () => {
    expect(resolveRefCode("blog-my-post", "internal-test")).toBe("internal-test");
    expect(resolveRefCode("blog-my-post", "blog-other-post")).toBe("blog-other-post");
  });

  it("최초 유입 ref가 없으면 blog-*를 그대로 쓴다", () => {
    expect(resolveRefCode("blog-my-post", null)).toBe("blog-my-post");
    expect(resolveRefCode("blog-my-post", "bad ref!")).toBe("blog-my-post");
  });

  it("blog-*가 아닌 URL ref(직접 입력한 링크)는 지금처럼 URL이 우선한다", () => {
    expect(resolveRefCode("newsletter", "sales-kim")).toBe("newsletter");
  });

  it("둘 다 없으면 null", () => {
    expect(resolveRefCode(undefined, null)).toBeNull();
  });
});

describe("storeFirstRef / readStoredRef", () => {
  it("최초 ref만 보관하고 이후 ref로 덮어쓰지 않는다", () => {
    const storage = memoryStorage();
    storeFirstRef(storage, "sales-kim");
    storeFirstRef(storage, "newsletter");
    expect(readStoredRef(storage)).toBe("sales-kim");
  });

  it("잘못된 ref는 보관하지 않는다", () => {
    const storage = memoryStorage();
    storeFirstRef(storage, "bad ref!");
    expect(storage.data.has(FIRST_REF_STORAGE_KEY)).toBe(false);
  });

  it("보관값이 변조돼 있으면 무시한다", () => {
    expect(readStoredRef(memoryStorage({ [FIRST_REF_STORAGE_KEY]: "<x>" }))).toBeNull();
  });

  it("저장소 접근이 실패해도 예외 없이 동작한다", () => {
    expect(() => storeFirstRef(throwingStorage, "sales-kim")).not.toThrow();
    expect(readStoredRef(throwingStorage)).toBeNull();
    expect(readStoredRef(null)).toBeNull();
  });
});

describe("blogRefCode", () => {
  it("blog-{slug} 형태로 만든다", () => {
    expect(blogRefCode("claude-tips")).toBe("blog-claude-tips");
  });

  it("허용 길이를 넘으면 자르고 결과는 항상 유효한 ref다", () => {
    const ref = blogRefCode(`${"a".repeat(74)}-b-c`);
    expect(ref.length).toBeLessThanOrEqual(80);
    expect(normalizeRefCode(ref)).toBe(ref);
  });
});

describe("withBlogRef", () => {
  it("ref 없는 /ax-check 링크에 blog ref를 붙인다", () => {
    expect(withBlogRef("/ax-check", "my-post")).toBe("/ax-check?ref=blog-my-post");
    expect(withBlogRef("/ax-check?utm_source=x#top", "my-post")).toBe(
      "/ax-check?utm_source=x&ref=blog-my-post#top"
    );
    expect(withBlogRef("https://www.coredxi.com/ax-check", "my-post")).toBe(
      "https://www.coredxi.com/ax-check?ref=blog-my-post"
    );
    expect(withBlogRef("https://coredxi.com/ax-check/", "my-post")).toBe(
      "https://coredxi.com/ax-check/?ref=blog-my-post"
    );
  });

  it("작성자가 넣은 ref는 그대로 둔다", () => {
    expect(withBlogRef("/ax-check?ref=sales-kim", "my-post")).toBe("/ax-check?ref=sales-kim");
  });

  it("다른 경로·외부 사이트 링크는 건드리지 않는다", () => {
    expect(withBlogRef("/contact", "my-post")).toBe("/contact");
    expect(withBlogRef("/ax-check/result/abc", "my-post")).toBe("/ax-check/result/abc");
    expect(withBlogRef("https://example.com/ax-check", "my-post")).toBe(
      "https://example.com/ax-check"
    );
    expect(withBlogRef("//example.com/ax-check", "my-post")).toBe("//example.com/ax-check");
  });
});

describe("/admin/leads ref 필터", () => {
  const refs = ["sales-kim", "blog-a", "blog-b", null, "sales-kim", "blog-a"];

  it("전체·블로그 묶음·ref 없음·개별 ref 건수를 만든다", () => {
    expect(buildRefFilterOptions(refs)).toEqual([
      { value: "all", label: "전체", count: 6 },
      { value: "blog", label: "블로그 전체 (blog-*)", count: 3 },
      { value: "none", label: "ref 없음 (직접 유입)", count: 1 },
      { value: "ref:blog-a", label: "blog-a", count: 2 },
      { value: "ref:sales-kim", label: "sales-kim", count: 2 },
      { value: "ref:blog-b", label: "blog-b", count: 1 },
    ]);
  });

  it("필터 값에 맞는 리드만 통과시킨다", () => {
    expect(refs.filter((r) => matchesRefFilter(r, "all"))).toHaveLength(6);
    expect(refs.filter((r) => matchesRefFilter(r, "blog"))).toEqual(["blog-a", "blog-b", "blog-a"]);
    expect(refs.filter((r) => matchesRefFilter(r, "none"))).toEqual([null]);
    expect(refs.filter((r) => matchesRefFilter(r, "ref:sales-kim"))).toHaveLength(2);
  });
});
