/**
 * admin-guard.ts — 뉴스레터 관리자 권한 확인
 * [홍보팀] 캠페인을 만들 수 있는 사람(SUPER_ADMIN·EDITOR)과, 특정 캠페인을 고치고 발송할 수 있는 사람
 * (SUPER_ADMIN 또는 그 캠페인의 담당자·공동담당자)을 구분합니다.
 */
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type NewsletterAdmin = { adminId: string; role: "SUPER_ADMIN" | "EDITOR"; email: string | null };

type GuardResult = { ok: true; admin: NewsletterAdmin } | { ok: false; error: string };

export async function requireNewsletterAdmin(): Promise<GuardResult> {
  const session = await auth();
  const user = session?.user;
  if (user?.accountType !== "admin" || !user.id) return { ok: false, error: "관리자 로그인이 필요합니다." };
  if (user.role !== "SUPER_ADMIN" && user.role !== "EDITOR") {
    return { ok: false, error: "뉴스레터 권한이 없습니다. EDITOR 이상만 사용할 수 있습니다." };
  }
  return { ok: true, admin: { adminId: user.id, role: user.role, email: user.email ?? null } };
}

export function canManageCampaign(
  admin: NewsletterAdmin,
  campaign: { ownerId: string; coManagerIds: string[] }
): boolean {
  return (
    admin.role === "SUPER_ADMIN" ||
    campaign.ownerId === admin.adminId ||
    campaign.coManagerIds.includes(admin.adminId)
  );
}

export async function requireCampaignManager(campaignId: string): Promise<GuardResult> {
  const gate = await requireNewsletterAdmin();
  if (!gate.ok) return gate;
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id: campaignId },
    select: { ownerId: true, coManagerIds: true },
  });
  if (!campaign) return { ok: false, error: "캠페인을 찾을 수 없습니다." };
  if (!canManageCampaign(gate.admin, campaign)) {
    return { ok: false, error: "이 캠페인의 담당자만 수정·발송할 수 있습니다." };
  }
  return gate;
}
