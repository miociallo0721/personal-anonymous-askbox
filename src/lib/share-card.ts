export const SHARE_CARD_ASPECTS = ["1:1", "4:5", "9:16"] as const;
export type ShareCardAspect = (typeof SHARE_CARD_ASPECTS)[number];

export const SHARE_CARD_THEME_NAMES = ["paper"] as const;
export type ShareCardThemeName = (typeof SHARE_CARD_THEME_NAMES)[number];

export type ShareCardData = {
  question: string;
  answer: string;
};

export const SHARE_CARD_FONT_FAMILY =
  '"Inter", "Noto Sans CJK SC", "Noto Sans Symbols", "Noto Sans Symbols 2", "Noto Sans Math", "DejaVu Sans"';

export type ShareCardTheme = {
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  accent: string;
};

export type ShareCardFormat = {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
  questionSize: number;
  answerSize: number;
};

export const SHARE_CARD_THEMES: Record<ShareCardThemeName, ShareCardTheme> = {
  paper: {
    background: "#F7F5F2",
    surface: "#FCFBF8",
    foreground: "#2D2A26",
    muted: "#7B756D",
    border: "#E7E2D9",
    accent: "#C98D5A",
  },
};

export const SHARE_CARD_FORMATS: Record<ShareCardAspect, ShareCardFormat> = {
  "1:1": {
    width: 1200,
    height: 1200,
    paddingX: 96,
    paddingY: 84,
    questionSize: 64,
    answerSize: 31,
  },
  "4:5": {
    width: 1200,
    height: 1500,
    paddingX: 104,
    paddingY: 96,
    questionSize: 68,
    answerSize: 32,
  },
  "9:16": {
    width: 1080,
    height: 1920,
    paddingX: 92,
    paddingY: 104,
    questionSize: 66,
    answerSize: 32,
  },
};

function textUnits(value: string) {
  return Array.from(value).reduce((total, character) => {
    if (character === "\n") return total + 8;
    return total + (/[\u0000-\u00ff]/.test(character) ? 0.58 : 1);
  }, 0);
}

function sizeForLength(base: number, units: number, kind: "question" | "answer") {
  const thresholds: ReadonlyArray<readonly [number, number]> =
    kind === "question"
      ? [
          [48, 1],
          [90, 0.88],
          [160, 0.74],
          [260, 0.61],
          [420, 0.5],
          [Number.POSITIVE_INFINITY, 0.4],
        ]
      : [
          [120, 1],
          [240, 0.87],
          [420, 0.74],
          [650, 0.65],
          [Number.POSITIVE_INFINITY, 0.56],
        ];
  const scale = thresholds.find(([limit]) => units <= limit)?.[1] ?? 1;
  return Math.round(base * scale);
}

export function getShareCardTypography(
  aspect: ShareCardAspect,
  data: ShareCardData,
): { questionSize: number; answerSize: number } {
  const format = SHARE_CARD_FORMATS[aspect];
  const questionUnits = textUnits(data.question);
  const answerUnits = textUnits(data.answer);
  const weightedTotal = questionUnits + answerUnits * 0.72;
  const capacity = aspect === "1:1" ? 820 : aspect === "4:5" ? 1080 : 1480;
  const combinedScale =
    weightedTotal > capacity ? Math.max(0.72, Math.sqrt(capacity / weightedTotal)) : 1;

  return {
    questionSize: Math.max(
      20,
      Math.round(sizeForLength(format.questionSize, questionUnits, "question") * combinedScale),
    ),
    answerSize: Math.max(
      15,
      Math.round(sizeForLength(format.answerSize, answerUnits, "answer") * combinedScale),
    ),
  };
}
