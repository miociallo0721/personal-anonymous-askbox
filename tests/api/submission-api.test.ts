import { describe, expect, it } from "vitest";

import { POST as submitQuestion } from "@/app/api/questions/route";
import { db } from "@/db/client";
import { blockedSources, questions } from "@/db/schema";
import { requestFingerprints } from "@/lib/request-security";
import { apiRequest } from "../helpers/request";

function submissionRequest(
  content: string,
  options: { token?: string; origin?: string; website?: string } = {},
) {
  return apiRequest("/api/questions", {
    method: "POST",
    origin: options.origin,
    body: {
      content,
      website: options.website ?? "",
      turnstileToken: options.token ?? "test-turnstile-token",
    },
  });
}

describe("匿名提交 API", () => {
  it("拒绝跨站请求与无效 Turnstile token", async () => {
    expect(
      (await submitQuestion(submissionRequest("跨站提交", { origin: "https://evil.example" })))
        .status,
    ).toBe(403);
    expect(
      (await submitQuestion(submissionRequest("无效验证", { token: "wrong-token" }))).status,
    ).toBe(400);
    expect(db.select().from(questions).all()).toHaveLength(0);
  });

  it("通过验证后保存问题并使用 Telegram Mock", async () => {
    const response = await submitQuestion(submissionRequest("这是一条可重复测试的匿名问题"));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, message: "已经收到" });
    expect(db.select().from(questions).get()).toMatchObject({
      content: "这是一条可重复测试的匿名问题",
      telegramNotified: true,
    });
  });

  it("在数据库层对一分钟内的第二次提交限流", async () => {
    expect((await submitQuestion(submissionRequest("一分钟内的第一个问题"))).status).toBe(201);
    expect((await submitQuestion(submissionRequest("一分钟内的第二个问题"))).status).toBe(429);
    expect(db.select().from(questions).all()).toHaveLength(1);
  });

  it("对已封禁来源返回普通成功但不落库", async () => {
    const request = submissionRequest("封禁来源的问题");
    const { ipHash } = requestFingerprints(request);
    db.insert(blockedSources).values({ ipHash, reason: "测试封禁", createdAt: new Date() }).run();

    const response = await submitQuestion(request);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(db.select().from(questions).all()).toHaveLength(0);
  });

  it("蜜罐命中时静默成功且不调用持久化流程", async () => {
    const response = await submitQuestion(
      submissionRequest("机器人问题", { website: "https://spam.example" }),
    );
    expect(response.status).toBe(200);
    expect(db.select().from(questions).all()).toHaveLength(0);
  });
});
