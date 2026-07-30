import { describe, expect, it } from "vitest";

import { assessSpam } from "@/lib/spam";

describe("垃圾信息评分", () => {
  it("不会误伤正常的短问题和中英文混合内容", () => {
    expect(assessSpam("最近还好吗？").action).toBe("accept");
    expect(assessSpam("你怎么看 React 19 的新功能？").score).toBeLessThan(45);
  });

  it("对纯链接保留审慎评分，而不是直接丢弃", () => {
    const result = assessSpam("https://example.com/article");
    expect(result.score).toBeGreaterThan(0);
    expect(result.action).toBe("accept");
  });

  it("识别重复字符、广告与联系方式轰炸", () => {
    const result = assessSpam(
      "加群兼职刷单稳赚 微信: abcde QQ: 123456 Telegram: spammer aaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.action).toBe("discard");
  });

  it("短时间完全重复会显著加分", () => {
    expect(assessSpam("这是一条普通但重复的问题", true).action).toBe("mark-spam");
  });
});
