"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { sendResendEmail } from "@/lib/resend";
import { generateUnsubscribeToken } from "@/lib/newsletter-token";
import { maskEmail, unsubscribePageUrl } from "@/lib/newsletter-unsubscribe";
import {
  removeResendAudienceContact,
  upsertResendAudienceContact,
} from "@/lib/resend-audience";
import type {
  NewsletterListResult,
  NewsletterSubscribeResult,
  NewsletterUnsubscribeResult,
  NewsletterUnsubscribeTarget,
} from "@/lib/newsletter-types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.coredxi.com";

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.accountType !== "admin" || !session.user.role) {
    return { ok: false, error: "관리자 로그인이 필요합니다." };
  }
  return { ok: true };
}

export async function subscribeNewsletter(
  emailInput: string,
  source?: string
): Promise<NewsletterSubscribeResult> {
  const email = emailInput.trim().toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) {
    return { success: false, error: "올바른 이메일 주소를 입력해 주세요." };
  }

  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit(`newsletter-subscribe:${clientIp}`, {
    max: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `너무 많은 요청이 접수되었습니다. ${rateLimit.retryAfterSeconds}초 후 다시 시도해 주세요.`,
    };
  }

  try {
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    const unsubscribeToken = existing?.unsubscribeToken ?? generateUnsubscribeToken();

    const subscriber = await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: {
        status: "SUBSCRIBED",
        unsubscribedAt: null,
        ...(source ? { source } : {}),
      },
      create: {
        email,
        unsubscribeToken,
        source: source ?? null,
      },
    });

    const syncResult = await upsertResendAudienceContact(email);
    if (syncResult.synced && subscriber.resendContactId !== syncResult.resendContactId) {
      await prisma.newsletterSubscriber.update({
        where: { email },
        data: { resendContactId: syncResult.resendContactId },
      });
    }

    const unsubscribeUrl = unsubscribePageUrl(SITE_URL, subscriber.unsubscribeToken);
    const notifyResult = await sendResendEmail({
      to: email,
      subject: "[CoreDXI] 뉴스레터 구독이 완료되었습니다",
      text: [
        "CoreDXI 뉴스레터 구독을 신청해 주셔서 감사합니다.",
        "새 블로그 소식이 있을 때 이 이메일로 안내드립니다.",
        "",
        `구독을 원치 않으시면 아래 링크에서 언제든 해지하실 수 있습니다.`,
        unsubscribeUrl,
      ].join("\n"),
    });

    if (!notifyResult.success) {
      // 확인 메일 발송 실패가 구독 자체를 막지 않도록 한다 (contact.ts와 동일 원칙).
      console.error("[subscribeNewsletter] confirmation email failed:", notifyResult.error);
    }

    return { success: true };
  } catch (e) {
    console.error("[subscribeNewsletter]", e);
    return {
      success: false,
      error: "구독 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}

export async function unsubscribeNewsletterByToken(
  token: string
): Promise<NewsletterUnsubscribeResult> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { success: false, error: "유효하지 않은 구독 해지 링크입니다.", code: "invalid_token" };
  }

  try {
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: trimmed },
    });

    if (!subscriber) {
      return { success: false, error: "유효하지 않은 구독 해지 링크입니다.", code: "invalid_token" };
    }

    if (subscriber.status === "UNSUBSCRIBED") {
      return { success: true, email: subscriber.email };
    }

    await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
    });

    await removeResendAudienceContact(subscriber.resendContactId);

    return { success: true, email: subscriber.email };
  } catch (e) {
    console.error("[unsubscribeNewsletterByToken]", e);
    return {
      success: false,
      error: "구독 해지 처리 중 오류가 발생했습니다.",
      code: "server_error",
    };
  }
}

/**
 * 수신거부 확인 화면용 조회 — 상태를 바꾸지 않는다(GET 안전).
 * 메일 보안 검사기가 링크를 미리 열어도 구독이 풀리지 않도록, 실제 해지는 confirmUnsubscribe(POST)에서만 한다.
 */
export async function getUnsubscribeTarget(token: string): Promise<NewsletterUnsubscribeTarget> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { success: false, error: "유효하지 않은 구독 해지 링크입니다." };
  }
  try {
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: trimmed },
      select: { email: true, status: true },
    });
    if (!subscriber) {
      return { success: false, error: "유효하지 않은 구독 해지 링크입니다." };
    }
    return {
      success: true,
      maskedEmail: maskEmail(subscriber.email),
      alreadyUnsubscribed: subscriber.status === "UNSUBSCRIBED",
    };
  } catch (e) {
    console.error("[getUnsubscribeTarget]", e);
    return { success: false, error: "구독 정보를 확인하는 중 오류가 발생했습니다." };
  }
}

/**
 * 확인 화면의 "구독 해지" 버튼(폼 POST)에서 호출. 처리 후 같은 화면으로 돌아가 결과를 보여준다.
 * 사용: `<form action={confirmUnsubscribe.bind(null, token)}>`
 */
export async function confirmUnsubscribe(token: string): Promise<void> {
  const path = `/unsubscribe/${encodeURIComponent(token.trim())}`;

  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit(`newsletter-unsubscribe:${clientIp}`, {
    max: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    redirect(`${path}?error=rate`);
  }

  const result = await unsubscribeNewsletterByToken(token);
  redirect(result.success ? path : `${path}?error=failed`);
}

export async function listNewsletterSubscribers(): Promise<NewsletterListResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  try {
    const [totalSubscribed, totalUnsubscribed, subscribers] = await Promise.all([
      prisma.newsletterSubscriber.count({ where: { status: "SUBSCRIBED" } }),
      prisma.newsletterSubscriber.count({ where: { status: "UNSUBSCRIBED" } }),
      prisma.newsletterSubscriber.findMany({
        orderBy: { subscribedAt: "desc" },
        take: 200,
        select: {
          id: true,
          email: true,
          status: true,
          source: true,
          subscribedAt: true,
          unsubscribedAt: true,
        },
      }),
    ]);

    return {
      success: true,
      stats: { totalSubscribed, totalUnsubscribed },
      subscribers,
    };
  } catch (e) {
    console.error("[listNewsletterSubscribers]", e);
    return {
      success: false,
      error: "구독자 목록을 불러오는 중 오류가 발생했습니다.",
    };
  }
}
