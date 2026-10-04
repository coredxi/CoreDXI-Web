/**
 * AttachButton.tsx — 수집 기사 한 건을 이번 호 후보(선택됨)로 추가
 * [홍보팀] 자동 선별에서 빠졌지만 꼭 넣고 싶은 기사를 넣을 때 씁니다. 추가하면 그 호는 "관리자 편집됨"이 되어 자동 재선별이 멈춥니다.
 */
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { attachArticleToIssue } from "@/actions/newsletter-issues";
import { Button } from "@/components/ui/button";

export function AttachButton({ issueId, articleId }: { issueId: string; articleId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending}
      onClick={() => startTransition(async () => {
        const r = await attachArticleToIssue(issueId, articleId);
        if (!r.success) return void toast.error(r.error);
        toast.success("이번 호에 추가했습니다.");
        router.refresh();
      })}>
      이번 호에 추가
    </Button>
  );
}
