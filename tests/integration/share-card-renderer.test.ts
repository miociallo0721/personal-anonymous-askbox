import { describe, expect, it } from "vitest";

import { imageResponseCardRenderer } from "@/services/share-card-renderer";

describe("server-side share-card renderer", () => {
  it("exports a real high-DPI PNG for multilingual persisted content", async () => {
    const rendered = await imageResponseCardRenderer.render({
      data: {
        question: "最近、心に残った静かな瞬間は？🙂",
        answer: "傍晚的风吹进来时，房间忽然安静了一会儿。",
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
});
