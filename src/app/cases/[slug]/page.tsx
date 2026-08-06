import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { getPortfolioBySlugOrId } from "@/lib/portfolio";
import { buildBreadcrumbJsonLd, buildCaseStudyJsonLd } from "@/lib/seo-jsonld";
import { siteUrl } from "@/lib/seo";
import { getVideoEmbedUrl } from "@/lib/video-embed";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: param } = await params;
  const item = await getPortfolioBySlugOrId(param);
  if (!item) return { title: "성공사례" };

  const description = `${item.clientName} · ${item.metrics}`;
  const canonical = siteUrl(`/cases/${item.slug}`);

  return {
    title: item.title,
    description,
    alternates: { canonical },
    // og:image/twitter:image는 파일 기반 opengraph-image.tsx(합성형 카드)가 단독 책임진다 —
    // 여기서 images를 지정하면 파일 기반과 우선순위가 충돌하고 채널별 이미지가 불일치할 수 있다.
    openGraph: {
      type: "article",
      locale: "ko_KR",
      siteName: "CoreDXI",
      title: item.title,
      description,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description,
    },
  };
}

export default async function CaseDetailPage({ params }: PageProps) {
  const { slug: param } = await params;
  const item = await getPortfolioBySlugOrId(param);
  if (!item) notFound();

  if (param !== item.slug) {
    redirect(`/cases/${item.slug}`);
  }

  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const embedUrl = item.videoUrl ? getVideoEmbedUrl(item.videoUrl) : null;
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "성공사례", path: "/cases" },
    { name: item.title, path: `/cases/${item.slug}` },
  ]);
  const caseStudyJsonLd = buildCaseStudyJsonLd({
    title: item.title,
    description: `${item.clientName} · ${item.metrics}`,
    url: siteUrl(`/cases/${item.slug}`),
    image: item.thumbnailUrl,
    clientName: item.clientName,
    datePublished: item.createdAt.toISOString(),
    dateModified: item.updatedAt.toISOString(),
  });

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(caseStudyJsonLd),
        }}
      />
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-16">
        <article className="mx-auto max-w-3xl px-6">
          <Link
            href="/cases"
            className="mb-6 inline-flex text-sm font-medium text-primary hover:underline"
          >
            ← 목록으로
          </Link>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="relative aspect-[16/9] bg-muted">
              <Image
                src={item.thumbnailUrl}
                alt={item.title}
                fill
                className="object-cover"
                sizes="(min-width: 768px) 768px, 100vw"
                priority
              />
            </div>

            <div className="space-y-6 p-6 md:p-8">
              <div>
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary dark:text-blue-300">
                  {item.metrics}
                </span>
                <h1 className="mt-3 text-2xl font-bold text-foreground md:text-3xl">
                  {item.title}
                </h1>
                <p className="mt-1 text-muted-foreground">{item.clientName}</p>
              </div>

              {embedUrl ? (
                <div className="aspect-video overflow-hidden rounded-lg bg-black">
                  <iframe
                    src={embedUrl}
                    title={`${item.title} 동영상`}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : item.videoUrl ? (
                <a
                  href={item.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-sm font-medium text-primary hover:underline dark:text-blue-300"
                >
                  동영상 보기 →
                </a>
              ) : null}

              <div className="whitespace-pre-wrap leading-relaxed text-foreground">
                {item.content}
              </div>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
