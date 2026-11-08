/**
 * CampaignActions.tsx — 캠페인 상세의 "지금 수집 / 미사용·사용 / 삭제" 버튼
 * [홍보팀] "지금 수집"은 아침 자동 수집을 기다리지 않고 바로 기사를 모읍니다. 삭제는 임시저장 캠페인만 가능합니다.
 */
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { collectCampaignNow, deleteDraftCampaign, setCampaignActive } from "@/actions/newsletter-campaigns";
import { Button } from "@/components/ui/button";

const ERROR_TOAST = "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

export function CampaignActions({ id, isActive, isDraft }: { id: string; isActive: boolean; isDraft: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // [홍보팀] 서버 오류(시간 초과 등)가 나도 화면이 멈추지 않고 안내 메시지를 띄웁니다.
  const guarded = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch {
      toast.error(ERROR_TOAST);
    }
  };

  const collect = () =>
    startTransition(() => guarded(async () => {
      const r = await collectCampaignNow(id);
      if (!r.success) return void toast.error(r.error);
      toast.success(`수집 ${r.fetched}건 → 조건 통과 ${r.matched}건, 이번 호 후보 ${r.attached}건`);
      if (r.errors.length > 0) toast.warning(`일부 수집 실패: ${r.errors.join(" / ")}`);
      router.refresh();
    }));

  const toggle = () =>
    startTransition(() => guarded(async () => {
      const r = await setCampaignActive(id, !isActive);
      if (!r.success) return void toast.error(r.error);
      router.refresh();
    }));

  const remove = () =>
    startTransition(() => guarded(async () => {
      if (!window.confirm("이 임시저장 캠페인을 삭제할까요?")) return;
      const r = await deleteDraftCampaign(id);
      if (!r.success) return void toast.error(r.error);
      router.push("/admin/newsletter/campaigns");
    }));

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={pending} onClick={collect}>{pending ? "수집 중… (최대 1분)" : "지금 수집"}</Button>
      <Button type="button" variant="outline" disabled={pending} onClick={toggle}>{isActive ? "미사용 처리" : "사용 재개"}</Button>
      {isDraft && <Button type="button" variant="outline" disabled={pending} onClick={remove}>삭제</Button>}
    </div>
  );
}
