import { ImageResponse } from "next/og";
import { OG_LOGO_DATA_URI } from "@/lib/og-logo";

export const runtime = "edge";
export const alt = "CoreDXI — 비즈니스의 중심을 AI로 깨우다";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#1E4E8C";
const ACCENT = "#3b82f6";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0f172a",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* 상단: 로고 워드마크 */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og(satori) 렌더 트리는 next/image를 지원하지 않음 */}
          <img
            src={OG_LOGO_DATA_URI}
            alt=""
            width={48}
            height={48}
            style={{ display: "flex" }}
          />
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
          <div
            style={{
              marginLeft: 16,
              paddingLeft: 16,
              borderLeft: "1px solid #334155",
              display: "flex",
            }}
          >
            <span style={{ fontSize: 18, color: "#64748b", fontWeight: 400 }}>
              AI 기반 AX 전환 솔루션
            </span>
          </div>
        </div>

        {/* 중앙: 헤드라인 */}
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
              fontSize: 68,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.1,
              letterSpacing: "-1.5px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>비즈니스의 중심을</span>
            <span style={{ color: ACCENT }}>AI로 깨우다</span>
          </div>
          <span
            style={{
              fontSize: 24,
              color: "#94a3b8",
              fontWeight: 400,
              lineHeight: 1.5,
            }}
          >
            복잡한 협업은 심플하게, 변화는 단단하게.
          </span>
        </div>

        {/* 하단: 수치 배지 + URL */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {(
            [
              { num: "50+", label: "도입 기업" },
              { num: "98%", label: "고객 만족도" },
              { num: "3×", label: "업무 효율" },
            ] as { num: string; label: string }[]
          ).map(({ num, label }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 10,
                padding: "10px 18px",
              }}
            >
              <span
                style={{ fontSize: 26, fontWeight: 800, color: ACCENT }}
              >
                {num}
              </span>
              <span style={{ fontSize: 15, color: "#94a3b8" }}>{label}</span>
            </div>
          ))}

          <div style={{ display: "flex", flex: 1, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 18, color: "#475569" }}>
              www.coredxi.com
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
