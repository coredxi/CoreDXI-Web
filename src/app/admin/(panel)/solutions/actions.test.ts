import { beforeEach, describe, expect, it, vi } from "vitest";
import { SOLUTIONS_CONTENT_DEFAULTS } from "@/lib/page-content/solutions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const savePageContentMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/page-content", () => ({
  savePageContent: (...args: unknown[]) => savePageContentMock(...args),
}));

const { saveSolutionsContent } = await import("./actions");

describe("saveSolutionsContent", () => {
  beforeEach(() => {
    savePageContentMock.mockClear();
  });

  it("rejects when a solution feature is blank", async () => {
    const solutions = SOLUTIONS_CONTENT_DEFAULTS.solutions.map((s, i) =>
      i === 0 ? { ...s, features: ["", ...s.features.slice(1)] } : s
    );
    const result = await saveSolutionsContent({
      ...SOLUTIONS_CONTENT_DEFAULTS,
      solutions,
    });
    expect(result.success).toBe(false);
    expect(savePageContentMock).not.toHaveBeenCalled();
  });

  it("rejects when a process step is incomplete", async () => {
    const result = await saveSolutionsContent({
      ...SOLUTIONS_CONTENT_DEFAULTS,
      processSteps: [
        { title: "", desc: "설명" },
        ...SOLUTIONS_CONTENT_DEFAULTS.processSteps.slice(1),
      ],
    });
    expect(result.success).toBe(false);
  });

  it("saves normalized content on valid input", async () => {
    const result = await saveSolutionsContent({
      ...SOLUTIONS_CONTENT_DEFAULTS,
      heroTitleLine1: "  변경된 타이틀  ",
    });
    expect(result.success).toBe(true);
    expect(savePageContentMock).toHaveBeenCalledWith(
      "solutions",
      expect.objectContaining({ heroTitleLine1: "변경된 타이틀" })
    );
  });

  it("accepts a relative brochure URL and trims it on save", async () => {
    const result = await saveSolutionsContent({
      ...SOLUTIONS_CONTENT_DEFAULTS,
      brochureUrl: "  /docs/coredxi-ax-consulting-brochure.pdf  ",
    });
    expect(result.success).toBe(true);
    expect(savePageContentMock).toHaveBeenCalledWith(
      "solutions",
      expect.objectContaining({
        brochureUrl: "/docs/coredxi-ax-consulting-brochure.pdf",
      })
    );
  });

  it("accepts an empty brochure URL to hide the button", async () => {
    const result = await saveSolutionsContent({
      ...SOLUTIONS_CONTENT_DEFAULTS,
      brochureUrl: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an https absolute brochure URL", async () => {
    const result = await saveSolutionsContent({
      ...SOLUTIONS_CONTENT_DEFAULTS,
      brochureUrl: "https://www.coredxi.com/docs/coredxi-ax-consulting-brochure.pdf",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a javascript: brochure URL", async () => {
    const result = await saveSolutionsContent({
      ...SOLUTIONS_CONTENT_DEFAULTS,
      brochureUrl: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
    expect(savePageContentMock).not.toHaveBeenCalled();
  });

  it("rejects a protocol-relative brochure URL", async () => {
    const result = await saveSolutionsContent({
      ...SOLUTIONS_CONTENT_DEFAULTS,
      brochureUrl: "//evil.example.com/x.pdf",
    });
    expect(result.success).toBe(false);
    expect(savePageContentMock).not.toHaveBeenCalled();
  });
});
