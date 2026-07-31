import { readFile } from "node:fs/promises";
import path from "node:path";

const fontDefinitions = [
  {
    file: "Inter-Regular.ttf",
    name: "Inter",
  },
  {
    file: "NotoSansCJKsc-Regular.otf",
    name: "Noto Sans CJK SC",
  },
  {
    file: "NotoSansSymbols-Regular.ttf",
    name: "Noto Sans Symbols",
  },
  {
    file: "NotoSansSymbols2-Regular.ttf",
    name: "Noto Sans Symbols 2",
  },
  {
    file: "NotoSansMath-Regular.ttf",
    name: "Noto Sans Math",
  },
  {
    file: "DejaVuSans.ttf",
    name: "DejaVu Sans",
  },
] as const;

export type ShareCardFont = {
  data: Buffer;
  name: (typeof fontDefinitions)[number]["name"];
  weight: 400;
  style: "normal";
};

let fontsPromise: Promise<ShareCardFont[]> | undefined;

export function loadShareCardFonts(): Promise<ShareCardFont[]> {
  fontsPromise ??= Promise.all(
    fontDefinitions.map(async ({ file, name }) => ({
      data: await readFile(path.join(process.cwd(), "public", "fonts", "share-card", file)),
      name,
      weight: 400 as const,
      style: "normal" as const,
    })),
  );

  return fontsPromise;
}
