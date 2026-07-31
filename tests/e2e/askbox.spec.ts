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
  await page.getByLabel("写下你的问题").fill(questionText);
  await page.getByRole("button", { name: "匿名提交" }).click();
  await expect(page.getByRole("heading", { name: "问题已收到" })).toBeVisible({
    timeout: 15_000,
  });
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

test("homepage communicates disabled, loading, and error states without losing input", async ({
  page,
}) => {
  await page.goto("/");

  const field = page.getByLabel("写下你的问题");
  const submit = page.getByRole("button", { name: "匿名提交" });
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("写下问题后即可提交", { exact: true })).toBeVisible();
  expect(await submit.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");

  await field.fill("这是一个会保留的问题");
  await expect(submit).toBeEnabled();
  await expect(submit).toHaveAttribute("aria-disabled", "false");
  await expect(page.getByText("写下问题后即可提交", { exact: true })).toHaveCount(0);

  await page.route("**/api/questions", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "暂时无法提交，请稍后再试。" }),
    });
  });

  await submit.click();
  await expect(page.getByRole("button", { name: "正在提交…" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "正在提交…" })).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(page.getByText("暂时无法提交，请稍后再试。", { exact: true })).toBeVisible();
  await expect(field).toHaveValue("这是一个会保留的问题");
  await expect(submit).toBeEnabled();
});

test("homepage themes and supported mobile widths stay within the viewport", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const readPalette = () =>
    page.locator("main").evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        background: styles.getPropertyValue("--background").trim(),
        surface: styles.getPropertyValue("--home-surface").trim(),
        foreground: styles.getPropertyValue("--foreground").trim(),
      };
    });
  const light = await readPalette();

  await page.emulateMedia({ colorScheme: "dark" });
  const dark = await readPalette();
  expect(dark.background).not.toBe(light.background);
  expect(dark.surface).not.toBe(light.surface);
  expect(dark.foreground).not.toBe(light.foreground);

  for (const width of [320, 375, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);

    const title = await page.getByRole("heading", { level: 1 }).boundingBox();
    expect(title).not.toBeNull();
    expect(title!.x).toBeGreaterThanOrEqual(16);
    expect(title!.x + title!.width).toBeLessThanOrEqual(width - 16);
  }
});
