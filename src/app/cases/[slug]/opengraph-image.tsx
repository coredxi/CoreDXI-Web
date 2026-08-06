import { getPortfolioBySlugOrId } from "@/lib/portfolio";
import {
  createOgImageResponse,
  OG_CONTENT_TYPE,
  OG_SIZE,
} from "@/lib/og-image";

export const runtime = "nodejs";

type PageProps = { params: Promise<{ slug: string }> };

// [홍보팀] 사례 제목을 반영한 동적 alt 텍스트를 만들기 위해 정적 alt export 대신 generateImageMetadata를 사용한다.
export async function generateImageMetadata({ params }: PageProps) {
  const { slug: param } = await params;
  const item = await getPortfolioBySlugOrId(param);

  return [
    {
      id: "og",
      alt: item?.title ?? "CoreDXI 성공사례",
      size: OG_SIZE,
      contentType: OG_CONTENT_TYPE,
    },
  ];
}

export default async function OpenGraphImage({ params }: PageProps) {
  const { slug: param } = await params;
  const item = await getPortfolioBySlugOrId(param);

  return createOgImageResponse({
    badge: "성공사례",
    title: item?.title ?? "CoreDXI 성공사례",
    subtitle: item
      ? `${item.clientName} · ${item.metrics}`
      : "CoreDXI와 함께한 AX 전환 성공사례",
    backgroundImageUrl: item?.thumbnailUrl,
  });
}
