import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import path from "node:path";

const questionText = "E2E：你最近留意到什么安静的小事？";
const answerText = "傍晚时，窗边的光比昨天停留得更久。";

test("anonymous submission through persisted answer and share-card export", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("想问的问题").fill(questionText);
  await page.getByRole("button", { name: "匿名提交" }).click();
  await expect(page.getByRole("status")).toContainText("已经收到");

  const sqlite = new Database(path.resolve("data/e2e.db"), { readonly: true });
  const savedQuestion = sqlite
    .prepare("SELECT id, status, telegram_notified FROM questions WHERE content = ?")
    .get(questionText) as { id: number; status: string; telegram_notified: number } | undefined;
  expect(savedQuestion).toMatchObject({ status: "unread", telegram_notified: 1 });
  sqlite.close();

  await page.goto("/admin/login");
  await page.getByLabel("管理员密码").fill("e2e-admin-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const article = page.locator(`#question-${savedQuestion?.id}`);
  await expect(article).toContainText(questionText);
  await article.getByRole("link", { name: "回答与分享" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/share/${savedQuestion?.id}$`));

  await page.getByLabel("回答").fill(answerText);
  await page.getByLabel("1:1").check();
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
});
