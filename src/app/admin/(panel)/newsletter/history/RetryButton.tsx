/**
 * RetryButton.tsx — 발송 실패한 호를 다시 보냄(이미 받은 사람에게는 다시 가지 않음)
 * [홍보팀] 실패 원인(예: 일시적 메일 서버 오류)을 확인한 뒤 누르세요.
 */
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { retryIssue } from "@/actions/newsletter-issues";
import { Button } from "@/components/ui/button";

export function RetryButton({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending}
      onClick={() => startTransition(async () => {
        try {
          const r = await retryIssue(issueId);
          if (!r.success) return void toast.error(r.error);
          toast.success(`재발송 ${r.sent}건, 실패 ${r.failed}건`);
          router.refresh();
        } catch {
          toast.error("요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        }
      })}>
      재시도
    </Button>
  );
}
