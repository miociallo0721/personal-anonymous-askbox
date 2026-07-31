import type { CSSProperties, ReactElement } from "react";

import {
  getShareCardTypography,
  SHARE_CARD_FORMATS,
  SHARE_CARD_FONT_FAMILY,
  SHARE_CARD_THEMES,
  type ShareCardAspect,
  type ShareCardData,
  type ShareCardThemeName,
} from "@/lib/share-card";

type Props = {
  data: ShareCardData;
  aspect: ShareCardAspect;
  themeName?: ShareCardThemeName;
};

function TextBlock({ children, style }: { children: string; style: CSSProperties }): ReactElement {
  return (
    <div
      lang="zh-CN"
      style={{
        display: "flex",
        width: "100%",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function ShareCard({ data, aspect, themeName = "paper" }: Props): ReactElement {
  const theme = SHARE_CARD_THEMES[themeName];
  const format = SHARE_CARD_FORMATS[aspect];
  const typography = getShareCardTypography(aspect, data);
  const tall = aspect === "9:16";

  return (
    <div
      lang="zh-CN"
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        padding: `${format.paddingY}px ${format.paddingX}px`,
        backgroundColor: theme.background,
        color: theme.foreground,
        fontFamily: SHARE_CARD_FONT_FAMILY,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: tall ? 62 : 48,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 21,
            fontWeight: 400,
            letterSpacing: "0.06em",
            color: theme.foreground,
          }}
        >
          Anonymous Ask Box
        </div>
        <div
          aria-hidden="true"
          style={{
            display: "flex",
            width: 26,
            height: 2,
            backgroundColor: theme.accent,
            opacity: 0.72,
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          minHeight: 0,
          flex: 1,
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: tall ? "center" : "flex-start",
            paddingTop: tall ? 72 : 42,
            paddingBottom: tall ? 88 : 62,
          }}
        >
          <TextBlock
            style={{
              fontSize: typography.questionSize,
              fontWeight: 400,
              letterSpacing: "-0.025em",
              lineHeight: 1.42,
            }}
          >
            {data.question}
          </TextBlock>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderTop: `1px solid ${theme.border}`,
            paddingTop: tall ? 54 : 42,
            paddingBottom: tall ? 62 : 46,
          }}
        >
          <TextBlock
            style={{
              fontSize: typography.answerSize,
              fontWeight: 400,
              letterSpacing: "-0.008em",
              lineHeight: 1.72,
              color: theme.foreground,
            }}
          >
            {data.answer}
          </TextBlock>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          paddingTop: 22,
          borderTop: `1px solid ${theme.border}`,
          color: theme.muted,
          fontSize: 18,
          fontWeight: 400,
          letterSpacing: "0.035em",
        }}
      >
        <div style={{ display: "flex" }}>ask.akiyamamio.one</div>
      </div>
    </div>
  );
}
