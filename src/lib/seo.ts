import type { Metadata } from "next";

export const SITE_URL = "https://www.coredxi.com";

/**
 * [홍보팀] 링크 미리보기 이미지 주소입니다. 카카오톡 등은 이미지를 "주소" 단위로 오래 저장해 두므로,
 * src/app/opengraph-image.tsx 의 그림을 바꿀 때는 아래 v= 값을 그날 날짜로 올려야
 * 카톡 미리보기에도 새 그림이 나옵니다. (2026-11-13: 근거 없는 수치 → 20년·3분·4단계 교체)
 */
export const OG_IMAGE_VERSION = "20261113";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph-image?v=${OG_IMAGE_VERSION}`;

export function siteUrl(path = ""): string {
  if (!path || path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function ogImageToUrl(
  img: string | URL | { url: string | URL }
): string | undefined {
  if (typeof img === "string") return img;
  if (img instanceof URL) return img.toString();
  const url = img.url;
  return typeof url === "string" ? url : url.toString();
}

export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  openGraph?: Metadata["openGraph"];
}): Metadata {
  const canonical = siteUrl(input.path);
  const ogImages = input.openGraph?.images ?? [{ url: DEFAULT_OG_IMAGE }];
  const twitterImages = (Array.isArray(ogImages) ? ogImages : [ogImages])
    .map((img) => ogImageToUrl(img))
    .filter((url): url is string => Boolean(url));

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: "CoreDXI",
      title: input.title,
      description: input.description,
      url: canonical,
      ...input.openGraph,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: twitterImages.length > 0 ? twitterImages : [DEFAULT_OG_IMAGE],
    },
  };
}

export const NOINDEX_METADATA: Metadata = {
  robots: { index: false, follow: false },
};
