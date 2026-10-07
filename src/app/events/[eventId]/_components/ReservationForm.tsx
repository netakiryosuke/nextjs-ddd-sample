"use client";

import { useActionState } from "react";
import { cancelAction, reserveAction } from "../actions";

type ReservationFormState = {
  reservationId: string | null;
  message: string;
  hasError: boolean;
};

export function ReservationForm({
  eventId,
  isReservable,
  hasStarted,
}: {
  eventId: string;
  isReservable: boolean;
  hasStarted: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    async (previousState: ReservationFormState): Promise<ReservationFormState> => {
      const result =
        previousState.reservationId === null
          ? await reserveAction(eventId)
          : await cancelAction(previousState.reservationId);

      if (!result.success) {
        return { ...previousState, message: result.message, hasError: true };
      }

      return {
        reservationId: result.reservationId,
        message: result.message,
        hasError: false,
      };
    },
    { reservationId: null, message: "", hasError: false },
  );

  return (
    <section
      aria-labelledby="reservation-heading"
      className="mt-8 border-t border-slate-200 pt-8"
    >
      <h2 id="reservation-heading" className="text-lg font-semibold">
        予約
      </h2>
      <p className="mt-3 text-sm text-slate-600">
        {state.reservationId === null
          ? "1回の予約で1席を確保します。"
          : "この催事を予約しています。"}
        キャンセルは催事の開始前まで可能です。
      </p>
      <form action={formAction} className="mt-5">
        <button
          type="submit"
          disabled={
            isPending ||
            (state.reservationId === null ? !isReservable : hasStarted)
          }
          className="rounded-lg bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? "処理中…"
            : state.reservationId === null
              ? "予約する"
              : "予約をキャンセルする"}
        </button>
      </form>
      <p
        role={state.hasError ? "alert" : "status"}
        className={`mt-4 text-sm ${state.hasError ? "text-red-700" : "text-teal-800"}`}
      >
        {state.message}
      </p>
    </section>
  );
}
