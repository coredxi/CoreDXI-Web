import { describe, expect, it } from "vitest";
import { generatePasswordResetToken, getPasswordResetExpiresAt } from "./password-reset-token";

describe("generatePasswordResetToken", () => {
  it("returns a 48-character hex string (24 random bytes)", () => {
    const token = generatePasswordResetToken();
    expect(token).toMatch(/^[0-9a-f]{48}$/);
  });

  it("returns a different value on each call", () => {
    const a = generatePasswordResetToken();
    const b = generatePasswordResetToken();
    expect(a).not.toBe(b);
  });
});

describe("getPasswordResetExpiresAt", () => {
  it("returns a timestamp roughly 1 hour in the future", () => {
    const before = Date.now();
    const expiresAt = getPasswordResetExpiresAt();
    const after = Date.now();

    const oneHourMs = 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + oneHourMs - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + oneHourMs + 1000);
  });
});
