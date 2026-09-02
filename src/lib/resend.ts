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
    const payload = {
      from: input.from ?? RESEND_FROM,
      to: input.to,
      subject: input.subject,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.html
        ? { html: input.html }
        : { text: input.text ?? "" }),
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
