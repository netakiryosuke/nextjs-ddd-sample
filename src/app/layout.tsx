import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "催事予約",
  description: "催事の予約・キャンセルを行うアプリケーション",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:block focus:p-4"
        >
          本文へ移動
        </a>
        <header className="border-b border-slate-200 bg-white">
          <nav
            aria-label="メインナビゲーション"
            className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5"
          >
            <Link href="/" className="text-lg font-bold tracking-tight text-teal-800">
              催事予約
            </Link>
            <Link href="/events" className="text-sm font-medium text-slate-600 hover:text-teal-700">
              催事一覧
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
