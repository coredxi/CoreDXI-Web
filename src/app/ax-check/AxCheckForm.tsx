"use client";

/**
 * AxCheckForm.tsx — AX 체크(인터뷰 깔때기) 8문항 마법사 폼
 *
 * [홍보팀] 질문 문구 자체는 여기가 아니라 src/lib/ax-check/catalog.ts에서 수정합니다.
 * 카톡 인앱 브라우저 기준 모바일 우선 — 한 화면에 질문 1개, 큰 터치 영역, 진행 표시.
 * 설계: docs/superpowers/specs/2026-08-22-sales-funnel-ax-check-design.md 7번
 */

import { type Dispatch, type SetStateAction, useState } from "react";
import Link from "next/link";
import { submitAxCheck } from "@/actions/ax-check";
import { trackEvent } from "@/lib/ga4-events";
import {
  AX_CHECK_QUESTIONS,
  type AxCheckQuestion,
} from "@/lib/ax-check/catalog";
import type { AxCheckAnswers, AxCheckPriority } from "@/lib/ax-check/summarize";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AxCheckPriorityCards } from "@/components/ax-check/AxCheckPriorityCards";

const TOTAL_STEPS = AX_CHECK_QUESTIONS.length + 1; // 8문항 + 연락처/동의 1단계

const EMPTY_ANSWERS: AxCheckAnswers = {
  q1: "",
  q2: "",
  q3: [],
  q3Other: "",
  q4: "",
  q5: "",
  q6: "",
  q7: "",
  q8: "",
};

type ContactState = {
  company: string;
  name: string;
  email: string;
  phone: string;
  privacyConsent: boolean;
  marketingOptIn: boolean;
};

const EMPTY_CONTACT: ContactState = {
  company: "",
  name: "",
  email: "",
  phone: "",
  privacyConsent: false,
  marketingOptIn: false,
};

type Props = { refCode?: string };

