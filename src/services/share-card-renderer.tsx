import satori from "satori";
import sharp from "sharp";

import { ShareCard } from "@/components/share-card";
import {
  SHARE_CARD_FORMATS,
  type ShareCardAspect,
  type ShareCardData,
  type ShareCardThemeName,
} from "@/lib/share-card";
import { loadShareCardFonts } from "@/services/share-card-fonts";

export type ShareCardRenderInput = {
  data: ShareCardData;
  aspect: ShareCardAspect;
  theme: ShareCardThemeName;
};

export type RenderedShareCard = {
  bytes: Uint8Array;
  mimeType: "image/png";
  pageNumber: number;
  pageCount: number;
};

export interface ShareCardRenderer {
  readonly version: string;
  render(input: ShareCardRenderInput): Promise<RenderedShareCard>;
}

export const imageResponseCardRenderer: ShareCardRenderer = {
  version: "satori-sharp-v2-unicode-fonts",
  async render(input) {
    const format = SHARE_CARD_FORMATS[input.aspect];
    const fonts = await loadShareCardFonts();
    const svg = await satori(
      ShareCard({
        data: input.data,
        aspect: input.aspect,
        themeName: input.theme,
      }),
      {
        width: format.width,
        height: format.height,
        fonts,
      },
    );
    const png = await sharp(Buffer.from(svg)).resize(format.width, format.height).png().toBuffer();

    return {
      bytes: Uint8Array.from(png),
      mimeType: "image/png",
      pageNumber: 1,
      pageCount: 1,
    };
  },
};
