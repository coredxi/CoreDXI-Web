import { ImageResponse } from "next/og";
import { getSupabaseStorageHost, isAllowedOgBackgroundUrl } from "./url-safety";
import { decideOgBackgroundDataUri, loadOgBackgroundDataUri } from "./og-background";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const BRAND = "#1E4E8C";
const ACCENT = "#3b82f6";

type OgCardInput = {
  badge: string;
  title: string;
  subtitle: string;
  footer?: string;
  /** 블로그 커버·성공사례 썸네일 URL. 없거나 검증/로드 실패 시 배지형으로 폴백한다. */
  backgroundImageUrl?: string | null;
};

export async function createOgImageResponse({
  badge,
  title,
  subtitle,
  footer = "www.coredxi.com",
  backgroundImageUrl,
}: OgCardInput) {
  const isAllowedUrl = backgroundImageUrl
    ? isAllowedOgBackgroundUrl(backgroundImageUrl, getSupabaseStorageHost())
    : false;
  const dataUri =
    backgroundImageUrl && isAllowedUrl
      ? await loadOgBackgroundDataUri(backgroundImageUrl)
      : null;
  const background = decideOgBackgroundDataUri({
    backgroundImageUrl,
    isAllowedUrl,
    dataUri,
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          display: "flex",
          position: "relative",
          backgroundColor: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        {background ? (
          // eslint-disable-next-line @next/next/no-img-element -- next/og(satori) 렌더 트리는 next/image를 지원하지 않음
          <img
            src={background}
            alt=""
            width={OG_SIZE.width}
            height={OG_SIZE.height}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: OG_SIZE.width,
              height: OG_SIZE.height,
              objectFit: "cover",
            }}
          />
        ) : null}
        {background ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              display: "flex",
              width: OG_SIZE.width,
              height: OG_SIZE.height,
              backgroundImage:
                "linear-gradient(to top, rgba(15,23,42,0.88), rgba(15,23,42,0.35))",
            }}
          />
        ) : null}
        {/* 배경 레이어 위에 그리기 위해 콘텐츠를 별도 relative 레이어로 분리 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: OG_SIZE.width,
            height: OG_SIZE.height,
            position: "relative",
            padding: "64px 72px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                backgroundColor: BRAND,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  border: "3px solid white",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 34,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.5px",
              }}
            >
              CoreDXI
            </span>
            <span style={{ fontSize: 18, color: "#64748b", marginLeft: 8 }}>
              {badge}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                width: 48,
                height: 4,
                backgroundColor: BRAND,
                borderRadius: 2,
              }}
            />
            <div
              style={{
                fontSize: 56,
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.15,
                letterSpacing: "-1px",
                maxWidth: 980,
              }}
            >
              {title}
            </div>
            <span
              style={{
                fontSize: 24,
                color: "#94a3b8",
                fontWeight: 400,
                lineHeight: 1.5,
                maxWidth: 900,
              }}
            >
              {subtitle}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 18, color: ACCENT }}>{footer}</span>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
