import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BlogPostContentServer } from "@/components/editor/BlogPostContentServer";
import { prisma } from "@/lib/prisma";
import { buildBreadcrumbJsonLd } from "@/lib/seo-jsonld";
import { siteUrl } from "@/lib/seo";
import { normalizeBlogContent } from "@/types/blocknote";
import { formatKstDateLong } from "@/lib/format-kst-date";

export const revalidate = 60;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true },
    });
    return posts.map((post) => ({ slug: post.slug }));
  } catch (e) {
    // 빌드 환경에서 DB 연결이 일시적으로 실패해도 전체 빌드가 죽지 않도록 함.
    // dynamicParams(기본 true)로 인해 각 글은 첫 요청 시 온디맨드로 렌더된다.
    console.error("[blog/[slug]] generateStaticParams DB query failed:", e);
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      title: true,
      excerpt: true,
      coverImageUrl: true,
      publishedAt: true,
    },
  });

  if (!post) {
    return { title: "글을 찾을 수 없습니다" };
  }

  const description = post.excerpt ?? post.title;
  const canonical = siteUrl(`/blog/${slug}`);

  return {
    title: post.title,
    description,
    alternates: { canonical },
    // og:image/twitter:image는 파일 기반 opengraph-image.tsx(합성형 카드)가 단독 책임진다 —
    // 여기서 images를 지정하면 파일 기반과 우선순위가 충돌하고 채널별 이미지가 불일치할 수 있다.
    openGraph: {
      type: "article",
      locale: "ko_KR",
      siteName: "CoreDXI",
      title: post.title,
      description,
      url: canonical,
      publishedTime: post.publishedAt?.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await prisma.blogPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { category: { select: { name: true, slug: true } } },
  });
  if (!post) notFound();

  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const content = normalizeBlogContent(post.content);
  const postUrl = siteUrl(`/blog/${slug}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt ?? post.title,
    image: post.coverImageUrl ?? `${siteUrl()}/brand/logo.png`,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: {
      "@type": "Organization",
      name: "CoreDXI",
    },
    publisher: {
      "@type": "Organization",
      name: "CoreDXI",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl()}/brand/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    url: postUrl,
  };

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "블로그", path: "/blog" },
    {
      name: post.category.name,
      path: `/blog/category/${post.category.slug}`,
    },
    { name: post.title, path: `/blog/${slug}` },
  ]);

  return (
    <article>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />
      <Link
        href={`/blog/category/${post.category.slug}`}
        className="text-sm font-medium text-primary hover:underline"
      >
        {post.category.name}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        {post.title}
      </h1>
      {post.excerpt ? (
        <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>
      ) : null}
      {post.publishedAt ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {formatKstDateLong(post.publishedAt)}
        </p>
      ) : null}

      <div className="mt-10 rounded-xl border border-border bg-card p-4 shadow-sm md:p-8">
        <BlogPostContentServer content={content} />
      </div>
    </article>
  );
}
