const STATUS_RATE_LIMIT_WINDOW_MS = 60_000;
const STATUS_RATE_LIMIT_MAX_REQUESTS = 60;
const STATUS_IMAGE_RATE_LIMIT_MAX_REQUESTS = 12;
const STATUS_RATE_LIMIT_MAX_KEYS = 10_000;

type StatusRateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

export type StatusRateLimitResult =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

const statusEntries = new Map<string, StatusRateLimitEntry>();
const imageEntries = new Map<string, StatusRateLimitEntry>();

function removeExpiredEntries(entries: Map<string, StatusRateLimitEntry>, now: number) {
  for (const [key, entry] of entries) {
    if (now - entry.windowStartedAt >= STATUS_RATE_LIMIT_WINDOW_MS) entries.delete(key);
  }
}

function consumeRateLimit(
  entries: Map<string, StatusRateLimitEntry>,
  maxRequests: number,
  key: string,
  now: number,
): StatusRateLimitResult {
  const existing = entries.get(key);
  if (!existing || now - existing.windowStartedAt >= STATUS_RATE_LIMIT_WINDOW_MS) {
    if (!existing && entries.size >= STATUS_RATE_LIMIT_MAX_KEYS) {
      removeExpiredEntries(entries, now);
      if (entries.size >= STATUS_RATE_LIMIT_MAX_KEYS) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(STATUS_RATE_LIMIT_WINDOW_MS / 1000),
        };
      }
    }
    entries.set(key, { count: 1, windowStartedAt: now });
    return { allowed: true };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((STATUS_RATE_LIMIT_WINDOW_MS - (now - existing.windowStartedAt)) / 1000),
      ),
    };
  }

  existing.count += 1;
  return { allowed: true };
}

export function consumeStatusRateLimit(key: string, now = Date.now()): StatusRateLimitResult {
  return consumeRateLimit(statusEntries, STATUS_RATE_LIMIT_MAX_REQUESTS, key, now);
}

export function consumeStatusImageRateLimit(key: string, now = Date.now()): StatusRateLimitResult {
  return consumeRateLimit(imageEntries, STATUS_IMAGE_RATE_LIMIT_MAX_REQUESTS, key, now);
}

export function resetStatusRateLimitsForTests() {
  statusEntries.clear();
  imageEntries.clear();
}
