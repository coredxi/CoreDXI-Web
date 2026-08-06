import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decideOgBackgroundDataUri,
  loadOgBackgroundDataUri,
} from "./og-background";

describe("decideOgBackgroundDataUri", () => {
  it("returns null when no background URL is given", () => {
    expect(
      decideOgBackgroundDataUri({
        backgroundImageUrl: null,
        isAllowedUrl: true,
        dataUri: "data:image/png;base64,AAA",
      })
    ).toBeNull();
  });

  it("returns null when the URL failed host/protocol validation", () => {
    expect(
      decideOgBackgroundDataUri({
        backgroundImageUrl: "https://evil.example.com/cover.jpg",
        isAllowedUrl: false,
        dataUri: "data:image/png;base64,AAA",
      })
    ).toBeNull();
  });

  it("returns null when the fetch/load failed (dataUri is null)", () => {
    expect(
      decideOgBackgroundDataUri({
        backgroundImageUrl: "https://abcxyz.supabase.co/cover.jpg",
        isAllowedUrl: true,
        dataUri: null,
      })
    ).toBeNull();
  });

  it("returns the data URI when the URL is allowed and loaded successfully", () => {
    expect(
      decideOgBackgroundDataUri({
        backgroundImageUrl: "https://abcxyz.supabase.co/cover.jpg",
        isAllowedUrl: true,
        dataUri: "data:image/png;base64,AAA",
      })
    ).toBe("data:image/png;base64,AAA");
  });
});

describe("loadOgBackgroundDataUri", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a data URI when fetch succeeds with an image response", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: async () => bytes.buffer,
      })
    );

    const result = await loadOgBackgroundDataUri(
      "https://abcxyz.supabase.co/cover.png"
    );

    expect(result).toBe(
      `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`
    );
  });

  it("returns null when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, headers: new Headers() })
    );

    expect(
      await loadOgBackgroundDataUri("https://abcxyz.supabase.co/cover.png")
    ).toBeNull();
  });

  it("returns null when content-type is not an image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: async () => new ArrayBuffer(0),
      })
    );

    expect(
      await loadOgBackgroundDataUri("https://abcxyz.supabase.co/cover.png")
    ).toBeNull();
  });

  it("returns null when fetch throws (network error / timeout)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    expect(
      await loadOgBackgroundDataUri("https://abcxyz.supabase.co/cover.png")
    ).toBeNull();
  });
});
