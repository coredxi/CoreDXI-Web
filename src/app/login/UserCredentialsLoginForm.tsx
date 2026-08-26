"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
} from "@/components/login/PasswordFieldIcons";

type Props = {
  callbackUrl: string;
};

export function UserCredentialsLoginForm({ callbackUrl }: Props) {
  const router = useRouter();

  const [loginStep, setLoginStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailChecking, setIsEmailChecking] = useState(false);
  const [isUserPending, setIsUserPending] = useState(false);

  const isValidEmail = email.includes("@") && email.includes(".");
  const isUserFormValid = password.trim().length > 0;

  function goToSignup(trimmed: string) {
    router.push(`/signup?email=${encodeURIComponent(trimmed)}`);
  }

  function backToEmailStep() {
    setLoginStep("email");
    setPassword("");
    setShowPassword(false);
  }

  async function handleEmailContinue() {
    const trimmed = email.trim();
    if (!trimmed.includes("@") || !trimmed.includes(".") || isEmailChecking) {
      return;
    }

    setIsEmailChecking(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message ?? "이메일 확인에 실패했습니다.");
        return;
      }

      if (data.exists && data.hasPassword) {
        setLoginStep("password");
        return;
      }

      goToSignup(trimmed);
    } catch {
      toast.error("이메일 확인 중 오류가 발생했습니다.");
    } finally {
      setIsEmailChecking(false);
    }
  }

  async function handleUserLogin() {
    const trimmed = email.trim();
    if (!isUserFormValid || isUserPending) return;

    setIsUserPending(true);
    try {
      const result = await signIn("user-credentials", {
        email: trimmed,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }

      toast.success("로그인되었습니다.");
      router.push(callbackUrl);
      router.refresh();
    } finally {
      setIsUserPending(false);
    }
  }

  return (
    <Card className="w-full max-w-md border border-gray-200 shadow-sm ring-0">
      <CardContent className="space-y-4 p-6">
        {loginStep === "email" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-sm font-medium">
                이메일
              </Label>
              <Input
                id="login-email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border-gray-300"
                autoComplete="email"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isValidEmail) {
                    void handleEmailContinue();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              disabled={!isValidEmail || isEmailChecking}
              className="w-full rounded-md bg-primary font-semibold text-white hover:bg-primary/90 disabled:opacity-40"
              onClick={() => void handleEmailContinue()}
            >
              {isEmailChecking ? "확인 중…" : "Continue"}
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="login-email-readonly" className="text-sm font-medium">
                이메일
              </Label>
              <div className="relative">
                <Input
                  id="login-email-readonly"
                  type="email"
                  value={email}
                  readOnly
                  className="rounded-md border-gray-300 bg-gray-50 pr-10"
                />
                <button
                  type="button"
                  onClick={backToEmailStep}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
                  aria-label="이메일 수정"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="user-password" className="text-sm font-medium">
                  비밀번호
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="user-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isUserPending}
                  className="rounded-md border-gray-300 pr-10"
                  autoComplete="current-password"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isUserFormValid) {
                      void handleUserLogin();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="button"
              disabled={!isUserFormValid || isUserPending}
              className="w-full rounded-md bg-primary font-semibold text-white hover:bg-primary/90 disabled:opacity-40"
              onClick={() => void handleUserLogin()}
            >
              {isUserPending ? "로그인 중…" : "로그인"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
