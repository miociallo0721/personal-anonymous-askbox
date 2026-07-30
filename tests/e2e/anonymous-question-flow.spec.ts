import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import path from "node:path";

test("匿名提交、管理员回复并生成持久化分享卡片", async ({ page }) => {
  const questionText = "E2E：你最近最想记录下来的小事是什么？";
  const answerText = "把一次完整而安静的工程升级记录下来。";

  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js?*", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `
          window.turnstile = {
            render: function (_element, options) {
              options.callback("test-turnstile-token");
              return "e2e-widget";
            },
            remove: function () {}
          };
        `,
    });
  });

  await page.goto("/");
  await page.getByLabel("想问的问题").fill(questionText);
  await expect(page.getByRole("button", { name: "匿名提交" })).toBeEnabled();
  await page.getByRole("button", { name: "匿名提交" }).click();
  await expect(page.getByText("已经收到，谢谢你的提问。")).toBeVisible();

  await page.goto("/admin/login");
  await page.getByLabel("管理员密码").fill("e2e-admin-password");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(questionText)).toBeVisible();

  await page.getByRole("link", { name: "回复 / 分享卡片" }).click();
  await expect(page.getByText(questionText)).toBeVisible();
  await expect(page.locator("form[data-hydrated='true']")).toBeVisible();
  await page.getByLabel("回答").fill(answerText);
  await page.getByRole("button", { name: "保存回答" }).click();
  await expect(page.getByText("回答已保存，问题已标记为已回复。")).toBeVisible();

  await page.getByRole("button", { name: "生成 PNG" }).click();
  await expect(page.getByText("PNG 已生成。")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByAltText(/分享卡片预览/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^askbox-\d+-4x5\.png$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  await page.getByRole("link", { name: "返回问题管理" }).click();
  await expect(page.getByText(questionText)).toBeVisible();
  const questionCard = page.getByText(questionText).locator("..");
  await expect(questionCard.locator(".badge", { hasText: "已回复" })).toBeVisible();

  const database = new Database(path.resolve(".tmp/e2e.db"), { readonly: true });
  const answer = database
    .prepare(
      `select a.content
       from answers a
       join questions q on q.id = a.question_id
       where q.content = ?`,
    )
    .get(questionText) as { content: string } | undefined;
  const card = database
    .prepare(
      `select c.aspect, c.image_format as imageFormat, c.width, c.height, c.renderer_version as rendererVersion
       from cards c
       join answers a on a.id = c.answer_id
       join questions q on q.id = a.question_id
       where q.content = ?
       order by c.id desc
       limit 1`,
    )
    .get(questionText) as
    | {
        aspect: string;
        imageFormat: string;
        width: number;
        height: number;
        rendererVersion: number;
      }
    | undefined;
  database.close();

  expect(answer).toEqual({ content: answerText });
  expect(card).toEqual({
    aspect: "4:5",
    imageFormat: "png",
    width: 1200,
    height: 1500,
    rendererVersion: 1,
  });
});