export function AxCheckForm({ refCode }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AxCheckAnswers>(EMPTY_ANSWERS);
  const [contact, setContact] = useState<ContactState>(EMPTY_CONTACT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priorities, setPriorities] = useState<AxCheckPriority[] | null>(null);

  const currentQuestion: AxCheckQuestion | null =
    step < AX_CHECK_QUESTIONS.length ? AX_CHECK_QUESTIONS[step]! : null;

  function setSingleAnswer(id: AxCheckQuestion["id"], value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setError(null);
  }

  function toggleQ3(value: string, maxSelect: number) {
    setAnswers((prev) => {
      if (prev.q3.includes(value)) {
        return { ...prev, q3: prev.q3.filter((v) => v !== value) };
      }
      if (prev.q3.length >= maxSelect) return prev;
      return { ...prev, q3: [...prev.q3, value] };
    });
    setError(null);
  }

  function canProceed(): boolean {
    if (!currentQuestion) return true;
    if (currentQuestion.type === "single") return Boolean(answers[currentQuestion.id]);
    return answers.q3.length > 0;
  }

  function handleNext() {
    if (!canProceed()) {
      setError("답변을 선택해 주세요.");
      return;
    }
    setError(null);
    setStep((s) => s + 1);
  }

  function handleBack() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function handleSubmit() {
    if (!contact.company.trim() || !contact.name.trim() || !contact.email.trim()) {
      setError("회사명·성함·이메일을 입력해 주세요.");
      return;
    }
    if (!contact.privacyConsent) {
      setError("개인정보 수집·이용에 동의해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await submitAxCheck({
        refCode,
        company: contact.company,
        name: contact.name,
        email: contact.email,
        phone: contact.phone || undefined,
        answers,
        privacyConsent: contact.privacyConsent,
        marketingOptIn: contact.marketingOptIn,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      trackEvent("ax_check_submit", { source: refCode ?? "direct" });
      setPriorities(result.priorities);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (priorities) {
    return <AxCheckPriorityCards company={contact.company} priorities={priorities} />;
  }

  const progressPercent = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  return (
    <div className="mx-auto w-full max-w-md">
      {/* ?ref= 쿼리를 화면에 노출하지 않고 폼 상태로만 보존한다 */}
      <input type="hidden" name="ref" value={refCode ?? ""} />

      <div className="mb-6">
        <p className="text-xs font-medium text-muted-foreground">
          {step + 1} / {TOTAL_STEPS}
        </p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {currentQuestion ? (
        <QuestionStep
          question={currentQuestion}
          answers={answers}
          onSingleChange={setSingleAnswer}
          onToggleQ3={toggleQ3}
          onOtherTextChange={(text) => setAnswers((prev) => ({ ...prev, q3Other: text }))}
        />
      ) : (
        <ContactStep contact={contact} setContact={setContact} />
      )}

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={step === 0 || isSubmitting}
        >
          이전
        </Button>
        {currentQuestion ? (
          <Button type="button" onClick={handleNext} className="h-11 flex-1">
            다음
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="h-11 flex-1">
            {isSubmitting ? "제출 중..." : "제출하기"}
          </Button>
        )}
      </div>
    </div>
  );
}

function QuestionStep({
  question,
  answers,
  onSingleChange,
  onToggleQ3,
  onOtherTextChange,
}: {
  question: AxCheckQuestion;
  answers: AxCheckAnswers;
  onSingleChange: (id: AxCheckQuestion["id"], value: string) => void;
  onToggleQ3: (value: string, maxSelect: number) => void;
  onOtherTextChange: (text: string) => void;
}) {
  return (
    <div>
      <h1 className="text-lg font-bold text-foreground">{question.prompt}</h1>
      {question.type === "multi" ? (
        <p className="mt-1 text-xs text-muted-foreground">
          최대 {question.maxSelect}개까지 선택할 수 있어요.
        </p>
      ) : null}

      <div className="mt-5 space-y-2.5">
        {question.type === "single" ? (
          <RadioGroup
            value={answers[question.id]}
            onValueChange={(value) => onSingleChange(question.id, String(value))}
            className="space-y-2.5"
          >
            {question.options.map((option) => {
              const isSelected = answers[question.id] === option.value;
              return (
                <Label
                  key={option.value}
                  htmlFor={`${question.id}-${option.value}`}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-sm font-normal transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-foreground/90 hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem id={`${question.id}-${option.value}`} value={option.value} />
                  {option.label}
                </Label>
              );
            })}
          </RadioGroup>
        ) : (
          <>
            {question.options.map((option) => {
              const isSelected = answers.q3.includes(option.value);
              const isDisabled = !isSelected && answers.q3.length >= question.maxSelect;
              return (
                <Label
                  key={option.value}
                  htmlFor={`q3-${option.value}`}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 text-sm font-normal transition-colors ${
                    isSelected
                      ? "cursor-pointer border-primary bg-primary/5 text-foreground"
                      : isDisabled
                        ? "cursor-not-allowed border-border text-muted-foreground/60"
                        : "cursor-pointer border-border text-foreground/90 hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    id={`q3-${option.value}`}
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={() => onToggleQ3(option.value, question.maxSelect)}
                  />
                  {option.label}
                </Label>
              );
            })}
            {answers.q3.includes("other") ? (
              <Input
                value={answers.q3Other ?? ""}
                onChange={(e) => onOtherTextChange(e.target.value)}
                placeholder="어떤 업무인지 간단히 적어주세요"
                maxLength={200}
                className="mt-1"
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function ContactStep({
  contact,
  setContact,
}: {
  contact: ContactState;
  setContact: Dispatch<SetStateAction<ContactState>>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">마지막 단계예요</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          진단 결과를 보내드릴 연락처를 입력해 주세요.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ax-company">회사명</Label>
        <Input
          id="ax-company"
          value={contact.company}
          onChange={(e) => setContact((p) => ({ ...p, company: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ax-name">성함</Label>
        <Input
          id="ax-name"
          value={contact.name}
          onChange={(e) => setContact((p) => ({ ...p, name: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ax-email">이메일</Label>
        <Input
          id="ax-email"
          type="email"
          value={contact.email}
          onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ax-phone">휴대전화 (선택)</Label>
        <Input
          id="ax-phone"
          type="tel"
          value={contact.phone}
          onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))}
        />
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <Label htmlFor="ax-privacy-consent" className="flex items-start gap-2 font-normal">
          <Checkbox
            id="ax-privacy-consent"
            checked={contact.privacyConsent}
            onCheckedChange={(checked) =>
              setContact((p) => ({ ...p, privacyConsent: checked }))
            }
          />
          <span className="text-sm text-foreground">
            (필수){" "}
            <Link href="/privacy" className="underline underline-offset-2">
              개인정보처리방침
            </Link>
            에 따른 개인정보 수집·이용에 동의합니다.
          </span>
        </Label>
        <Label htmlFor="ax-marketing-optin" className="flex items-start gap-2 font-normal">
          <Checkbox
            id="ax-marketing-optin"
            checked={contact.marketingOptIn}
            onCheckedChange={(checked) =>
              setContact((p) => ({ ...p, marketingOptIn: checked }))
            }
          />
          <span className="text-sm text-muted-foreground">
            (선택) AX 소식·팔로업 메일을 받아보겠습니다.
          </span>
        </Label>
      </div>
    </div>
  );
}
