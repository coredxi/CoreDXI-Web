/**
 * markdown-to-tiptap.ts — blog-drafts/*.md 본문을 BlogPost.content(Tiptap JSON)로 변환.
 *
 * scripts/publish-blog-drafts.ts 전용 유틸. 새 markdown 파서 라이브러리(remark 등)를
 * 추가하지 않고, ../blog-drafts 초안 4편에서 실제로 쓰인 문법만 지원한다:
 * 헤딩(# 스킵, ### → heading level 3), 굵게(**)/기울임(*)/인라인코드(`)/링크([]()),
 * 불릿(- )·번호(N. ) 목록, 파이프 테이블, 수평선(---).
 *
 * 설계: docs/superpowers/plans(플랜 파일 "블로그 초안 4편 — 이미지·표 보강 + 원클릭 등록 스크립트")
 */
import type { JSONContent } from "@tiptap/core";

export type DraftSection = {
  /** ### 소제목 원문 */
  heading: string;
  /** 카드 이미지에 넣을 짧은 강조 문구(섹션 내 첫 **굵게** 또는 첫 문장 요약) */
  highlight: string;
};

export type ParsedDraft = {
  doc: JSONContent;
  sections: DraftSection[];
};

// ── 인라인 마크 파싱 ─────────────────────────────────────────────
const INLINE_PATTERN =
  /\*\*([^*]+?)\*\*|`([^`]+?)`|\[([^\]]+?)\]\(([^)]+?)\)|\*([^*]+?)\*/g;

export function parseInline(text: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  let lastIndex = 0;
  INLINE_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      if (plain) nodes.push({ type: "text", text: plain });
    }

    const [, bold, code, linkText, linkHref, italic] = match;
    if (bold !== undefined) {
      nodes.push({ type: "text", text: bold, marks: [{ type: "bold" }] });
    } else if (code !== undefined) {
      nodes.push({ type: "text", text: code, marks: [{ type: "code" }] });
    } else if (linkText !== undefined) {
      nodes.push({
        type: "text",
        text: linkText,
        marks: [{ type: "link", attrs: { href: linkHref } }],
      });
    } else if (italic !== undefined) {
      nodes.push({ type: "text", text: italic, marks: [{ type: "italic" }] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    if (rest) nodes.push({ type: "text", text: rest });
  }

  return nodes;
}

function paragraphNode(text: string): JSONContent {
  const content = parseInline(text);
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

// ── 섹션 강조 문구 추출 (이미지 카드용) ───────────────────────────
export function extractHighlight(rawText: string): string {
  const boldMatch = /\*\*([^*]+?)\*\*/.exec(rawText);
  if (boldMatch) return truncate(boldMatch[1].trim(), 60);

  const stripped = rawText
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/\*([^*]+?)\*/g, "$1")
    .replace(/`([^`]+?)`/g, "$1")
    .replace(/\[([^\]]+?)\]\([^)]+?\)/g, "$1")
    .trim();

  const firstSentence = stripped.split(/(?<=[.다요!?])\s/)[0] ?? stripped;
  return truncate(firstSentence.trim(), 60);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

