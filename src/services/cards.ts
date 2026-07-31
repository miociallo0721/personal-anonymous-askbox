import { createHash } from "node:crypto";

import type { createDatabase } from "@/db/client";
import { cards, type Answer, type Question } from "@/db/schema";
import {
  SHARE_CARD_FORMATS,
  type ShareCardAspect,
  type ShareCardThemeName,
} from "@/lib/share-card";
import {
  imageResponseCardRenderer,
  type RenderedShareCard,
  type ShareCardRenderer,
} from "@/services/share-card-renderer";

type DatabaseClient = ReturnType<typeof createDatabase>["db"];

export type ExportShareCardInput = {
  question: Pick<Question, "id" | "content">;
  answer: Pick<Answer, "id" | "content">;
  aspect: ShareCardAspect;
  theme: ShareCardThemeName;
  now?: Date;
};

export type ExportedShareCard = RenderedShareCard & {
  card: typeof cards.$inferSelect;
};

export async function exportShareCard(
  database: DatabaseClient,
  input: ExportShareCardInput,
  renderer: ShareCardRenderer = imageResponseCardRenderer,
): Promise<ExportedShareCard> {
  const format = SHARE_CARD_FORMATS[input.aspect];
  const rendered = await renderer.render({
    data: {
      question: input.question.content.trim(),
      answer: input.answer.content.trim(),
    },
    aspect: input.aspect,
    theme: input.theme,
  });
  const contentHash = createHash("sha256").update(rendered.bytes).digest("hex");
  const card = database
    .insert(cards)
    .values({
      answerId: input.answer.id,
      aspect: input.aspect,
      theme: input.theme,
      width: format.width,
      height: format.height,
      mimeType: rendered.mimeType,
      byteSize: rendered.bytes.byteLength,
      contentHash,
      rendererVersion: renderer.version,
      pageNumber: rendered.pageNumber,
      pageCount: rendered.pageCount,
      createdAt: input.now ?? new Date(),
    })
    .returning()
    .get();

  return { ...rendered, card };
}
