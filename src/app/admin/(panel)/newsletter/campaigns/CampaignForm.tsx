/**
 * CampaignForm.tsx — 뉴스레터 캠페인 만들기/수정 폼(4개 구역: 기준 · 수신자 · 검색 키워드 · 선별지표)
 * [홍보팀] 포스코 "새뉴스레터 만들기" 화면에 해당합니다. "임시저장"은 필수값이 비어도 저장되며 자동 수집되지 않습니다.
 * "저장"하면 다음 날 아침부터 기사가 자동 수집됩니다. 제목 앞 "(광고)"는 법적 표기라 지우지 마세요.
 * 한 번 "저장"한 캠페인은 임시저장으로 되돌릴 수 없어 "임시저장" 버튼이 사라집니다.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { previewKeywordSearch, saveCampaign, type KeywordPreviewItem } from "@/actions/newsletter-campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CampaignFormInput, RuleFormInput } from "@/lib/newsletter/campaign-input";
import {
  DEFAULT_COLLECT_DAYS,
  DEFAULT_MAX_ARTICLES,
  DEFAULT_SELECTION_RULES,
  DEFAULT_SEND_DAY_OF_WEEK,
  DEFAULT_SEND_HOUR_KST,
  DEFAULT_SUBJECT_TEMPLATE,
} from "@/lib/newsletter/defaults";
import type { KeywordInput } from "@/lib/newsletter/types";

type SourceOption = { id: string; name: string; category: string; rssUrl: string | null };

const SELECT_CLASS = "h-9 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm";
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function todayKst(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
}

function defaultInput(): CampaignFormInput {
  return {
    name: "",
    subjectTemplate: DEFAULT_SUBJECT_TEMPLATE,
    sendType: "REVIEW_THEN_SEND",
    cadence: "WEEKLY",
    sendDayOfWeek: DEFAULT_SEND_DAY_OF_WEEK,
    sendHourKst: DEFAULT_SEND_HOUR_KST,
    activeFrom: todayKst(),
    activeUntil: `${todayKst().slice(0, 4)}-12-31`,
    collectDays: DEFAULT_COLLECT_DAYS,
    maxArticles: DEFAULT_MAX_ARTICLES,
    audience: "subscribers",
    internalRecipients: [],
    keywords: [{ group: 1, operator: "OR", term: "", weight: 3 }],
    rules: DEFAULT_SELECTION_RULES.map((r) => ({ ...r, isEnabled: true })),
    sourceIds: [],
  };
}

/** isDraft: 새 캠페인이거나 아직 임시저장 상태일 때만 true(기본값). 저장 완료된 캠페인은 false를 넘겨 "임시저장" 버튼을 숨긴다. */
export function CampaignForm({ sources, initial, isDraft = true }: { sources: SourceOption[]; initial?: CampaignFormInput; isDraft?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<CampaignFormInput>(initial ?? defaultInput());
  const [preview, setPreview] = useState<KeywordPreviewItem[] | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof CampaignFormInput>(key: K, value: CampaignFormInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setKeyword = (i: number, patch: Partial<KeywordInput>) =>
    set("keywords", form.keywords.map((k, idx) => (idx === i ? { ...k, ...patch } : k)));
  const setRule = (i: number, patch: Partial<RuleFormInput>) =>
    set("rules", form.rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const maxGroup = Math.max(1, ...form.keywords.filter((k) => k.operator !== "NOT").map((k) => k.group));

  const submit = (draft: boolean) =>
    startTransition(async () => {
      const r = await saveCampaign(form, { draft });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(draft ? "임시저장했습니다." : "저장했습니다. 다음 수집부터 반영됩니다.");
      router.push(`/admin/newsletter/campaigns/${r.id}`);
    });

  const runPreview = () =>
    startTransition(async () => {
      const r = await previewKeywordSearch(form.keywords);
      if (!r.success) toast.error(r.error);
      else setPreview(r.items);
    });

  return (
    <div className="space-y-8">
      {/* ① 기준 */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">① 기준</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="nl-name">뉴스레터 이름</Label>
            <Input id="nl-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nl-subject">메일 제목 템플릿</Label>
            <Input id="nl-subject" value={form.subjectTemplate} onChange={(e) => set("subjectTemplate", e.target.value)} />
            <p className="text-xs text-gray-500">{"{{issueDate}}"}=발행일, {"{{issueNo}}"}=회차</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nl-sendtype">발송 유형</Label>
            <select id="nl-sendtype" className={SELECT_CLASS} value={form.sendType}
              onChange={(e) => set("sendType", e.target.value as CampaignFormInput["sendType"])}>
              <option value="REVIEW_THEN_SEND">검토 후 발송(권장)</option>
              <option value="IMMEDIATE">즉시 발송(1회)</option>
              <option value="SCHEDULED" disabled>스케줄 자동발송(2단계)</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="nl-cadence">주기</Label>
              <select id="nl-cadence" className={SELECT_CLASS} value={form.cadence}
                onChange={(e) => set("cadence", e.target.value as CampaignFormInput["cadence"])}>
                <option value="DAILY">매일</option>
                <option value="WEEKLY">매주</option>
                <option value="BIWEEKLY">격주</option>
                <option value="MONTHLY">매월 첫째 주</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="nl-day">요일</Label>
              <select id="nl-day" className={SELECT_CLASS} disabled={form.cadence === "DAILY"}
                value={form.sendDayOfWeek ?? DEFAULT_SEND_DAY_OF_WEEK}
                onChange={(e) => set("sendDayOfWeek", Number(e.target.value))}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="nl-hour">시각(KST)</Label>
              <Input id="nl-hour" type="number" min={0} max={23} value={form.sendHourKst}
                onChange={(e) => set("sendHourKst", Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="nl-from">사용기간 시작</Label>
              <Input id="nl-from" type="date" value={form.activeFrom} onChange={(e) => set("activeFrom", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nl-until">사용기간 종료</Label>
              <Input id="nl-until" type="date" value={form.activeUntil ?? ""}
                onChange={(e) => set("activeUntil", e.target.value || null)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="nl-days">수집기간(최근 N일)</Label>
              <Input id="nl-days" type="number" min={1} max={31} value={form.collectDays}
                onChange={(e) => set("collectDays", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nl-max">선별 기사 수</Label>
              <Input id="nl-max" type="number" min={1} max={20} value={form.maxArticles}
                onChange={(e) => set("maxArticles", Number(e.target.value))} />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500">예약 발송은 매일 오전 8시(KST)에 한 번 처리됩니다.</p>
      </section>

      {/* ② 수신자 */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">② 수신자</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="nl-audience" checked={form.audience === "subscribers"} onChange={() => set("audience", "subscribers")} />
          구독자 전원(구독 중인 사람만)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="nl-audience" checked={form.audience === "internal"} onChange={() => set("audience", "internal")} />
          내부 지정 수신자
        </label>
        {form.audience === "internal" && (
          <div className="space-y-1">
            <Label htmlFor="nl-internal">내부 수신자 이메일(쉼표 구분, 최대 20명)</Label>
            <Input id="nl-internal" value={form.internalRecipients.join(", ")}
              onChange={(e) => set("internalRecipients", e.target.value.split(","))} />
          </div>
        )}
      </section>

      {/* ③ 검색 키워드 */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">③ 검색 키워드</h2>
        <p className="text-xs text-gray-500">같은 그룹 안의 단어는 하나만 맞아도 되고, 모든 그룹이 맞아야 수집됩니다. &quot;제외&quot; 단어가 들어간 기사는 빠집니다.</p>
        {form.keywords.map((k, i) => (
          <div key={i} className="grid grid-cols-[110px_90px_1fr_80px_auto] items-center gap-2">
            <select aria-label={`키워드 ${i + 1} 구분`} className={SELECT_CLASS}
              value={k.operator === "NOT" ? "NOT" : String(k.group)}
              onChange={(e) =>
                setKeyword(i, e.target.value === "NOT" ? { operator: "NOT", group: 0 } : { operator: "OR", group: Number(e.target.value) })
              }>
              {Array.from({ length: maxGroup + 1 }, (_, g) => g + 1).map((g) => (
                <option key={g} value={g}>포함 그룹 {g}</option>
              ))}
              <option value="NOT">제외</option>
            </select>
            <span className="text-xs text-gray-500">{k.operator === "NOT" ? "이 단어 제외" : "중 하나"}</span>
            <Input aria-label={`키워드 ${i + 1}`} value={k.term} onChange={(e) => setKeyword(i, { term: e.target.value })} />
            <select aria-label={`키워드 ${i + 1} 가중치`} className={SELECT_CLASS} value={k.weight}
              disabled={k.operator === "NOT"} onChange={(e) => setKeyword(i, { weight: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>가중 {w}</option>)}
            </select>
            <Button type="button" variant="outline" size="sm"
              onClick={() => set("keywords", form.keywords.filter((_, idx) => idx !== i))}>삭제</Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm"
            onClick={() => set("keywords", [...form.keywords, { group: 1, operator: "OR", term: "", weight: 3 }])}>
            키워드 추가
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={runPreview}>
            결과 미리보기(네이버 10건)
          </Button>
        </div>
        {preview && (
          <ul className="space-y-1 rounded-xl bg-gray-50 p-3 text-sm">
            {preview.length === 0 ? <li className="text-gray-500">조건에 맞는 최근 기사가 없습니다.</li> : preview.map((p) => (
              <li key={p.url}>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[#1E4E8C] hover:underline">{p.title}</a>
                <span className="ml-2 text-xs text-gray-500">적중 {Math.round(p.hitRate * 100)}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ④ 선별지표 + RSS 매체 */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">④ 선별지표 · RSS 매체</h2>
        <p className="text-xs text-gray-500">선별지표는 2단계(AI 점수)부터 반영됩니다. 지금은 키워드·최신성·매체 신뢰도로 자동 점수를 매깁니다.</p>
        {form.rules.map((r, i) => (
          <div key={r.indicator} className="grid grid-cols-[auto_120px_1fr_90px] items-center gap-2 text-sm">
            <input type="checkbox" aria-label={`${r.label} 사용`} checked={r.isEnabled} onChange={(e) => setRule(i, { isEnabled: e.target.checked })} />
            <span className="font-medium">{r.label}</span>
            <span className="text-gray-500">{r.description}</span>
            <select aria-label={`${r.label} 가중치`} className={SELECT_CLASS} value={r.weight}
              onChange={(e) => setRule(i, { weight: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>가중 {w}</option>)}
            </select>
          </div>
        ))}
        <div className="grid gap-2 pt-2 sm:grid-cols-3">
          {sources.map((s) => (
            <label key={s.id} className={`flex items-center gap-2 text-sm ${s.rssUrl ? "" : "text-gray-400"}`}>
              <input type="checkbox" disabled={!s.rssUrl} checked={form.sourceIds.includes(s.id)}
                onChange={(e) =>
                  set("sourceIds", e.target.checked ? [...form.sourceIds, s.id] : form.sourceIds.filter((id) => id !== s.id))
                } />
              {s.name} <span className="text-xs text-gray-400">{s.rssUrl ? s.category : "RSS 없음"}</span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-2">
        {isDraft && <Button type="button" variant="outline" disabled={pending} onClick={() => submit(true)}>임시저장</Button>}
        <Button type="button" disabled={pending} onClick={() => submit(false)}>저장</Button>
      </div>
    </div>
  );
}
