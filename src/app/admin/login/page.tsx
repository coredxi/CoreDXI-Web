"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ADMIN_LOGIN_CONTENT = {
  title: "관리자 로그인",
  subtitle: "CoreDXI 관리자 계정으로 로그인하세요.",
  emailLabel: "관리자 이메일",
  emailPlaceholder: "admin@coredxi.com",
  passwordLabel: "비밀번호",
  passwordPlaceholder: "비밀번호를 입력하세요",
  submitText: "관리자 로그인",
  submittingText: "로그인 중…",
  initialSetupLinkText: "최초 관리자 계정이 없나요? 시스템 설정",
  userLoginLinkText: "일반 사용자 로그인",
} as const;

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("/admin/users");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const nextCallback = params.get("callbackUrl");
    if (nextCallback?.startsWith("/admin")) {
      setCallbackUrl(nextCallback);
    }
    if (params.get("error") === "Forbidden") {
      toast.error("관리자 전용 영역입니다. 관리자 계정으로 로그인해 주세요.");
      window.history.replaceState({}, "", "/admin/login");
    }
    if (params.get("setup") === "complete") {
      toast.success("최초 관리자 계정이 등록되었습니다. 로그인해 주세요.");
      window.history.replaceState({}, "", "/admin/login");
    }
  }, []);

  const isEmailValid = email.includes("@") && email.includes(".");
  const isFormValid = isEmailValid && password.trim().length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex items-center justify-between border-b border-border/40 px-6 py-4">
        <Logo
          size={30}
          showWordmark
          wordmark="CoreDXI Admin"
          wordmarkClassName="text-lg font-bold tracking-tight text-primary"
        />
        <Link
          href="/login"
          className="text-sm font-medium text-primary hover:underline"
        >
          {ADMIN_LOGIN_CONTENT.userLoginLinkText}
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {ADMIN_LOGIN_CONTENT.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {ADMIN_LOGIN_CONTENT.subtitle}
            </p>
          </div>

          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!isFormValid || pending) return;

              setPending(true);
              try {
                const result = await signIn("admin-credentials", {
                  email: email.trim(),
                  password,
                  redirect: false,
                });
                if (result?.error) {
                  toast.error(
                    "이메일 또는 비밀번호가 올바르지 않거나 관리자 권한이 없습니다."
                  );
                } else {
                  toast.success("관리자로 로그인되었습니다.");
                  router.push(callbackUrl);
                  router.refresh();
                }
              } finally {
                setPending(false);
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="admin-login-email" className="text-sm font-medium">
                {ADMIN_LOGIN_CONTENT.emailLabel}
              </Label>
              <Input
                id="admin-login-email"
                type="email"
                autoComplete="username"
                placeholder={ADMIN_LOGIN_CONTENT.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                className="rounded-xl border-border bg-white focus-visible:ring-primary"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-login-password" className="text-sm font-medium">
                  {ADMIN_LOGIN_CONTENT.passwordLabel}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
              <Input
                id="admin-login-password"
                type="password"
                autoComplete="current-password"
                placeholder={ADMIN_LOGIN_CONTENT.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
                className="rounded-xl border-border bg-white focus-visible:ring-primary"
              />
            </div>

            <Button
              type="submit"
              disabled={!isFormValid || pending}
              className="w-full rounded-xl bg-primary font-semibold text-white shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending
                ? ADMIN_LOGIN_CONTENT.submittingText
                : ADMIN_LOGIN_CONTENT.submitText}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            <Link
              href="/setup"
              className="font-medium text-primary hover:underline hover:underline-offset-4"
            >
              {ADMIN_LOGIN_CONTENT.initialSetupLinkText}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
