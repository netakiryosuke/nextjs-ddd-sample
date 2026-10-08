import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { loginAction, logoutAction } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "催事予約",
  description: "催事の予約・キャンセルを行うアプリケーション",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();

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
            className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-5"
          >
            <Link href="/" className="text-lg font-bold tracking-tight text-teal-800">
              催事予約
            </Link>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Link
                href="/events"
                className="font-medium text-slate-600 hover:text-teal-700"
              >
                催事一覧
              </Link>
              {session ? (
                <>
                  <span>{session.user.name ?? "ログイン中"}</span>
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="rounded-sm font-medium text-teal-700 underline underline-offset-4 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
                    >
                      ログアウト
                    </button>
                  </form>
                </>
              ) : (
                <form action={loginAction.bind(null, "/events")}>
                  <button
                    type="submit"
                    className="rounded-sm font-medium text-teal-700 underline underline-offset-4 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
                  >
                    ログイン
                  </button>
                </form>
              )}
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
