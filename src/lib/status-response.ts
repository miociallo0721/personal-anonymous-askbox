export const PRIVATE_STATUS_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

export function protectPrivateStatusResponse<T extends Response>(response: T): T {
  for (const [key, value] of Object.entries(PRIVATE_STATUS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
