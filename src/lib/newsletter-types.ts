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
  | { success: false; error: string };

export type NewsletterStats = {
  totalSubscribed: number;
  totalUnsubscribed: number;
};

export type NewsletterListResult =
  | { success: true; stats: NewsletterStats; subscribers: NewsletterSubscriberRecord[] }
  | { success: false; error: string };
