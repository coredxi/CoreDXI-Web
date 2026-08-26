import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "./ga4-events";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("trackEvent", () => {
  it("does nothing when window is undefined (SSR)", () => {
    expect(() => trackEvent("contact_submit", {})).not.toThrow();
  });

  it("does nothing when window.gtag is not a function", () => {
    vi.stubGlobal("window", {});
    expect(() => trackEvent("cta_click", { cta_location: "footer" })).not.toThrow();
  });

  it("calls window.gtag with the event name and params", () => {
    const gtagMock = vi.fn();
    vi.stubGlobal("window", { gtag: gtagMock });

    trackEvent("cta_click", { cta_location: "footer" });

    expect(gtagMock).toHaveBeenCalledWith("event", "cta_click", {
      cta_location: "footer",
    });
  });

  it("passes scroll_depth params through unchanged", () => {
    const gtagMock = vi.fn();
    vi.stubGlobal("window", { gtag: gtagMock });

    trackEvent("scroll_depth", { percent: 50 });

    expect(gtagMock).toHaveBeenCalledWith("event", "scroll_depth", { percent: 50 });
  });

  it("sends ax_check_submit with the ref code as source", () => {
    const gtagMock = vi.fn();
    vi.stubGlobal("window", { gtag: gtagMock });

    trackEvent("ax_check_submit", { source: "sales-kim" });

    expect(gtagMock).toHaveBeenCalledWith("event", "ax_check_submit", {
      source: "sales-kim",
    });
  });
});
