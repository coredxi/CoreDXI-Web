import { describe, expect, it } from "vitest";
import { extractHighlight, parseDraftMarkdownToDoc, parseInline } from "./markdown-to-tiptap";

describe("parseInline", () => {
  it("굵게/기울임/코드/링크 마크를 각각 파싱한다", () => {
    const nodes = parseInline("일반 **굵게** 그리고 *기울임* 과 `코드` 와 [링크](https://a.b)");
    expect(nodes).toEqual([
      { type: "text", text: "일반 " },
      { type: "text", text: "굵게", marks: [{ type: "bold" }] },
      { type: "text", text: " 그리고 " },
      { type: "text", text: "기울임", marks: [{ type: "italic" }] },
      { type: "text", text: " 과 " },
      { type: "text", text: "코드", marks: [{ type: "code" }] },
      { type: "text", text: " 와 " },
      { type: "text", text: "링크", marks: [{ type: "link", attrs: { href: "https://a.b" } }] },
    ]);
  });

  it("마크가 없으면 순수 텍스트 노드 하나만 반환한다", () => {
    expect(parseInline("그냥 문장입니다")).toEqual([{ type: "text", text: "그냥 문장입니다" }]);
  });
});

describe("parseDraftMarkdownToDoc", () => {
  it("첫 줄의 H1(게시글 제목 중복)은 건너뛰고 ###만 heading으로 변환한다", () => {
    const { doc } = parseDraftMarkdownToDoc("# 제목\n\n### 소제목\n\n본문 문단입니다.");
    expect(doc.content?.[0]).toEqual({
      type: "heading",
      attrs: { level: 3 },
      content: [{ type: "text", text: "소제목" }],
    });
    expect(doc.content?.[1]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "본문 문단입니다." }],
    });
  });

  it("연속된 '- ' 줄을 bulletList로 묶는다", () => {
    const { doc } = parseDraftMarkdownToDoc("- 첫째\n- 둘째\n- 셋째");
    expect(doc.content?.[0]).toEqual({
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "첫째" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "둘째" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "셋째" }] }] },
      ],
    });
  });

  it("연속된 'N. ' 줄을 orderedList로 묶는다", () => {
    const { doc } = parseDraftMarkdownToDoc("1. 하나\n2. 둘\n3. 셋");
    const node = doc.content?.[0];
    expect(node?.type).toBe("orderedList");
    expect(node?.attrs).toEqual({ start: 1 });
    expect(node?.content).toHaveLength(3);
  });

  it("파이프 테이블을 table/tableRow/tableHeader/tableCell로 변환한다", () => {
    const md = "| 이름 | 값 |\n|---|---|\n| A | 1 |\n| B | 2 |";
    const { doc } = parseDraftMarkdownToDoc(md);
    const table = doc.content?.[0];
    expect(table?.type).toBe("table");
    expect(table?.content).toHaveLength(3); // header row + 2 body rows
    expect(table?.content?.[0]).toEqual({
      type: "tableRow",
      content: [
        { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "이름" }] }] },
        { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "값" }] }] },
      ],
    });
    expect(table?.content?.[1]).toEqual({
      type: "tableRow",
      content: [
        { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }] },
        { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "1" }] }] },
      ],
    });
  });

  it("'---' 단독 줄은 horizontalRule로 변환한다", () => {
    const { doc } = parseDraftMarkdownToDoc("문단 하나\n\n---\n\n문단 둘");
    expect(doc.content?.[1]).toEqual({ type: "horizontalRule" });
  });

  it("### 섹션마다 heading 텍스트와 강조 문구를 sections로 반환한다", () => {
    const md = [
      "### 첫 번째 소제목",
      "",
      "일반 문장 뒤에 **강조된 핵심 문구**가 나온다.",
      "",
      "### 두 번째 소제목",
      "",
      "여기는 굵은 글씨가 없는 문단입니다. 두 번째 문장.",
    ].join("\n");
    const { sections } = parseDraftMarkdownToDoc(md);
    expect(sections).toEqual([
      { heading: "첫 번째 소제목", highlight: "강조된 핵심 문구" },
      { heading: "두 번째 소제목", highlight: "여기는 굵은 글씨가 없는 문단입니다." },
    ]);
  });
});

describe("extractHighlight", () => {
  it("굵게 표시가 있으면 그 문구를 우선 사용한다", () => {
    expect(extractHighlight("문장 중간에 **핵심 통계 33.4%** 가 있다")).toBe("핵심 통계 33.4%");
  });

  it("굵게 표시가 없으면 첫 문장을 사용한다", () => {
    expect(extractHighlight("첫 문장입니다. 둘째 문장입니다.")).toBe("첫 문장입니다.");
  });

  it("60자를 넘으면 말줄임표로 자른다", () => {
    const long = "가".repeat(80);
    const result = extractHighlight(long);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result.endsWith("…")).toBe(true);
  });
});
