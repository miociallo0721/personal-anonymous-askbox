import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "澪的匿名提问箱", template: "%s · 匿名提问箱" },
  description: "一个安静、简单的个人匿名提问箱。",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1917" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
