import { describe, expect, it } from "vitest";

import { formatShanghaiTime } from "@/lib/time";

describe("time formatting", () => {
  it("renders stored instants in Asia/Shanghai", () => {
    expect(formatShanghaiTime(new Date("2026-07-18T00:46:00.000Z"))).toBe("2026-07-18 08:46");
  });
});
