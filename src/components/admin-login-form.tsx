"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "登录失败");
      setPassword("");
      router.replace("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="password" className="text-sm font-medium text-[var(--foreground)]">
        管理员密码
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        required
        autoFocus
        className="field mt-3 px-4 py-3"
      />
      <button disabled={loading || !password} className="button-primary mt-5 w-full">
        {loading ? <span className="loading-mark" aria-hidden="true" /> : null}
        {loading ? "正在登录…" : "登录"}
      </button>
      <div role="alert" className="mt-3 min-h-6 text-sm leading-6 text-[var(--danger)]">
        {error}
      </div>
    </form>
  );
}
