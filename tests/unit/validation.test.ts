import { describe, expect, it } from "vitest";

import {
  answerContentSchema,
  idSchema,
  questionContentSchema,
  submitQuestionSchema,
} from "@/lib/validation";

describe("server-side validation", () => {
  it("trims valid multilingual questions and counts Unicode code points", () => {
    expect(questionContentSchema.parse("  澪🙂?  ")).toBe("澪🙂?");
    expect(questionContentSchema.safeParse("a").success).toBe(false);
    expect(questionContentSchema.safeParse("🙂".repeat(1001)).success).toBe(false);
  });

  it("validates persisted answers independently from questions", () => {
    expect(answerContentSchema.parse("  回答です  ")).toBe("回答です");
    expect(answerContentSchema.safeParse("x").success).toBe(false);
    expect(answerContentSchema.safeParse("a".repeat(601)).success).toBe(false);
  });

  it("bounds hidden and external-service fields", () => {
    expect(
      submitQuestionSchema.safeParse({
        content: "正常问题",
        website: "x".repeat(501),
        turnstileToken: "",
      }).success,
    ).toBe(false);
  });

  it("accepts only positive integer identifiers", () => {
    expect(idSchema.parse("12")).toBe(12);
    expect(idSchema.safeParse("0").success).toBe(false);
    expect(idSchema.safeParse("1.2").success).toBe(false);
  });
});
