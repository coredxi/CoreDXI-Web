import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AxCheckForm } from "./AxCheckForm";

export const metadata: Metadata = pageMetadata({
  title: "AX 체크 — 3분 AI 도입 진단",
  description:
    "8개 질문에 답하면 귀사의 AX(AI 전환) 우선 과제 3가지를 바로 확인할 수 있습니다.",
  path: "/ax-check",
});

// nonce용 headers()를 쓰지 않지만, 향후 방문마다 결과가 달라지는 개인화 페이지이므로
// /blog/[slug]에서 겪은 generateStaticParams()+ISR 충돌을 원천 차단하기 위해 동적 렌더로 고정한다.
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ ref?: string | string[] }>;
};

export default async function AxCheckPage({ searchParams }: Props) {
  const params = await searchParams;
  const refParam = params.ref;
  const refCode = Array.isArray(refParam) ? refParam[0] : refParam;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-24">
        <div className="mx-auto max-w-2xl px-6 py-8">
          <AxCheckForm refCode={refCode} />
        </div>
      </main>
      <Footer />
    </>
  );
}
