"use client";

import { useCallback, useState, type FormEvent } from "react";

import { TurnstileWidget } from "@/components/turnstile-widget";

type Props = { turnstileEnabled: boolean; siteKey: string };
type Notice = { kind: "success" | "error"; text: string } | null;

export function QuestionForm({ turnstileEnabled, siteKey }: Props) {
  const [content, setContent] = useState("");
  const [website, setWebsite] = useState("");
  const [token, setToken] = useState("");
  const [widgetKey, setWidgetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const length = Array.from(content).length;
  const onToken = useCallback((value: string) => setToken(value), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (length < 2 || length > 1000) {
      setNotice({ kind: "error", text: "请输入 2 至 1000 个字符。" });
      return;
    }
    if (turnstileEnabled && !token) {
      setNotice({ kind: "error", text: "请先完成人机验证。" });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, website, turnstileToken: token }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "提交失败，请稍后重试。");
      setContent("");
      setWebsite("");
      setNotice({ kind: "success", text: "已经收到，谢谢你的提问。" });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "提交失败，请稍后重试。",
      });
    } finally {
      setToken("");
      setWidgetKey((value) => value + 1);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="question" className="type-section block">
        想问的问题
      </label>
      <textarea
        id="question"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={7}
        maxLength={2000}
        disabled={submitting}
        placeholder="写下你想问的事情……"
        className="field mt-5 min-h-48 resize-y px-5 py-4 text-base leading-7 sm:min-h-56"
      />
      <div className="mt-3 flex items-center justify-between gap-4">
        <span className="type-caption">请勿提交敏感个人信息</span>
        <span
          className={`type-caption tabular-nums ${length > 1000 ? "text-[var(--danger)]" : ""}`}
        >
          {length} / 1000
        </span>
      </div>

      <div
        className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="website">网站</label>
        <input
          id="website"
          name="website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {turnstileEnabled && siteKey ? (
        <div className="mt-5">
          <TurnstileWidget key={widgetKey} siteKey={siteKey} onToken={onToken} />
        </div>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-6 text-sm leading-6" role="status" aria-live="polite">
          {notice ? (
            <p
              className={
                notice.kind === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"
              }
            >
              {notice.text}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={submitting || length < 2 || length > 1000 || (turnstileEnabled && !token)}
          className="button-primary w-full sm:w-auto sm:min-w-32"
        >
          {submitting ? <span className="loading-mark" aria-hidden="true" /> : null}
          {submitting ? "正在提交…" : "匿名提交"}
        </button>
      </div>
    </form>
  );
}
