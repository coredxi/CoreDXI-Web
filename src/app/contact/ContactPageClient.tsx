"use client";

import { Check, Clock, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import { submitContactForm } from "@/actions/contact";
import { trackEvent } from "@/lib/ga4-events";
import { Header } from "@/components/Header";
import { ContactFaqSection } from "@/components/contact/ContactFaqSection";
import type { ContactFaqItem } from "@/lib/contact-faq";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const INQUIRY_TYPE_OPTIONS = [
  { value: "service-quote", label: "서비스 도입 및 견적 문의" },
  { value: "demo", label: "제품 데모 시연 요청" },
  { value: "technical", label: "기능 및 기술 관련 문의" },
  { value: "partnership", label: "파트너십 및 제휴 제안" },
  { value: "other", label: "기타" },
] as const;

const MARKETING_POINTS = [
  "영업일 기준 1~2일 내 담당자가 연락드립니다.",
  "AX·AI 도입 로드맵과 맞춤 데모를 안내해 드립니다.",
  "PoC·파일럿 프로젝트 설계까지 함께합니다.",
  "엔터프라이즈 보안·컴플라이언스 요건을 반영합니다.",
];

type Props = {
  notificationEmail: string;
  faqItems: ContactFaqItem[];
};

export function ContactPageClient({ notificationEmail, faqItems }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [inquiryType, setInquiryType] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedInquiryTypeLabel = useMemo(
    () => INQUIRY_TYPE_OPTIONS.find((o) => o.value === inquiryType)?.label,
    [inquiryType]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inquiryType) {
      alert("문의 유형을 선택해 주세요.");
      return;
    }

    const typeLabel =
      INQUIRY_TYPE_OPTIONS.find((o) => o.value === inquiryType)?.label ??
      inquiryType;

    setIsSubmitting(true);
    try {
      const result = await submitContactForm({
        firstName,
        lastName,
        email,
        type: typeLabel,
        message,
      });

      if (!result.success) {
        alert(result.error ?? "문의 접수에 실패했습니다.");
        return;
      }

      trackEvent("contact_submit", {});
      alert(
        "문의가 성공적으로 접수되었습니다. 영업일 기준 1~2일 내로 연락드리겠습니다."
      );
      setFirstName("");
      setLastName("");
      setEmail("");
      setInquiryType("");
      setMessage("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-24">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-start">
            <section className="rounded-xl bg-card p-8 shadow-lg">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                이야기 나눠봐요
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
                CoreDXI 도입·상담이 필요하시면 아래 양식을 작성해 주세요. 담당
                영업팀이 빠르게 연락드리겠습니다.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="first-name">이름 (First Name)</Label>
                    <Input
                      id="first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="길동"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last-name">성 (Last Name)</Label>
                    <Input
                      id="last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="홍"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">업무용 이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inquiry-type">문의 유형</Label>
                  <Select
                    value={inquiryType}
                    onValueChange={(v) => {
                      if (v) setInquiryType(v);
                    }}
                  >
                    <SelectTrigger id="inquiry-type" className="w-full">
                      <SelectValue placeholder="선택해 주세요">
                        {selectedInquiryTypeLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {INQUIRY_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message">어떻게 도와드릴까요?</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="프로젝트 배경, 일정, 예산 범위 등을 자유롭게 적어 주세요."
                    rows={4}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 h-11 w-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  {isSubmitting ? "전송 중..." : "제출하기"}
                </Button>
              </form>
            </section>

            <section className="md:pt-8">
              <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                영업팀과 상담하세요
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                CoreDXI는 B2B AX·AI 전환을 위한 회의·협업 솔루션입니다. 도입
                목적에 맞는 기능 구성과 PoC 설계까지 전문 컨설턴트가
                안내합니다.
              </p>

              <ul className="mt-8 space-y-4">
                {MARKETING_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                      <Check className="size-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm leading-relaxed text-foreground md:text-base">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 space-y-3 rounded-xl border border-border bg-card/60 p-5">
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <Mail className="size-4 shrink-0 text-primary dark:text-blue-300" aria-hidden="true" />
                  <span>
                    <span className="font-medium">이메일</span>{" "}
                    <a
                      href={`mailto:${notificationEmail}`}
                      className="font-mono text-foreground hover:text-primary hover:underline dark:hover:text-blue-300"
                    >
                      {notificationEmail}
                    </a>
                  </span>
                </p>
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <Clock className="size-4 shrink-0 text-primary dark:text-blue-300" aria-hidden="true" />
                  <span>
                    <span className="font-medium">응답 시간</span> 영업일 기준
                    1~2일
                  </span>
                </p>
              </div>
            </section>
          </div>

          <ContactFaqSection items={faqItems} />
        </div>
      </main>
    </>
  );
}
