/**
 * business-days.ts — AX 체크 팔로업(T1) 발송 시각 계산용 KST 영업일 유틸
 *
 * 외부 날짜 라이브러리를 쓰지 않는다 — Intl.DateTimeFormat(Asia/Seoul)만 사용.
 * 설계: docs/superpowers/specs/2026-09-02-ax-check-auto-followup-design.md 5번
 */

/**
 * 한국 공휴일(2026년 잔여분 + 2027-01-01). 매년 갱신 필요 —
 * 수정 방법은 CONTENT_GUIDE.md 17번 참고. 대체공휴일은 관보 확인 후 추가한다.
 * [홍보팀] 새해가 되면 이 목록을 다음 해 공휴일로 갱신해 주세요.
 */
export const KR_PUBLIC_HOLIDAYS: ReadonlySet<string> = new Set([
  "2026-09-24", // 추석 연휴
  "2026-09-25", // 추석
  "2026-09-26", // 추석 연휴
  "2026-10-03", // 개천절
  "2026-10-09", // 한글날
  "2026-12-25", // 성탄절
  "2027-01-01", // 신정
]);

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** UTC Date → KST 기준 "YYYY-MM-DD" 문자열. */
export function toKstDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
}

/**
 * fromKstDate(YYYY-MM-DD, 달력상의 KST 날짜)로부터 n영업일 뒤의 날짜를 반환한다.
 * 주말(토·일)과 holidays에 포함된 날짜를 건너뛴다. 순수 함수 — 시각 정보는 다루지 않는다.
 */
export function addBusinessDays(
  fromKstDate: string,
  n: number,
  holidays: ReadonlySet<string> = KR_PUBLIC_HOLIDAYS
): string {
  const cursor = new Date(`${fromKstDate}T00:00:00Z`);
  let remaining = n;

  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dateStr = cursor.toISOString().slice(0, 10);
    const isWeekend = cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6;
    if (!isWeekend && !holidays.has(dateStr)) {
      remaining -= 1;
    }
  }

  return cursor.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" + KST 시:분 → 실제 시각(UTC Date). */
export function kstDateTimeToUtc(dateStr: string, hh: number, mm: number): Date {
  const hhStr = String(hh).padStart(2, "0");
  const mmStr = String(mm).padStart(2, "0");
  return new Date(`${dateStr}T${hhStr}:${mmStr}:00+09:00`);
}

/** 제출 시각(UTC) → D+2 영업일 09:30 KST(UTC Date). submitAxCheck에서 사용. */
export function computeFollowupScheduledAt(
  submittedAt: Date,
  holidays: ReadonlySet<string> = KR_PUBLIC_HOLIDAYS
): Date {
  const submittedKstDate = toKstDateString(submittedAt);
  const targetKstDate = addBusinessDays(submittedKstDate, 2, holidays);
  return kstDateTimeToUtc(targetKstDate, 9, 30);
}

/** "2026-09-04(금) 09:30" 형식 — 영업이사 알림 메일에서 사용. */
export function formatKstFollowupSchedule(date: Date): string {
  const dateStr = toKstDateString(date);
  const weekdayIndex = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  const timeStr = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${dateStr}(${WEEKDAY_KO[weekdayIndex]}) ${timeStr}`;
}
