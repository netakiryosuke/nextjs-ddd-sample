"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function Error({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">催事情報を取得できませんでした</h1>
      <p role="alert" className="mt-4 text-slate-600">
        時間をおいて、もう一度お試しください。
      </p>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          // 境界のリセットだけではServer Componentの取得を再実行できない。
          startTransition(() => {
            router.refresh();
            reset();
          });
        }}
        className="mt-8 rounded-lg bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 disabled:opacity-60"
      >
        {isPending ? "再取得中…" : "再試行する"}
      </button>
    </main>
  );
}
