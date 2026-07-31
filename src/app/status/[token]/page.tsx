import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import Link from "next/link";

import { db } from "@/db/client";
import { formatShanghaiTime } from "@/lib/time";
import { getQuestionStatusByToken } from "@/services/question-status";
import { consumeStatusAccess } from "@/services/status-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "提问状态",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-[52rem] flex-col sm:min-h-[calc(100dvh-3.5rem)]">
        <header className="rule-subtle flex items-center justify-between border-b pb-3">
          <p className="font-editorial text-[15px] tracking-[-0.01em]">ANONYMOUS ASK BOX</p>
          <span className="h-px w-5 bg-[var(--accent)] opacity-80" aria-hidden="true" />
        </header>
        <div className="flex flex-1 items-center py-12 sm:py-16">{children}</div>
        <footer className="rule-subtle border-t pt-4 text-[11px] leading-5 text-[var(--muted)]">
          <p>此页面仅限持有私密链接的人访问，请勿公开分享链接。</p>
        </footer>
      </div>
    </main>
  );
}

function InvalidStatusPage() {
  return (
    <PageFrame>
      <section className="w-full max-w-xl">
        <p className="eyebrow">Private status</p>
        <h1 className="type-heading mt-5">链接无效或已失效</h1>
        <p className="type-body mt-5">请检查你保存的完整链接，然后重新打开。</p>
        <Link href="/" className="button-secondary mt-8 no-underline">
          返回提问箱
        </Link>
      </section>
    </PageFrame>
  );
}

async function loadPrivateStatus(token: string) {
  try {
    const requestHeaders = await headers();
    const rateLimit = consumeStatusAccess(requestHeaders);
    if (!rateLimit.allowed) return null;

    return getQuestionStatusByToken(db, token);
  } catch {
    console.error("[question-status-page] status lookup failed");
    return null;
  }
}

export default async function StatusPage({ params }: Props) {
  const token = (await params).token;
  const status = await loadPrivateStatus(token);
  if (!status) return <InvalidStatusPage />;

  const repliedAt = status.question.repliedAt ?? status.answer?.updatedAt ?? null;

  return (
    <PageFrame>
      <article className="w-full">
        <div className="max-w-2xl">
          <p className="eyebrow">Private status</p>
          <div className="mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <h1 className="type-heading">{status.state === "answered" ? "已回复" : "已收到"}</h1>
            <span
              className={`badge ${status.state === "answered" ? "badge-success" : "badge-neutral"}`}
            >
              {status.state === "answered" ? "Answered" : "Received"}
            </span>
          </div>

          {status.state === "received" ? (
            <p className="type-body mt-5">你的问题正在等待回复。</p>
          ) : null}

          <dl className="rule-subtle mt-8 border-t pt-6 text-sm">
            <div className="flex flex-wrap justify-between gap-3">
              <dt className="text-[var(--muted)]">提交于</dt>
              <dd className="m-0 tabular-nums">{formatShanghaiTime(status.question.createdAt)}</dd>
            </div>
            {repliedAt ? (
              <div className="mt-3 flex flex-wrap justify-between gap-3">
                <dt className="text-[var(--muted)]">回复于</dt>
                <dd className="m-0 tabular-nums">{formatShanghaiTime(repliedAt)}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {status.answer ? (
          <div className="mt-12 grid gap-9 sm:mt-16 sm:gap-12">
            <section className="rule-subtle border-t pt-7">
              <h2 className="type-section">问题</h2>
              <p className="mt-4 whitespace-pre-wrap break-words text-base leading-8">
                {status.question.content}
              </p>
            </section>
            <section className="rule-subtle border-t pt-7">
              <h2 className="type-section">回答</h2>
              <p className="mt-4 whitespace-pre-wrap break-words text-base leading-8">
                {status.answer.content}
              </p>
            </section>
          </div>
        ) : null}

        {status.cards.length > 0 ? (
          <section className="rule-subtle mt-12 border-t pt-7 sm:mt-16">
            <h2 className="type-section">分享卡片</h2>
            <div className="mt-6 grid gap-8 sm:grid-cols-2">
              {status.cards.map((card) => {
                const cardPath = `/api/status/${token}/card?aspect=${encodeURIComponent(card.aspect)}`;
                return (
                  <figure key={card.aspect} className="m-0">
                    <div className="surface overflow-hidden p-3">
                      <Image
                        src={cardPath}
                        alt={`${card.aspect} 分享卡片预览`}
                        width={card.width}
                        height={card.height}
                        unoptimized
                        className="h-auto w-full border border-[var(--border)]"
                      />
                    </div>
                    <figcaption className="mt-3 flex items-center justify-between gap-4">
                      <span className="type-caption tabular-nums">
                        {card.aspect} · {card.width} × {card.height}
                      </span>
                      <a
                        href={`${cardPath}&download=1`}
                        className="button-secondary button-compact no-underline"
                        download
                      >
                        下载 PNG
                      </a>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        ) : null}
      </article>
    </PageFrame>
  );
}
