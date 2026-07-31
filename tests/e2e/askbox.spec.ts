import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import path from "node:path";

const questionText = "E2E：你最近留意到什么安静的小事？";
const answerText = "傍晚时，窗边的光比昨天停留得更久。";

test.beforeEach(() => {
  const sqlite = new Database(path.resolve("data/e2e.db"));
  try {
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(`
      DELETE FROM cards;
      DELETE FROM answers;
      DELETE FROM questions;
      DELETE FROM admin_sessions;
      DELETE FROM admin_login_attempts;
      DELETE FROM blocked_sources;
    `);
  } finally {
    sqlite.close();
  }
});

test("anonymous submission through persisted answer and share-card export", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("想问的问题").fill(questionText);
  await page.getByRole("button", { name: "匿名提交" }).click();
  await expect(page.getByRole("heading", { name: "问题已收到" })).toBeVisible();
  const statusLink = page.getByRole("link", { name: "查看状态" });
  const statusPath = await statusLink.getAttribute("href");
  expect(statusPath).toMatch(/^\/status\/[A-Za-z0-9_-]{32}$/);
  await expect(page.getByLabel("私密状态链接")).toHaveValue(
    new RegExp(`/status/[A-Za-z0-9_-]{32}$`),
  );

  const sqlite = new Database(path.resolve("data/e2e.db"), { readonly: true });
  const savedQuestion = sqlite
    .prepare(
      "SELECT id, status, status_token_hash, telegram_notified FROM questions WHERE content = ?",
    )
    .get(questionText) as
    | {
        id: number;
        status: string;
        status_token_hash: string;
        telegram_notified: number;
      }
    | undefined;
  expect(savedQuestion).toMatchObject({ status: "unread", telegram_notified: 1 });
  expect(savedQuestion?.status_token_hash).toHaveLength(64);
  expect(statusPath).not.toBe(`/status/${savedQuestion?.id}`);
  sqlite.close();

  const receivedResponse = await page.goto(statusPath!);
  const cacheControl = receivedResponse?.headers()["cache-control"] ?? "";
  // Next.js development mode enforces `no-cache`; production adds the stricter
  // `private, no-store` policy verified by the route/API tests.
  expect(cacheControl).toMatch(/no-store|no-cache/);
  expect(cacheControl).not.toContain("public");
  expect(receivedResponse?.headers()["x-robots-tag"]).toContain("noindex");
  expect(receivedResponse?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);
  await expect(page.getByRole("heading", { name: "已收到", exact: true })).toBeVisible();
  await expect(page.getByText("你的问题正在等待回复。")).toBeVisible();
  await expect(page.getByRole("heading", { name: "回答", exact: true })).toHaveCount(0);

  await page.goto("/admin/login");
  await page.getByLabel("管理员密码").fill("e2e-admin-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const article = page.locator(`#question-${savedQuestion?.id}`);
  await expect(article).toContainText(questionText);
  await article.getByRole("link", { name: "回答与分享" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/share/${savedQuestion?.id}$`));

  await page.getByLabel("回答").fill(answerText);
  const aspectOptions = page.getByRole("group", { name: "画面比例" });
  await aspectOptions.getByText("1:1", { exact: true }).click();
  await expect(aspectOptions.getByLabel("1:1")).toBeChecked();
  await page.getByRole("button", { name: "生成 PNG" }).click();
  await expect(page.getByRole("status")).toContainText("PNG 已生成", { timeout: 30_000 });
  await expect(page.getByRole("img", { name: /分享卡片预览/ })).toBeVisible();

  await expect
    .poll(() => {
      const verificationDatabase = new Database(path.resolve("data/e2e.db"), {
        readonly: true,
      });
      try {
        return verificationDatabase
          .prepare(
            `SELECT q.status, a.content AS answer, c.aspect, c.mime_type AS mimeType
             FROM questions q
             JOIN answers a ON a.question_id = q.id
             JOIN cards c ON c.answer_id = a.id
             WHERE q.id = ?
             ORDER BY c.id DESC
             LIMIT 1`,
          )
          .get(savedQuestion?.id);
      } finally {
        verificationDatabase.close();
      }
    })
    .toMatchObject({
      status: "replied",
      answer: answerText,
      aspect: "1:1",
      mimeType: "image/png",
    });

  await page.goto(statusPath!);
  await expect(page.getByRole("heading", { name: "已回复", exact: true })).toBeVisible();
  await expect(page.getByText(questionText, { exact: true })).toBeVisible();
  await expect(page.getByText(answerText, { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "1:1 分享卡片预览" })).toBeVisible();

  const downloadPath = await page.getByRole("link", { name: "下载 PNG" }).getAttribute("href");
  const downloadResponse = await page.request.get(downloadPath!);
  expect(downloadResponse.status()).toBe(200);
  expect(downloadResponse.headers()["content-type"]).toBe("image/png");
  expect(downloadResponse.headers()["cache-control"]).toContain("no-store");
  expect(downloadResponse.headers()["content-disposition"]).toContain("attachment");
  expect(Array.from((await downloadResponse.body()).subarray(0, 8))).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
});
