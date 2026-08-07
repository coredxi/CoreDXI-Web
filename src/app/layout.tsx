/**
 * layout.tsx — 공통 레이아웃
 *
 * 모든 페이지에 공통으로 적용되는 HTML 구조, 폰트, 메타데이터를 정의합니다.
 *
 * [홍보팀 안내]
 * - 브라우저 탭 제목과 검색 엔진 설명은 아래 metadata 객체에서 수정하세요.
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { buildSiteJsonLd } from "@/lib/seo-jsonld";
import { SITE_URL } from "@/lib/seo";

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/* 구글 폰트: Geist (모던하고 가독성 높은 산세리프 폰트) */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/*
 * [홍보팀] 브라우저 탭과 검색 엔진에 표시되는 사이트 정보입니다.
 * title: 브라우저 탭에 표시되는 제목
 * description: 구글 검색 결과에 표시되는 설명 문구
 */
export const metadata: Metadata = {
  title: {
    default: "CoreDXI — 비즈니스의 중심을 AI로 깨우다",
    template: "%s | CoreDXI",
  },
  description:
    "복잡한 협업은 심플하게, 변화는 단단하게. B2B 회의 예약 및 AX 전환 솔루션을 제공하는 당신의 AI 코어 파트너, CoreDXI.",
  metadataBase: new URL(SITE_URL),
  // 이 canonical은 홈(/) 전용 기본값이다. 페이지별 metadata가 없는 라우트는 이 값을 그대로 상속받아
  // canonical이 홈으로 잘못 지정될 수 있으므로, 새로 추가하는 공개 페이지는 반드시 src/lib/seo.ts의
  // pageMetadata()(또는 자체 alternates.canonical)를 지정할 것.
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: "CoreDXI",
    title: "CoreDXI — 비즈니스의 중심을 AI로 깨우다",
    description:
      "복잡한 협업은 심플하게, 변화는 단단하게. B2B AX 전환 솔루션을 제공하는 AI 코어 파트너, CoreDXI.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CoreDXI — 비즈니스의 중심을 AI로 깨우다",
    description:
      "복잡한 협업은 심플하게, 변화는 단단하게. B2B AX 전환 솔루션을 제공하는 AI 코어 파트너.",
  },
  icons: {
    icon: [
      {
        url: "/brand/favicon-32x32.png?v=2",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/brand/favicon-16x16.png?v=2",
        sizes: "16x16",
        type: "image/png",
      },
      { url: "/favicon.ico?v=2", sizes: "48x48", type: "image/x-icon" },
    ],
    shortcut: "/brand/favicon-32x32.png?v=2",
    apple: [{ url: "/apple-icon.png?v=2", type: "image/png" }],
  },
};

/**
 * 루트 레이아웃 컴포넌트
 * 모든 페이지를 감싸는 공통 HTML 구조입니다.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteJsonLd = buildSiteJsonLd();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    /* lang="ko" — 화면 읽기 프로그램과 SEO를 위해 한국어로 설정 */
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* [홍보팀] Google Analytics(구글 애널리틱스) 방문자 추적 코드입니다. .env의 NEXT_PUBLIC_GA_MEASUREMENT_ID 값을 수정하세요. */}
        {gaMeasurementId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
              strategy="afterInteractive"
              nonce={nonce}
            />
            <Script id="google-analytics" strategy="afterInteractive" nonce={nonce}>
              {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaMeasurementId}');
          `}
            </Script>
          </>
        ) : null}
        {/* [홍보팀] 네이버 서치어드바이저 사이트 소유 확인용 메타 태그입니다. 등록 건마다 코드가 다를 수 있습니다. */}
        <meta
          name="naver-site-verification"
          content="875becbd46b223c2a689b9154f11335a6326f85d"
        />
        <meta
          name="naver-site-verification"
          content="62def37bfa19ead530193e944ae227af1667048c"
        />
        {siteJsonLd.map((schema) => (
          <script
            key={schema["@type"] as string}
            type="application/ld+json"
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/brand/favicon-32x32.png?v=2"
        />
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} nonce={nonce}>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-center" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
