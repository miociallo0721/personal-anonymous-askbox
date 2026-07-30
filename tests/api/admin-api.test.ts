import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { POST as blockSource } from "@/app/api/admin/blocked/route";
import { POST as login } from "@/app/api/admin/login/route";
import { GET as listQuestions } from "@/app/api/admin/questions/route";
import { PATCH as updateQuestion } from "@/app/api/admin/questions/[id]/route";
import { GET as getAnswer, PUT as saveAnswer } from "@/app/api/admin/questions/[id]/answer/route";
import { POST as retryTelegram } from "@/app/api/admin/questions/[id]/retry-telegram/route";
import { POST as createShareCard } from "@/app/api/admin/questions/[id]/share-card/route";
import { db } from "@/db/client";
import { adminLoginAttempts, answers, blockedSources, questions } from "@/db/schema";
import { apiRequest, sessionCookie } from "../helpers/request";

async function authenticate(password = "test-admin-password") {
  const response = await login(
    apiRequest("/api/admin/login", {
      method: "POST",
      body: { password },
    }),
  );
  return { response, cookie: response.ok ? sessionCookie(response) : undefined };
}

function createQuestion(content = "后台 API 测试问题") {
  const now = new Date("2026-07-30T10:00:00.000Z");
  return db
    .insert(questions)
    .values({
      content,
      ipHash: "a".repeat(64),
      userAgentHash: "b".repeat(64),
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

describe("管理员 API 鉴权与操作", () => {
  it("拒绝未认证的后台读取和图片生成", async () => {
    expect((await listQuestions(apiRequest("/api/admin/questions"))).status).toBe(401);
    expect(
      (
        await createShareCard(
          apiRequest("/api/admin/questions/1/share-card", {
            method: "POST",
            body: { aspect: "4:5", theme: "paper" },
          }),
          { params: Promise.resolve({ id: "1" }) },
        )
      ).status,
    ).toBe(401);
  });

  it("登录拒绝跨站 Origin，并设置安全 Session Cookie", async () => {
    const denied = await login(
      apiRequest("/api/admin/login", {
        method: "POST",
        origin: "https://evil.example",
        body: { password: "test-admin-password" },
      }),
    );
    expect(denied.status).toBe(403);

    const { response, cookie } = await authenticate();
    expect(response.status).toBe(200);
    expect(cookie).toContain("askbox_admin_session=");
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=Strict/i);
  });

  it("五次失败后对同一来源执行登录限流", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await authenticate("wrong-password")).response.status).toBe(401);
    }
    expect((await authenticate()).response.status).toBe(429);
    expect(db.select().from(adminLoginAttempts).all()).toHaveLength(5);
  });

  it("持久化回答并原子更新问题状态", async () => {
    const question = createQuestion();
    const { cookie } = await authenticate();
    const response = await saveAnswer(
      apiRequest(`/api/admin/questions/${question.id}/answer`, {
        method: "PUT",
        cookie,
        body: { content: "这是后台保存的正式回答。" },
      }),
      { params: Promise.resolve({ id: String(question.id) }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      answer: { questionId: question.id, content: "这是后台保存的正式回答。" },
    });
    expect(db.select().from(answers).all()).toHaveLength(1);
    expect(db.select().from(questions).where(eq(questions.id, question.id)).get()).toMatchObject({
      status: "replied",
    });

    const read = await getAnswer(
      apiRequest(`/api/admin/questions/${question.id}/answer`, { cookie }),
      { params: Promise.resolve({ id: String(question.id) }) },
    );
    expect(await read.json()).toMatchObject({
      answer: { content: "这是后台保存的正式回答。" },
    });
  });

  it("没有持久化回答时禁止直接标记为已回复", async () => {
    const question = createQuestion();
    const { cookie } = await authenticate();
    const response = await updateQuestion(
      apiRequest(`/api/admin/questions/${question.id}`, {
        method: "PATCH",
        cookie,
        body: { status: "replied" },
      }),
      { params: Promise.resolve({ id: String(question.id) }) },
    );

    expect(response.status).toBe(409);
    expect(db.select().from(questions).where(eq(questions.id, question.id)).get()?.status).toBe(
      "unread",
    );
  });

  it("封禁来源并在历史问题上同步标记", async () => {
    const question = createQuestion();
    const { cookie } = await authenticate();
    const response = await blockSource(
      apiRequest("/api/admin/blocked", {
        method: "POST",
        cookie,
        body: { ipHash: question.ipHash, reason: "API 测试封禁" },
      }),
    );

    expect(response.status).toBe(200);
    expect(db.select().from(blockedSources).get()).toMatchObject({
      ipHash: question.ipHash,
      reason: "API 测试封禁",
    });
    expect(db.select().from(questions).where(eq(questions.id, question.id)).get()?.isBlocked).toBe(
      true,
    );
  });

  it("通过 Mock 外部服务重发 Telegram 通知", async () => {
    const question = createQuestion();
    const { cookie } = await authenticate();
    const response = await retryTelegram(
      apiRequest(`/api/admin/questions/${question.id}/retry-telegram`, {
        method: "POST",
        cookie,
      }),
      { params: Promise.resolve({ id: String(question.id) }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, messageId: question.id });
    expect(db.select().from(questions).where(eq(questions.id, question.id)).get()).toMatchObject({
      telegramNotified: true,
      telegramMessageId: question.id,
    });
  });
});
