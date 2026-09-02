import { describe, expect, it } from "vitest";
import {
  KR_PUBLIC_HOLIDAYS,
  addBusinessDays,
  computeFollowupScheduledAt,
  formatKstFollowupSchedule,
  kstDateTimeToUtc,
  toKstDateString,
} from "./business-days";

describe("toKstDateString", () => {
  it("UTC 14:59:59는 같은 날짜의 KST(23:59:59)로 변환된다", () => {
    expect(toKstDateString(new Date("2026-09-02T14:59:59Z"))).toBe("2026-09-02");
  });

  it("UTC 15:00:00는 다음날 KST 자정(00:00:00)으로 넘어간다", () => {
    expect(toKstDateString(new Date("2026-09-02T15:00:00Z"))).toBe("2026-09-03");
  });
});

describe("kstDateTimeToUtc", () => {
  it("KST 09:30은 UTC 00:30이다", () => {
    expect(kstDateTimeToUtc("2026-09-04", 9, 30).toISOString()).toBe(
      "2026-09-04T00:30:00.000Z"
    );
  });
});

describe("addBusinessDays", () => {
  it("주말만 건너뛴다(공휴일 없음)", () => {
    // 2026-09-04는 금요일 — +1 영업일은 주말(토·일)을 건너뛴 월요일
    expect(addBusinessDays("2026-09-04", 1, new Set())).toBe("2026-09-07");
  });

  it("수요일 제출 → D+2 영업일은 금요일이다", () => {
    // 2026-09-02는 수요일
    expect(addBusinessDays("2026-09-02", 2, KR_PUBLIC_HOLIDAYS)).toBe("2026-09-04");
  });

  it("금요일 제출 → D+2 영업일은 화요일이다(주말 건너뜀)", () => {
    // 2026-09-04는 금요일
    expect(addBusinessDays("2026-09-04", 2, KR_PUBLIC_HOLIDAYS)).toBe("2026-09-08");
  });

  it("추석 연휴 직전 제출 → 연휴(9/24~26)와 주말을 모두 건너뛴다", () => {
    // 2026-09-23은 수요일. +1영업일은 9/24(목,휴일)·9/25(금,휴일)·9/26(토,휴일 겸 주말)·
    // 9/27(일,주말)을 모두 건너뛴 9/28(월). +2영업일은 9/29(화).
    expect(addBusinessDays("2026-09-23", 2, KR_PUBLIC_HOLIDAYS)).toBe("2026-09-29");
  });

  it("성탄절(공휴일) 다음이 주말과 이어지면 연속으로 건너뛴다", () => {
    // 2026-12-24(목) +1영업일: 12/25(금,휴일) → 12/26(토,주말) → 12/27(일,주말) → 12/28(월)
    expect(addBusinessDays("2026-12-24", 1, KR_PUBLIC_HOLIDAYS)).toBe("2026-12-28");
  });
});

describe("computeFollowupScheduledAt", () => {
  it("수요일 14:00 KST 제출 → D+2 영업일(금요일) 09:30 KST를 UTC로 반환한다", () => {
    // 2026-09-02T05:00:00Z = 2026-09-02 14:00 KST(수요일)
    const result = computeFollowupScheduledAt(new Date("2026-09-02T05:00:00Z"));
    expect(result.toISOString()).toBe("2026-09-04T00:30:00.000Z"); // 09/04 09:30 KST
  });
});

describe("formatKstFollowupSchedule", () => {
  it("YYYY-MM-DD(요일) HH:mm 형식으로 포맷한다", () => {
    // 2026-09-04T00:30:00Z = 2026-09-04 09:30 KST(금요일)
    expect(formatKstFollowupSchedule(new Date("2026-09-04T00:30:00Z"))).toBe(
      "2026-09-04(금) 09:30"
    );
  });
});
