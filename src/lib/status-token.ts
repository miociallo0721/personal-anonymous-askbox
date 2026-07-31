import { createHash, randomBytes } from "node:crypto";

export const STATUS_TOKEN_BYTES = 24;
export const STATUS_TOKEN_LENGTH = 32;
export const STATUS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function generateStatusToken() {
  return randomBytes(STATUS_TOKEN_BYTES).toString("base64url");
}

export function isValidStatusToken(value: string) {
  return value.length === STATUS_TOKEN_LENGTH && STATUS_TOKEN_PATTERN.test(value);
}

export function hashStatusToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
