import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/seo";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getAxCheckResultByToken } from "@/actions/ax-check";
import { AxCheckPriorityCards } from "@/components/ax-check/AxCheckPriorityCards";

export const metadata: Metadata = pageMetadata({
  title: "AX 체크 결과",
  description: "메일로 안내드린 AX 체크 결과를 다시 확인하세요.",
  path: "/ax-check/result",
});

// 토큰별로 항상 최신 상태를 조회해야 하는 개인화 페이지 — /blog/[slug]에서 겪은
// generateStaticParams()+ISR 충돌(DYNAMIC_SERVER_USAGE)을 원천 차단하기 위해 동적 렌더로 고정한다.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function AxCheckResultPage({ params }: Props) {
  const { token } = await params;
  const result = await getAxCheckResultByToken(token);

  if (!result.success) {
    notFound();
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-24">
        <div className="mx-auto max-w-2xl px-6 py-8">
          <AxCheckPriorityCards
            company={result.data.company}
            priorities={result.data.priorities}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
