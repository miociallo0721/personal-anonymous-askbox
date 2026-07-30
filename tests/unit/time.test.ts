import { describe, expect, it } from "vitest";

import { formatShanghaiTime } from "@/lib/time";

describe("时间格式化", () => {
  it("稳定转换为上海时区", () => {
    expect(formatShanghaiTime(new Date("2026-07-30T10:00:00.000Z"))).toBe("2026-07-30 18:00");
  });
});
