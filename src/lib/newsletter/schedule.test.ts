import { describe, expect, it } from "vitest";
import { computeNextSendAt, formatKstYmd, kstDateKey, kstYmdToUtc, type ScheduleInput } from "./schedule";

// 2026-10-05(월) 12:00 KST = 03:00 UTC
const MON_NOON_KST = new Date("2026-10-05T03:00:00Z");
const base: ScheduleInput = {
  cadence: "WEEKLY",
  sendDayOfWeek: 2,
  sendHourKst: 8,
  activeFrom: new Date("2026-10-01T00:00:00Z"),
  activeUntil: null,
};

describe("computeNextSendAt", () => {
  it("WEEKLY 화 08시 → 다음 날 화요일 08:00 KST(= 월 23:00 UTC)", () => {
    expect(computeNextSendAt(base, MON_NOON_KST)?.toISOString()).toBe("2026-10-05T23:00:00.000Z");
  });

  it("슬롯과 정확히 같은 시각이면 다음 주로 넘어간다(엄격히 이후)", () => {
    const slot = new Date("2026-10-05T23:00:00Z");
    expect(computeNextSendAt(base, slot)?.toISOString()).toBe("2026-10-12T23:00:00.000Z");
  });

  it("DAILY는 다음 08:00 KST", () => {
    expect(computeNextSendAt({ ...base, cadence: "DAILY" }, MON_NOON_KST)?.toISOString()).toBe(
      "2026-10-05T23:00:00.000Z"
    );
  });

  it("BIWEEKLY는 activeFrom 기준 짝수 주에만", () => {
    const s: ScheduleInput = { ...base, cadence: "BIWEEKLY", activeFrom: new Date("2026-10-05T23:00:00Z") };
    expect(computeNextSendAt(s, MON_NOON_KST)?.toISOString()).toBe("2026-10-05T23:00:00.000Z");
    expect(computeNextSendAt(s, new Date("2026-10-06T00:00:00Z"))?.toISOString()).toBe(
      "2026-10-19T23:00:00.000Z"
    );
  });

  it("MONTHLY는 매월 첫째 주 해당 요일", () => {
    const s: ScheduleInput = { ...base, cadence: "MONTHLY" };
    // 10월 첫째 화요일(10/6)은 이미 지났다고 보고 from=10/7 → 11월 첫째 화요일 11/3
    expect(computeNextSendAt(s, new Date("2026-10-07T00:00:00Z"))?.toISOString()).toBe(
      "2026-11-02T23:00:00.000Z"
    );
  });

  it("사용기간 시작 전이면 시작 이후 첫 슬롯", () => {
    const s = { ...base, activeFrom: new Date("2026-10-20T00:00:00Z") };
    expect(computeNextSendAt(s, MON_NOON_KST)?.toISOString()).toBe("2026-10-26T23:00:00.000Z");
  });

  it("사용기간이 끝났으면 null", () => {
    const s = { ...base, activeUntil: new Date("2026-10-05T10:00:00Z") };
    expect(computeNextSendAt(s, MON_NOON_KST)).toBeNull();
  });

  it("요일 미지정 WEEKLY는 화요일 기본값", () => {
    expect(computeNextSendAt({ ...base, sendDayOfWeek: null }, MON_NOON_KST)?.toISOString()).toBe(
      "2026-10-05T23:00:00.000Z"
    );
  });
});

describe("kstDateKey / formatKstYmd / kstYmdToUtc", () => {
  it("UTC 23:00(=KST 다음날 08:00)의 KST 날짜는 다음날", () => {
    const slot = new Date("2026-10-05T23:00:00Z");
    expect(formatKstYmd(slot)).toBe("2026-10-06");
    expect(kstDateKey(slot).toISOString()).toBe("2026-10-05T15:00:00.000Z");
  });

  it("YYYY-MM-DD를 KST 자정/하루 끝으로 변환", () => {
    expect(kstYmdToUtc("2026-12-31")?.toISOString()).toBe("2026-12-30T15:00:00.000Z");
    expect(kstYmdToUtc("2026-12-31", true)?.toISOString()).toBe("2026-12-31T14:59:59.999Z");
    expect(kstYmdToUtc("2026-13-40")).toBeNull();
    expect(kstYmdToUtc("abc")).toBeNull();
  });
});
