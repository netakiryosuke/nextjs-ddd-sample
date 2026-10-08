import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { EventApplicationService } from "@/application/EventApplicationService";
import { ReservationApplicationService } from "@/application/ReservationApplicationService";
import { container } from "@/di/container";
import { formatEventDateTime } from "../../_lib/formatEventDateTime";
import { ReservationForm } from "./_components/ReservationForm";
import { loginAction } from "../../actions";

export default async function EventDetailPage({
  params,
}: PageProps<"/events/[eventId]">) {
  await connection();

  const { eventId } = await params;
  const eventApplicationService = container.get(EventApplicationService);
  const eventAvailability = await eventApplicationService.lookup(eventId);

  if (eventAvailability === null) {
    notFound();
  }

  const event = eventAvailability.event;
  const session = await auth();
  const reservationApplicationService = container.get(
    ReservationApplicationService,
  );
  const reservation = session?.user.id
    ? await reservationApplicationService.lookup(event.id, session.user.id)
    : null;
  const now = new Date();
  const hasStarted = event.hasStarted(now);
  const isFull = eventAvailability.isFull();
  const availabilityLabel = hasStarted ? "受付終了" : isFull ? "満席" : "空席あり";
  const availabilityColor = hasStarted
    ? "bg-slate-100 text-slate-600"
    : isFull
      ? "bg-amber-50 text-amber-800"
      : "bg-teal-50 text-teal-800";

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
      <Link
        href="/events"
        className="rounded-sm text-sm font-medium text-teal-700 underline underline-offset-4 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
      >
        ← 催事一覧へ戻る
      </Link>

      <article className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
        <p className="text-sm font-semibold tracking-widest text-teal-700">催事詳細</p>
        <h1 className="mt-3 text-3xl font-bold leading-snug tracking-tight sm:text-4xl">
          {event.title}
        </h1>

        <dl className="mt-8 grid gap-4 sm:grid-cols-[5rem_1fr] sm:gap-x-8 sm:gap-y-5">
          <dt className="font-medium text-slate-500">開始日時</dt>
          <dd>
            <time dateTime={event.period.startTime.toISOString()}>
              {formatEventDateTime(event.period.startTime)}
            </time>
          </dd>
          <dt className="font-medium text-slate-500">終了日時</dt>
          <dd>
            <time dateTime={event.period.endTime.toISOString()}>
              {formatEventDateTime(event.period.endTime)}
            </time>
          </dd>
          <dt className="font-medium text-slate-500">会場</dt>
          <dd>{event.venueName}</dd>
          <dt className="font-medium text-slate-500">定員</dt>
          <dd>{event.capacity}人</dd>
        </dl>

        <section
          aria-labelledby="availability-heading"
          className="mt-10 border-t border-slate-200 pt-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="availability-heading" className="text-lg font-semibold">
              空き状況
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${availabilityColor}`}
            >
              {availabilityLabel}
            </span>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 p-5">
              <dt className="text-sm text-slate-600">予約数</dt>
              <dd className="mt-2 text-2xl font-semibold">
                {eventAvailability.reservationCount}
                <span className="ml-1 text-sm font-normal">人</span>
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-5">
              <dt className="text-sm text-slate-600">残席</dt>
              <dd className="mt-2 text-2xl font-semibold">
                {eventAvailability.remainingSeats()}
                <span className="ml-1 text-sm font-normal">席</span>
              </dd>
            </div>
          </dl>
          {hasStarted && (
            <p className="mt-4 text-sm text-slate-600">
              開始時刻を過ぎたため、予約受付は終了しています。
            </p>
          )}
        </section>
        {session ? (
          <ReservationForm
            key={`${event.id}:${session.user.id}`}
            eventId={event.id}
            initialReservationId={reservation?.id ?? null}
            isReservable={eventAvailability.isReservable(now)}
            hasStarted={hasStarted}
          />
        ) : (
          <section
            aria-labelledby="reservation-heading"
            className="mt-8 border-t border-slate-200 pt-8"
          >
            <h2 id="reservation-heading" className="text-lg font-semibold">
              予約
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              予約するにはログインしてください。
            </p>
            <form
              action={loginAction.bind(null, `/events/${event.id}`)}
              className="mt-5"
            >
              <button
                type="submit"
                className="rounded-lg bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
              >
                ログインして予約する
              </button>
            </form>
          </section>
        )}
      </article>
      <p className="mt-6 text-xs text-slate-500">日時はすべて日本時間（JST）です。</p>
    </main>
  );
}
