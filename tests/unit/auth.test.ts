import { describe, expect, it } from "vitest";

import { verifyAdminPassword } from "@/lib/auth";

describe("管理员密码认证", () => {
  it("只接受完全匹配的服务端密码", () => {
    expect(verifyAdminPassword("a-long-password", "a-long-password")).toBe(true);
    expect(verifyAdminPassword("a-long-password ", "a-long-password")).toBe(false);
    expect(verifyAdminPassword("wrong", "a-long-password")).toBe(false);
  });
});
