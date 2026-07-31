import { describe, expect, it } from "vitest";
import satori from "satori";

import { ShareCard } from "@/components/share-card";
import { imageResponseCardRenderer } from "@/services/share-card-renderer";
import { loadShareCardFonts } from "@/services/share-card-fonts";

describe("server-side share-card renderer", () => {
  const unicodeSamples = [
    "你好",
    "Ciallo～(∠・ω< )⌒★",
    "こんにちは",
    "Hello ★",
    "测试 ❤️",
  ] as const;

  it.each(unicodeSamples)("exports a PNG without dropping Unicode input: %s", async (text) => {
    const rendered = await imageResponseCardRenderer.render({
      data: {
        question: text,
        answer: text,
      },
      aspect: "1:1",
      theme: "paper",
    });

    expect(rendered.mimeType).toBe("image/png");
    expect(rendered.bytes.byteLength).toBeGreaterThan(10_000);
    expect(Array.from(rendered.bytes.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(rendered).toMatchObject({ pageNumber: 1, pageCount: 1 });
  });

  it("covers visible multilingual glyphs with bundled fonts", async () => {
    const missingAssets: Array<{ language: string; segment: string }> = [];
    const fonts = await loadShareCardFonts();

    await satori(
      ShareCard({
        data: {
          question: "你好 Ciallo～(∠・ω< )⌒★",
          answer: "こんにちは Hello ★ 测试 ❤",
        },
        aspect: "1:1",
        themeName: "paper",
      }),
      {
        width: 1200,
        height: 1200,
        fonts,
        loadAdditionalAsset: async (language, segment) => {
          missingAssets.push({ language, segment });
          return [];
        },
      },
    );

    expect(missingAssets).toEqual([]);
  });

  it("renders the emoji variation selector without an extra missing-glyph box", async () => {
    const emojiPresentation = await imageResponseCardRenderer.render({
      data: { question: "测试 ❤️", answer: "测试 ❤️" },
      aspect: "1:1",
      theme: "paper",
    });
    const textPresentation = await imageResponseCardRenderer.render({
      data: { question: "测试 ❤", answer: "测试 ❤" },
      aspect: "1:1",
      theme: "paper",
    });

    expect(Buffer.from(emojiPresentation.bytes)).toEqual(Buffer.from(textPresentation.bytes));
  });
});
