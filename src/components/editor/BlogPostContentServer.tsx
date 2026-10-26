/**
 * BlogPostContentServer.tsx
 *
 * 블로그 글 본문을 서버에서 HTML로 렌더링합니다.
 * 검색엔진 크롤러가 JavaScript 없이도 본문 텍스트를 읽을 수 있게 합니다.
 */
import { blogContentToHtml } from "@/lib/blog-content-html";
import type { BlogPostContent } from "@/types/blocknote";

type Props = {
  content: BlogPostContent | null;
  /** [홍보팀] 글 주소 — 본문의 /ax-check 링크에 유입 경로(ref=blog-글주소)를 자동으로 붙이는 데 사용 */
  blogSlug?: string;
};

const CONTENT_CLASS =
  "max-w-none text-gray-800 [&_a]:text-primary [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:text-gray-600 [&_code]:rounded-lg [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:text-gray-500 [&_figure]:my-6 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-gray-900 [&_pre]:p-4 [&_pre]:text-gray-100 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6";

/** 서버 렌더 블로그 본문 — SEO·접근성용 시맨틱 HTML */
export function BlogPostContentServer({ content, blogSlug }: Props) {
  const html = blogContentToHtml(content, { blogSlug });

  if (!html) {
    return <p className="text-gray-500">본문이 없습니다.</p>;
  }

  return (
    <div
      className={CONTENT_CLASS}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
