import {
  getContactNotificationEmail,
  listContacts,
} from "@/actions/contact";
import { auth } from "@/auth";
import { previewTestData } from "@/actions/test-data-cleanup";
import { AdminContactManager } from "./AdminContactManager";

export const dynamic = "force-dynamic";

export default async function AdminContactPage() {
  const session = await auth();
  // [홍보팀] "테스트 데이터 정리" 버튼은 최고 관리자(SUPER_ADMIN)에게만 보입니다.
  const canCleanup = session?.user?.role === "SUPER_ADMIN";
  const [result, notificationEmail, cleanupResult] = await Promise.all([
    listContacts(),
    getContactNotificationEmail(),
    canCleanup ? previewTestData("contacts") : Promise.resolve(null),
  ]);

  return (
    <AdminContactManager
      initialContacts={result.success ? result.data : []}
      loadError={result.success ? undefined : result.error}
      initialNotificationEmail={notificationEmail}
      cleanupPreview={cleanupResult?.success ? cleanupResult.preview : null}
    />
  );
}
