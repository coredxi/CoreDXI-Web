/**
 * forgot-password/page.tsx — 비밀번호 재설정 요청 (Admin·User 공통)
 *
 * 설계: docs/superpowers/specs/2026-08-26-password-reset-design.md
 */

"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/actions/password-reset";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<
    { type: "idle" } | { type: "sent" } | { type: "error"; message: string }
  >({ type: "idle" });

  const isValidEmail = email.includes("@") && email.includes(".");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset(email);
      if (!result.success) {
        setStatus({ type: "error", message: result.error });
        return;
      }
      setStatus({ type: "sent" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <Logo
          size={36}
          showWordmark
          href="/"
          wordmarkClassName="text-xl font-bold tracking-tight text-foreground"
        />

        <Card className="w-full max-w-md border border-border shadow-md ring-0">
          <CardContent className="p-8 sm:p-10">
            {status.type === "sent" ? (
              <div className="space-y-3 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail className="size-6" aria-hidden="true" />
                </span>
                <h1 className="text-lg font-bold text-foreground">메일을 확인해 주세요</h1>
                <p className="text-sm text-muted-foreground">
                  입력하신 이메일로 가입된 계정이 있다면, 비밀번호 재설정 링크를
                  보내드렸습니다. 링크는 1시간 동안만 유효합니다.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <h1 className="text-lg font-bold text-foreground">비밀번호 재설정</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    가입하신 이메일 주소를 입력하시면 재설정 링크를 보내드립니다.
                    관리자·일반 회원 계정 모두 이용할 수 있습니다.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="forgot-password-email">이메일</Label>
                  <Input
                    id="forgot-password-email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {status.type === "error" && (
                  <p className="text-sm text-destructive" role="alert">
                    {status.message}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={!isValidEmail || isSubmitting}
                  className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting ? "전송 중..." : "재설정 링크 보내기"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium hover:underline hover:underline-offset-4">
            일반 로그인
          </Link>
          {" · "}
          <Link
            href="/admin/login"
            className="font-medium hover:underline hover:underline-offset-4"
          >
            관리자 로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
