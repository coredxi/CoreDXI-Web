/**
 * IssueEditor.tsx — 뉴스레터 한 호의 선별 편집·미리보기·검토요청·승인·발송
 * [홍보팀] 포스코 "선별 자료관리" 화면입니다. 순서: 기사 체크·순서 조정·코멘트 → 저장 → 미리보기 확인 →
 * "검토요청(내게 보내기)"로 내 메일함에서 확인 → "승인(예약)" 또는 "즉시 발송".
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  approveIssue, cancelIssue, getIssuePreview, requestIssueReview, sendIssueNow, unapproveIssue, updateIssue,
  type IssueArticleEdit,
} from "@/actions/newsletter-issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type EditorArticle = IssueArticleEdit & {
  title: string;
  url: string;
  sourceName: string | null;
  publishedLabel: string;
  ruleScore: number;
};

type Props = {
  issueId: string;
  status: string;
  subject: string;
  intro: string | null;
  maxArticles: number;
  scheduledLabel: string | null;
  articles: EditorArticle[];
};

const EDITABLE = ["COLLECTING", "DRAFT", "REVIEW_REQUESTED"];

export function IssueEditor(props: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState(props.subject);
  const [intro, setIntro] = useState(props.intro ?? "");
  const [articles, setArticles] = useState(props.articles);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [pending, startTransition] = useTransition();
  const editable = EDITABLE.includes(props.status);
  const selectedCount = articles.filter((a) => a.isSelected).length;

  const patch = (id: string, p: Partial<EditorArticle>) => setArticles((list) => list.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const move = (index: number, dir: -1 | 1) =>
    setArticles((list) => {
      const next = [...list];
      const target = index + dir;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.success) return void toast.error(r.error ?? "실패했습니다.");
      toast.success(ok);
      router.refresh();
    });

  const save = () =>
    run(
      () => updateIssue(props.issueId, {
        subject,
        intro,
        articles: articles.map((a, i) => ({ id: a.id, isSelected: a.isSelected, sortOrder: i, editorNote: a.editorNote, summary: a.summary })),
      }),
      "저장했습니다."
    );

  const loadPreview = () =>
    startTransition(async () => {
      const r = await getIssuePreview(props.issueId);
      if (!r.success) return void toast.error(r.error);
      setPreviewHtml(r.html);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="is-subject">메일 제목</Label>
          <Input id="is-subject" value={subject} disabled={!editable} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="is-intro">인사말(선택)</Label>
          <Textarea id="is-intro" value={intro} disabled={!editable} onChange={(e) => setIntro(e.target.value)} />
        </div>
        <p className="text-sm text-gray-600">선택 {selectedCount}건 / 권장 {props.maxArticles}건</p>
        <ul className="space-y-3">
          {articles.map((a, i) => (
            <li key={a.id} className={`rounded-xl border p-3 ${a.isSelected ? "border-[#1E4E8C] bg-white" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex items-start gap-2">
                <input type="checkbox" aria-label={`${a.title} 선택`} checked={a.isSelected} disabled={!editable}
                  onChange={(e) => patch(a.id, { isSelected: e.target.checked })} />
                <div className="flex-1">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:underline">{a.title}</a>
                  <p className="text-xs text-gray-500">{[a.sourceName, a.publishedLabel, `점수 ${a.ruleScore}`].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" aria-label="위로" disabled={!editable} onClick={() => move(i, -1)}>▲</Button>
                  <Button type="button" size="sm" variant="outline" aria-label="아래로" disabled={!editable} onClick={() => move(i, 1)}>▼</Button>
                </div>
              </div>
              {a.isSelected && (
                <div className="mt-2 grid gap-2">
                  <Input aria-label={`${a.title} 요약`} placeholder="2문장 요약(직접 작성, 비우면 기사 설명 1줄)" value={a.summary ?? ""}
                    disabled={!editable} onChange={(e) => patch(a.id, { summary: e.target.value })} />
                  <Input aria-label={`${a.title} 코멘트`} placeholder="편집자 한 줄 코멘트(선택)" value={a.editorNote ?? ""}
                    disabled={!editable} onChange={(e) => patch(a.id, { editorNote: e.target.value })} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {editable && <Button type="button" disabled={pending} onClick={save}>저장</Button>}
          <Button type="button" variant="outline" disabled={pending} onClick={loadPreview}>미리보기</Button>
          {editable && (
            <Button type="button" variant="outline" disabled={pending}
              onClick={() => run(() => requestIssueReview(props.issueId), "검토요청 메일을 보냈습니다.")}>
              검토요청(내게 보내기)
            </Button>
          )}
        </div>
        {editable && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 p-3">
            <div className="space-y-1">
              <Label htmlFor="is-schedule">예약 시각(비우면 캠페인 다음 발송일)</Label>
              <Input id="is-schedule" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
            </div>
            <Button type="button" disabled={pending}
              onClick={() => run(() => approveIssue(props.issueId, scheduleAt ? new Date(`${scheduleAt}:00+09:00`).toISOString() : null), "승인했습니다. 예약 시각에 발송됩니다.")}>
              승인(예약)
            </Button>
          </div>
        )}
        {props.status === "APPROVED" && (
          <p className="text-sm text-gray-700">
            승인됨 — 예약 {props.scheduledLabel}.{" "}
            <Button type="button" size="sm" variant="outline" disabled={pending}
              onClick={() => run(() => unapproveIssue(props.issueId), "승인을 취소했습니다.")}>승인 취소</Button>
          </p>
        )}
        {(editable || props.status === "APPROVED" || props.status === "FAILED") && (
          <div className="flex gap-2">
            <Button type="button" variant="destructive" disabled={pending}
              onClick={() => {
                if (!window.confirm("지금 구독자 전원에게 발송합니다. 계속할까요?")) return;
                startTransition(async () => {
                  const r = await sendIssueNow(props.issueId);
                  if (!r.success) return void toast.error(r.error);
                  toast.success(`발송 ${r.sent}건, 실패 ${r.failed}건, 제외 ${r.skipped}건`);
                  router.refresh();
                });
              }}>
              즉시 발송
            </Button>
            {props.status !== "FAILED" && (
              <Button type="button" variant="outline" disabled={pending}
                onClick={() => window.confirm("이 호를 취소할까요?") && run(() => cancelIssue(props.issueId), "취소했습니다.")}>
                호 취소
              </Button>
            )}
          </div>
        )}
        {previewHtml !== null && (
          <iframe title="뉴스레터 미리보기" sandbox="" srcDoc={previewHtml} className="h-[720px] w-full rounded-xl border border-gray-200 bg-white" />
        )}
      </div>
    </div>
  );
}
