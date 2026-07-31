import { describe, expect, it } from "vitest";

import {
  generateStatusToken,
  hashStatusToken,
  isValidStatusToken,
  STATUS_TOKEN_BYTES,
  STATUS_TOKEN_LENGTH,
} from "@/lib/status-token";

describe("private status tokens", () => {
  it("generates 192-bit URL-safe tokens with the expected fixed length", () => {
    const token = generateStatusToken();

    expect(token).toHaveLength(STATUS_TOKEN_LENGTH);
    expect(isValidStatusToken(token)).toBe(true);
    expect(Buffer.from(token, "base64url")).toHaveLength(STATUS_TOKEN_BYTES);
  });

  it("generates distinct tokens and never embeds a question identifier", () => {
    const tokens = Array.from({ length: 128 }, generateStatusToken);

    expect(new Set(tokens).size).toBe(tokens.length);
    for (const token of tokens) {
      expect(token).not.toMatch(/[\/=+]/);
    }
  });

  it("stores and compares a one-way SHA-256 digest", () => {
    const token = generateStatusToken();
    const digest = hashStatusToken(token);

    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toBe(token);
    expect(hashStatusToken(token)).toBe(digest);
  });
});
