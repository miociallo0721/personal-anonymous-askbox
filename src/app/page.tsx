import { QuestionForm } from "@/components/question-form";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const turnstileEnabled = process.env.TURNSTILE_ENABLED !== "false";
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  return (
    <main className="home-page min-h-dvh px-5 pt-5 sm:px-8 sm:pt-7 lg:px-12">
      <div className="home-shell mx-auto flex w-full max-w-[68rem] flex-col">
        <header className="rule-subtle flex items-center justify-between border-b pb-3">
          <p className="font-editorial text-[15px] tracking-[-0.01em] text-[var(--foreground)]">
            ANONYMOUS ASK BOX
          </p>
          <span className="h-px w-5 bg-[var(--accent)] opacity-80" aria-hidden="true" />
        </header>

        <section className="grid flex-1 items-center gap-12 py-12 md:grid-cols-[0.92fr_1.08fr] md:gap-16 lg:gap-20">
          <div className="max-w-lg md:pb-10">
            <h1 className="type-hero mt-4">有什么想问澪的吗？</h1>
            <p className="type-body mt-5 max-w-sm">
              无需登录，也不需要留下名字。请友善地写下你的问题。
            </p>
          </div>

          <div className="askbox-surface surface p-4 sm:p-5 lg:p-8">
            <QuestionForm turnstileEnabled={turnstileEnabled} siteKey={siteKey} />
          </div>
        </section>

        <footer className="home-footer rule-subtle border-t text-[11px] leading-5 text-[var(--muted)]">
          <p>仅保存经过单向处理的来源特征，不保存原始 IP 或浏览器信息。</p>
        </footer>
      </div>
    </main>
  );
}
