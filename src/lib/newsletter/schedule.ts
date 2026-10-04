/**
 * schedule.ts — 뉴스레터 발송 슬롯(KST) 계산. 순수 함수.
 * [홍보팀] "매주 화요일 오전 8시" 같은 캠페인 설정을 실제 발송 시각으로 바꿔 주는 계산기입니다.
 * 한국 시간은 서머타임이 없어 UTC+9 고정으로 계산합니다.
 */
import { DEFAULT_SEND_DAY_OF_WEEK } from "./defaults";

export type CadenceValue = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export type ScheduleInput = {
  cadence: CadenceValue;
  sendDayOfWeek: number | null;
  sendHourKst: number;
  activeFrom: Date;
  activeUntil: Date | null;
};

const KST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;
const SEARCH_DAYS = 70; // 격주·월간 슬롯을 찾기에 충분한 탐색 범위

function kstParts(date: Date) {
  const k = new Date(date.getTime() + KST_OFFSET_MS);
  return { y: k.getUTCFullYear(), m0: k.getUTCMonth(), d: k.getUTCDate(), dow: k.getUTCDay() };
}

function kstToUtc(y: number, m0: number, d: number, h: number): Date {
  return new Date(Date.UTC(y, m0, d, h) - KST_OFFSET_MS);
}

function kstDayNumber(date: Date): number {
  return Math.floor((date.getTime() + KST_OFFSET_MS) / DAY_MS);
}

function matchesCadence(s: ScheduleInput, candidate: Date): boolean {
  if (s.cadence === "DAILY") return true;
  const p = kstParts(candidate);
  if (p.dow !== (s.sendDayOfWeek ?? DEFAULT_SEND_DAY_OF_WEEK)) return false;
  if (s.cadence === "WEEKLY") return true;
  if (s.cadence === "BIWEEKLY") {
    const diffDays = kstDayNumber(candidate) - kstDayNumber(s.activeFrom);
    return Math.floor(diffDays / 7) % 2 === 0;
  }
  return p.d <= 7; // MONTHLY — 첫째 주 해당 요일
}

export function computeNextSendAt(s: ScheduleInput, from: Date): Date | null {
  const start = from < s.activeFrom ? s.activeFrom : from;
  const p = kstParts(start);
  for (let i = -1; i <= SEARCH_DAYS; i++) {
    const candidate = kstToUtc(p.y, p.m0, p.d + i, s.sendHourKst);
    if (candidate <= from || candidate < s.activeFrom) continue;
    if (s.activeUntil && candidate > s.activeUntil) return null;
    if (matchesCadence(s, candidate)) return candidate;
  }
  return null;
}

export function kstDateKey(date: Date): Date {
  const p = kstParts(date);
  return kstToUtc(p.y, p.m0, p.d, 0);
}

export function formatKstYmd(date: Date): string {
  const p = kstParts(date);
  return `${p.y}-${String(p.m0 + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** "YYYY-MM-DD"(KST 달력) → 그 날 00:00:00.000 KST(또는 endOfDay면 23:59:59.999 KST)의 UTC 순간. */
export function kstYmdToUtc(ymd: string, endOfDay = false): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const start = kstToUtc(y, mo, d, 0);
  if (formatKstYmd(start) !== ymd) return null; // 2026-13-40 같은 값 거부
  return endOfDay ? new Date(start.getTime() + DAY_MS - 1) : start;
}
