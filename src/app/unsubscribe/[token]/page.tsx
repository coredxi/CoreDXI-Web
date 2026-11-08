import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MailX, XCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { NOINDEX_METADATA, pageMetadata } from "@/lib/seo";
import { confirmUnsubscribe, getUnsubscribeTarget } from "@/actions/newsletter";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "뉴스레터 구독 해지",
    description: "CoreDXI 뉴스레터 구독을 해지합니다.",
    path: "/unsubscribe",
  }),
  ...NOINDEX_METADATA,
};

// 구독 상태를 매번 DB에서 읽어야 한다(해지 직후 결과 화면 포함).
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  rate: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  failed: "구독 해지 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

/**
 * 수신거부 화면. 링크를 여는 것(GET)만으로는 해지되지 않고, "구독 해지" 버튼(POST)을 눌러야 해지된다.
 * — 회사 메일 보안 검사기가 링크를 미리 열어 구독이 풀리는 사고를 막기 위함(2026-10-20).
 */
export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { token } = await params;
  const { error } = await searchParams;
  const target = await getUnsubscribeTarget(token);
  const actionError = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.failed) : null;

  return (
    <>
      <Header />
      <main className="flex min-h-screen items-center justify-center bg-background pt-16">
        <div className="mx-auto max-w-md px-6 py-20 text-center">
          {!target.success ? (
            <>
              <XCircle className="mx-auto size-10 text-destructive" aria-hidden="true" />
              <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
                구독 해지 링크를 확인할 수 없습니다
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{target.error}</p>
            </>
          ) : target.alreadyUnsubscribed ? (
            <>
              <CheckCircle2 className="mx-auto size-10 text-primary" aria-hidden="true" />
              <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
                구독이 해지되었습니다
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {target.maskedEmail}로의 뉴스레터 발송이 중단되었습니다. 언제든지 다시 구독하실 수
                있습니다.
              </p>
            </>
          ) : (
            <>
              <MailX className="mx-auto size-10 text-primary" aria-hidden="true" />
              <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
                뉴스레터 구독을 해지하시겠어요?
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                아래 버튼을 누르면 {target.maskedEmail}로의 CoreDXI 뉴스레터 발송이 중단됩니다.
              </p>
              {actionError && (
                <p role="alert" className="mt-4 text-sm font-medium text-destructive">
                  {actionError}
                </p>
              )}
              <form action={confirmUnsubscribe.bind(null, token)} className="mt-6">
                <Button type="submit" size="lg">
                  구독 해지
                </Button>
              </form>
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
