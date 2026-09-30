import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "催事予約",
  description: "催事の予約・キャンセルを行うアプリケーション",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
