import { describe, expect, it } from "vitest";
import { getNewlyReachedThresholds } from "./scroll-depth";

describe("getNewlyReachedThresholds", () => {
  it("returns nothing at 0%", () => {
    expect(getNewlyReachedThresholds(0, new Set())).toEqual([]);
  });

  it("returns [25] once the user scrolls past 25%", () => {
    expect(getNewlyReachedThresholds(30, new Set())).toEqual([25]);
  });

  it("does not repeat thresholds that already fired", () => {
    expect(getNewlyReachedThresholds(60, new Set([25]))).toEqual([50]);
  });

  it("returns every remaining threshold when the page is fully scrolled", () => {
    expect(getNewlyReachedThresholds(100, new Set())).toEqual([25, 50, 75, 100]);
  });

  it("returns nothing when every threshold already fired", () => {
    expect(getNewlyReachedThresholds(100, new Set([25, 50, 75, 100]))).toEqual([]);
  });
});
