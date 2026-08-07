import { listNewsletterSubscribers } from "@/actions/newsletter";
import { formatKstDate } from "@/lib/format-kst-date";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  SUBSCRIBED: "구독 중",
  UNSUBSCRIBED: "해지됨",
};

export default async function AdminNewsletterPage() {
  const result = await listNewsletterSubscribers();

  if (!result.success) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">뉴스레터 구독자</h1>
        <p className="mt-4 text-sm text-red-600">{result.error}</p>
      </div>
    );
  }

  const { stats, subscribers } = result;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">뉴스레터 구독자</h1>
      <p className="mt-1 text-sm text-gray-500">
        블로그 하단 뉴스레터 폼으로 접수된 구독자 목록입니다. 최근 200건까지
        표시됩니다.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">구독 중</p>
          <p className="mt-1 text-3xl font-bold text-[#1E4E8C]">
            {stats.totalSubscribed}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">해지됨</p>
          <p className="mt-1 text-3xl font-bold text-gray-400">
            {stats.totalUnsubscribed}
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">이메일</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">유입 경로</th>
              <th className="px-4 py-3 font-medium">구독일</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  아직 구독자가 없습니다.
                </td>
              </tr>
            ) : (
              subscribers.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-gray-900">{s.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.status === "SUBSCRIBED"
                          ? "bg-blue-50 text-[#1E4E8C]"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.source ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatKstDate(s.subscribedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
