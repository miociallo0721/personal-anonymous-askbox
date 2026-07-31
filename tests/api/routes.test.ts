import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adminLoginAttempts, blockedSources, questions } from "@/db/schema";
import { hmacHash } from "@/lib/crypto";
import { resetEnvForTests } from "@/lib/env";

import { createTestDatabase } from "../helpers/database";

let database: ReturnType<typeof createTestDatabase>;
const turnstileCheck = vi.fn();

function jsonRequest(
  url: string,
  body: unknown,
  options: { origin?: string; method?: string } = {},
) {
  const parsedUrl = new URL(url);
  return new NextRequest(url, {
    method: options.method ?? "POST",
    headers: {
      "content-type": "application/json",
      host: parsedUrl.host,
      origin: options.origin ?? parsedUrl.origin,
    },
    body: JSON.stringify(body),
  });
}

function insertQuestion() {
  const now = new Date("2026-07-18T00:00:00.000Z");
  return database.db
    .insert(questions)
    .values({
      content: "API 测试问题",
      ipHash: "a".repeat(64),
      userAgentHash: "b".repeat(64),
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  database = createTestDatabase();
  Object.assign(process.env, {
    NODE_ENV: "test",
    EXTERNAL_SERVICES_MODE: "mock",
    TURNSTILE_ENABLED: "true",
    TRUST_CLOUDFLARE_PROXY: "false",
    TRUST_PROXY: "false",
  });
  resetEnvForTests();
  turnstileCheck.mockResolvedValue(true);
  vi.doMock("@/db/client", () => ({ db: database.db, database }));
  vi.doMock("@/lib/turnstile", () => ({ verifyTurnstile: turnstileCheck }));
});

afterEach(() => {
  database.close();
  vi.doUnmock("@/db/client");
  vi.doUnmock("@/lib/turnstile");
  vi.doUnmock("@/lib/auth");
  vi.doUnmock("@/lib/telegram");
});

describe("public question API", () => {
  it("rejects invalid origins before writing data", async () => {
    const { POST } = await import("@/app/api/questions/route");
    const response = await POST(
      jsonRequest(
        "https://ask.example.com/api/questions",
        { content: "这是正常问题", turnstileToken: "token" },
        { origin: "https://attacker.example" },
      ),
    );
    expect(response.status).toBe(403);
    expect(database.db.select().from(questions).all()).toHaveLength(0);
  });

  it("fails closed when Turnstile verification fails", async () => {
    turnstileCheck.mockResolvedValue(false);
    const { POST } = await import("@/app/api/questions/route");
    const response = await POST(
      jsonRequest("https://ask.example.com/api/questions", {
        content: "这是正常问题",
        turnstileToken: "invalid",
      }),
    );
    expect(response.status).toBe(400);
    expect(database.db.select().from(questions).all()).toHaveLength(0);
  });

  it("enforces persistent rate limits", async () => {
    const { POST } = await import("@/app/api/questions/route");
    const first = await POST(
      jsonRequest("https://ask.example.com/api/questions", {
        content: "第一个正常问题",
        turnstileToken: "token",
      }),
    );
    const second = await POST(
      jsonRequest("https://ask.example.com/api/questions", {
        content: "第二个正常问题",
        turnstileToken: "token",
      }),
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(429);
    expect(database.db.select().from(questions).all()).toHaveLength(1);
  });

  it("silently accepts but does not persist a banned source", async () => {
    const ipHash = hmacHash("unknown", process.env.IP_HASH_SECRET!);
    database.db
      .insert(blockedSources)
      .values({ ipHash, reason: "test ban", createdAt: new Date() })
      .run();
    const { POST } = await import("@/app/api/questions/route");
    const response = await POST(
      jsonRequest("https://ask.example.com/api/questions", {
        content: "被封禁来源的问题",
        turnstileToken: "token",
      }),
    );
    expect(response.status).toBe(201);
    expect(database.db.select().from(questions).all()).toHaveLength(0);
  });
});

describe("administrator APIs", () => {
  it("rejects unauthenticated list access", async () => {
    vi.doMock("@/lib/auth", () => ({ isAdminAuthenticated: vi.fn(async () => false) }));
    const { GET } = await import("@/app/api/admin/questions/route");
    const response = await GET(
      new NextRequest("https://ask.example.com/api/admin/questions", {
        headers: { host: "ask.example.com" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("records login failures and creates a session only for the configured password", async () => {
    const createAdminSession = vi.fn(async () => undefined);
    const actualAuth = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
    vi.doMock("@/lib/auth", () => ({ ...actualAuth, createAdminSession }));
    const { POST } = await import("@/app/api/admin/login/route");

    const denied = await POST(
      jsonRequest("https://ask.example.com/api/admin/login", { password: "wrong-password" }),
    );
    const accepted = await POST(
      jsonRequest("https://ask.example.com/api/admin/login", {
        password: process.env.ADMIN_PASSWORD,
      }),
    );
    expect(denied.status).toBe(401);
    expect(accepted.status).toBe(200);
    expect(database.db.select().from(adminLoginAttempts).all()).toHaveLength(2);
    expect(createAdminSession).toHaveBeenCalledTimes(1);
  });

  it("validates origin and persists source bans", async () => {
    const question = insertQuestion();
    vi.doMock("@/lib/auth", () => ({ isAdminAuthenticated: vi.fn(async () => true) }));
    const { POST } = await import("@/app/api/admin/blocked/route");
    const crossOrigin = await POST(
      jsonRequest(
        "https://ask.example.com/api/admin/blocked",
        { ipHash: question.ipHash, reason: "test" },
        { origin: "https://attacker.example" },
      ),
    );
    const accepted = await POST(
      jsonRequest("https://ask.example.com/api/admin/blocked", {
        ipHash: question.ipHash,
        reason: "test",
      }),
    );
    expect(crossOrigin.status).toBe(403);
    expect(accepted.status).toBe(200);
    expect(database.db.select().from(blockedSources).all()).toHaveLength(1);
    expect(database.db.select().from(questions).get()?.isBlocked).toBe(true);
  });

  it("surfaces Telegram retry failure without modifying the question", async () => {
    const question = insertQuestion();
    const retry = vi.fn(async () => ({ success: false as const, error: "mock outage" }));
    vi.doMock("@/lib/auth", () => ({ isAdminAuthenticated: vi.fn(async () => true) }));
    vi.doMock("@/lib/telegram", () => ({ sendQuestionToTelegram: retry }));
    const { POST } = await import("@/app/api/admin/questions/[id]/retry-telegram/route");
    const response = await POST(
      jsonRequest(`https://ask.example.com/api/admin/questions/${question.id}/retry-telegram`, {}),
      { params: Promise.resolve({ id: String(question.id) }) },
    );
    expect(response.status).toBe(502);
    expect(retry).toHaveBeenCalledOnce();
    expect(database.db.select().from(questions).get()?.content).toBe(question.content);
  });
});
