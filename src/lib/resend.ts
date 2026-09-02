import { Resend } from "resend";

export const RESEND_FROM = "CoreDXI <noreply@coredxi.com>";

export type SendResendEmailInput = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string | string[];
  from?: string;
};

export type SendResendEmailResult =
  | { success: true }
  | { success: false; error: string };

export function getResendApiKey(): string | null {
  return process.env.RESEND_API_KEY ?? null;
}

function formatResendError(error: { message?: string }): string {
  return error.message ?? "메일 발송에 실패했습니다.";
}

export async function sendResendEmail(
  input: SendResendEmailInput
): Promise<SendResendEmailResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: "이메일 발송 설정이 완료되지 않았습니다.",
    };
  }

  try {
    const resend = new Resend(apiKey);
    // html·text는 배타적이지 않다 — 둘 다 주어지면 멀티파트로 함께 보낸다(HTML을 못 읽는
    // 클라이언트·접근성 도구를 위한 대체 텍스트). html만 있으면 html만, text만 있으면
    // text만(기존 OTP 메일 등 단일 필드 호출부와 호환 유지). 한 개의 삼항식으로 구성해야
    // Resend SDK의 "html/text 중 최소 하나" 판별 유니언 타입에 맞는다(별도 조건부 스프레드
    // 두 개로 나누면 각 필드가 독립적으로 optional 취급돼 타입이 안 맞는다).
    const bodyFields = input.html
      ? input.text
        ? { html: input.html, text: input.text }
        : { html: input.html }
      : { text: input.text ?? "" };
    const payload = {
      from: input.from ?? RESEND_FROM,
      to: input.to,
      subject: input.subject,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...bodyFields,
    };
    const { error } = await resend.emails.send(payload);

    if (error) {
      console.error("[sendResendEmail]", error);
      return {
        success: false,
        error: formatResendError(error),
      };
    }

    return { success: true };
  } catch (e) {
    console.error("[sendResendEmail]", e);
    return {
      success: false,
      error: "메일 발송 중 오류가 발생했습니다.",
    };
  }
}