// ── 블록 파싱 ────────────────────────────────────────────────────
function headingLevel(line: string): number {
  const match = /^(#{1,6})\s+(.*)$/.exec(line);
  return match ? match[1].length : 0;
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") || /^\s*\S.*\|/.test(line);
}

function isTableSeparatorRow(line: string): boolean {
  const t = line.trim();
  return /^[|:\-\s]+$/.test(t) && t.includes("-");
}

function splitTableCells(line: string): string[] {
  const t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return t.split("|").map((c) => c.trim());
}

function tableCellNode(text: string, isHeader: boolean): JSONContent {
  return {
    type: isHeader ? "tableHeader" : "tableCell",
    content: [paragraphNode(text)],
  };
}

/**
 * ../blog-drafts/*.md "## 본문 (재가공 완료본)" 섹션의 markdown 텍스트를
 * Tiptap doc JSON + 섹션(###) 목록으로 변환한다.
 */
export function parseDraftMarkdownToDoc(markdown: string): ParsedDraft {
  const rawLines = markdown.replace(/\r\n/g, "\n").split("\n");

  // 앞뒤 빈 줄 정리
  let start = 0;
  let end = rawLines.length;
  while (start < end && rawLines[start].trim() === "") start += 1;
  while (end > start && rawLines[end - 1].trim() === "") end -= 1;
  const lines = rawLines.slice(start, end);

  const nodes: JSONContent[] = [];
  type SectionAcc = { heading: string; rawTextParts: string[] };
  const sectionAccs: SectionAcc[] = [];
  let currentSection: SectionAcc | null = null;

  const recordRaw = (text: string) => {
    if (currentSection) currentSection.rawTextParts.push(text);
  };

  let i = 0;

  // 본문 첫 줄이 "# 제목" (레벨1)이면 스킵 — 게시글 title 필드와 중복
  if (i < lines.length && headingLevel(lines[i]) === 1) {
    i += 1;
    while (i < lines.length && lines[i].trim() === "") i += 1;
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const level = headingLevel(line);
    if (level === 3) {
      const text = line.replace(/^#{1,6}\s+/, "").trim();
      nodes.push({ type: "heading", attrs: { level: 3 }, content: parseInline(text) });
      currentSection = { heading: text, rawTextParts: [] };
      sectionAccs.push(currentSection);
      i += 1;
      continue;
    }
    if (level > 0) {
      // 예상치 못한 헤딩 레벨(#, ##, ####+) — 본문에는 나타나지 않지만 방어적으로 heading 3 취급
      const text = line.replace(/^#{1,6}\s+/, "").trim();
      nodes.push({ type: "heading", attrs: { level: 3 }, content: parseInline(text) });
      recordRaw(text);
      i += 1;
      continue;
    }

    if (line.trim() === "---") {
      nodes.push({ type: "horizontalRule" });
      i += 1;
      continue;
    }

    // 테이블: "|"로 시작하는 연속 줄
    if (isTableRow(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i]) && lines[i].trim() !== "") {
        tableLines.push(lines[i]);
        i += 1;
      }
      if (tableLines.length >= 2 && isTableSeparatorRow(tableLines[1])) {
        const headerCells = splitTableCells(tableLines[0]);
        const bodyRows = tableLines.slice(2);
        const rows: JSONContent[] = [];
        rows.push({
          type: "tableRow",
          content: headerCells.map((c) => tableCellNode(c, true)),
        });
        for (const rowLine of bodyRows) {
          const cells = splitTableCells(rowLine);
          rows.push({
            type: "tableRow",
            content: cells.map((c) => tableCellNode(c, false)),
          });
        }
        nodes.push({ type: "table", content: rows });
        recordRaw(tableLines.join(" "));
        continue;
      }
      // 표로 인식은 됐지만 구분행이 없으면 각 줄을 그냥 문단으로 되돌림
      for (const l of tableLines) {
        nodes.push(paragraphNode(l.trim()));
        recordRaw(l);
      }
      continue;
    }

    // 불릿 목록
    if (/^-\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^-\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^-\s+/, ""));
        i += 1;
      }
      nodes.push({
        type: "bulletList",
        content: items.map((t) => ({
          type: "listItem",
          content: [paragraphNode(t)],
        })),
      });
      recordRaw(items.join(" "));
      continue;
    }

    // 번호 목록
    if (/^\d+\.\s+/.test(line.trim())) {
      const items: string[] = [];
      let startNum: number | null = null;
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const m = /^(\d+)\.\s+(.*)$/.exec(lines[i].trim())!;
        if (startNum === null) startNum = Number(m[1]);
        items.push(m[2]);
        i += 1;
      }
      nodes.push({
        type: "orderedList",
        attrs: { start: startNum ?? 1 },
        content: items.map((t) => ({
          type: "listItem",
          content: [paragraphNode(t)],
        })),
      });
      recordRaw(items.join(" "));
      continue;
    }

    // 일반 문단 — 다음 빈 줄/특수 블록 전까지 연속 줄을 한 문단으로 합침
    {
      const parts: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        headingLevel(lines[i]) === 0 &&
        lines[i].trim() !== "---" &&
        !isTableRow(lines[i]) &&
        !/^-\s+/.test(lines[i].trim()) &&
        !/^\d+\.\s+/.test(lines[i].trim())
      ) {
        parts.push(lines[i].trim());
        i += 1;
      }
      const text = parts.join(" ");
      nodes.push(paragraphNode(text));
      recordRaw(text);
    }
  }

  const sections: DraftSection[] = sectionAccs.map((s) => ({
    heading: s.heading,
    highlight: extractHighlight(s.rawTextParts.join(" ")),
  }));

  return { doc: { type: "doc", content: nodes }, sections };
}
