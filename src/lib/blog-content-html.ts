import type { JSONContent } from "@tiptap/core";
import type { BlogPostContent, TiptapBlogContent } from "@/types/blocknote";
import { isTiptapDocument } from "@/types/blocknote";
import { withBlogRef } from "@/lib/ax-check/ref";

export type BlogContentHtmlOptions = {
  /** 지정하면 본문의 /ax-check 링크에 ref=blog-{slug}를 자동 부여한다(ref가 이미 있으면 유지). */
  blogSlug?: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

function tiptapNodeToHtml(node: JSONContent, options: BlogContentHtmlOptions): string {
  const type = node.type ?? "";
  const text = node.text ? escapeHtml(node.text) : "";
  const attrs = node.attrs as Record<string, string | number | boolean | null> | undefined;

  if (node.content?.length) {
    const inner = node.content.map((child) => tiptapNodeToHtml(child, options)).join("");
    switch (type) {
      case "doc":
        return inner;
      case "paragraph":
        return `<p>${inner}</p>`;
      case "heading": {
        const level = Math.min(6, Math.max(2, Number(attrs?.level ?? 2)));
        return `<h${level}>${inner}</h${level}>`;
      }
      case "bulletList":
        return `<ul>${inner}</ul>`;
      case "orderedList":
        return `<ol>${inner}</ol>`;
      case "listItem":
        return `<li>${inner}</li>`;
      case "blockquote":
        return `<blockquote>${inner}</blockquote>`;
      case "codeBlock": {
        const language = typeof attrs?.language === "string" ? attrs.language : "";
        const langAttr = language ? ` class="language-${escapeAttr(language)}"` : "";
        return `<pre><code${langAttr}>${inner}</code></pre>`;
      }
      case "table":
        return `<table>${inner}</table>`;
      case "tableRow":
        return `<tr>${inner}</tr>`;
      case "tableHeader":
        return `<th>${inner}</th>`;
      case "tableCell":
        return `<td>${inner}</td>`;
      default:
        return inner;
    }
  }

  switch (type) {
    case "text": {
      let result = text;
      const marks = node.marks ?? [];
      for (const mark of marks) {
        if (mark.type === "bold") result = `<strong>${result}</strong>`;
        if (mark.type === "italic") result = `<em>${result}</em>`;
        if (mark.type === "underline") result = `<u>${result}</u>`;
        if (mark.type === "strike") result = `<s>${result}</s>`;
        if (mark.type === "code") result = `<code>${result}</code>`;
        if (mark.type === "link" && typeof mark.attrs?.href === "string") {
          const href = options.blogSlug
            ? withBlogRef(mark.attrs.href, options.blogSlug)
            : mark.attrs.href;
          result = `<a href="${escapeAttr(href)}" rel="noopener noreferrer">${result}</a>`;
        }
      }
      return result;
    }
    case "hardBreak":
      return "<br />";
    case "horizontalRule":
      return "<hr />";
    case "image": {
      const src = typeof attrs?.src === "string" ? attrs.src : "";
      const alt = typeof attrs?.alt === "string" ? attrs.alt : "";
      if (!src) return "";
      return `<figure><img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy" /></figure>`;
    }
    case "youtube": {
      const src = typeof attrs?.src === "string" ? attrs.src : "";
      if (!src) return "";
      return `<p><a href="${escapeAttr(src)}" rel="noopener noreferrer">${escapeHtml(src)}</a></p>`;
    }
    default:
      return text;
  }
}

function tiptapToHtml(doc: TiptapBlogContent, options: BlogContentHtmlOptions): string {
  return tiptapNodeToHtml(doc, options);
}

/** 블로그 본문 JSON을 크롤러가 읽을 수 있는 HTML 문자열로 변환합니다. */
export function blogContentToHtml(
  content: BlogPostContent | null,
  options: BlogContentHtmlOptions = {}
): string {
  if (!content) return "";
  if (isTiptapDocument(content)) return tiptapToHtml(content, options);
  return "";
}

/** 메타 설명·스니펫용 평문 추출 */
export function blogContentToPlainText(content: BlogPostContent | null): string {
  const html = blogContentToHtml(content);
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
