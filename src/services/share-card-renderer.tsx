import { ImageResponse } from "next/og";

import { ShareCard } from "@/components/share-card";
import {
  SHARE_CARD_FORMATS,
  type ShareCardAspect,
  type ShareCardData,
  type ShareCardThemeName,
} from "@/lib/share-card";

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
  version: "image-response-v1",
  async render(input) {
    const format = SHARE_CARD_FORMATS[input.aspect];
    const response = new ImageResponse(
      ShareCard({
        data: input.data,
        aspect: input.aspect,
        themeName: input.theme,
      }),
      { width: format.width, height: format.height },
    );

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mimeType: "image/png",
      pageNumber: 1,
      pageCount: 1,
    };
  },
};
