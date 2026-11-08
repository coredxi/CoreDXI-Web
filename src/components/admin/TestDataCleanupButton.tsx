"use client";

/**
 * [홍보팀] 관리자 화면 상단의 "테스트 데이터 정리" 버튼입니다.
 * 자동 테스트가 남긴 문의·리드([E2E TEST] 표식)만 미리 보여 주고, 확인을 누르면 지웁니다.
 * 최고 관리자(SUPER_ADMIN)에게만 보이며, 정리할 데이터가 없으면 버튼이 꺼져 있습니다.
 */
import { useState } from "react";
import { Eraser } from "lucide-react";
import { toast } from "sonner";
import { cleanupTestData } from "@/actions/test-data-cleanup";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatKstDateTime } from "@/lib/format-kst-date";
import type { CleanupTarget, TestDataPreview } from "@/lib/test-data/cleanup-criteria";

const TARGET_LABEL: Record<CleanupTarget, string> = {
  contacts: "테스트 문의",
  leads: "테스트 리드",
};

type Props = {
  target: CleanupTarget;
  initialPreview: TestDataPreview;
  onCleaned: (deletedIds: string[]) => void;
};

export function TestDataCleanupButton({ target, initialPreview, onCleaned }: Props) {
  const [preview, setPreview] = useState(initialPreview);
  const [open, setOpen] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const isEmpty = preview.total === 0;
  const label = TARGET_LABEL[target];

  const handleConfirm = async () => {
    setIsCleaning(true);
    const result = await cleanupTestData(target);
    setIsCleaning(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setOpen(false);
    setPreview({ total: 0, samples: [] });
    onCleaned(result.deletedIds);
    toast.success(
      result.deletedIds.length > 0
        ? `${result.deletedIds.length}건 정리됨`
        : "정리할 테스트 데이터가 없습니다"
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={isEmpty}
            title={isEmpty ? "정리할 테스트 데이터가 없습니다" : undefined}
          />
        }
      >
        <Eraser />
        테스트 데이터 정리{isEmpty ? "" : ` (${preview.total})`}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label} {preview.total}건을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            자동 테스트(E2E)가 남긴 데이터만 대상입니다([E2E TEST] 표식). 삭제하면 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-1 rounded-xl border bg-muted/40 p-3 text-xs">
          {preview.samples.map((s) => (
            <li key={s.id} className="flex justify-between gap-3">
              <span className="truncate text-foreground">{s.label}</span>
              <span className="shrink-0 text-muted-foreground">{formatKstDateTime(s.createdAt)}</span>
            </li>
          ))}
          {preview.total > preview.samples.length ? (
            <li className="text-muted-foreground">외 {preview.total - preview.samples.length}건</li>
          ) : null}
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline" disabled={isCleaning} />}>
            취소
          </AlertDialogCancel>
          <Button variant="destructive" onClick={handleConfirm} disabled={isCleaning}>
            {isCleaning ? "정리 중…" : `${preview.total}건 삭제`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
