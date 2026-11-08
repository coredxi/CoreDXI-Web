import { describe, expect, it } from "vitest";
import { buildPreview, isE2eTestContact, isE2eTestLead } from "./cleanup-criteria";

describe("isE2eTestContact", () => {
  it("e2e-…@example.com 이고 [E2E TEST] 내용이면 대상", () => {
    expect(
      isE2eTestContact({
        email: "e2e-1762590000000@example.com",
        message: "[E2E TEST] Playwright 골든패스 자동 테스트 문의입니다.",
      })
    ).toBe(true);
  });

  it("e2e-…@example.com 이지만 [E2E TEST] 표식이 없으면 대상 아님", () => {
    expect(isE2eTestContact({ email: "e2e-1@example.com", message: "도입 상담 요청드립니다." })).toBe(false);
  });

  it("[E2E TEST]가 있어도 다른 도메인이면 대상 아님", () => {
    expect(isE2eTestContact({ email: "e2e-1@customer.co.kr", message: "[E2E TEST] 문의" })).toBe(false);
    expect(isE2eTestContact({ email: "e2e-1@example.com.evil.kr", message: "[E2E TEST] 문의" })).toBe(false);
  });

  it("[E2E TEST]가 있어도 e2e- 접두가 아니면 대상 아님", () => {
    expect(isE2eTestContact({ email: "kim@example.com", message: "[E2E TEST] 문의" })).toBe(false);
  });

  it("값이 비어 있으면 대상 아님", () => {
    expect(isE2eTestContact({ email: null, message: null })).toBe(false);
  });
});

describe("isE2eTestLead", () => {
  it("ref=e2e 이고 회사명이 [E2E TEST]로 시작하면 대상", () => {
    expect(isE2eTestLead({ refCode: "e2e", company: "[E2E TEST] AX체크회사 1762590000000" })).toBe(true);
  });

  it("영업 링크 ref(sales-kim) 리드는 회사명과 무관하게 대상 아님", () => {
    expect(isE2eTestLead({ refCode: "sales-kim", company: "[E2E TEST] AX체크회사" })).toBe(false);
    expect(isE2eTestLead({ refCode: "sales-kim", company: "(주)주신에이브이티" })).toBe(false);
  });

  it("ref=e2e 라도 회사명 표식이 없으면 대상 아님", () => {
    expect(isE2eTestLead({ refCode: "e2e", company: "미디소프트" })).toBe(false);
  });

  it("ref가 없으면 대상 아님", () => {
    expect(isE2eTestLead({ refCode: null, company: "[E2E TEST] 회사" })).toBe(false);
  });
});

describe("buildPreview", () => {
  it("전체 건수는 유지하고 미리보기는 5건까지만", () => {
    const samples = Array.from({ length: 7 }, (_, i) => ({ id: `${i}`, label: `L${i}`, createdAt: "2026-11-08" }));
    const preview = buildPreview(samples);
    expect(preview.total).toBe(7);
    expect(preview.samples).toHaveLength(5);
  });
});
