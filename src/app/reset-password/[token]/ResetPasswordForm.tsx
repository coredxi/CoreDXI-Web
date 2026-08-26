"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordWithToken } from "@/actions/password-reset";

type Props = { token: string };

export function ResetPasswordForm({ token }: Props) {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginHref, setLoginHref] = useState<string | null>(null);

  const isValid = password.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await resetPasswordWithToken(token, password);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setLoginHref(result.accountType === "admin" ? "/admin/login" : "/login");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loginHref) {
    return (
      <div className="space-y-3 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-bold text-foreground">비밀번호가 변경되었습니다</h1>
        <p className="text-sm text-muted-foreground">새 비밀번호로 다시 로그인해 주세요.</p>
        <Link
          href={loginHref}
          className={buttonVariants({
            className: "w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90",
          })}
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-lg font-bold text-foreground">새 비밀번호 설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          새로 사용하실 비밀번호를 입력해 주세요.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reset-password-new">새 비밀번호</Label>
        <Input
          id="reset-password-new"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 입력"
          autoComplete="new-password"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">8자 이상 입력해 주세요.</p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {isSubmitting ? "변경 중..." : "비밀번호 변경"}
      </Button>
    </form>
  );
}
