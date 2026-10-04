/**
 * ManualArticleForm.tsx — 자동 수집에 안 잡힌 기사를 URL·제목으로 직접 추가
 * [홍보팀] 기사 본문을 복사해 붙이지 마세요. 요약은 직접 쓴 한두 문장만 넣습니다(저작권).
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addManualArticle, type ManualArticleInput } from "@/actions/newsletter-campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY: ManualArticleInput = { url: "", title: "", sourceName: "", publishedAt: "", snippet: "" };

export function ManualArticleForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<ManualArticleInput>(EMPTY);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof ManualArticleInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          try {
            const r = await addManualArticle(campaignId, form);
            if (!r.success) return void toast.error(r.error);
            toast.success("기사를 추가하고 이번 호에 선택했습니다.");
            setForm(EMPTY);
            router.refresh();
          } catch {
            toast.error("요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
          }
        });
      }}
    >
      <h2 className="font-semibold text-gray-900 sm:col-span-2">기사 직접 추가</h2>
      <div className="space-y-1"><Label htmlFor="ma-url">기사 URL</Label><Input id="ma-url" value={form.url} onChange={(e) => set("url", e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="ma-title">기사 제목</Label><Input id="ma-title" value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="ma-source">매체명</Label><Input id="ma-source" value={form.sourceName} onChange={(e) => set("sourceName", e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="ma-date">발행일</Label><Input id="ma-date" type="date" value={form.publishedAt} onChange={(e) => set("publishedAt", e.target.value)} /></div>
      <div className="space-y-1 sm:col-span-2"><Label htmlFor="ma-snippet">한 줄 요약(직접 작성)</Label><Input id="ma-snippet" value={form.snippet} onChange={(e) => set("snippet", e.target.value)} /></div>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>추가</Button></div>
    </form>
  );
}
