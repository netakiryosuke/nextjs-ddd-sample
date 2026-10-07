import Link from "next/link";
import { connection } from "next/server";
import { EventApplicationService } from "@/application/EventApplicationService";
import { container } from "@/di/container";
import { formatEventDateTime } from "../_lib/formatEventDateTime";

export default async function EventListPage() {
  // ビルド時にDBへ接続せず、閲覧時点の開催情報を取得する。
  await connection();

  const eventApplicationService = container.get(EventApplicationService);
  const events = await eventApplicationService.list();

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
      <div className="mb-8">
        <p className="mb-3 text-sm font-semibold tracking-widest text-teal-700">
          催事を探す
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">催事一覧</h1>
        <p className="mt-4 text-slate-600">
          気になる催事の開催情報と空き状況をご確認ください。
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold">現在、催事はありません</h2>
          <p className="mt-3 text-sm text-slate-600">
            新しい催事の公開をお待ちください。
          </p>
        </div>
      ) : (
        <ul className="space-y-5">
          {events.map((event) => (
            <li key={event.id}>
              <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                <h2 className="text-xl font-semibold">
                  <Link
                    href={`/events/${encodeURIComponent(event.id)}`}
                    className="rounded-sm text-slate-900 underline decoration-teal-200 underline-offset-4 hover:decoration-teal-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
                  >
                    {event.title}
                  </Link>
                </h2>
                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-[5rem_1fr] sm:gap-x-6 sm:gap-y-3">
                  <dt className="font-medium text-slate-500">開催日時</dt>
                  <dd className="leading-7">
                    <time dateTime={event.period.startTime.toISOString()}>
                      {formatEventDateTime(event.period.startTime)}
                    </time>
                    <span className="mx-2">〜</span>
                    <time dateTime={event.period.endTime.toISOString()}>
                      {formatEventDateTime(event.period.endTime)}
                    </time>
                  </dd>
                  <dt className="font-medium text-slate-500">会場</dt>
                  <dd>{event.venueName}</dd>
                  <dt className="font-medium text-slate-500">定員</dt>
                  <dd>{event.capacity}人</dd>
                </dl>
              </article>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-slate-500">日時はすべて日本時間（JST）です。</p>
    </main>
  );
}
