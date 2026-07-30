import { NextRequest } from "next/server";

const origin = "https://ask.example.com";

export function apiRequest(
  pathname: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    origin?: string | null;
    headers?: Record<string, string>;
  } = {},
) {
  const headers = new Headers({
    host: "ask.example.com",
    ...options.headers,
  });
  if (options.origin !== null) headers.set("origin", options.origin ?? origin);
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.body !== undefined) headers.set("content-type", "application/json");

  return new NextRequest(`${origin}${pathname}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export function sessionCookie(response: Response) {
  const value = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!value) throw new Error("response did not set a session cookie");
  return value;
}
