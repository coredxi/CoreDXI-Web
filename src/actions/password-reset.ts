"use server";

/**
 * password-reset.ts — Admin·User 공통 비밀번호 재설정(이메일 링크) 서버 액션
 *
 * requestPasswordReset: 이메일 검증 → rate limit → Admin/User 조회 → 토큰 발급·메일 발송.
 * 계정 존재 여부와 무관하게 항상 동일한 응답을 반환해 이메일 열거 공격을 막는다.
 * resetPasswordWithToken: 토큰 검증 → 새 비밀번호로 Admin 또는 User 갱신 → 토큰 삭제(1회용).
 *
 * 설계: docs/superpowers/specs/2026-08-26-password-reset-design.md
 */

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { sendResendEmail } from "@/lib/resend";
import {
  generatePasswordResetToken,
  getPasswordResetExpiresAt,
} from "@/lib/password-reset-token";
import type {
  PasswordResetRequestResult,
  PasswordResetResult,
  PasswordResetTokenStatus,
} from "@/lib/password-reset-types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

function siteUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://www.coredxi.com";
}

export async function requestPasswordReset(
  emailInput: string
): Promise<PasswordResetRequestResult> {
  const email = emailInput.trim().toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) {
    return { success: false, error: "올바른 이메일 주소를 입력해 주세요." };
  }

  const clientIp = await getClientIp();
  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit(`password-reset-request-ip:${clientIp}`, {
      max: 5,
      windowMs: 60 * 60 * 1000,
    }),
    checkRateLimit(`password-reset-request-email:${email}`, {
      max: 3,
      windowMs: 60 * 60 * 1000,
    }),
  ]);
  if (!ipLimit.allowed) {
    return {
      success: false,
      error: `너무 많은 요청이 접수되었습니다. ${ipLimit.retryAfterSeconds}초 후 다시 시도해 주세요.`,
    };
  }
  if (!emailLimit.allowed) {
    return {
      success: false,
      error: `너무 많은 요청이 접수되었습니다. ${emailLimit.retryAfterSeconds}초 후 다시 시도해 주세요.`,
    };
  }

  try {
    const [admin, user] = await Promise.all([
      prisma.admin.findUnique({ where: { email }, select: { id: true } }),
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
    ]);

    if (!admin && !user) {
      // 계정이 없어도 이 시점에서는 성공과 동일하게 응답한다(이메일 열거 방지).
      return { success: true };
    }

    const token = generatePasswordResetToken();
    const expiresAt = getPasswordResetExpiresAt();

    await prisma.passwordResetToken.deleteMany({ where: { email } });
    await prisma.passwordResetToken.create({
      data: { email, token, expiresAt },
    });

    const resetUrl = `${siteUrl()}/reset-password/${token}`;
    const mailResult = await sendResendEmail({
      to: email,
      subject: "[CoreDXI] 비밀번호 재설정 안내",
      text: [
        "비밀번호 재설정을 요청하셨습니다.",
        "아래 링크에서 새 비밀번호를 설정해 주세요. 이 링크는 1시간 동안만 유효합니다.",
        "",
        resetUrl,
        "",
        "본인이 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.",
      ].join("\n"),
    });

    if (!mailResult.success) {
      console.error("[requestPasswordReset] email failed:", mailResult.error);
      return {
        success: false,
        error: "메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      };
    }

    return { success: true };
  } catch (e) {
    console.error("[requestPasswordReset]", e);
    return {
      success: false,
      error: "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}

export async function getPasswordResetTokenStatus(
  token: string
): Promise<PasswordResetTokenStatus> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { valid: false, error: "유효하지 않은 링크입니다." };
  }

  try {
    const record = await prisma.passwordResetToken.findUnique({
      where: { token: trimmed },
      select: { expiresAt: true },
    });

    if (!record) {
      return { valid: false, error: "유효하지 않은 링크입니다." };
    }
    if (record.expiresAt < new Date()) {
      return { valid: false, error: "링크가 만료되었습니다. 다시 요청해 주세요." };
    }

    return { valid: true };
  } catch (e) {
    console.error("[getPasswordResetTokenStatus]", e);
    return { valid: false, error: "링크 확인 중 오류가 발생했습니다." };
  }
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<PasswordResetResult> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return { success: false, error: "유효하지 않은 링크입니다." };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      success: false,
      error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`,
    };
  }

  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit(`password-reset-consume-ip:${clientIp}`, {
    max: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `너무 많은 요청이 접수되었습니다. ${rateLimit.retryAfterSeconds}초 후 다시 시도해 주세요.`,
    };
  }

  try {
    const record = await prisma.passwordResetToken.findUnique({
      where: { token: trimmedToken },
    });

    if (!record) {
      return { success: false, error: "유효하지 않은 링크입니다." };
    }
    if (record.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { token: trimmedToken } });
      return { success: false, error: "링크가 만료되었습니다. 다시 요청해 주세요." };
    }

    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    const admin = await prisma.admin.findUnique({
      where: { email: record.email },
      select: { id: true },
    });

    if (admin) {
      await prisma.admin.update({ where: { id: admin.id }, data: { password: hashed } });
      await prisma.passwordResetToken.delete({ where: { token: trimmedToken } });
      return { success: true, accountType: "admin" };
    }

    const user = await prisma.user.findUnique({
      where: { email: record.email },
      select: { id: true },
    });

    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
      await prisma.passwordResetToken.delete({ where: { token: trimmedToken } });
      return { success: true, accountType: "user" };
    }

    // 토큰 발급 이후 계정이 삭제된 경우
    await prisma.passwordResetToken.delete({ where: { token: trimmedToken } });
    return { success: false, error: "유효하지 않은 링크입니다." };
  } catch (e) {
    console.error("[resetPasswordWithToken]", e);
    return {
      success: false,
      error: "비밀번호 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}
