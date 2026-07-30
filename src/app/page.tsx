import { QuestionForm } from "@/components/question-form";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const turnstileEnabled = process.env.TURNSTILE_ENABLED !== "false";
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  return (
    <main className="min-h-dvh px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl flex-col sm:min-h-[calc(100dvh-3.5rem)]">
        <header className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <p className="font-editorial text-[15px] tracking-[-0.01em] text-[var(--foreground)]">
            ANONYMOUS ASK BOX
          </p>
          <span className="h-px w-8 bg-[var(--accent)]" aria-hidden="true" />
        </header>

        <section className="quiet-in grid flex-1 items-center gap-10 py-10 md:grid-cols-[0.92fr_1.08fr] md:gap-14 lg:gap-24 lg:py-14">
          <div className="max-w-lg md:pb-10">
            <h1 className="type-hero mt-6">有什么想问澪的吗？</h1>
            <p className="type-body mt-6 max-w-sm">
              无需登录，也不需要留下名字。请友善地写下你的问题。
            </p>
          </div>

          <div className="surface p-5 sm:p-7 lg:p-9">
            <QuestionForm turnstileEnabled={turnstileEnabled} siteKey={siteKey} />
          </div>
        </section>

        <footer className="border-t border-[var(--border)] pt-4 text-[11px] leading-5 text-[var(--muted)]">
          <p>仅保存经过单向处理的来源特征，不保存原始 IP 或浏览器信息。</p>
        </footer>
      </div>
    </main>
  );
}
