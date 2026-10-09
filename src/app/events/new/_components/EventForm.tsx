"use client";

import { useActionState } from "react";
import { createEventAction, type EventActionResult } from "../actions";

export function EventForm({ venues }: { venues: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(
    async (_previousState: EventActionResult | null, formData: FormData) =>
      createEventAction(formData),
    null,
  );

  const inputClassName =
    "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-teal-700";

  return (
    <form
      action={formAction}
      className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
    >
      <div>
        <label htmlFor="title" className="font-medium">催事名</label>
        <input id="title" name="title" required className={inputClassName} />
      </div>
      <div>
        <label htmlFor="venueId" className="font-medium">会場</label>
        <select
          id="venueId"
          name="venueId"
          required
          defaultValue=""
          className={inputClassName}
        >
          <option value="" disabled>会場を選択してください</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>{venue.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="startTime" className="font-medium">開始日時</label>
        <input
          id="startTime"
          name="startTime"
          type="datetime-local"
          required
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="endTime" className="font-medium">終了日時</label>
        <input
          id="endTime"
          name="endTime"
          type="datetime-local"
          required
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="capacity" className="font-medium">定員（人）</label>
        <input
          id="capacity"
          name="capacity"
          type="number"
          min="1"
          step="1"
          required
          className={inputClassName}
        />
      </div>
      {venues.length === 0 && <p className="text-sm text-slate-600">登録済みの会場がありません。</p>}
      <button
        type="submit"
        disabled={isPending || venues.length === 0}
        className="rounded-lg bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "作成中…" : "作成する"}
      </button>
      {state && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
    </form>
  );
}
