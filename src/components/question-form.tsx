"use client";

import { useCallback, useState, type FormEvent } from "react";

import { TurnstileWidget } from "@/components/turnstile-widget";

type Props = { turnstileEnabled: boolean; siteKey: string };
type Notice = { kind: "success" | "error"; text: string } | null;
type StatusLink = { path: string; url: string } | null;

const statusPathPattern = /^\/status\/[A-Za-z0-9_-]{32}$/;

export function QuestionForm({ turnstileEnabled, siteKey }: Props) {
  const [content, setContent] = useState("");
  const [website, setWebsite] = useState("");
  const [token, setToken] = useState("");
  const [widgetKey, setWidgetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [statusLink, setStatusLink] = useState<StatusLink>(null);
  const [copyNotice, setCopyNotice] = useState("");
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
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        statusPath?: string;
      };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "提交失败，请稍后重试。");
      if (!data.statusPath || !statusPathPattern.test(data.statusPath)) {
        throw new Error("状态链接生成失败，请稍后重试。");
      }
      const absoluteStatusUrl = new URL(data.statusPath, window.location.origin).toString();
      setContent("");
      setWebsite("");
      setStatusLink({ path: data.statusPath, url: absoluteStatusUrl });
      setCopyNotice("");
      setNotice(null);
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

  async function copyStatusLink() {
    if (!statusLink) return;
    try {
      await navigator.clipboard.writeText(statusLink.url);
      setCopyNotice("链接已复制。");
    } catch {
      setCopyNotice("复制失败，请手动选择并保存链接。");
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

      {statusLink ? (
        <section
          className="rule-subtle mt-7 border-t pt-7"
          aria-labelledby="submission-success-title"
        >
          <h2 id="submission-success-title" className="type-section">
            问题已收到
          </h2>
          <p className="type-body mt-3">
            请保存此链接。你可以稍后通过它查看回复，我们无法在链接丢失后帮你找回。
          </p>
          <label htmlFor="status-link" className="type-caption mt-5 block">
            私密状态链接
          </label>
          <input
            id="status-link"
            value={statusLink.url}
            readOnly
            className="field mt-2 px-3 py-2 text-sm"
            onFocus={(event) => event.currentTarget.select()}
          />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={copyStatusLink}
              className="button-secondary w-full sm:w-auto"
            >
              复制状态链接
            </button>
            <a href={statusLink.path} className="button-primary w-full no-underline sm:w-auto">
              查看状态
            </a>
          </div>
          <p className="mt-2 min-h-5 text-xs leading-5 text-[var(--muted)]" role="status">
            {copyNotice}
          </p>
        </section>
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
