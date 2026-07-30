import { describe, expect, it } from "vitest";

import { getShareCardTypography, SHARE_CARD_FORMATS, SHARE_CARD_THEMES } from "@/lib/share-card";

describe("share card", () => {
  it("provides high-resolution dimensions for every aspect", () => {
    expect(SHARE_CARD_FORMATS["1:1"]).toMatchObject({ width: 1200, height: 1200 });
    expect(SHARE_CARD_FORMATS["4:5"]).toMatchObject({ width: 1200, height: 1500 });
    expect(SHARE_CARD_FORMATS["9:16"]).toMatchObject({ width: 1080, height: 1920 });
  });

  it("uses the warm paper design tokens", () => {
    expect(SHARE_CARD_THEMES.paper).toMatchObject({
      background: "#F7F5F2",
      foreground: "#2D2A26",
      muted: "#7B756D",
      border: "#E7E2D9",
      accent: "#C98D5A",
    });
  });

  it("reduces type size for long content while keeping the question dominant", () => {
    const short = getShareCardTypography("1:1", {
      question: "最近在读什么？",
      answer: "一本关于日常生活的书。",
    });
    const long = getShareCardTypography("1:1", {
      question: "这是一个很长的问题。".repeat(60),
      answer: "这是一个较长的回答。".repeat(40),
    });

    expect(long.questionSize).toBeLessThan(short.questionSize);
    expect(long.answerSize).toBeLessThan(short.answerSize);
    expect(long.questionSize).toBeGreaterThan(long.answerSize);
  });
});
