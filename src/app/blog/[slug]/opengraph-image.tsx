import { prisma } from "@/lib/prisma";
import {
  createOgImageResponse,
  OG_CONTENT_TYPE,
  OG_SIZE,
} from "@/lib/og-image";

export const runtime = "nodejs";

type PageProps = { params: Promise<{ slug: string }> };

// [홍보팀] 글 제목을 반영한 동적 alt 텍스트를 만들기 위해 정적 alt export 대신 generateImageMetadata를 사용한다.
export async function generateImageMetadata({ params }: PageProps) {
  const { slug } = await params;
  const post = await prisma.blogPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { title: true },
  });

  return [
    {
      id: "og",
      alt: post?.title ?? "CoreDXI 블로그",
      size: OG_SIZE,
      contentType: OG_CONTENT_TYPE,
    },
  ];
}

export default async function OpenGraphImage({ params }: PageProps) {
  const { slug } = await params;
  const post = await prisma.blogPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { title: true, excerpt: true, coverImageUrl: true },
  });

  return createOgImageResponse({
    badge: "블로그",
    title: post?.title ?? "CoreDXI 블로그",
    subtitle: post?.excerpt ?? "CoreDXI 소식·인사이트·고객 사례",
    backgroundImageUrl: post?.coverImageUrl,
  });
}
