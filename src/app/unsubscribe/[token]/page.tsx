import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { pageMetadata } from "@/lib/seo";
import { unsubscribeNewsletterByToken } from "@/actions/newsletter";

export const metadata: Metadata = pageMetadata({
  title: "뉴스레터 구독 해지",
  description: "CoreDXI 뉴스레터 구독을 해지합니다.",
  path: "/unsubscribe",
});

type Props = {
  params: Promise<{ token: string }>;
};

export default async function UnsubscribePage({ params }: Props) {
  const { token } = await params;
  const result = await unsubscribeNewsletterByToken(token);

  return (
    <>
      <Header />
      <main className="flex min-h-screen items-center justify-center bg-background pt-16">
        <div className="mx-auto max-w-md px-6 py-20 text-center">
          {result.success ? (
            <>
              <CheckCircle2
                className="mx-auto size-10 text-primary"
                aria-hidden="true"
              />
              <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
                구독이 해지되었습니다
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {result.email}로의 뉴스레터 발송이 중단되었습니다. 언제든지
                다시 구독하실 수 있습니다.
              </p>
            </>
          ) : (
            <>
              <XCircle
                className="mx-auto size-10 text-destructive"
                aria-hidden="true"
              />
              <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
                구독 해지에 실패했습니다
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {result.error}
              </p>
            </>
          )}
          <Link
            href="/"
            className="mt-8 inline-block text-sm font-medium text-primary hover:underline"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
