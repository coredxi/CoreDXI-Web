export type NewsletterSubscriberStatus = "SUBSCRIBED" | "UNSUBSCRIBED";

export type NewsletterSubscriberRecord = {
  id: string;
  email: string;
  status: NewsletterSubscriberStatus;
  source: string | null;
  subscribedAt: Date;
  unsubscribedAt: Date | null;
};

export type NewsletterSubscribeResult =
  | { success: true }
  | { success: false; error: string };

export type NewsletterUnsubscribeResult =
  | { success: true; email: string }
  | { success: false; error: string; code: "invalid_token" | "server_error" };

/** 수신거부 확인 화면용(상태 변경 없음). 이메일은 가려서 전달한다. */
export type NewsletterUnsubscribeTarget =
  | { success: true; maskedEmail: string; alreadyUnsubscribed: boolean }
  | { success: false; error: string };

export type NewsletterStats = {
  totalSubscribed: number;
  totalUnsubscribed: number;
};

export type NewsletterListResult =
  | { success: true; stats: NewsletterStats; subscribers: NewsletterSubscriberRecord[] }
  | { success: false; error: string };
