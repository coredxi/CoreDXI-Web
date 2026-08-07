"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { subscribeNewsletter } from "@/actions/newsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  /** 폼이 렌더링되는 위치 — 구독 소스 추적용 (예: "footer", "blog_list") */
  source?: string;
  className?: string;
};

export function NewsletterSubscribeForm({ source = "footer", className }: Props) {
  const emailId = useId();
  const consentId = useId();

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<
    { type: "idle" } | { type: "success" } | { type: "error"; message: string }
  >({ type: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setStatus({
        type: "error",
        message: "개인정보 수집·이용에 동의해 주세요.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: "idle" });
    try {
      const result = await subscribeNewsletter(email, source);
      if (!result.success) {
        setStatus({ type: "error", message: result.error });
        return;
      }
      setStatus({ type: "success" });
      setEmail("");
      setConsent(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status.type === "success") {
    return (
      <div className={className}>
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Mail className="size-4 shrink-0 text-primary" aria-hidden="true" />
          구독이 완료되었습니다. 확인 메일을 보내드렸어요.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      <p className="text-sm font-semibold text-foreground">뉴스레터 구독</p>
      <p className="mt-1 text-xs text-muted-foreground">
        CoreDXI의 AX 인사이트와 새 블로그 소식을 이메일로 받아보세요.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor={emailId} className="sr-only">
          이메일 주소
        </label>
        <Input
          id={emailId}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          className="sm:max-w-xs"
        />
        <Button
          type="submit"
          disabled={isSubmitting}
          className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isSubmitting ? "처리 중..." : "구독하기"}
        </Button>
      </div>

      <label
        htmlFor={consentId}
        className="mt-2 flex items-start gap-2 text-xs text-muted-foreground"
      >
        <input
          id={consentId}
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-3.5 shrink-0 rounded border-border accent-primary"
        />
        <span>
          <Link href="/privacy" className="underline hover:text-foreground">
            개인정보처리방침
          </Link>
          에 따른 이메일 수집·이용에 동의합니다. 구독은 메일 하단 링크로 언제든
          해지할 수 있습니다.
        </span>
      </label>

      {status.type === "error" && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {status.message}
        </p>
      )}
    </form>
  );
}
