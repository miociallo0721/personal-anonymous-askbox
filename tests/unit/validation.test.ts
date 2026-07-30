import { describe, expect, it } from "vitest";

import {
  answerContentSchema,
  idSchema,
  questionContentSchema,
  submitQuestionSchema,
} from "@/lib/validation";

describe("输入验证", () => {
  it("清理问题首尾空白并保留正文换行", () => {
    expect(questionContentSchema.parse("  第一行\n第二行  ")).toBe("第一行\n第二行");
  });

  it("按 Unicode 字符而不是 UTF-16 单元计算长度", () => {
    expect(questionContentSchema.safeParse("😀😀").success).toBe(true);
    expect(questionContentSchema.safeParse("😀").success).toBe(false);
  });

  it("限制问题与回答的最大长度", () => {
    expect(questionContentSchema.safeParse("问".repeat(1001)).success).toBe(false);
    expect(answerContentSchema.safeParse("答".repeat(601)).success).toBe(false);
  });

  it("为可选的反机器人字段提供安全默认值", () => {
    expect(submitQuestionSchema.parse({ content: "正常问题" })).toMatchObject({
      website: "",
      turnstileToken: "",
    });
  });

  it("只接受正整数编号", () => {
    expect(idSchema.parse("42")).toBe(42);
    expect(idSchema.safeParse("0").success).toBe(false);
    expect(idSchema.safeParse("1.5").success).toBe(false);
  });
});
