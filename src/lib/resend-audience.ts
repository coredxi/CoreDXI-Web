import { Resend } from "resend";
import { getResendApiKey } from "@/lib/resend";

/**
 * Resend Audiences 연동 — `RESEND_AUDIENCE_ID`가 설정되어 있을 때만 동작한다.
 * 미설정 시 로컬 DB(NewsletterSubscriber)만으로도 구독 기능이 100% 동작하도록
 * 그레이스풀 디그레이드한다 (Resend Audiences 요금제 확인은 경영진 소관이라
 * 개발 착수를 막지 않기 위함 — docs/superpowers/specs/2026-08-08-newsletter-design.md 참고).
 */

export type ResendAudienceSyncResult =
  | { synced: true; resendContactId: string }
  | { synced: false; reason: string };

function getAudienceId(): string | null {
  return process.env.RESEND_AUDIENCE_ID ?? null;
}

export function isResendAudienceConfigured(): boolean {
  return Boolean(getResendApiKey() && getAudienceId());
}

export async function upsertResendAudienceContact(
  email: string
): Promise<ResendAudienceSyncResult> {
  const apiKey = getResendApiKey();
  const audienceId = getAudienceId();
  if (!apiKey || !audienceId) {
    return { synced: false, reason: "RESEND_AUDIENCE_ID 미설정" };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.contacts.create({
      email,
      audienceId,
      unsubscribed: false,
    });

    if (error || !data) {
      console.error("[upsertResendAudienceContact]", error);
      return { synced: false, reason: error?.message ?? "Resend API 오류" };
    }

    return { synced: true, resendContactId: data.id };
  } catch (e) {
    console.error("[upsertResendAudienceContact]", e);
    return { synced: false, reason: "Resend API 호출 중 오류가 발생했습니다." };
  }
}

export async function removeResendAudienceContact(
  resendContactId: string | null
): Promise<void> {
  const apiKey = getResendApiKey();
  const audienceId = getAudienceId();
  if (!apiKey || !audienceId || !resendContactId) return;

  try {
    const resend = new Resend(apiKey);
    await resend.contacts.remove({ id: resendContactId, audienceId });
  } catch (e) {
    // 구독 해지 자체는 로컬 DB 기준으로 이미 성공 처리되므로, Resend 동기화
    // 실패가 사용자에게 노출되지 않도록 로그만 남긴다.
    console.error("[removeResendAudienceContact]", e);
  }
}
