/**
 * reset-password/[token]/page.tsx — 새 비밀번호 설정 (Admin·User 공통)
 *
 * 설계: docs/superpowers/specs/2026-08-26-password-reset-design.md
 * 토큰 유효성은 서버에서 먼저 확인한 뒤에만 폼을 렌더한다.
 */

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { getPasswordResetTokenStatus } from "@/actions/password-reset";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage({ params }: Props) {
  const { token } = await params;
  const status = await getPasswordResetTokenStatus(token);

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
            {status.valid ? (
              <ResetPasswordForm token={token} />
            ) : (
              <div className="space-y-3 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-6" aria-hidden="true" />
                </span>
                <h1 className="text-lg font-bold text-foreground">{status.error}</h1>
                <p className="text-sm text-muted-foreground">
                  <Link
                    href="/forgot-password"
                    className="font-medium text-primary hover:underline"
                  >
                    비밀번호 재설정 다시 요청하기
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
