import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">ページが見つかりません</h1>
      <p className="mt-4 text-slate-600">
        お探しの催事またはページは存在しません。
      </p>
      <Link href="/" className="mt-8 inline-block text-teal-700 underline underline-offset-4">
        催事一覧へ戻る
      </Link>
    </main>
  );
}
