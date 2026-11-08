"use client";

import {
  updateContactNotificationEmail,
  updateContactStatus,
} from "@/actions/contact";
import { sendReplyEmail } from "@/actions/sendEmail";
import { TestDataCleanupButton } from "@/components/admin/TestDataCleanupButton";
import { type ContactStatus } from "@/lib/contact-status";
import type { ContactRecord } from "@/lib/contact-types";
import type { TestDataPreview } from "@/lib/test-data/cleanup-criteria";
import { Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { ContactList } from "./ContactList";
import { ContactReplyPanel } from "./ContactReplyPanel";

type Props = {
  initialContacts: ContactRecord[];
  loadError?: string;
  initialNotificationEmail: string;
  /** SUPER_ADMIN일 때만 값이 있음 — 없으면 "테스트 데이터 정리" 버튼을 숨긴다. */
  cleanupPreview: TestDataPreview | null;
};

export function AdminContactManager({
  initialContacts,
  loadError,
  initialNotificationEmail,
  cleanupPreview,
}: Props) {
  const [adminEmail, setAdminEmail] = useState(initialNotificationEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [contacts, setContacts] = useState(initialContacts);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialContacts[0]?.id ?? null
  );

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedId) ?? null,
    [contacts, selectedId]
  );

  const handleSaveEmail = async () => {
    const trimmed = adminEmail.trim();
    if (!trimmed) {
      alert("알림 수신 메일 주소를 입력해 주세요.");
      return;
    }

    setIsSavingEmail(true);
    try {
      const result = await updateContactNotificationEmail(trimmed);
      if (!result.success) {
        alert(result.error ?? "알림 수신 메일 저장에 실패했습니다.");
        return;
      }

      setAdminEmail(result.email);
      setIsEditingEmail(false);
      alert(`문의 수신 메일 주소가 ${result.email}로 변경되었습니다.`);
    } finally {
      setIsSavingEmail(false);
    }
  };

  const applyContactStatus = async (
    contactId: string,
    newStatus: ContactStatus,
    previousStatus: ContactStatus
  ) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId ? { ...contact, status: newStatus } : contact
      )
    );

    const result = await updateContactStatus(contactId, newStatus);
    if (!result.success) {
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === contactId
            ? { ...contact, status: previousStatus }
            : contact
        )
      );
      alert(result.error ?? "상태 변경에 실패했습니다.");
      return false;
    }

    return true;
  };

  const handleStatusChange = async (newStatus: ContactStatus) => {
    if (!selectedContact || selectedContact.status === newStatus) return;

    setIsUpdatingStatus(true);
    try {
      await applyContactStatus(
        selectedContact.id,
        newStatus,
        selectedContact.status
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSendReply = async ({
    subject,
    body,
  }: {
    subject: string;
    body: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!selectedContact) {
      return { success: false, error: "답장할 문의를 선택해 주세요." };
    }

    const result = await sendReplyEmail({
      to: selectedContact.email,
      subject,
      text: body,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const previousStatus = selectedContact.status;
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === selectedContact.id
          ? { ...contact, status: "COMPLETED" }
          : contact
      )
    );

    const statusResult = await updateContactStatus(
      selectedContact.id,
      "COMPLETED"
    );
    if (!statusResult.success) {
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === selectedContact.id
            ? { ...contact, status: previousStatus }
            : contact
        )
      );
      alert(
        `메일은 발송되었으나 상태 변경에 실패했습니다. ${statusResult.error ?? ""}`.trim()
      );
    }

    return { success: true };
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 text-slate-800">
      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            고객 문의 및 답장 관리
          </h1>
          <p className="text-sm text-slate-500">
            방문자의 문의를 확인하고 정석 양식으로 신속하게 메일 답장을
            보냅니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cleanupPreview ? (
            <TestDataCleanupButton
              target="contacts"
              initialPreview={cleanupPreview}
              onCleaned={(ids) => setContacts((prev) => prev.filter((c) => !ids.includes(c.id)))}
            />
          ) : null}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <Settings className="h-4 w-4 text-slate-500" />
            <span className="min-w-[90px] text-xs font-semibold text-slate-600">
              알림 수신 메일:
            </span>
            {isEditingEmail ? (
              <div className="flex items-center gap-1">
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-44 rounded border bg-white p-1 text-xs focus:outline-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleSaveEmail}
                  disabled={isSavingEmail}
                  className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingEmail ? "저장 중..." : "저장"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-700">
                  {adminEmail}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingEmail(true)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  변경
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ContactList
        contacts={contacts}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {selectedContact ? (
        <ContactReplyPanel
          contact={selectedContact}
          isUpdatingStatus={isUpdatingStatus}
          onStatusChange={(status) => void handleStatusChange(status)}
          onSend={handleSendReply}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
          목록에서 문의를 선택하면 상세 내용과 답장 폼이 표시됩니다.
        </div>
      )}
    </div>
  );
}
