"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SolutionsContent } from "@/lib/page-content/solutions";
import { saveSolutionsContent } from "./actions";

type Props = {
  initial: SolutionsContent;
};

function updateAt<T>(list: T[], index: number, value: T): T[] {
  return list.map((item, i) => (i === index ? value : item));
}

export function SolutionsContentForm({ initial }: Props) {
  const [values, setValues] = useState<SolutionsContent>(initial);
  const [pending, setPending] = useState(false);

  function updateField<K extends keyof SolutionsContent>(
    key: K,
    value: SolutionsContent[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateSolution<
    K extends keyof SolutionsContent["solutions"][number]
  >(index: number, key: K, value: SolutionsContent["solutions"][number][K]) {
    updateField(
      "solutions",
      updateAt(values.solutions, index, { ...values.solutions[index]!, [key]: value })
    );
  }

  function updateSolutionFeature(
    solutionIndex: number,
    featureIndex: number,
    value: string
  ) {
    const solution = values.solutions[solutionIndex]!;
    updateSolution(
      solutionIndex,
      "features",
      updateAt(solution.features, featureIndex, value)
    );
  }

  function updateProcessStep(
    index: number,
    key: "title" | "desc",
    value: string
  ) {
    updateField(
      "processSteps",
      updateAt(values.processSteps, index, { ...values.processSteps[index]!, [key]: value })
    );
  }

  function updateCaseStudyParagraph(index: number, value: string) {
    updateField(
      "caseStudyParagraphs",
      updateAt(values.caseStudyParagraphs, index, value)
    );
  }

  function addCaseStudyParagraph() {
    updateField("caseStudyParagraphs", [...values.caseStudyParagraphs, ""]);
  }

  function removeCaseStudyParagraph(index: number) {
    updateField(
      "caseStudyParagraphs",
      values.caseStudyParagraphs.filter((_, i) => i !== index)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const result = await saveSolutionsContent(values);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="max-w-3xl space-y-8">
      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700">히어로 섹션</h2>
        <div className="space-y-1.5">
          <Label htmlFor="sol-hero-badge">뱃지 문구</Label>
          <Input
            id="sol-hero-badge"
            value={values.heroBadge}
            onChange={(e) => updateField("heroBadge", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sol-hero-title1">타이틀 1행</Label>
            <Input
              id="sol-hero-title1"
              value={values.heroTitleLine1}
              onChange={(e) => updateField("heroTitleLine1", e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sol-hero-title2">타이틀 2행</Label>
            <Input
              id="sol-hero-title2"
              value={values.heroTitleLine2}
              onChange={(e) => updateField("heroTitleLine2", e.target.value)}
              disabled={pending}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sol-hero-subtitle">서브 문구</Label>
          <Textarea
            id="sol-hero-subtitle"
            value={values.heroSubtitle}
            onChange={(e) => updateField("heroSubtitle", e.target.value)}
            rows={2}
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700">솔루션 섹션</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sol-section-label">섹션 라벨</Label>
            <Input
              id="sol-section-label"
              value={values.solutionsLabel}
              onChange={(e) => updateField("solutionsLabel", e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sol-section-title">섹션 타이틀</Label>
            <Input
              id="sol-section-title"
              value={values.solutionsTitle}
              onChange={(e) => updateField("solutionsTitle", e.target.value)}
              disabled={pending}
            />
          </div>
        </div>

        {values.solutions.map((solution, si) => (
          <div key={si} className="space-y-3 rounded-lg border border-gray-100 p-4">
            <h3 className="text-xs font-semibold text-gray-500">
              솔루션 카드 {si + 1} (아이콘 고정)
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`sol-badge-${si}`}>뱃지</Label>
                <Input
                  id={`sol-badge-${si}`}
                  value={solution.badge}
                  onChange={(e) => updateSolution(si, "badge", e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`sol-title-${si}`}>제목</Label>
                <Input
                  id={`sol-title-${si}`}
                  value={solution.title}
                  onChange={(e) => updateSolution(si, "title", e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`sol-desc-${si}`}>설명</Label>
              <Textarea
                id={`sol-desc-${si}`}
                value={solution.desc}
                onChange={(e) => updateSolution(si, "desc", e.target.value)}
                rows={2}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label>특징 목록 (4개)</Label>
              {solution.features.map((feature, fi) => (
                <Input
                  key={fi}
                  value={feature}
                  onChange={(e) => updateSolutionFeature(si, fi, e.target.value)}
                  disabled={pending}
                  aria-label={`솔루션 ${si + 1} 특징 ${fi + 1}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700">도입 프로세스 섹션</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sol-process-label">섹션 라벨</Label>
            <Input
              id="sol-process-label"
              value={values.processLabel}
              onChange={(e) => updateField("processLabel", e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sol-process-title">섹션 타이틀</Label>
            <Input
              id="sol-process-title"
              value={values.processTitle}
              onChange={(e) => updateField("processTitle", e.target.value)}
              disabled={pending}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sol-process-desc">섹션 설명</Label>
          <Textarea
            id="sol-process-desc"
            value={values.processDesc}
            onChange={(e) => updateField("processDesc", e.target.value)}
            rows={2}
            disabled={pending}
          />
        </div>

        {values.processSteps.map((step, i) => (
          <div key={i} className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={`sol-step-title-${i}`}>단계 {i + 1} 제목</Label>
              <Input
                id={`sol-step-title-${i}`}
                value={step.title}
                onChange={(e) => updateProcessStep(i, "title", e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`sol-step-desc-${i}`}>단계 {i + 1} 설명</Label>
              <Input
                id={`sol-step-desc-${i}`}
                value={step.desc}
                onChange={(e) => updateProcessStep(i, "desc", e.target.value)}
                disabled={pending}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700">소개서 다운로드</h2>
        <p className="text-xs text-gray-500">
          AX 컨설팅 카드 하단에 노출되는 소개서 PDF 다운로드 버튼입니다. PDF 파일을 교체할
          때는 같은 파일명으로 덮어쓰면 URL이 유지됩니다. URL을 비워두면 버튼이 사라집니다.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sol-brochure-label">버튼 문구</Label>
            <Input
              id="sol-brochure-label"
              value={values.brochureLabel}
              onChange={(e) => updateField("brochureLabel", e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sol-brochure-url">파일 URL</Label>
            <Input
              id="sol-brochure-url"
              value={values.brochureUrl}
              onChange={(e) => updateField("brochureUrl", e.target.value)}
              disabled={pending}
              placeholder="/docs/coredxi-ax-consulting-brochure.pdf"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700">
          AX 사례 섹션 (Safety-RAG)
        </h2>
        <p className="text-xs text-gray-500">
          제목을 비우면 홈페이지에서 섹션 전체가 숨겨집니다. PDF 파일을 교체할
          때는 같은 파일명(safety-rag-case-study.pdf)으로 덮어쓰면 URL이
          유지됩니다. 데모 신청 버튼의 링크는 집계용이라 코드에서 고정되어
          있습니다.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sol-case-eyebrow">섹션 라벨</Label>
            <Input
              id="sol-case-eyebrow"
              value={values.caseStudyEyebrow}
              onChange={(e) => updateField("caseStudyEyebrow", e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sol-case-title">섹션 제목 (비우면 섹션 숨김)</Label>
            <Input
              id="sol-case-title"
              value={values.caseStudyTitle}
              onChange={(e) => updateField("caseStudyTitle", e.target.value)}
              disabled={pending}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>본문 문단</Label>
          {values.caseStudyParagraphs.map((paragraph, pi) => (
            <div key={pi} className="flex gap-2">
              <Textarea
                value={paragraph}
                onChange={(e) => updateCaseStudyParagraph(pi, e.target.value)}
                rows={2}
                disabled={pending}
                aria-label={`AX 사례 문단 ${pi + 1}`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => removeCaseStudyParagraph(pi)}
                disabled={pending}
                className="rounded-xl"
              >
                삭제
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addCaseStudyParagraph}
            disabled={pending}
            className="rounded-xl"
          >
            문단 추가
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sol-case-pdf-label">PDF 버튼 문구</Label>
            <Input
              id="sol-case-pdf-label"
              value={values.caseStudyPdfLabel}
              onChange={(e) => updateField("caseStudyPdfLabel", e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sol-case-pdf-url">사례 PDF URL</Label>
            <Input
              id="sol-case-pdf-url"
              value={values.caseStudyPdfUrl}
              onChange={(e) => updateField("caseStudyPdfUrl", e.target.value)}
              disabled={pending}
              placeholder="/docs/safety-rag-case-study.pdf"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sol-case-demo-label">데모 신청 버튼 문구</Label>
          <Input
            id="sol-case-demo-label"
            value={values.caseStudyDemoLabel}
            onChange={(e) => updateField("caseStudyDemoLabel", e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700">하단 CTA 섹션</h2>
        <div className="space-y-1.5">
          <Label htmlFor="sol-cta-title">CTA 타이틀</Label>
          <Input
            id="sol-cta-title"
            value={values.ctaTitle}
            onChange={(e) => updateField("ctaTitle", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sol-cta-desc">CTA 설명</Label>
          <Textarea
            id="sol-cta-desc"
            value={values.ctaDesc}
            onChange={(e) => updateField("ctaDesc", e.target.value)}
            rows={2}
            disabled={pending}
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="rounded-xl">
        {pending ? "저장 중…" : "저장하기"}
      </Button>
    </form>
  );
}
