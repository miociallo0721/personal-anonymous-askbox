"use client";

import { useEffect, useRef } from "react";

type TurnstileSize = "compact" | "flexible";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme: "auto";
          size: TurnstileSize;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type Props = { siteKey: string; onToken: (token: string) => void };

const flexibleMinWidth = 300;
const flexibleMinViewportWidth = 375;

export function TurnstileWidget({ siteKey, onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId: string | undefined;
    let renderedSize: TurnstileSize | undefined;
    let resizeFrame: number | undefined;
    let scriptElement: HTMLScriptElement | null = null;
    let cancelled = false;

    const removeWidget = () => {
      if (!widgetId || !window.turnstile) return;
      window.turnstile.remove(widgetId);
      widgetId = undefined;
    };

    const render = () => {
      const container = containerRef.current;
      if (cancelled || !container) return;

      const availableWidth = container.parentElement?.clientWidth ?? container.clientWidth;
      const size: TurnstileSize =
        window.innerWidth >= flexibleMinViewportWidth && availableWidth >= flexibleMinWidth
          ? "flexible"
          : "compact";
      container.dataset.turnstileSize = size;
      if (!window.turnstile || (widgetId && renderedSize === size)) return;

      if (widgetId) {
        removeWidget();
        onToken("");
      }

      widgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        theme: "auto",
        size,
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
      renderedSize = size;
    };

    const scheduleRender = () => {
      if (cancelled) return;
      if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = undefined;
        render();
      });
    };

    render();
    const resizeObserver = new ResizeObserver(scheduleRender);
    const sizingElement = containerRef.current?.parentElement ?? containerRef.current;
    if (sizingElement) resizeObserver.observe(sizingElement);
    window.addEventListener("resize", scheduleRender);

    if (window.turnstile) {
      scheduleRender();
    } else {
      const existing = document.querySelector<HTMLScriptElement>("script[data-askbox-turnstile]");
      if (existing) {
        scriptElement = existing;
        scriptElement.addEventListener("load", scheduleRender, { once: true });
      } else {
        scriptElement = document.createElement("script");
        scriptElement.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        scriptElement.async = true;
        scriptElement.defer = true;
        scriptElement.dataset.askboxTurnstile = "true";
        scriptElement.addEventListener("load", scheduleRender, { once: true });
        document.head.appendChild(scriptElement);
      }
    }

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleRender);
      scriptElement?.removeEventListener("load", scheduleRender);
      if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame);
      removeWidget();
    };
  }, [onToken, siteKey]);

  return <div ref={containerRef} className="turnstile-region" aria-label="人机验证" />;
}
