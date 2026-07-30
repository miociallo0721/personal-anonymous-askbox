"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Status = "unread" | "read" | "replied" | "ignored" | "spam";
type Question = {
  id: number;
  content: string;
  status: Status;
  ipHash: string;
  spamScore: number;
  isBlocked: boolean;
  telegramNotified: boolean;
  telegramMessageId: number | null;
  telegramError: string | null;
  createdAt: string;
  repliedAt: string | null;
};
type BlockedSource = { id: number; ipHash: string; reason: string; createdAt: string };

const statusLabels: Record<Status, string> = {
  unread: "未读",
  read: "已读",
  replied: "已回复",
  ignored: "忽略",
  spam: "垃圾信息",
};
const statuses = Object.keys(statusLabels) as Status[];
const statusBadgeClasses: Record<Status, string> = {
  unread: "badge-accent",
  read: "badge-neutral",
  replied: "badge-success",
  ignored: "badge-neutral",
  spam: "badge-danger",
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(new Date(value));
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = (await response.json()) as T & { ok?: boolean; error?: string };
  if (response.status === 401) {
    window.location.assign("/admin/login");
    throw new Error("会话已过期");
  }
  if (!response.ok || !data.ok) throw new Error(data.error ?? "操作失败");
  return data;
}

export function AdminDashboard({ initialQuestionId }: { initialQuestionId?: number }) {
  const router = useRouter();
  const [items, setItems] = useState<Question[]>([]);
  const [blocked, setBlocked] = useState<BlockedSource[]>([]);
  const [status, setStatus] = useState<Status | "">("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set("status", status);
      if (search) params.set("q", search);
      const [questionData, blockedData, requestedQuestion] = await Promise.all([
        api<{ ok: true; items: Question[]; total: number }>(`/api/admin/questions?${params}`),
        api<{ ok: true; items: BlockedSource[] }>("/api/admin/blocked"),
        initialQuestionId
          ? api<{ ok: true; item: Question }>(`/api/admin/questions/${initialQuestionId}`).catch(
              () => null,
            )
          : Promise.resolve(null),
      ]);
      setItems(
        requestedQuestion &&
          !questionData.items.some((item) => item.id === requestedQuestion.item.id)
          ? [requestedQuestion.item, ...questionData.items]
          : questionData.items,
      );
      setTotal(questionData.total);
      setBlocked(blockedData.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [initialQuestionId, page, search, status]);

  useEffect(() => {
    // Initial and filter-driven remote data synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!initialQuestionId || loading) return;
    document.getElementById(`question-${initialQuestionId}`)?.scrollIntoView({ block: "start" });
  }, [initialQuestionId, loading]);

  async function mutate(url: string, options: RequestInit, success: string) {
    try {
      await api(url, options);
      setMessage(success);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(query.trim());
  }

  async function logout() {
    await api("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  async function deleteQuestion(id: number) {
    if (!window.confirm(`确定删除问题 #${id}？删除后无法从后台恢复。`)) return;
    await mutate(`/api/admin/questions/${id}`, { method: "DELETE" }, "问题已删除");
  }

  async function deleteSpam() {
    if (!window.confirm("确定批量删除当前所有垃圾信息？")) return;
    await mutate("/api/admin/questions/bulk-spam", { method: "DELETE" }, "垃圾信息已批量删除");
  }

  return (
    <main className="mx-auto min-h-dvh max-w-7xl px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--border)] pb-6">
        <div>
          <p className="eyebrow">ASKBOX ADMIN</p>
          <h1 className="type-heading mt-4">问题管理</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <a href="/" target="_blank" className="button-secondary no-underline">
            查看前台
          </a>
          <button onClick={() => void logout()} className="button-quiet">
            退出登录
          </button>
        </div>
      </header>

      <section className="surface mt-7 p-4 sm:p-5">
        <form
          onSubmit={submitSearch}
          className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_auto_auto_auto]"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索问题内容"
            aria-label="搜索问题内容"
            className="field min-w-0 px-3.5 py-2.5 text-sm"
          />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as Status | "");
              setPage(1);
            }}
            aria-label="按状态筛选"
            className="field min-w-36 px-3.5 py-2.5 text-sm"
          >
            <option value="">全部状态</option>
            {statuses.map((item) => (
              <option value={item} key={item}>
                {statusLabels[item]}
              </option>
            ))}
          </select>
          <button className="button-primary">搜索</button>
          <button type="button" onClick={() => void deleteSpam()} className="button-danger">
            清空垃圾信息
          </button>
        </form>
      </section>

      <div className="mt-5 flex min-h-6 items-center justify-between border-b border-[var(--border)] pb-3">
        <span className="type-caption uppercase">共 {total} 条</span>
        <span role="status" className="text-xs text-[var(--foreground)]">
          {message}
        </span>
      </div>

      <section className="mt-4 space-y-3.5" aria-busy={loading}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--muted)]">
            <span className="loading-mark" aria-hidden="true" />
            正在加载…
          </div>
        ) : null}
        {!loading && items.length === 0 ? (
          <div className="surface py-16 text-center">
            <p className="type-body">没有符合条件的问题</p>
          </div>
        ) : null}
        {items.map((question) => (
          <article
            id={`question-${question.id}`}
            key={question.id}
            className={`surface scroll-mt-5 p-4 sm:p-5 ${
              question.id === initialQuestionId ? "border-[var(--accent)]" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-[var(--muted)]">
              <strong className="font-editorial text-sm font-normal text-[var(--foreground)]">
                #{question.id}
              </strong>
              <span>{formatTime(question.createdAt)}</span>
              <span className={`badge ${statusBadgeClasses[question.status]}`}>
                {statusLabels[question.status]}
              </span>
              <span>垃圾评分 {question.spamScore}</span>
              <span
                className={`badge ${question.telegramNotified ? "badge-success" : "badge-danger"}`}
              >
                Telegram{" "}
                {question.telegramNotified
                  ? `已发送 · ${question.telegramMessageId ?? "-"}`
                  : "未发送"}
              </span>
            </div>
            <p className="mt-5 max-w-4xl whitespace-pre-wrap break-words text-[15px] leading-7.5 sm:text-base">
              {question.content}
            </p>
            {question.telegramError ? (
              <p className="mt-3 break-all text-xs text-[var(--danger)]">
                最近错误：{question.telegramError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
              {statuses.map((nextStatus) => (
                <button
                  key={nextStatus}
                  disabled={question.status === nextStatus}
                  onClick={() =>
                    void mutate(
                      `/api/admin/questions/${question.id}`,
                      {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ status: nextStatus }),
                      },
                      `问题 #${question.id} 已标记为${statusLabels[nextStatus]}`,
                    )
                  }
                  className="button-secondary min-h-8 px-2.5 py-1.5 text-xs disabled:bg-[var(--surface-muted)]"
                >
                  {statusLabels[nextStatus]}
                </button>
              ))}
              <button
                onClick={() =>
                  void mutate(
                    `/api/admin/questions/${question.id}/retry-telegram`,
                    { method: "POST" },
                    "Telegram 通知已发送",
                  )
                }
                className="button-secondary min-h-8 px-2.5 py-1.5 text-xs"
              >
                重发通知
              </button>
              <button
                disabled={blocked.some((item) => item.ipHash === question.ipHash)}
                onClick={() =>
                  void mutate(
                    "/api/admin/blocked",
                    {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        ipHash: question.ipHash,
                        reason: `由问题 #${question.id} 封禁`,
                      }),
                    },
                    "来源已封禁",
                  )
                }
                className="button-secondary min-h-8 px-2.5 py-1.5 text-xs"
              >
                {blocked.some((item) => item.ipHash === question.ipHash)
                  ? "来源已封禁"
                  : "封禁来源"}
              </button>
              <button
                onClick={() => void deleteQuestion(question.id)}
                className="button-danger ml-auto min-h-8 px-2.5 py-1.5 text-xs"
              >
                删除
              </button>
            </div>
          </article>
        ))}
      </section>

      {total > 30 ? (
        <nav className="mt-6 flex items-center justify-center gap-3 text-sm" aria-label="分页">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="button-secondary"
          >
            上一页
          </button>
          <span>
            第 {page} / {Math.ceil(total / 30)} 页
          </span>
          <button
            disabled={page >= Math.ceil(total / 30)}
            onClick={() => setPage((value) => value + 1)}
            className="button-secondary"
          >
            下一页
          </button>
        </nav>
      ) : null}

      <section className="mt-14 border-t border-[var(--border)] pt-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="type-section">已封禁来源</h2>
          </div>
          <span className="badge badge-neutral">{blocked.length} 条</span>
        </div>
        <div className="surface mt-4 overflow-x-auto">
          {blocked.length === 0 ? (
            <p className="p-5 text-sm text-[var(--muted)]">暂无封禁记录</p>
          ) : (
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="bg-[var(--surface-muted)] text-[var(--muted)]">
                <tr>
                  <th className="p-3 font-medium">来源哈希</th>
                  <th className="p-3 font-medium">原因</th>
                  <th className="p-3 font-medium">时间</th>
                  <th className="p-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {blocked.map((source) => (
                  <tr
                    key={source.id}
                    className="border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-muted)]"
                  >
                    <td className="max-w-60 truncate p-3 font-mono" title={source.ipHash}>
                      {source.ipHash}
                    </td>
                    <td className="p-3">{source.reason}</td>
                    <td className="p-3">{formatTime(source.createdAt)}</td>
                    <td className="p-3">
                      <button
                        onClick={() =>
                          void mutate(
                            `/api/admin/blocked/${source.id}`,
                            { method: "DELETE" },
                            "来源已解除封禁",
                          )
                        }
                        className="button-quiet p-0 text-[var(--accent)]"
                      >
                        解除封禁
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
