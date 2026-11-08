"use server";

/**
 * test-data-cleanup.ts — 관리자 "테스트 데이터 정리" 서버 액션 (문의 + AX 체크 리드)
 *
 * [홍보팀] 자동 테스트(E2E)가 남긴 문의·리드만 지웁니다. 최고 관리자(SUPER_ADMIN)만 실행할 수 있고,
 * 무엇을 지울지는 화면이 보낸 목록을 믿지 않고 서버가 매번 다시 찾습니다.
 * 대상 규칙: src/lib/test-data/cleanup-criteria.ts / 설계: docs/superpowers/specs/2026-11-08-e2e-prod-write-guard-design.md
 */
import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  E2E_CONTACT_EMAIL_DOMAIN,
  E2E_CONTACT_EMAIL_PREFIX,
  E2E_LEAD_REF,
  E2E_TEST_MARKER,
  buildPreview,
  isE2eTestContact,
  isE2eTestLead,
  type CleanupTarget,
  type TestDataCleanupResult,
  type TestDataPreviewResult,
  type TestDataSample,
} from "@/lib/test-data/cleanup-criteria";

const CONTACT_EMAIL_LIKE = `${E2E_CONTACT_EMAIL_PREFIX}%${E2E_CONTACT_EMAIL_DOMAIN}`;
const CONTACT_MESSAGE_LIKE = `%${E2E_TEST_MARKER}%`;

const FORBIDDEN = "최고 관리자(SUPER_ADMIN)만 테스트 데이터를 정리할 수 있습니다.";

async function requireSuperAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.accountType !== "admin" || session.user.role !== "SUPER_ADMIN") {
    return { ok: false, error: FORBIDDEN };
  }
  return { ok: true };
}

type ContactRow = { id: string; email: string | null; message: string | null; created_at: string };

type FindResult = { ok: true; samples: TestDataSample[] } | { ok: false; error: string };

async function findTestContacts(): Promise<FindResult> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return { ok: false, error: "문의 조회 설정이 완료되지 않았습니다." };

  const { data, error } = await supabase
    .from("contacts")
    .select("id, email, message, created_at")
    .ilike("email", CONTACT_EMAIL_LIKE)
    .like("message", CONTACT_MESSAGE_LIKE)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[findTestContacts]", error);
    return { ok: false, error: "테스트 문의를 찾는 중 오류가 발생했습니다." };
  }

  const samples = ((data ?? []) as ContactRow[])
    .filter((row) => isE2eTestContact(row))
    .map((row) => ({ id: row.id, label: row.email ?? "", createdAt: row.created_at }));
  return { ok: true, samples };
}

async function findTestLeads(): Promise<FindResult> {
  const rows = await prisma.axCheckResponse.findMany({
    where: { refCode: E2E_LEAD_REF, company: { startsWith: E2E_TEST_MARKER } },
    select: { id: true, refCode: true, company: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const samples = rows
    .filter((row) => isE2eTestLead(row))
    .map((row) => ({ id: row.id, label: row.company, createdAt: row.createdAt.toISOString() }));
  return { ok: true, samples };
}

function find(target: CleanupTarget): Promise<FindResult> {
  return target === "contacts" ? findTestContacts() : findTestLeads();
}

export async function previewTestData(target: CleanupTarget): Promise<TestDataPreviewResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  try {
    const found = await find(target);
    if (!found.ok) return { success: false, error: found.error };
    return { success: true, preview: buildPreview(found.samples) };
  } catch (e) {
    console.error("[previewTestData]", e);
    return { success: false, error: "테스트 데이터를 찾는 중 오류가 발생했습니다." };
  }
}

export async function cleanupTestData(target: CleanupTarget): Promise<TestDataCleanupResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  try {
    // 화면이 보낸 목록이 아니라, 지금 이 순간 서버가 다시 찾은 대상만 지운다.
    const found = await find(target);
    if (!found.ok) return { success: false, error: found.error };
    const ids = found.samples.map((s) => s.id);
    if (ids.length === 0) return { success: true, deletedIds: [] };

    if (target === "contacts") {
      const supabase = createSupabaseAdmin();
      if (!supabase) return { success: false, error: "문의 삭제 설정이 완료되지 않았습니다." };
      const { error } = await supabase
        .from("contacts")
        .delete()
        .in("id", ids)
        .ilike("email", CONTACT_EMAIL_LIKE)
        .like("message", CONTACT_MESSAGE_LIKE);
      if (error) {
        console.error("[cleanupTestData:contacts]", error);
        return { success: false, error: "테스트 문의 삭제 중 오류가 발생했습니다." };
      }
      revalidatePath("/admin/contact");
    } else {
      // 팔로업(T1) 예약은 같은 행의 컬럼이라 행 삭제로 함께 사라진다(개별 "삭제(개인정보 파기)"와 같은 hard delete).
      await prisma.axCheckResponse.deleteMany({
        where: { id: { in: ids }, refCode: E2E_LEAD_REF, company: { startsWith: E2E_TEST_MARKER } },
      });
      revalidatePath("/admin/leads");
    }

    Sentry.addBreadcrumb({
      category: "admin.test-data-cleanup",
      level: "info",
      message: `테스트 데이터 정리: ${target} ${ids.length}건`,
      data: { target, count: ids.length },
    });

    return { success: true, deletedIds: ids };
  } catch (e) {
    console.error("[cleanupTestData]", e);
    return { success: false, error: "테스트 데이터 정리 중 오류가 발생했습니다." };
  }
}
