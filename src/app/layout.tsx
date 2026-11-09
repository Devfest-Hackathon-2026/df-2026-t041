import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ビラ・POPメーカー",
  description: "飲食店向けのビラ・POPを、料理写真と短い日本語の指示から作成・編集・書き出しできるツール",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        {/* Flyer fonts are fetched on demand from Google Fonts (see src/lib/fonts.ts). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="h-full min-h-full flex flex-col bg-[var(--bg)] text-[var(--fg)]">{children}</body>
    </html>
  );
}
