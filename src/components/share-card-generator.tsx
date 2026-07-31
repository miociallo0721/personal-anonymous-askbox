"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";

import { SHARE_CARD_ASPECTS, SHARE_CARD_FORMATS, type ShareCardAspect } from "@/lib/share-card";

type Props = {
  question: {
    id: number;
    content: string;
    answer: string;
  };
};

type Notice = { kind: "error" | "success"; text: string } | null;

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("读取失败")),
    );
    reader.addEventListener("error", () => reject(new Error("读取失败")));
    reader.readAsDataURL(blob);
  });
}

export function ShareCardGenerator({ question }: Props) {
  const [answer, setAnswer] = useState(question.answer);
  const [aspect, setAspect] = useState<ShareCardAspect>("4:5");
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const answerLength = Array.from(answer).length;
  const format = SHARE_CARD_FORMATS[aspect];

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (generating) return;
    if (answerLength < 2 || answerLength > 600) {
      setNotice({ kind: "error", text: "请输入 2 至 600 个字符的回答。" });
      return;
    }

    setGenerating(true);
    setNotice(null);
    try {
      const saveResponse = await fetch(`/api/admin/questions/${question.id}/answer`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: answer }),
      });
      if (!saveResponse.ok) {
        const data = (await saveResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "回答保存失败，请稍后重试。");
      }

      const response = await fetch(`/api/admin/questions/${question.id}/share-card`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aspect, theme: "paper" }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "图片生成失败，请稍后重试。");
      }
      const image = await blobToDataUrl(await response.blob());
      setImageUrl(image);
      setNotice({ kind: "success", text: "PNG 已生成。" });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "图片生成失败，请稍后重试。",
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <form
      onSubmit={generate}
      className="grid gap-8 py-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(22rem,1.14fr)] lg:gap-12"
    >
      <section>
        <div>
          <p className="type-caption uppercase">问题 #{question.id}</p>
          <p className="mt-3 whitespace-pre-wrap break-words text-base leading-7">
            {question.content}
          </p>
        </div>

        <div className="rule-subtle mt-8 border-t pt-7">
          <label htmlFor="share-answer" className="type-section block">
            回答
          </label>
          <textarea
            id="share-answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={8}
            maxLength={600}
            disabled={generating}
            placeholder="写下要展示在分享卡片上的回答……"
            className="field mt-4 min-h-52 resize-y px-5 py-4 text-base leading-7"
          />
          <div className="mt-3 flex items-center justify-between gap-4">
            <span className="type-caption">回答会安全保存，并用于后续重新生成</span>
            <span className="type-caption tabular-nums">{answerLength} / 600</span>
          </div>
        </div>

        <fieldset className="rule-subtle mt-8 border-t pt-7">
          <legend className="text-sm font-medium">画面比例</legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SHARE_CARD_ASPECTS.map((item) => (
              <label key={item} className="relative">
                <input
                  type="radio"
                  name="share-card-aspect"
                  value={item}
                  checked={aspect === item}
                  onChange={() => setAspect(item)}
                  disabled={generating}
                  className="peer sr-only"
                />
                <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent text-sm text-[var(--muted)] transition-colors duration-200 peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent-soft)] peer-checked:text-[var(--foreground)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                  {item}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-8">
          <button
            type="submit"
            disabled={generating || answerLength < 2 || answerLength > 600}
            className="button-primary w-full sm:w-auto sm:min-w-36"
          >
            {generating ? <span className="loading-mark" aria-hidden="true" /> : null}
            {generating ? "正在生成…" : "生成 PNG"}
          </button>
          <div className="mt-3 min-h-6 text-sm leading-6" role="status" aria-live="polite">
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
        </div>
      </section>

      <section className="lg:sticky lg:top-8 lg:self-start" aria-label="分享卡片预览">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium">PNG 预览</h2>
          <span className="type-caption tabular-nums">
            {format.width} × {format.height}
          </span>
        </div>
        <div
          className="surface flex w-full items-center justify-center overflow-hidden p-4 sm:p-6"
          style={{ minHeight: "28rem" }}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={`问题 #${question.id} 的 ${aspect} 分享卡片预览`}
              width={format.width}
              height={format.height}
              unoptimized
              className="max-h-[70dvh] w-auto max-w-full border border-[var(--border)] object-contain"
            />
          ) : (
            <div
              className="flex max-h-[62dvh] w-full max-w-sm items-center justify-center border border-[var(--border)] bg-[var(--background)] px-8 text-center text-sm leading-6 text-[var(--muted)]"
              style={{ aspectRatio: aspect.replace(":", " / ") }}
            >
              选择比例并生成后，将在这里显示 PNG 预览。
            </div>
          )}
        </div>
        {imageUrl ? (
          <a
            href={imageUrl}
            download={`askbox-${question.id}-${aspect.replace(":", "x")}.png`}
            className="button-secondary mt-4 w-full no-underline"
          >
            下载 PNG
          </a>
        ) : null}
      </section>
    </form>
  );
}
